import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/ApiError";
import {
  AssignmentLegType,
  AssignmentStatus,
  ShipmentStatus,
} from "../../../generated/prisma/client";
import { transitionStatusInTx } from "../shipment/shipment.transition";
import {
  LeastLoadedInZoneStrategy,
  AnyAvailableCourierStrategy,
} from "./courier.assignment-strategy";
import {
  calculateLegEarning,
  PICKUP_LEG_SHARE,
  DELIVERY_LEG_SHARE,
} from "./courier.constant";
import { PaymentService } from "../payment/payment.service";
import { NotificationService } from "../notification/notification.service";

const LEG_PRECONDITION: Record<AssignmentLegType, ShipmentStatus> = {
  [AssignmentLegType.PICKUP]: ShipmentStatus.PICKUP_SCHEDULED,
  [AssignmentLegType.DELIVERY]: ShipmentStatus.AT_DESTINATION_HUB,
  [AssignmentLegType.RETURN_PICKUP]: ShipmentStatus.RETURN_INITIATED,
  [AssignmentLegType.RETURN_DELIVERY]: ShipmentStatus.RETURN_IN_TRANSIT,
};

/**
 * Assigns a courier to one leg of a shipment's journey and advances the
 * shipment's status in the same transaction. Candidate selection and the
 * claim are separated so a race between two ops users assigning the same
 * courier to different shipments at the same instant can't over-book
 * them: we try each candidate's atomic `updateMany` claim in order and
 * move to the next one if it's already taken.
 */
const assignCourierToShipment = async (params: {
  shipmentId: string;
  legType: AssignmentLegType;
  actorId: string;
  preferredCourierId?: string;
}) => {
  return prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.findUnique({
      where: { id: params.shipmentId },
    });
    if (!shipment) throw ApiError.notFound("Shipment not found.");

    const requiredStatus = LEG_PRECONDITION[params.legType];
    if (shipment.status !== requiredStatus) {
      throw ApiError.conflict(
        `Shipment must be in status ${requiredStatus} to assign a ${params.legType} courier (currently ${shipment.status}).`,
      );
    }

    const targetZoneId =
      params.legType === AssignmentLegType.PICKUP ||
      params.legType === AssignmentLegType.RETURN_DELIVERY
        ? shipment.originZoneId
        : shipment.destinationZoneId;

    let claimedCourierId: string | null = null;

    if (params.preferredCourierId) {
      const claimed = await tx.courierProfile.updateMany({
        where: { id: params.preferredCourierId, isAvailable: true },
        data: { activeParcelCount: { increment: 1 } },
      });
      if (claimed.count === 0) {
        throw ApiError.conflict(
          "The requested courier is not currently available.",
        );
      }
      claimedCourierId = params.preferredCourierId;
    } else {
      let candidates = await LeastLoadedInZoneStrategy.getCandidates(tx, {
        organizationId: shipment.organizationId,
        zoneId: targetZoneId,
      });
      if (candidates.length === 0) {
        candidates = await AnyAvailableCourierStrategy.getCandidates(tx, {
          organizationId: shipment.organizationId,
          zoneId: targetZoneId,
        });
      }

      for (const candidate of candidates) {
        const claimed = await tx.courierProfile.updateMany({
          where: { id: candidate.id, isAvailable: true },
          data: { activeParcelCount: { increment: 1 } },
        });
        if (claimed.count === 1) {
          claimedCourierId = candidate.id;
          break;
        }
        // else: another concurrent request claimed this courier first — try the next candidate.
      }
    }

    if (!claimedCourierId) {
      throw ApiError.conflict(
        "No available courier could be found for this leg right now.",
      );
    }

    const assignment = await tx.courierAssignment.create({
      data: {
        shipmentId: shipment.id,
        courierId: claimedCourierId,
        legType: params.legType,
        status: AssignmentStatus.ASSIGNED,
      },
    });

    const nextStatus =
      params.legType === AssignmentLegType.PICKUP
        ? ShipmentStatus.COURIER_ASSIGNED
        : params.legType === AssignmentLegType.DELIVERY
          ? ShipmentStatus.OUT_FOR_DELIVERY
          : shipment.status; // return legs are transitioned separately by the return workflow

    if (nextStatus !== shipment.status) {
      await transitionStatusInTx(tx, {
        shipmentId: shipment.id,
        toStatus: nextStatus,
        actorId: params.actorId,
        note: `${params.legType} courier assigned`,
      });
    }

    return tx.courierAssignment.findUniqueOrThrow({
      where: { id: assignment.id },
      include: { courier: { include: { user: true } } },
    });
  });
};

const acceptAssignment = async (
  assignmentId: string,
  courierUserId: string,
) => {
  const assignment = await prisma.courierAssignment.findUnique({
    where: { id: assignmentId },
    include: { courier: true },
  });
  if (!assignment) throw ApiError.notFound("Assignment not found.");
  if (assignment.courier.userId !== courierUserId) {
    throw ApiError.forbidden("This assignment does not belong to you.");
  }
  if (assignment.status !== AssignmentStatus.ASSIGNED) {
    throw ApiError.conflict(`Assignment is already ${assignment.status}.`);
  }

  return prisma.courierAssignment.update({
    where: { id: assignmentId },
    data: { status: AssignmentStatus.ACCEPTED, acceptedAt: new Date() },
  });
};

/** Courier confirms they've physically picked up the parcel from the customer. */
const completePickupLeg = async (
  assignmentId: string,
  courierUserId: string,
) => {
  return prisma.$transaction(async (tx) => {
    const assignment = await getOwnedAssignment(
      tx,
      assignmentId,
      courierUserId,
      AssignmentLegType.PICKUP,
    );

    await tx.courierAssignment.update({
      where: { id: assignmentId },
      data: { status: AssignmentStatus.IN_PROGRESS },
    });

    return transitionStatusInTx(tx, {
      shipmentId: assignment.shipmentId,
      toStatus: ShipmentStatus.PICKED_UP,
      actorId: courierUserId,
      note: "Courier picked up parcel from sender",
      extraData: { pickedUpAt: new Date() },
    });
  });
};

/**
 * Hub manager/hub scan confirms the parcel physically arrived at the
 * origin hub. This — not the courier's "picked up" tap — is what
 * completes the pickup assignment and pays out the pickup-leg earning,
 * so a courier can't collect payment for a parcel that never made it in.
 */
const confirmArrivalAtOriginHub = async (params: {
  shipmentId: string;
  hubId: string;
  actorId: string;
}) => {
  const result = await prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.findUnique({
      where: { id: params.shipmentId },
    });
    if (!shipment) throw ApiError.notFound("Shipment not found.");
    if (shipment.originHubId !== params.hubId) {
      throw ApiError.badRequest(
        "This shipment's origin hub does not match the scanning hub.",
      );
    }

    const updated = await transitionStatusInTx(tx, {
      shipmentId: shipment.id,
      toStatus: ShipmentStatus.AT_ORIGIN_HUB,
      actorId: params.actorId,
      note: "Parcel received at origin hub",
      location: params.hubId,
      currentHubId: params.hubId,
    });

    const assignment = await tx.courierAssignment.findFirst({
      where: {
        shipmentId: shipment.id,
        legType: AssignmentLegType.PICKUP,
        status: AssignmentStatus.IN_PROGRESS,
      },
    });

    if (assignment) {
      await completeAssignmentAndPayInTx(
        tx,
        assignment.id,
        shipment.price,
        PICKUP_LEG_SHARE,
      );
    }

    return updated;
  });

  void NotificationService.notify({
    userId: result.customerId,
    title: "Your parcel reached the origin hub",
    body: `Tracking ${result.trackingId} is now at the origin hub and will move to the destination city soon.`,
    meta: { shipmentId: result.id, trackingId: result.trackingId },
  });

  return result;
};

/** Courier confirms final delivery to the receiver (e.g. after OTP/signature capture on the app). */
const completeDeliveryLeg = async (
  assignmentId: string,
  courierUserId: string,
  codCollected?: boolean,
) => {
  const result = await prisma.$transaction(async (tx) => {
    const assignment = await getOwnedAssignment(
      tx,
      assignmentId,
      courierUserId,
      AssignmentLegType.DELIVERY,
    );
    const shipment = await tx.shipment.findUniqueOrThrow({
      where: { id: assignment.shipmentId },
    });

    const updated = await transitionStatusInTx(tx, {
      shipmentId: shipment.id,
      toStatus: ShipmentStatus.DELIVERED,
      actorId: courierUserId,
      note: "Delivered to receiver",
      extraData: { deliveredAt: new Date() },
    });

    await completeAssignmentAndPayInTx(
      tx,
      assignmentId,
      shipment.price,
      DELIVERY_LEG_SHARE,
    );

    return { updated, shipment };
  });

  if (
    result.shipment.codAmount > 0 &&
    codCollected &&
    result.shipment.paymentId
  ) {
    await PaymentService.markCollectedAsCod(result.shipment.paymentId);
  }

  void NotificationService.notify({
    userId: result.shipment.customerId,
    title: "Parcel delivered",
    body: `Tracking ${result.shipment.trackingId} has been delivered.`,
    meta: {
      shipmentId: result.shipment.id,
      trackingId: result.shipment.trackingId,
    },
  });

  return result.updated;
};

/** Courier reports they could not complete a pickup or delivery attempt. */
const failLeg = async (
  assignmentId: string,
  courierUserId: string,
  reason: string,
) => {
  return prisma.$transaction(async (tx) => {
    const assignment = await tx.courierAssignment.findUnique({
      where: { id: assignmentId },
      include: { courier: true },
    });
    if (!assignment) throw ApiError.notFound("Assignment not found.");
    if (assignment.courier.userId !== courierUserId) {
      throw ApiError.forbidden("This assignment does not belong to you.");
    }

    await tx.courierAssignment.update({
      where: { id: assignmentId },
      data: {
        status: AssignmentStatus.FAILED,
        failureReason: reason,
        completedAt: new Date(),
      },
    });

    // Free up the courier immediately so they can be re-assigned elsewhere.
    await tx.courierProfile.update({
      where: { id: assignment.courierId },
      data: { activeParcelCount: { decrement: 1 } },
    });

    const failStatus =
      assignment.legType === AssignmentLegType.PICKUP
        ? ShipmentStatus.PICKUP_FAILED
        : ShipmentStatus.DELIVERY_FAILED;

    return transitionStatusInTx(tx, {
      shipmentId: assignment.shipmentId,
      toStatus: failStatus,
      actorId: courierUserId,
      note: reason,
    });
  });
};

/** Admin/ops provisions a courier profile for an existing user with the COURIER role. */
const createProfile = async (
  organizationId: string,
  payload: {
    userId: string;
    homeHubId?: string;
    currentZoneId?: string;
    vehicleType: string;
    capacityKg: number;
  },
) => {
  const user = await prisma.user.findFirst({
    where: { id: payload.userId, organizationId },
  });
  if (!user)
    throw ApiError.badRequest("User must belong to your organization.");
  if (user.role !== "COURIER")
    throw ApiError.badRequest("User must have the COURIER role.");

  const existing = await prisma.courierProfile.findUnique({
    where: { userId: payload.userId },
  });
  if (existing)
    throw ApiError.conflict("This user already has a courier profile.");

  return prisma.courierProfile.create({ data: { ...payload, organizationId } });
};

const setAvailability = async (
  courierUserId: string,
  payload: { isAvailable: boolean; currentZoneId?: string },
) => {
  const profile = await prisma.courierProfile.findUnique({
    where: { userId: courierUserId },
  });
  if (!profile)
    throw ApiError.notFound("No courier profile found for this user.");

  return prisma.courierProfile.update({
    where: { id: profile.id },
    data: payload,
  });
};

const getMyAssignments = async (courierUserId: string) => {
  const profile = await prisma.courierProfile.findUnique({
    where: { userId: courierUserId },
  });
  if (!profile)
    throw ApiError.notFound("No courier profile found for this user.");

  return prisma.courierAssignment.findMany({
    where: { courierId: profile.id },
    include: {
      shipment: { include: { senderAddress: true, receiverAddress: true } },
    },
    orderBy: { assignedAt: "desc" },
  });
};

const getMyEarnings = async (courierUserId: string) => {
  const profile = await prisma.courierProfile.findUnique({
    where: { userId: courierUserId },
  });
  if (!profile)
    throw ApiError.notFound("No courier profile found for this user.");

  const [earnings, summary] = await Promise.all([
    prisma.courierEarning.findMany({
      where: { courierId: profile.id },
      include: { shipment: { select: { trackingId: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.courierEarning.groupBy({
      by: ["status"],
      where: { courierId: profile.id },
      _sum: { amount: true },
    }),
  ]);

  return { earnings, summary };
};

// --- internal helpers -------------------------------------------------

async function getOwnedAssignment(
  tx: any,
  assignmentId: string,
  courierUserId: string,
  expectedLeg: AssignmentLegType,
) {
  const assignment = await tx.courierAssignment.findUnique({
    where: { id: assignmentId },
    include: { courier: true },
  });
  if (!assignment) throw ApiError.notFound("Assignment not found.");
  if (assignment.courier.userId !== courierUserId) {
    throw ApiError.forbidden("This assignment does not belong to you.");
  }
  if (assignment.legType !== expectedLeg) {
    throw ApiError.badRequest(
      `Expected a ${expectedLeg} assignment, got ${assignment.legType}.`,
    );
  }
  if (
    assignment.status !== AssignmentStatus.ASSIGNED &&
    assignment.status !== AssignmentStatus.ACCEPTED
  ) {
    throw ApiError.conflict(`Assignment is already ${assignment.status}.`);
  }
  return assignment;
}

async function completeAssignmentAndPayInTx(
  tx: any,
  assignmentId: string,
  shipmentPrice: number,
  legShare: number,
) {
  const assignment = await tx.courierAssignment.update({
    where: { id: assignmentId },
    data: { status: AssignmentStatus.COMPLETED, completedAt: new Date() },
  });

  await tx.courierProfile.update({
    where: { id: assignment.courierId },
    data: { activeParcelCount: { decrement: 1 } },
  });

  await tx.courierEarning.create({
    data: {
      courierId: assignment.courierId,
      shipmentId: assignment.shipmentId,
      assignmentId: assignment.id,
      amount: calculateLegEarning(shipmentPrice, legShare),
      status: "PENDING",
    },
  });
}

export const CourierService = {
  createProfile,
  setAvailability,
  assignCourierToShipment,
  acceptAssignment,
  completePickupLeg,
  confirmArrivalAtOriginHub,
  completeDeliveryLeg,
  failLeg,
  getMyAssignments,
  getMyEarnings,
};

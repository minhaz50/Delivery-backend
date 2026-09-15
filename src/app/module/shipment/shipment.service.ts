import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/ApiError";
import { ShipmentStatus, ServiceLevel } from "../../../generated/prisma";
import { generateTrackingId } from "./shipment.constant";
import { transitionStatus, transitionStatusInTx } from "./shipment.transition";import { PricingService } from "../pricing/pricing.service";
import { PaymentService } from "../payment/payment.service";
import { NotificationService } from "../notification/notification.service";
import type { IAddressInput, ICreateShipmentPayload, IUpdateShipmentPayload } from "./shipment.interface";

const resolveDefaultHubForZone = async (tx: any, organizationId: string, zoneId: string) => {
  const hub = await tx.hub.findFirst({ where: { organizationId, zoneId, isActive: true } });
  if (!hub) {
    throw ApiError.badRequest(
      "No active hub is configured for one of the given zones yet. An ops manager needs to set one up first.",
    );
  }
  return hub;
};

const createAddressInTx = (tx: any, userId: string | undefined, input: IAddressInput) =>
  tx.address.create({ data: { ...input, userId } });

const createShipment = async (
  customerId: string,
  organizationId: string,
  payload: ICreateShipmentPayload,
) => {
  const [senderZone, receiverZone] = await Promise.all([
    prisma.zone.findFirst({ where: { id: payload.senderAddress.zoneId, organizationId } }),
    prisma.zone.findFirst({ where: { id: payload.receiverAddress.zoneId, organizationId } }),
  ]);
  if (!senderZone) throw ApiError.badRequest("Sender address zone is invalid for this organization.");
  if (!receiverZone) throw ApiError.badRequest("Receiver address zone is invalid for this organization.");

  const serviceLevel = payload.serviceLevel ?? ServiceLevel.STANDARD;

  const quote = await PricingService.calculatePrice(organizationId, {
    originZoneId: senderZone.id,
    destinationZoneId: receiverZone.id,
    weightKg: payload.weightKg,
    serviceLevel,
  });

  const shipment = await prisma.$transaction(async (tx) => {
    const originHub = await resolveDefaultHubForZone(tx, organizationId, senderZone.id);
    const destinationHub = await resolveDefaultHubForZone(tx, organizationId, receiverZone.id);

    const senderAddress = await createAddressInTx(tx, customerId, payload.senderAddress);
    const receiverAddress = await createAddressInTx(tx, undefined, payload.receiverAddress);

    const { payment, redirectUrl } = await PaymentService.createPaymentInTx(tx, {
      organizationId,
      amount: quote.price,
      method: payload.paymentMethod,
    });

    let trackingId = generateTrackingId();
    // Extremely unlikely collision given the keyspace, but guard anyway.
    while (await tx.shipment.findUnique({ where: { trackingId } })) {
      trackingId = generateTrackingId();
    }

    const created = await tx.shipment.create({
      data: {
        trackingId,
        organizationId,
        customerId,
        senderAddressId: senderAddress.id,
        receiverAddressId: receiverAddress.id,
        originZoneId: senderZone.id,
        destinationZoneId: receiverZone.id,
        originHubId: originHub.id,
        destinationHubId: destinationHub.id,
        weightKg: payload.weightKg,
        lengthCm: payload.lengthCm,
        widthCm: payload.widthCm,
        heightCm: payload.heightCm,
        declaredValue: payload.declaredValue,
        codAmount: payload.paymentMethod === "COD" ? 0 : (payload.codAmount ?? 0),
        serviceLevel,
        description: payload.description,
        price: quote.price,
        paymentId: payment.id,
        status: ShipmentStatus.CREATED,
      },
    });

    await tx.shipmentEvent.create({
      data: {
        shipmentId: created.id,
        status: ShipmentStatus.CREATED,
        note: "Shipment created",
        actorId: customerId,
      },
    });

    return { shipment: created, payment, redirectUrl };
  });

  void NotificationService.notify({
    userId: customerId,
    title: "Shipment created",
    body: `Your shipment ${shipment.shipment.trackingId} has been created. Estimated cost: ${quote.price} ${quote.currency}.`,
    meta: { shipmentId: shipment.shipment.id, trackingId: shipment.shipment.trackingId },
  });

  return { ...shipment, quote };
};

const schedulePickup = async (shipmentId: string, actorId: string, pickupScheduledAt?: Date) => {
  return transitionStatus({
    shipmentId,
    toStatus: ShipmentStatus.PICKUP_SCHEDULED,
    actorId,
    note: "Pickup scheduled",
    extraData: { pickupScheduledAt: pickupScheduledAt ?? new Date() },
  });
};

const cancelShipment = async (shipmentId: string, actorId: string, reason?: string) => {
  const result = await transitionStatus({
    shipmentId,
    toStatus: ShipmentStatus.CANCELLED,
    actorId,
    note: reason ?? "Cancelled",
    extraData: { cancelledAt: new Date() },
  });

  if (result.paymentId) {
    const payment = await prisma.payment.findUnique({ where: { id: result.paymentId } });
    if (payment?.status === "PAID") {
      await PaymentService.refund(payment.id);
    }
  }

  return result;
};

const initiateReturn = async (shipmentId: string, actorId: string, reason: string) => {
  return prisma.$transaction(async (tx) => {
    const updated = await transitionStatusInTx(tx, {
      shipmentId,
      toStatus: ShipmentStatus.RETURN_INITIATED,
      actorId,
      note: `Return initiated: ${reason}`,
    });
    await tx.returnRequest.create({ data: { shipmentId, reason } });
    return updated;
  });
};

const markReturnInTransit = async (shipmentId: string, actorId: string) =>
  transitionStatus({
    shipmentId,
    toStatus: ShipmentStatus.RETURN_IN_TRANSIT,
    actorId,
    note: "Return shipment picked up, heading back to sender",
  });

const markReturnedToSender = async (shipmentId: string, actorId: string) => {
  return prisma.$transaction(async (tx) => {
    const updated = await transitionStatusInTx(tx, {
      shipmentId,
      toStatus: ShipmentStatus.RETURNED_TO_SENDER,
      actorId,
      note: "Returned to sender",
    });
    await tx.returnRequest.update({
      where: { shipmentId },
      data: { status: "COMPLETED", resolvedAt: new Date() },
    });
    return updated;
  });
};

const getById = async (id: string) => {
  const shipment = await prisma.shipment.findFirst({
    where: { id, isDeleted: false },
    include: {
      senderAddress: true,
      receiverAddress: true,
      originHub: true,
      destinationHub: true,
      currentHub: true,
      payment: true,
      assignments: { include: { courier: { include: { user: true } } } },
      events: { orderBy: { createdAt: "asc" } },
      returnRequest: true,
    },
  });
  if (!shipment) throw ApiError.notFound("Shipment not found.");
  return shipment;
};

/**
 * Narrow, non-structural edit — see IUpdateShipmentPayload for why
 * addresses/weight/zones/price aren't here. Locked to the pre-dispatch
 * window (before a courier is assigned) so an edit can never land after
 * a courier or hub has already acted on the old values.
 */
const updateShipment = async (id: string, payload: IUpdateShipmentPayload) => {
  const shipment = await prisma.shipment.findFirst({ where: { id, isDeleted: false } });
  if (!shipment) throw ApiError.notFound("Shipment not found.");

  const editableStatuses: ShipmentStatus[] = [ShipmentStatus.CREATED, ShipmentStatus.PICKUP_SCHEDULED];
  if (!editableStatuses.includes(shipment.status)) {
    throw ApiError.conflict(
      `Shipment details can only be edited before a courier is assigned (currently ${shipment.status}).`,
    );
  }

  const data: Record<string, unknown> = {};
  if (payload.description !== undefined) data.description = payload.description;
  if (payload.declaredValue !== undefined) data.declaredValue = payload.declaredValue;
  if (payload.codAmount !== undefined) data.codAmount = payload.codAmount;

  if (Object.keys(data).length === 0) {
    throw ApiError.badRequest("Provide at least one editable field (description, declaredValue, codAmount).");
  }

  return prisma.shipment.update({ where: { id }, data });
};

/**
 * Ops/admin manual override — see updateShipmentStatusValidation for why
 * this exists alongside the action-specific endpoints. Blocked for any
 * transition normally driven by a courier-assignment side effect
 * (COURIER_ASSIGNED, PICKED_UP, OUT_FOR_DELIVERY, DELIVERED) to avoid
 * silently creating a status the assignment/earning records don't agree
 * with — those must go through their real endpoints. Everything else
 * (hub scans, transit, returns, corrections) is fair game as long as the
 * state machine allows the jump.
 */
const BLOCKED_MANUAL_STATUSES: ShipmentStatus[] = [
  ShipmentStatus.COURIER_ASSIGNED,
  ShipmentStatus.PICKED_UP,
  ShipmentStatus.OUT_FOR_DELIVERY,
  ShipmentStatus.DELIVERED,
];

const forceUpdateStatus = async (
  shipmentId: string,
  toStatus: ShipmentStatus,
  actorId: string,
  note?: string,
  location?: string,
) => {
  if (BLOCKED_MANUAL_STATUSES.includes(toStatus)) {
    throw ApiError.badRequest(
      `${toStatus} must be set via its dedicated endpoint (courier assignment/completion), not a manual status update.`,
    );
  }
  return transitionStatus({
    shipmentId,
    toStatus,
    actorId,
    note: note ?? `Manually set to ${toStatus} by ops`,
    location,
  });
};

/**
 * Soft delete: hides the record from normal listing/search while
 * preserving it (and its ShipmentEvent/Payment history) for audit
 * purposes. Restricted to shipments that are CREATED or already
 * CANCELLED — nothing physically in motion can be "deleted", only
 * cancelled through the proper state-machine path first.
 */
const softDelete = async (id: string, actorId: string) => {
  const shipment = await prisma.shipment.findFirst({ where: { id, isDeleted: false } });
  if (!shipment) throw ApiError.notFound("Shipment not found.");

  const deletableStatuses: ShipmentStatus[] = [ShipmentStatus.CREATED, ShipmentStatus.CANCELLED];
  if (!deletableStatuses.includes(shipment.status)) {
    throw ApiError.conflict(
      `Only a CREATED or CANCELLED shipment can be deleted (currently ${shipment.status}). Cancel it first.`,
    );
  }

  await prisma.shipmentEvent.create({
    data: { shipmentId: id, status: shipment.status, note: "Shipment soft-deleted", actorId },
  });

  return prisma.shipment.update({
    where: { id },
    data: { isDeleted: true, deletedAt: new Date() },
  });
};

/**
 * Free-text search across tracking ID and contact details on either
 * address. Kept simple (Postgres ILIKE via Prisma `contains` +
 * `mode: "insensitive"`) — swap for a proper full-text/trigram index or
 * a search service (Meilisearch/Elasticsearch) if volume grows enough
 * that this table scan becomes a bottleneck.
 */
const searchShipments = async (params: {
  organizationId?: string;
  customerId?: string;
  keyword: string;
  page: number;
  limit: number;
}) => {
  const skip = (params.page - 1) * params.limit;

  const where: Record<string, unknown> = {
    isDeleted: false,
    ...(params.organizationId ? { organizationId: params.organizationId } : {}),
    ...(params.customerId ? { customerId: params.customerId } : {}),
    OR: [
      { trackingId: { contains: params.keyword, mode: "insensitive" } },
      { description: { contains: params.keyword, mode: "insensitive" } },
      { senderAddress: { contactName: { contains: params.keyword, mode: "insensitive" } } },
      { senderAddress: { contactPhone: { contains: params.keyword, mode: "insensitive" } } },
      { receiverAddress: { contactName: { contains: params.keyword, mode: "insensitive" } } },
      { receiverAddress: { contactPhone: { contains: params.keyword, mode: "insensitive" } } },
    ],
  };

  const [data, total] = await Promise.all([
    prisma.shipment.findMany({
      where,
      skip,
      take: params.limit,
      orderBy: { createdAt: "desc" },
      include: {
        senderAddress: true,
        receiverAddress: true,
        originHub: { select: { name: true } },
        destinationHub: { select: { name: true } },
      },
    }),
    prisma.shipment.count({ where }),
  ]);

  return {
    data,
    meta: { page: params.page, limit: params.limit, total, totalPages: Math.ceil(total / params.limit) },
  };
};

/** Public-facing tracking lookup — no auth required, minimal data exposed. */
const trackByTrackingId = async (trackingId: string) => {
  const shipment = await prisma.shipment.findUnique({
    where: { trackingId },
    select: {
      trackingId: true,
      status: true,
      serviceLevel: true,
      createdAt: true,
      deliveredAt: true,
      originHub: { select: { name: true, address: true } },
      destinationHub: { select: { name: true, address: true } },
      currentHub: { select: { name: true } },
      events: {
        orderBy: { createdAt: "asc" },
        select: { status: true, note: true, location: true, createdAt: true },
      },
    },
  });
  if (!shipment) throw ApiError.notFound("No shipment found with this tracking ID.");
  return shipment;
};

interface IListFilters {
  organizationId?: string;
  customerId?: string;
  courierUserId?: string;
  status?: string;
  page: number;
  limit: number;
}

const listShipments = async (filters: IListFilters) => {
  const where: Record<string, unknown> = { isDeleted: false };
  if (filters.organizationId) where.organizationId = filters.organizationId;
  if (filters.customerId) where.customerId = filters.customerId;
  if (filters.status) where.status = filters.status;

  if (filters.courierUserId) {
    where.assignments = {
      some: { courier: { userId: filters.courierUserId } },
    };
  }

  const skip = (filters.page - 1) * filters.limit;

  const [data, total] = await Promise.all([
    prisma.shipment.findMany({
      where,
      skip,
      take: filters.limit,
      orderBy: { createdAt: "desc" },
      include: {
        senderAddress: true,
        receiverAddress: true,
        originHub: { select: { name: true } },
        destinationHub: { select: { name: true } },
      },
    }),
    prisma.shipment.count({ where }),
  ]);

  return {
    data,
    meta: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.ceil(total / filters.limit),
    },
  };
};

export const ShipmentService = {
  createShipment,
  schedulePickup,
  updateShipment,
  forceUpdateStatus,
  softDelete,
  searchShipments,
  cancelShipment,
  initiateReturn,
  markReturnInTransit,
  markReturnedToSender,
  getById,
  trackByTrackingId,
  listShipments,
};

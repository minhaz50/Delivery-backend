import type { Prisma, ShipmentStatus } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/ApiError";
import { HOLDER_AFTER_STATUS, isTransitionAllowed } from "./shipment.constant";

type TxClient = Prisma.TransactionClient;

export interface TransitionParams {
  shipmentId: string;
  toStatus: ShipmentStatus;
  actorId?: string;
  note?: string;
  location?: string;
  /** Set/clear which hub the parcel is physically sitting in. */
  currentHubId?: string | null;
  /** Extra Shipment columns to set atomically with the status change. */
  extraData?: Record<string, unknown>;
}

/**
 * The one function in the whole codebase allowed to change
 * `Shipment.status`. Every caller — shipment creation, courier actions,
 * hub scans, manifest dispatch/arrival, cancellations — routes through
 * here so the state machine and audit trail can never be bypassed.
 *
 * Concurrency safety: the UPDATE is conditioned on both `id` AND the
 * `version` we read moments ago (optimistic locking). If a concurrent
 * request already moved the shipment (e.g. a hub scan and a courier app
 * both trying to close out the same parcel), `updateMany`'s affected
 * count comes back 0 and we raise a 409 telling the caller to refetch
 * and retry, rather than silently overwriting the other update.
 *
 * Must be called with a `tx` (Prisma.TransactionClient) so the status
 * update, the event-log insert, and any caller-supplied side effects
 * (completing a courier assignment, crediting an earning, etc.) commit —
 * or fail — as a single atomic unit.
 */
export async function transitionStatusInTx(
  tx: TxClient,
  params: TransitionParams,
) {
  const shipment = await tx.shipment.findUnique({
    where: { id: params.shipmentId },
  });
  if (!shipment) throw ApiError.notFound("Shipment not found.");

  if (!isTransitionAllowed(shipment.status, params.toStatus)) {
    throw ApiError.conflict(
      `Cannot move shipment from ${shipment.status} to ${params.toStatus}.`,
    );
  }

  const holderType = HOLDER_AFTER_STATUS[params.toStatus];

  const updateResult = await tx.shipment.updateMany({
    where: { id: params.shipmentId, version: shipment.version },
    data: {
      status: params.toStatus,
      version: { increment: 1 },
      ...(holderType ? { holderType } : {}),
      ...(params.currentHubId !== undefined
        ? { currentHubId: params.currentHubId }
        : {}),
      ...params.extraData,
    },
  });

  if (updateResult.count === 0) {
    // Someone else updated this shipment between our read and our write.
    throw ApiError.conflict(
      "This shipment was updated by another action just now. Please retry.",
    );
  }

  await tx.shipmentEvent.create({
    data: {
      shipmentId: params.shipmentId,
      status: params.toStatus,
      note: params.note,
      location: params.location,
      actorId: params.actorId,
    },
  });

  return tx.shipment.findUniqueOrThrow({ where: { id: params.shipmentId } });
}

/** Convenience wrapper that opens its own transaction, for simple call sites. */
export async function transitionStatus(params: TransitionParams) {
  return prisma.$transaction((tx) => transitionStatusInTx(tx, params));
}

import { HolderType, ShipmentStatus } from "../../../generated/prisma/client";

/**
 * The shipment state machine, expressed as an explicit adjacency list:
 * ALLOWED_TRANSITIONS[currentStatus] = set of statuses it may move to next.
 *
 * This is the single source of truth for "is this transition legal?" —
 * ShipmentService.updateStatus consults it before touching the database,
 * so illegal jumps (e.g. CREATED -> DELIVERED) are rejected with a 409
 * instead of silently corrupting the timeline. Keeping it as data (not
 * scattered if/else in the service) also makes it trivially unit-testable
 * and easy to extend when a new branch is needed.
 */
export const ALLOWED_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  [ShipmentStatus.CREATED]: [
    ShipmentStatus.PICKUP_SCHEDULED,
    ShipmentStatus.CANCELLED,
  ],
  [ShipmentStatus.PICKUP_SCHEDULED]: [
    ShipmentStatus.COURIER_ASSIGNED,
    ShipmentStatus.CANCELLED,
  ],
  [ShipmentStatus.COURIER_ASSIGNED]: [
    ShipmentStatus.PICKED_UP,
    ShipmentStatus.PICKUP_FAILED,
    ShipmentStatus.CANCELLED,
  ],
  [ShipmentStatus.PICKUP_FAILED]: [
    ShipmentStatus.COURIER_ASSIGNED,
    ShipmentStatus.CANCELLED,
  ],
  [ShipmentStatus.PICKED_UP]: [ShipmentStatus.AT_ORIGIN_HUB],
  [ShipmentStatus.AT_ORIGIN_HUB]: [ShipmentStatus.IN_TRANSIT],
  [ShipmentStatus.IN_TRANSIT]: [ShipmentStatus.AT_DESTINATION_HUB],
  [ShipmentStatus.AT_DESTINATION_HUB]: [ShipmentStatus.OUT_FOR_DELIVERY],
  [ShipmentStatus.OUT_FOR_DELIVERY]: [
    ShipmentStatus.DELIVERED,
    ShipmentStatus.DELIVERY_FAILED,
  ],
  [ShipmentStatus.DELIVERY_FAILED]: [
    ShipmentStatus.OUT_FOR_DELIVERY, // retry delivery
    ShipmentStatus.RETURN_INITIATED,
  ],
  [ShipmentStatus.RETURN_INITIATED]: [ShipmentStatus.RETURN_IN_TRANSIT],
  [ShipmentStatus.RETURN_IN_TRANSIT]: [ShipmentStatus.RETURNED_TO_SENDER],
  [ShipmentStatus.RETURNED_TO_SENDER]: [],
  [ShipmentStatus.DELIVERED]: [],
  [ShipmentStatus.CANCELLED]: [],
};

/**
 * Who/what is expected to be holding the parcel once it reaches a given
 * status. Used to keep Shipment.holderType consistent with Shipment.status
 * in the same transaction, so "who currently has this parcel" is always a
 * cheap column read instead of a derived guess.
 */
export const HOLDER_AFTER_STATUS: Partial<Record<ShipmentStatus, HolderType>> =
  {
    [ShipmentStatus.CREATED]: HolderType.CUSTOMER,
    [ShipmentStatus.PICKUP_SCHEDULED]: HolderType.CUSTOMER,
    [ShipmentStatus.COURIER_ASSIGNED]: HolderType.CUSTOMER,
    [ShipmentStatus.PICKUP_FAILED]: HolderType.CUSTOMER,
    [ShipmentStatus.PICKED_UP]: HolderType.COURIER,
    [ShipmentStatus.AT_ORIGIN_HUB]: HolderType.HUB,
    [ShipmentStatus.IN_TRANSIT]: HolderType.HUB, // in transit between hubs, not with a courier "leg"
    [ShipmentStatus.AT_DESTINATION_HUB]: HolderType.HUB,
    [ShipmentStatus.OUT_FOR_DELIVERY]: HolderType.COURIER,
    [ShipmentStatus.DELIVERY_FAILED]: HolderType.COURIER,
    [ShipmentStatus.DELIVERED]: HolderType.NONE,
    [ShipmentStatus.RETURN_INITIATED]: HolderType.HUB,
    [ShipmentStatus.RETURN_IN_TRANSIT]: HolderType.COURIER,
    [ShipmentStatus.RETURNED_TO_SENDER]: HolderType.NONE,
    [ShipmentStatus.CANCELLED]: HolderType.NONE,
  };

export const TERMINAL_STATUSES: ShipmentStatus[] = [
  ShipmentStatus.DELIVERED,
  ShipmentStatus.CANCELLED,
  ShipmentStatus.RETURNED_TO_SENDER,
];

export function isTransitionAllowed(
  from: ShipmentStatus,
  to: ShipmentStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function generateTrackingId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars (0/O, 1/I)
  let random = "";
  for (let i = 0; i < 8; i++) {
    random += chars[Math.floor(Math.random() * chars.length)];
  }
  return `CRX-${random}`;
}

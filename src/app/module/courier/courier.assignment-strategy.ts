import type { Prisma } from "../../../generated/prisma";

type TxClient = Prisma.TransactionClient;

/**
 * Pluggable courier-matching interface. `assignCourierToShipment` in
 * courier.service.ts only depends on this shape, so swapping the matching
 * logic (e.g. adding distance-based scoring, or a ML-ranked candidate
 * list) later never touches the transaction/locking code around it —
 * just the strategy implementation.
 */
export interface IAssignmentStrategy {
  /**
   * Returns candidate couriers ordered from most to least preferred.
   * The caller tries to atomically claim them in this order until one
   * succeeds (see courier.service.ts) so a race between two shipments
   * picking the "best" courier at the same moment can't double-book them.
   */
  getCandidates(
    tx: TxClient,
    params: { organizationId: string; zoneId: string; limit?: number },
  ): Promise<{ id: string }[]>;
}

/**
 * v1 strategy: available couriers currently in the target zone,
 * least-loaded first (fewest active parcels), ties broken by rating.
 * Good enough for a single-city pilot; swap in a distance/ETA-aware
 * strategy once GPS ping data exists.
 */
export const LeastLoadedInZoneStrategy: IAssignmentStrategy = {
  async getCandidates(tx, { organizationId, zoneId, limit = 5 }) {
    return tx.courierProfile.findMany({
      where: { organizationId, currentZoneId: zoneId, isAvailable: true },
      orderBy: [{ activeParcelCount: "asc" }, { rating: "desc" }],
      take: limit,
      select: { id: true },
    });
  },
};

/**
 * Fallback strategy for when no courier is currently pinned to the exact
 * zone (e.g. couriers haven't checked in yet) — widens the search to any
 * available courier in the organization. Used automatically by
 * courier.service if the zone-scoped strategy comes back empty.
 */
export const AnyAvailableCourierStrategy: IAssignmentStrategy = {
  async getCandidates(tx, { organizationId, limit = 5 }) {
    return tx.courierProfile.findMany({
      where: { organizationId, isAvailable: true },
      orderBy: [{ activeParcelCount: "asc" }, { rating: "desc" }],
      take: limit,
      select: { id: true },
    });
  },
};

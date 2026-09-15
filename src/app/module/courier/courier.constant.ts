// Simple, tunable commission split. In a multi-org production system
// these would live per-Organization (or per pricing rule) rather than
// being global constants — kept flat here to keep the scaffold readable.
export const COURIER_COMMISSION_PERCENT = 0.3; // 30% of shipment price is paid out to couriers in total
export const PICKUP_LEG_SHARE = 0.4; // of the commission pool
export const DELIVERY_LEG_SHARE = 0.6;

export function calculateLegEarning(shipmentPrice: number, legShare: number): number {
  return Number((shipmentPrice * COURIER_COMMISSION_PERCENT * legShare).toFixed(2));
}

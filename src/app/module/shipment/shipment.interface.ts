import type { PaymentMethod, ServiceLevel } from "../../../generated/prisma";

export interface IAddressInput {
  label?: string;
  line1: string;
  line2?: string;
  city: string;
  zoneId: string;
  postCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  contactName: string;
  contactPhone: string;
}

export interface ICreateShipmentPayload {
  senderAddress: IAddressInput;
  receiverAddress: IAddressInput;
  weightKg: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  declaredValue?: number;
  codAmount?: number;
  serviceLevel?: ServiceLevel;
  description?: string;
  paymentMethod: PaymentMethod;
}

/**
 * Deliberately narrow: only non-structural, pre-dispatch metadata is
 * editable via the generic update endpoint. Anything that the state
 * machine, pricing, or an assigned courier already depends on
 * (addresses, weight, zones, price) is intentionally excluded — changing
 * those requires cancelling and recreating the shipment instead of a
 * silent PATCH that could invalidate an already-quoted price or an
 * already-assigned courier's leg.
 */
export interface IUpdateShipmentPayload {
  description?: string;
  declaredValue?: number;
  codAmount?: number;
}

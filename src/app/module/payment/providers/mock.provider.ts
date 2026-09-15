import { nanoid } from "nanoid";
import type { IPaymentProvider } from "../payment.interface";

/**
 * Always-succeeds provider used for local development and demos so the
 * whole shipment -> payment -> delivery flow is runnable without real
 * gateway credentials. `PAYMENT_PROVIDER=MOCK` (the default) selects this.
 */
export const MockPaymentProvider: IPaymentProvider = {
  name: "MOCK",

  async initiate({ amount, currency, reference }) {
    return {
      providerRef: `mock_${reference}_${nanoid(8)}`,
      redirectUrl: undefined, // no redirect needed; caller treats it as immediately payable
    };
  },

  async verify(_providerRef: string) {
    return true;
  },

  async refund(_providerRef: string, _amount: number) {
    return true;
  },
};

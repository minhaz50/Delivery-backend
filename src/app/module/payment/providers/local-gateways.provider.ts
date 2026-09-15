import type { IPaymentProvider } from "../payment.interface";

/**
 * Same extension pattern as stripe.provider.ts. SSLCommerz and bKash are
 * both redirect/callback-based: `initiate()` would call their session API
 * and return the redirect URL, then a callback route
 * (POST /api/v1/payments/webhook/sslcommerz or /bkash) validates the
 * signature and calls PaymentService.markPaid.
 *
 * Left unimplemented pending real merchant credentials
 * (SSLCOMMERZ_STORE_ID/PASSWORD, BKASH_APP_KEY/SECRET in .env).
 */
export const SSLCommerzPaymentProvider: IPaymentProvider = {
  name: "SSLCOMMERZ",
  async initiate() {
    throw new Error("SSLCommerz integration is not implemented yet — see local-gateways.provider.ts.");
  },
  async verify() {
    throw new Error("SSLCommerz integration is not implemented yet — see local-gateways.provider.ts.");
  },
  async refund() {
    throw new Error("SSLCommerz integration is not implemented yet — see local-gateways.provider.ts.");
  },
};

export const BkashPaymentProvider: IPaymentProvider = {
  name: "BKASH",
  async initiate() {
    throw new Error("bKash integration is not implemented yet — see local-gateways.provider.ts.");
  },
  async verify() {
    throw new Error("bKash integration is not implemented yet — see local-gateways.provider.ts.");
  },
  async refund() {
    throw new Error("bKash integration is not implemented yet — see local-gateways.provider.ts.");
  },
};

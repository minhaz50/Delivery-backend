export interface IPaymentInitiateResult {
  providerRef: string;
  redirectUrl?: string; // present for redirect-based gateways (Stripe Checkout, SSLCommerz, bKash)
}

/**
 * Every real gateway (Stripe / SSLCommerz / bKash) implements this same
 * shape. Swapping providers is a one-line change in payment.service.ts —
 * nothing in the shipment or order flow needs to know which gateway is
 * behind it.
 */
export interface IPaymentProvider {
  name: string;
  initiate(params: { amount: number; currency: string; reference: string }): Promise<IPaymentInitiateResult>;
  verify(providerRef: string): Promise<boolean>;
  refund(providerRef: string, amount: number): Promise<boolean>;
}

import Stripe from "stripe";
import type { IPaymentProvider } from "../payment.interface";
import { config } from "../../../config";

let stripeClient: Stripe | null = null;

function getClient(): Stripe {
  if (!config.payment.stripeSecretKey) {
    throw new Error(
      "STRIPE_SECRET_KEY is not configured. Set it in .env or switch PAYMENT_PROVIDER back to MOCK.",
    );
  }
  if (!stripeClient) {
    stripeClient = new Stripe(config.payment.stripeSecretKey);
  }
  return stripeClient;
}

/**
 * Uses Stripe Checkout Sessions — the simplest integration style: Stripe
 * hosts the actual payment page, we just create a session and hand the
 * customer its redirect URL. Success/failure comes back to us via the
 * webhook in payment.webhook.ts, not a synchronous response, since the
 * customer completes payment on Stripe's page, not ours.
 */
export const StripePaymentProvider: IPaymentProvider = {
  name: "STRIPE",

  async initiate({ amount, currency, reference }) {
    const stripe = getClient();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: (config.payment.stripeCurrency || currency || "usd").toLowerCase(),
            unit_amount: Math.round(amount * 100),
            product_data: { name: `Courier shipment payment (${reference})` },
          },
          quantity: 1,
        },
      ],
      metadata: { internalPaymentId: reference },
      success_url: `${config.payment.stripeSuccessUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: config.payment.stripeCancelUrl,
    });

    return {
      providerRef: session.id,
      redirectUrl: session.url ?? undefined,
    };
  },

  async verify(providerRef: string) {
    const stripe = getClient();
    const session = await stripe.checkout.sessions.retrieve(providerRef);
    return session.payment_status === "paid";
  },

  async refund(providerRef: string, amount: number) {
    const stripe = getClient();
    const session = await stripe.checkout.sessions.retrieve(providerRef, {
      expand: ["payment_intent"],
    });

    const paymentIntent = session.payment_intent;
    const paymentIntentId = typeof paymentIntent === "string" ? paymentIntent : paymentIntent?.id;

    if (!paymentIntentId) {
      throw new Error("Cannot refund: no payment_intent found for this Stripe session.");
    }

    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: Math.round(amount * 100),
    });

    return refund.status === "succeeded" || refund.status === "pending";
  },
};

import type { Request, Response } from "express";
import Stripe from "stripe";
import { config } from "../../config";
import { prisma } from "../../lib/prisma";
import { PaymentService } from "./payment.service";

/**
 * Stripe tells us payment succeeded by calling this endpoint directly —
 * NOT by the browser redirecting back to success_url (that's just for
 * the customer's UX; it's not proof of payment on its own). Requires the
 * RAW request body to verify the signature — see app.ts wiring.
 */
export const handleStripeWebhook = async (req: Request, res: Response) => {
  const signature = req.headers["stripe-signature"];

  if (!signature || !config.payment.stripeWebhookSecret || !config.payment.stripeSecretKey) {
    return res.status(400).send("Stripe webhook is not configured correctly.");
  }

  const stripe = new Stripe(config.payment.stripeSecretKey);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      config.payment.stripeWebhookSecret,
    );
  } catch (err) {
    console.error("[stripe webhook] signature verification failed:", (err as Error).message);
    return res.status(400).send(`Webhook Error: ${(err as Error).message}`);
  }

  try {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object as Stripe.Checkout.Session;

      const payment = await prisma.payment.findFirst({ where: { providerRef: session.id } });
      if (payment && payment.status !== "PAID") {
        await PaymentService.markPaid(payment.id);
        console.log(`[stripe webhook] payment ${payment.id} marked PAID via session ${session.id}`);
      }
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error("[stripe webhook] handler error:", err);
    res.status(500).json({ received: false });
  }
};

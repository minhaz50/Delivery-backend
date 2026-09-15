import type { Prisma, PaymentMethod } from "../../../generated/prisma";
import { prisma } from "../../lib/prisma";
import { config } from "../../config";
import { ApiError } from "../../utils/ApiError";
import type { IPaymentProvider } from "./payment.interface";
import { MockPaymentProvider } from "./providers/mock.provider";
import { StripePaymentProvider } from "./providers/stripe.provider";
import { SSLCommerzPaymentProvider, BkashPaymentProvider } from "./providers/local-gateways.provider";

const PROVIDERS: Record<string, IPaymentProvider> = {
  MOCK: MockPaymentProvider,
  STRIPE: StripePaymentProvider,
  SSLCOMMERZ: SSLCommerzPaymentProvider,
  BKASH: BkashPaymentProvider,
};

function getProvider(): IPaymentProvider {
  const provider = PROVIDERS[config.payment.provider];
  if (!provider) {
    throw ApiError.internal(`Unknown PAYMENT_PROVIDER "${config.payment.provider}".`);
  }
  return provider;
}

type TxClient = Prisma.TransactionClient;

/**
 * Creates the Payment row for a new shipment. For COD, the payment is
 * simply PENDING until the courier collects cash at delivery. For online
 * methods, we immediately call the provider to get a payable
 * reference/redirect URL, which the API response hands to the frontend.
 */
const createPaymentInTx = async (
  tx: TxClient,
  params: { organizationId: string; amount: number; method: PaymentMethod },
) => {
  const payment = await tx.payment.create({
    data: {
      organizationId: params.organizationId,
      amount: params.amount,
      method: params.method,
      status: "PENDING",
      provider: params.method === "COD" ? null : getProvider().name,
    },
  });

  if (params.method === "COD") {
    return { payment, redirectUrl: undefined as string | undefined };
  }

  const initiated = await getProvider().initiate({
    amount: params.amount,
    currency: config.payment.stripeCurrency ?? "BDT",
    reference: payment.id,
  });

  const updated = await tx.payment.update({
    where: { id: payment.id },
    data: { providerRef: initiated.providerRef },
  });

  return { payment: updated, redirectUrl: initiated.redirectUrl };
};

/**
 * Standalone payment trigger — for retrying a failed/expired online
 * payment on an existing shipment, or switching an existing COD
 * shipment over to an online method. Shipment creation still creates
 * the initial Payment row automatically (createPaymentInTx); this is
 * for everything *after* that point where the customer needs a fresh
 * payable session rather than the original one.
 */
const initiateForShipment = async (params: {
  shipmentId: string;
  requesterId: string;
  requesterRole: string;
  method?: PaymentMethod;
}) => {
  const shipment = await prisma.shipment.findFirst({
    where: { id: params.shipmentId, isDeleted: false },
  });
  if (!shipment) throw ApiError.notFound("Shipment not found.");

  if (params.requesterRole === "CUSTOMER" && shipment.customerId !== params.requesterId) {
    throw ApiError.forbidden("This shipment does not belong to you.");
  }
  if (!shipment.paymentId) {
    throw ApiError.badRequest("This shipment has no associated payment record.");
  }

  const payment = await prisma.payment.findUnique({ where: { id: shipment.paymentId } });
  if (!payment) throw ApiError.notFound("Payment record not found.");

  if (payment.status === "PAID") {
    throw ApiError.conflict("This shipment has already been paid for.");
  }

  const targetMethod = params.method ?? payment.method;
  if (targetMethod === "COD") {
    throw ApiError.badRequest(
      "Cannot initiate an online payment session for Cash on Delivery. Provide \"method\": \"CARD\" or \"MOBILE_BANKING\" to switch this shipment to online payment.",
    );
  }

  const provider = getProvider();
  const initiated = await provider.initiate({
    amount: payment.amount,
    currency: config.payment.stripeCurrency ?? "BDT",
    reference: payment.id,
  });

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      method: targetMethod,
      provider: provider.name,
      providerRef: initiated.providerRef,
      status: "PENDING",
    },
  });

  return { payment: updated, redirectUrl: initiated.redirectUrl };
};

const getById = async (paymentId: string) => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { shipment: { select: { id: true, trackingId: true, customerId: true, organizationId: true } } },
  });
  if (!payment) throw ApiError.notFound("Payment not found.");
  return payment;
};

const markPaid = async (paymentId: string) => {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw ApiError.notFound("Payment not found.");
  if (payment.status === "PAID") return payment;

  if (payment.method !== "COD" && payment.providerRef) {
    const verified = await getProvider().verify(payment.providerRef);
    if (!verified) throw ApiError.badRequest("Payment could not be verified with the provider.");
  }

  return prisma.payment.update({
    where: { id: paymentId },
    data: { status: "PAID", paidAt: new Date() },
  });
};

/** Collect COD cash — called by the courier app at successful delivery. */
const markCollectedAsCod = async (paymentId: string) => {
  return prisma.payment.update({
    where: { id: paymentId },
    data: { status: "PAID", paidAt: new Date() },
  });
};

const refund = async (paymentId: string) => {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw ApiError.notFound("Payment not found.");
  if (payment.status !== "PAID") {
    throw ApiError.badRequest("Only a PAID payment can be refunded.");
  }

  if (payment.method !== "COD" && payment.providerRef) {
    await getProvider().refund(payment.providerRef, payment.amount);
  }

  return prisma.payment.update({ where: { id: paymentId }, data: { status: "REFUNDED" } });
};

export const PaymentService = {
  getById,
  createPaymentInTx,
  initiateForShipment,
  markPaid,
  markCollectedAsCod,
  refund,
};

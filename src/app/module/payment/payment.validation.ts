import { z } from "zod";
import { PaymentMethod } from "../../../generated/prisma";

export const paymentIdParamValidation = z.object({
  params: z.object({ id: z.string().min(1) }),
});

export const initiatePaymentValidation = z.object({
  body: z.object({
    shipmentId: z.string().min(1),
    // Optional: lets a customer switch from COD to an online method, or
    // retry with a different method after a failed attempt. Omit it to
    // just retry the shipment's existing method.
    method: z.nativeEnum(PaymentMethod).optional(),
  }),
});

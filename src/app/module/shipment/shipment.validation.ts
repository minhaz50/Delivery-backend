import { z } from "zod";
import { PaymentMethod, ServiceLevel, ShipmentStatus } from "../../../generated/prisma";

const addressSchema = z.object({
  label: z.string().optional(),
  line1: z.string().min(3),
  line2: z.string().optional(),
  city: z.string().min(2),
  zoneId: z.string().min(1),
  postCode: z.string().optional(),
  country: z.string().default("BD"),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  contactName: z.string().min(2),
  contactPhone: z.string().min(6),
});

export const createShipmentValidation = z.object({
  body: z.object({
    senderAddress: addressSchema,
    receiverAddress: addressSchema,
    weightKg: z.number().positive().max(1000),
    lengthCm: z.number().positive().optional(),
    widthCm: z.number().positive().optional(),
    heightCm: z.number().positive().optional(),
    declaredValue: z.number().nonnegative().optional(),
    codAmount: z.number().nonnegative().default(0),
    serviceLevel: z.nativeEnum(ServiceLevel).default(ServiceLevel.STANDARD),
    description: z.string().optional(),
    paymentMethod: z.nativeEnum(PaymentMethod).default(PaymentMethod.COD),
  }),
});

export const schedulePickupValidation = z.object({
  body: z.object({
    pickupScheduledAt: z.coerce.date().optional(),
  }),
});

export const cancelShipmentValidation = z.object({
  body: z.object({
    reason: z.string().optional(),
  }),
});

export const initiateReturnValidation = z.object({
  body: z.object({
    reason: z.string().min(3),
  }),
});

export const listShipmentsValidation = z.object({
  query: z.object({
    status: z.string().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
});

export const updateShipmentValidation = z.object({
  body: z.object({
    description: z.string().optional(),
    declaredValue: z.number().nonnegative().optional(),
    codAmount: z.number().nonnegative().optional(),
  }),
});

/**
 * A manual override, not a substitute for the action-specific endpoints
 * (schedule-pickup, assign, complete-pickup, complete-delivery, cancel,
 * return...). Those exist because a real status change usually needs to
 * do more than flip a column (assign a courier, pay an earning, refund a
 * payment). This is for ops correcting a shipment that's stuck or wrong
 * for some out-of-band reason — it still goes through the same state
 * machine, so it can't skip to an illegal status, but it bypasses the
 * side effects the specific endpoints trigger.
 */
export const updateShipmentStatusValidation = z.object({
  body: z.object({
    status: z.nativeEnum(ShipmentStatus),
    note: z.string().optional(),
    location: z.string().optional(),
  }),
});

export const searchShipmentsValidation = z.object({
  query: z.object({
    q: z.string().min(1, "q (search keyword) is required"),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
});

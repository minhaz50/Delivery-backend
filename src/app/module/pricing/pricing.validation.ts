import { z } from "zod";
import { ServiceLevel } from "../../../generated/prisma";

export const createPricingRuleValidation = z.object({
  body: z.object({
    fromZoneId: z.string().optional(),
    toZoneId: z.string().optional(),
    serviceLevel: z.nativeEnum(ServiceLevel).default(ServiceLevel.STANDARD),
    baseFee: z.number().nonnegative(),
    perKgFee: z.number().nonnegative(),
    baseWeightKg: z.number().positive().default(1),
  }),
});

export const quotePriceValidation = z.object({
  body: z.object({
    originZoneId: z.string().min(1),
    destinationZoneId: z.string().min(1),
    weightKg: z.number().positive(),
    serviceLevel: z.nativeEnum(ServiceLevel).default(ServiceLevel.STANDARD),
  }),
});

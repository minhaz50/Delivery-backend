import { z } from "zod";
import { AssignmentLegType } from "../../../generated/prisma/client";

export const createCourierProfileValidation = z.object({
  body: z.object({
    userId: z.string().min(1),
    homeHubId: z.string().optional(),
    currentZoneId: z.string().optional(),
    vehicleType: z.enum(["BIKE", "VAN", "TRUCK"]).default("BIKE"),
    capacityKg: z.number().positive().default(20),
  }),
});

export const setAvailabilityValidation = z.object({
  body: z.object({
    isAvailable: z.boolean(),
    currentZoneId: z.string().optional(),
  }),
});

export const assignCourierValidation = z.object({
  body: z.object({
    legType: z.nativeEnum(AssignmentLegType),
    preferredCourierId: z.string().optional(),
  }),
});

export const failLegValidation = z.object({
  body: z.object({
    reason: z.string().min(3),
  }),
});

export const codCollectedValidation = z.object({
  body: z.object({
    codCollected: z.boolean().optional().default(false),
  }),
});

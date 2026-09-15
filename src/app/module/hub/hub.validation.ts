import { z } from "zod";

export const createHubValidation = z.object({
  body: z.object({
    name: z.string().min(2),
    code: z.string().min(1).toUpperCase(),
    zoneId: z.string().min(1),
    address: z.string().min(3),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    managerId: z.string().optional(),
  }),
});

export const assignManagerValidation = z.object({
  body: z.object({
    managerId: z.string().min(1),
  }),
});

import { z } from "zod";

export const createZoneValidation = z.object({
  body: z.object({
    name: z.string().min(2),
    code: z.string().min(1).toUpperCase(),
    city: z.string().min(2),
  }),
});

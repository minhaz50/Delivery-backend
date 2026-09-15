import { z } from "zod";

export const createOrganizationValidation = z.object({
  body: z.object({
    name: z.string().min(2),
    slug: z
      .string()
      .min(2)
      .regex(/^[a-z0-9-]+$/, "slug must be lowercase letters, numbers, and hyphens only"),
    contactEmail: z.string().email(),
    contactPhone: z.string().optional(),
  }),
});

export const updateOrganizationValidation = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    contactEmail: z.string().email().optional(),
    contactPhone: z.string().optional(),
    isActive: z.boolean().optional(),
  }),
});

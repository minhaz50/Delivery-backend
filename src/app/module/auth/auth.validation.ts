import { z } from "zod";

export const registerValidation = z.object({
  body: z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("A valid email is required"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    phone: z.string().optional(),
    organizationSlug: z.string().min(1, "organizationSlug is required (which courier company you're shipping through)"),
  }),
});

export const loginValidation = z.object({
  body: z.object({
    email: z.string().email("A valid email is required"),
    password: z.string().min(1, "Password is required"),
  }),
});

export const refreshTokenValidation = z.object({
  body: z.object({
    refreshToken: z.string().min(1, "refreshToken is required"),
  }),
});

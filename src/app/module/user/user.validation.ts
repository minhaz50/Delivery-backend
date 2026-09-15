import { z } from "zod";

export const updateProfileValidation = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    phone: z.string().min(6).optional(),
  }),
});

export const changePasswordValidation = z.object({
  body: z.object({
    currentPassword: z.string().min(1, "currentPassword is required"),
    newPassword: z.string().min(8, "newPassword must be at least 8 characters"),
  }),
});

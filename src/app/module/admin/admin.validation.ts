import { z } from "zod";
import { Role, UserStatus } from "../../../generated/prisma/client";

export const listUsersValidation = z.object({
  query: z.object({
    role: z.nativeEnum(Role).optional(),
    status: z.nativeEnum(UserStatus).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
});

export const updateUserRoleValidation = z.object({
  body: z.object({
    role: z.nativeEnum(Role),
  }),
});

export const auditLogsValidation = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
});

import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { Role } from "../../../generated/prisma";
import { AdminController } from "./admin.controller";
import {
  listUsersValidation,
  updateUserRoleValidation,
  auditLogsValidation,
} from "./admin.validation";

const router = Router();

const adminOnly = auth(Role.ADMIN, Role.SUPER_ADMIN);

router.get(
  "/users",
  adminOnly,
  validateRequest(listUsersValidation),
  AdminController.listUsers,
);
router.patch(
  "/users/:id/role",
  adminOnly,
  validateRequest(updateUserRoleValidation),
  AdminController.updateUserRole,
);
router.get("/dashboard-stats", adminOnly, AdminController.getDashboardStats);
router.get(
  "/audit-logs",
  adminOnly,
  validateRequest(auditLogsValidation),
  AdminController.getAuditLogs,
);

export const AdminRoutes = router;

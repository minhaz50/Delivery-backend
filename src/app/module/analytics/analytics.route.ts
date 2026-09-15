import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma";
import { AnalyticsController } from "./analytics.controller";

const router = Router();

router.get(
  "/dashboard",
  auth(Role.ADMIN, Role.OPS_MANAGER, Role.SUPER_ADMIN),
  AnalyticsController.getDashboardSummary,
);
router.get(
  "/courier-leaderboard",
  auth(Role.ADMIN, Role.OPS_MANAGER),
  AnalyticsController.getCourierLeaderboard,
);

export const AnalyticsRoutes = router;

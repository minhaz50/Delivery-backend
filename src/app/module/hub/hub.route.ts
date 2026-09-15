import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { Role } from "../../../generated/prisma/client";
import { HubController } from "./hub.controller";
import { createHubValidation, assignManagerValidation } from "./hub.validation";

const router = Router();

router.post(
  "/",
  auth(Role.ADMIN, Role.OPS_MANAGER),
  validateRequest(createHubValidation),
  HubController.create,
);
router.get("/", auth(), HubController.getAll);
router.get("/:id", auth(), HubController.getById);
router.patch(
  "/:id/manager",
  auth(Role.ADMIN, Role.OPS_MANAGER),
  validateRequest(assignManagerValidation),
  HubController.assignManager,
);

export const HubRoutes = router;

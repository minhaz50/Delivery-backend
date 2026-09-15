import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { Role } from "../../../generated/prisma/client";
import { ZoneController } from "./zone.controller";
import { createZoneValidation } from "./zone.validation";

const router = Router();

router.post(
  "/",
  auth(Role.ADMIN, Role.OPS_MANAGER),
  validateRequest(createZoneValidation),
  ZoneController.create,
);
router.get("/", auth(), ZoneController.getAll);
router.get("/:id", auth(), ZoneController.getById);

export const ZoneRoutes = router;

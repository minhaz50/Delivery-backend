import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { Role } from "../../../generated/prisma/client";
import { ManifestController } from "./manifest.controller";
import {
  createManifestValidation,
  addItemsValidation,
} from "./manifest.validation";

const router = Router();

const canManageManifests = auth(Role.ADMIN, Role.OPS_MANAGER, Role.HUB_MANAGER);

router.post(
  "/",
  canManageManifests,
  validateRequest(createManifestValidation),
  ManifestController.create,
);
router.get("/", canManageManifests, ManifestController.list);
router.get("/:id", canManageManifests, ManifestController.getById);
router.post(
  "/:id/items",
  canManageManifests,
  validateRequest(addItemsValidation),
  ManifestController.addItems,
);
router.post("/:id/dispatch", canManageManifests, ManifestController.dispatch);
router.post("/:id/arrive", canManageManifests, ManifestController.arrive);
router.post("/:id/close", canManageManifests, ManifestController.close);

export const ManifestRoutes = router;

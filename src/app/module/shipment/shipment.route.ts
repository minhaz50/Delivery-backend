import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { Role } from "../../../generated/prisma";
import { ShipmentController } from "./shipment.controller";
import {
  createShipmentValidation,
  schedulePickupValidation,
  cancelShipmentValidation,
  initiateReturnValidation,
  listShipmentsValidation,
  updateShipmentValidation,
  updateShipmentStatusValidation,
  searchShipmentsValidation,
} from "./shipment.validation";

const router = Router();

// Public tracking — no auth. Mounted before the authed :id route so
// "/track/:trackingId" never collides with "/:id".
router.get("/track/:trackingId", ShipmentController.track);

router.post(
  "/",
  auth(Role.CUSTOMER),
  validateRequest(createShipmentValidation),
  ShipmentController.create,
);

router.get("/", auth(), validateRequest(listShipmentsValidation), ShipmentController.list);

// IMPORTANT: "/search" must be registered before "/:id" — otherwise
// Express matches "/:id" first and treats the literal word "search" as
// an id, and this route becomes unreachable.
router.get("/search", auth(), validateRequest(searchShipmentsValidation), ShipmentController.search);

router.get("/:id", auth(), ShipmentController.getById);

router.patch(
  "/:id",
  auth(Role.CUSTOMER, Role.ADMIN, Role.OPS_MANAGER),
  validateRequest(updateShipmentValidation),
  ShipmentController.update,
);

router.patch(
  "/:id/status",
  auth(Role.ADMIN, Role.OPS_MANAGER),
  validateRequest(updateShipmentStatusValidation),
  ShipmentController.updateStatus,
);

router.delete(
  "/:id",
  auth(Role.CUSTOMER, Role.ADMIN, Role.OPS_MANAGER),
  ShipmentController.remove,
);

router.patch(
  "/:id/schedule-pickup",
  auth(Role.CUSTOMER, Role.ADMIN, Role.OPS_MANAGER),
  validateRequest(schedulePickupValidation),
  ShipmentController.schedulePickup,
);

router.patch(
  "/:id/cancel",
  auth(Role.CUSTOMER, Role.ADMIN, Role.OPS_MANAGER),
  validateRequest(cancelShipmentValidation),
  ShipmentController.cancel,
);

router.post(
  "/:id/return/initiate",
  auth(Role.ADMIN, Role.OPS_MANAGER, Role.HUB_MANAGER),
  validateRequest(initiateReturnValidation),
  ShipmentController.initiateReturn,
);
router.post(
  "/:id/return/in-transit",
  auth(Role.ADMIN, Role.OPS_MANAGER, Role.COURIER),
  ShipmentController.markReturnInTransit,
);
router.post(
  "/:id/return/completed",
  auth(Role.ADMIN, Role.OPS_MANAGER, Role.HUB_MANAGER),
  ShipmentController.markReturnedToSender,
);

export const ShipmentRoutes = router;

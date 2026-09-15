import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { Role } from "../../../generated/prisma";
import { CourierController } from "./courier.controller";
import {
  createCourierProfileValidation,
  setAvailabilityValidation,
  assignCourierValidation,
  failLegValidation,
  codCollectedValidation,
} from "./courier.validation";

const router = Router();

// --- profile management (ops/admin) ---
router.post(
  "/profiles",
  auth(Role.ADMIN, Role.OPS_MANAGER),
  validateRequest(createCourierProfileValidation),
  CourierController.createProfile,
);

// --- courier self-service ---
router.patch(
  "/me/availability",
  auth(Role.COURIER),
  validateRequest(setAvailabilityValidation),
  CourierController.setAvailability,
);
router.get("/me/assignments", auth(Role.COURIER), CourierController.getMyAssignments);
router.get("/me/earnings", auth(Role.COURIER), CourierController.getMyEarnings);

router.post("/assignments/:id/accept", auth(Role.COURIER), CourierController.acceptAssignment);
router.post("/assignments/:id/complete-pickup", auth(Role.COURIER), CourierController.completePickup);
router.post(
  "/assignments/:id/complete-delivery",
  auth(Role.COURIER),
  validateRequest(codCollectedValidation),
  CourierController.completeDelivery,
);
router.post(
  "/assignments/:id/fail",
  auth(Role.COURIER),
  validateRequest(failLegValidation),
  CourierController.failLeg,
);

// --- ops/hub-manager actions on a shipment ---
router.post(
  "/shipments/:shipmentId/assign",
  auth(Role.ADMIN, Role.OPS_MANAGER, Role.HUB_MANAGER),
  validateRequest(assignCourierValidation),
  CourierController.assignCourier,
);
router.post(
  "/shipments/:shipmentId/confirm-origin-hub-arrival",
  auth(Role.ADMIN, Role.OPS_MANAGER, Role.HUB_MANAGER),
  CourierController.confirmArrivalAtOriginHub,
);

export const CourierRoutes = router;

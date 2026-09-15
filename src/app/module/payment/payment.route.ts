import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { Role } from "../../../generated/prisma";
import { PaymentController } from "./payment.controller";
import { paymentIdParamValidation, initiatePaymentValidation } from "./payment.validation";

const router = Router();

router.post(
  "/initiate",
  auth(Role.CUSTOMER, Role.ADMIN, Role.OPS_MANAGER),
  validateRequest(initiatePaymentValidation),
  PaymentController.initiate,
);

// In production, "confirm" would instead be a webhook route the gateway
// calls directly (see provider stub comments). Exposed here as an
// authenticated endpoint so the mock/dev flow is testable end-to-end.
router.get(
  "/:id",
  auth(Role.ADMIN, Role.OPS_MANAGER, Role.CUSTOMER),
  validateRequest(paymentIdParamValidation),
  PaymentController.getById,
);

router.post(
  "/:id/confirm",
  auth(Role.ADMIN, Role.OPS_MANAGER, Role.CUSTOMER),
  validateRequest(paymentIdParamValidation),
  PaymentController.confirm,
);
router.post(
  "/:id/refund",
  auth(Role.ADMIN, Role.OPS_MANAGER),
  validateRequest(paymentIdParamValidation),
  PaymentController.refund,
);

export const PaymentRoutes = router;

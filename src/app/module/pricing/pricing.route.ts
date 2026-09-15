import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { Role } from "../../../generated/prisma";
import { PricingController } from "./pricing.controller";
import { createPricingRuleValidation, quotePriceValidation } from "./pricing.validation";

const router = Router();

router.post(
  "/rules",
  auth(Role.ADMIN, Role.OPS_MANAGER),
  validateRequest(createPricingRuleValidation),
  PricingController.createRule,
);
router.get("/rules", auth(Role.ADMIN, Role.OPS_MANAGER), PricingController.getAllRules);
router.post("/quote", auth(), validateRequest(quotePriceValidation), PricingController.quote);

export const PricingRoutes = router;

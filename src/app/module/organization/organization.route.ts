import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { Role } from "../../../generated/prisma/client";
import { OrganizationController } from "./organization.controller";
import {
  createOrganizationValidation,
  updateOrganizationValidation,
} from "./organization.validation";

const router = Router();

// Public — lets a signup form list which courier companies exist before
// the customer has any token at all.
router.get("/public", OrganizationController.getAllPublic);

// Only a platform SUPER_ADMIN can create/manage tenants.
router.post(
  "/",
  auth(Role.SUPER_ADMIN),
  validateRequest(createOrganizationValidation),
  OrganizationController.create,
);
router.get(
  "/",
  auth(Role.SUPER_ADMIN, Role.ADMIN),
  OrganizationController.getAll,
);
router.get(
  "/:id",
  auth(Role.SUPER_ADMIN, Role.ADMIN),
  OrganizationController.getById,
);
router.patch(
  "/:id",
  auth(Role.SUPER_ADMIN, Role.ADMIN),
  validateRequest(updateOrganizationValidation),
  OrganizationController.update,
);

export const OrganizationRoutes = router;

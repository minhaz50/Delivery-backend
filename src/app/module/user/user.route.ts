import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { UserController } from "./user.controller";
import { updateProfileValidation, changePasswordValidation } from "./user.validation";

const router = Router();

router.get("/me", auth(), UserController.getMe);
router.patch("/me", auth(), validateRequest(updateProfileValidation), UserController.updateProfile);
router.patch(
  "/me/change-password",
  auth(),
  validateRequest(changePasswordValidation),
  UserController.changePassword,
);

export const UserRoutes = router;

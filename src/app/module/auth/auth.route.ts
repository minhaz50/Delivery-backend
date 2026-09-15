import { Router } from "express";
import { AuthController } from "./auth.controller";
import { validateRequest } from "../../middleware/validateRequest";
import { registerValidation, loginValidation, refreshTokenValidation } from "./auth.validation";
import { auth } from "../../middleware/checkAuth";

const router = Router();

router.post("/register", validateRequest(registerValidation), AuthController.register);
router.post("/login", validateRequest(loginValidation), AuthController.login);
router.post(
  "/refresh-token",
  validateRequest(refreshTokenValidation),
  AuthController.refreshToken,
);
router.get("/me", auth(), AuthController.getMe);

export const AuthRoutes = router;

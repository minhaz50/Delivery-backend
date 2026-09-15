import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { NotificationController } from "./notification.controller";

const router = Router();

router.get("/me", auth(), NotificationController.getMine);

export const NotificationRoutes = router;

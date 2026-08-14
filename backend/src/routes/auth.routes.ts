import { Router } from "express";

import authController from "../controllers/auth.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { registerSchema, loginSchema } from "../validations/auth.validation.js";
const authRouter = Router();

/**
 * Public Routes
 */
authRouter.post("/register", validate(registerSchema), authController.register);
authRouter.post("/login", validate(loginSchema), authController.login);

/**
 * Protected Routes
 */
authRouter.get("/me", protect, authController.me);
authRouter.post("/logout", protect, authController.logout);

export default authRouter;

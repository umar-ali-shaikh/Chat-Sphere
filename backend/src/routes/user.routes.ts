import { Router } from "express";

import userController from "../controllers/user.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import upload from "../middleware/upload.middleware.js";

import {
  updateProfileSchema,
  changePasswordSchema,
} from "../validations/user.validation.js";

const userRouter = Router();

userRouter.get("/", protect, userController.listUsers);

userRouter.get("/profile", protect, userController.getProfile);

userRouter.put(
  "/profile",
  protect,
  validate(updateProfileSchema),
  userController.updateProfile,
);

userRouter.put(
  "/change-password",
  protect,
  validate(changePasswordSchema),
  userController.changePassword,
);

userRouter.post(
  "/avatar",
  protect,
  upload.single("avatar"),
  userController.uploadAvatar,
);



export default userRouter;

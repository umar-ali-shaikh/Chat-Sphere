import { Router } from "express";
import { protect } from "../middleware/auth.middleware.js";
import upload from "../middleware/upload.middleware.js";
import {
  uploadImage,
  deleteImage,
} from "../controllers/upload.controller.js";

const router = Router();

/**
 * @route   POST /api/upload/image
 * @desc    Upload Image
 * @access  Private
 */
router.post(
  "/image",
  protect,
  upload.single("image"),
  uploadImage
);

/**
 * @route   DELETE /api/upload?publicId=...
 * @desc    Delete Image
 * @access  Private
 */
router.delete(
  "/",
  protect,
  deleteImage
);

export default router;
import { Request, Response } from "express";

import asyncHandler from "../utils/asyncHandler.js";
import AppError from "../utils/AppError.js";
import {
  uploadBufferToCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinary.js";

/**
 * @route POST /api/upload/image
 * @desc Upload Image
 * @access Private
 *
 * Uploads are scoped to the caller's own Cloudinary folder
 * (chat-app/messages/<userId>/...) so that deleteImage can later verify
 * ownership purely from the public_id, without needing a separate
 * "who uploaded this" record.
 */
export const uploadImage = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.file) {
      throw new AppError("Please upload an image.", 400);
    }

    const userId = req.user!.id;

    const result = await uploadBufferToCloudinary(
      req.file.buffer,
      `chat-app/messages/${userId}`,
    );

    res.status(201).json({
      success: true,
      message: "Image uploaded successfully.",
      data: {
        url: result.secure_url,
        publicId: result.public_id,
      },
    });
  }
);

/**
 * @route DELETE /api/upload?publicId=chat-app/messages/<userId>/<id>
 * @desc Delete Image
 * @access Private
 *
 * publicId is passed as a query param (not a path segment) because
 * Cloudinary public_ids contain "/" from the folder structure, which a
 * single Express route param cannot match.
 *
 * Only assets uploaded into the caller's own folder may be deleted —
 * prevents any authenticated user from deleting any other user's asset
 * by guessing its public_id.
 */
export const deleteImage = asyncHandler(
  async (req: Request, res: Response) => {
    const publicId = req.query.publicId as string | undefined;
    const userId = req.user!.id;

    if (!publicId) {
      throw new AppError("Public ID is required.", 400);
    }

    if (!publicId.startsWith(`chat-app/messages/${userId}/`)) {
      throw new AppError("You are not authorized to delete this image.", 403);
    }

    await deleteFromCloudinary(publicId);

    res.status(200).json({
      success: true,
      message: "Image deleted successfully.",
    });
  }
);

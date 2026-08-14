import fs from "fs/promises";
import cloudinary from "../config/cloudinary.js";
import streamifier from "streamifier";
import type { UploadApiResponse } from "cloudinary";
/**
 * Upload image to Cloudinary
 */


export const uploadBufferToCloudinary = (
  buffer: Buffer,
  folder = "chat-app/avatars"
) => {
  return new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result as UploadApiResponse);
      }
    );

    streamifier.createReadStream(buffer).pipe(stream);
  });
};

/**
 * Delete image from Cloudinary
 */
export const deleteFromCloudinary = async (publicId: string) => {
  if (!publicId) return;

  await cloudinary.uploader.destroy(publicId);
};

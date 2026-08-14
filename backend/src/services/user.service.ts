import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import {
  uploadBufferToCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinary.js";
import bcrypt from "bcrypt";
import env from "../config/env.js";

class UserService {
  /**
   * List users other than the caller, optionally filtered by a name/email
   * search term. Powers the "start a new chat" user picker on the frontend.
   */
  async listUsers(userId: string, search?: string) {
    const filter: Record<string, unknown> = { _id: { $ne: userId } };

    if (search?.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      filter.$or = [{ name: regex }, { email: regex }];
    }

    return User.find(filter)
      .select("name email avatar bio isOnline lastSeen")
      .sort({ name: 1 })
      .limit(50);
  }

  /**
   * Get current user profile
   */
  async getProfile(userId: string) {
    const user = await User.findById(userId).select("-password");

    if (!user) {
      throw new AppError("User not found", 404);
    }

    return user;
  }

  /**
   * Update user profile
   */

  async updateProfile(userId: string, data: { name: string; bio: string }) {
    const { name, bio } = data;

    const user = await User.findById(userId);

    if (!user) {
      throw new AppError("User not found", 404);
    }

    if (name !== undefined) {
      user.name = name;
    }
    if (bio !== undefined) {
      user.bio = bio;
    }

    await user.save();

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      bio: user.bio,
      avatar: user.avatar,
    };
  }

  async changePassword(
    userId: string,
    data: { currentPassword: string; newPassword: string },
  ) {
    const { currentPassword, newPassword } = data;

    const user = await User.findById(userId).select("+password");

    if (!user) {
      throw new AppError("User not found", 404);
    }
    const isPasswordMatch = await bcrypt.compare(
      currentPassword,
      user.password,
    );

    if (!isPasswordMatch) {
      throw new AppError("Current password is incorrect", 400);
    }

    const hashedPassword = await bcrypt.hash(newPassword, env.BCRYPT_SALT_ROUNDS);

    user.password = hashedPassword;

    await user.save();

    return {
      success: true,
      message: "Password changed successfully",
    };
  }

  async uploadAvatar(userId: string, file?: Express.Multer.File) {
    if (!file) {
      throw new AppError("Avatar image is required", 400);
    }

    const user = await User.findById(userId);

    if (!user) {
      throw new AppError("User not found", 404);
    }

    const uploadedImage = await uploadBufferToCloudinary(file.buffer);

    const previousAvatarPublicId = user.avatar?.public_id;

    user.avatar = {
      public_id: uploadedImage.public_id,
      url: uploadedImage.secure_url,
    };

    await user.save();

    if (previousAvatarPublicId) {
      try {
        await deleteFromCloudinary(previousAvatarPublicId);
      } catch (error) {
        console.error(error);
      }
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      bio: user.bio,
      avatar: user.avatar,
    };
  }
}

export default new UserService();

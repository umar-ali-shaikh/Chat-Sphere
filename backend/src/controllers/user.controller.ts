import { Request, Response } from "express";
import asyncHandler from "../utils/asyncHandler.js";
import userService from "../services/user.service.js";

class UserController {
  /**
   * List/Search Users (excludes the caller)
   */

  listUsers = asyncHandler(async (req: Request, res: Response) => {
    const search = typeof req.query.q === "string" ? req.query.q : undefined;

    const users = await userService.listUsers(req.user!.id, search);

    res.status(200).json({ success: true, count: users.length, data: users });
  });

  /**
   * Get Current User Profile
   */

  getProfile = asyncHandler(async (req: Request, res: Response) => {
    const user = await userService.getProfile(req.user!.id);

    res.status(200).json({ success: true, data: user });
  });

  /**
   * Update User Profile
   */

  updateProfile = asyncHandler(async (req: Request, res: Response) => {
    const { name, bio } = req.body;

    const user = await userService.updateProfile(req.user!.id, { name, bio });

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: user,
    });
  });

  /**
   * Change Password
   */

  changePassword = asyncHandler(async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body;

    await userService.changePassword(req.user!.id, {
      currentPassword,
      newPassword,
    });

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  });

  /**
   * Upload Avatar
   */

  uploadAvatar = asyncHandler(async (req: Request, res: Response) => {
    const user = await userService.uploadAvatar(req.user!.id, req.file);

    res.status(200).json({
      success: true,
      message: "Avatar uploaded successfully",
      data: user,
    });
  });
}

export default new UserController();

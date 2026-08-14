import { Request, Response } from "express";

import asyncHandler from "../utils/asyncHandler.js";
import authService from "../services/auth.service.js";
import {
  authCookieOptions,
  authCookieOptionsWithExpiry,
} from "../utils/cookieOptions.js";

class AuthController {
  /**
   * Register User
   */
  register = asyncHandler(async (req: Request, res: Response) => {
    const { name, email, password } = req.body;

    const result = await authService.register({
      name,
      email,
      password,
    });

    res.cookie("token", result.token, authCookieOptionsWithExpiry);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: result.user,
    });
  });

  /**
   * Login User
   */
  login = asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    const result = await authService.login({
      email,
      password,
    });

    res.cookie("token", result.token, authCookieOptionsWithExpiry);

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: result.user,
    });
  });

  /**
   * Get Current Logged-in User
   */
  me = asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      data: req.user,
    });
  });

  /**
   * Logout User
   */
  logout = asyncHandler(async (_req: Request, res: Response) => {
    res.clearCookie("token", authCookieOptions);

    res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  });
}

export default new AuthController();
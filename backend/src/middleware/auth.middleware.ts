import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import asyncHandler from "../utils/asyncHandler.js";
import AppError from "../utils/AppError.js";
import env from "../config/env.js";
import User from "../models/User.js";

interface TokenPayload extends JwtPayload {
  userId: string;
}

export const protect = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies?.token;

    if (!token) {
      throw new AppError("Authentication required", 401);
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as TokenPayload;

    const user = await User.findById(decoded.userId);

    if (!user) {
      throw new AppError("User not found", 401);
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
    };

    next();
  },
);

import { Request, Response, NextFunction } from "express";
import multer from "multer";
import { ZodError } from "zod";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import AppError from "../utils/AppError.js";
import env from "../config/env.js";

const errorMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) => {
  let statusCode = err instanceof AppError ? err.statusCode : 500;
  let message = err.message || "Internal Server Error";

  if (err instanceof multer.MulterError) {
    statusCode = 400;
    message =
      err.code === "LIMIT_FILE_SIZE"
        ? "Avatar image must not exceed 5 MB"
        : "Invalid multipart upload";
  }

  if (err instanceof ZodError) {
    statusCode = 400;
    message = err.issues[0]?.message || "Invalid request data";
  }

  if (err instanceof SyntaxError && "body" in err) {
    statusCode = 400;
    message = "Invalid JSON request body";
  }

  if (err instanceof jwt.TokenExpiredError) {
    statusCode = 401;
    message = "Session expired. Please log in again.";
  } else if (err instanceof jwt.JsonWebTokenError) {
    statusCode = 401;
    message = "Invalid authentication token.";
  }

  if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = `Invalid value for ${err.path}.`;
  }

  if ((err as { code?: number }).code === 11000) {
    statusCode = 409;
    message = "A record with these details already exists.";
  }

  if (statusCode === 500 && env.NODE_ENV === "production") {
    console.error(err);
    message = "Internal Server Error";
  } else if (statusCode === 500) {
    console.error(err);
  }

  res.status(statusCode).json({
    success: false,
    message,
  });
};

export default errorMiddleware;

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import morgan from "morgan";
import env from "./config/env.js";

import authRouter from "./routes/auth.routes.js";
import userRouter from "./routes/user.routes.js";
import chatRouter from "./routes/chat.routes.js";
import messageRouter from "./routes/message.routes.js";
import uploadRouter from "./routes/upload.routes.js";
import notificationRouter from "./routes/notification.routes.js";

import notFound from "./middleware/notFound.js";
import errorHandler from "./middleware/error.js";
import { authLimiter } from "./middleware/rateLimit.middleware.js";

const app = express();

app.use(helmet());

if (env.NODE_ENV !== "test") {
  app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
}

app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Test Route
app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "🚀 Chat API is running...",
  });
});

// ✅ Routes
app.use("/api/auth", authLimiter, authRouter);
app.use("/api/user", userRouter);
app.use("/api/chat", chatRouter);
app.use("/api/messages", messageRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/notifications", notificationRouter);

// ✅ 404 Middleware (Always after all routes)
app.use(notFound);

// ✅ Error Middleware (Always last)
app.use(errorHandler);

export default app;

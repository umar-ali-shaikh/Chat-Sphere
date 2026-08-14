import { Router } from "express";
import chatController from "../controllers/chat.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const chatRouter = Router();

/**
 * Create Chat
 * POST /api/chat
 */
chatRouter.post("/", protect, chatController.createChat);

/**
 * Get Logged-in User Chats
 * GET /api/chat
 */
chatRouter.get("/", protect, chatController.getUserChats);

/**
 * Get Chat By Id
 * GET /api/chat/:chatId
 */
chatRouter.get("/:chatId", protect, chatController.getChatById);

/**
 * Delete Chat
 * DELETE /api/chat/:chatId
 */
chatRouter.delete("/:chatId", protect, chatController.deleteChat);

export default chatRouter;
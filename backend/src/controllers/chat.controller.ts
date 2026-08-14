import { Request, Response } from "express";
import asyncHandler from "../utils/asyncHandler.js";
import chatService from "../services/chat.service.js";
import AppError from "../utils/AppError.js";

class ChatController {
  /**
   * Create Chat
   * POST /chats
   * body: { receiverId }
   */
  createChat = asyncHandler(async (req: Request, res: Response) => {
    const senderId = req.user?.id;
    const { receiverId } = req.body;

    if (!senderId) {
      throw new AppError("Unauthorized.", 401);
    }

    if (!receiverId) {
      throw new AppError("Receiver id is required.", 400);
    }

    const chat = await chatService.createChat(senderId, receiverId);

    res.status(201).json({
      success: true,
      message: "Chat created successfully.",
      data: chat,
    });
  });

  /**
   * Get Logged-in User's Chats
   * GET /chats
   */
  getUserChats = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError("Unauthorized.", 401);
    }

    const page = req.query.page ? Number(req.query.page) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;

    const chats = await chatService.getUserChats(userId, page, limit);

    res.status(200).json({
      success: true,
      count: chats.length,
      data: chats,
    });
  });

  /**
   * Get Chat by Id
   * GET /chats/:chatId
   */
  getChatById = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const chatId = Array.isArray(req.params.chatId)
      ? undefined
      : req.params.chatId;

    if (!userId) {
      throw new AppError("Unauthorized.", 401);
    }
    if (!chatId) {
      throw new AppError("Invalid chat id.", 400);
    }

    const chat = await chatService.getChatById(chatId, userId);

    res.status(200).json({
      success: true,
      data: chat,
    });
  });

  /**
   * Delete Chat
   * DELETE /chats/:chatId
   */
  deleteChat = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const chatId = Array.isArray(req.params.chatId)
      ? undefined
      : req.params.chatId;

    if (!userId) {
      throw new AppError("Unauthorized.", 401);
    }
    if (!chatId) {
      throw new AppError("Invalid chat id.", 400);
    }

    const result = await chatService.deleteChat(chatId, userId);

    res.status(200).json(result);
  });
}

export default new ChatController();

import { Request, Response } from "express";
import * as messageService from "../services/message.service.js";
import asyncHandler from "../utils/asyncHandler.js";
import AppError from "../utils/AppError.js";
import { getIO } from "../config/socket.js";

/**
 * POST /api/messages
 * Send a new message. `sender` always comes from the authenticated
 * session — never from the request body — to prevent spoofing.
 */
export const sendMessage = asyncHandler(async (req: Request, res: Response) => {
  const senderId = req.user!.id;
  const { chat, receiver, text, image, replyTo } = req.body;

  const message = await messageService.sendMessage({
    chat,
    sender: senderId,
    receiver,
    text,
    image,
    replyTo,
  });

  res.status(201).json({
    success: true,
    message: "Message sent successfully.",
    data: message,
  });
});

/**
 * GET /api/messages/:chatId?limit=30&before=<ISO date>
 * Get paginated messages of a chat (caller must be a participant)
 */
export const getMessages = asyncHandler(async (req: Request, res: Response) => {
  const chatId = req.params.chatId;
  const userId = req.user!.id;

  if (!chatId) {
    throw new AppError("Chat ID is required.", 400);
  }

  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const before = req.query.before ? new Date(req.query.before as string) : undefined;

  const messages = await messageService.getMessages(chatId, userId, {
    limit,
    before,
  });

  res.status(200).json({
    success: true,
    count: messages.length,
    data: messages,
  });
});

/**
 * GET /api/messages/:chatId/search?q=<text>
 * Search messages within a chat (caller must be a participant)
 */
export const searchMessages = asyncHandler(async (req: Request, res: Response) => {
  const chatId = req.params.chatId;
  const userId = req.user!.id;
  const query = typeof req.query.q === "string" ? req.query.q : "";

  if (!chatId) {
    throw new AppError("Chat ID is required.", 400);
  }

  const messages = await messageService.searchMessages(chatId, userId, query);

  res.status(200).json({
    success: true,
    count: messages.length,
    data: messages,
  });
});

/**
 * PATCH /api/messages/:id/delivered
 * Mark message as delivered (only the receiver may confirm this)
 */
export const markAsDelivered = asyncHandler(async (req: Request, res: Response) => {
  const messageId = req.params.id;
  const userId = req.user!.id;

  if (!messageId) {
    throw new AppError("Message ID is required.", 400);
  }

  const message = await messageService.markAsDelivered(messageId, userId);

  if (!message) {
    throw new AppError("Message not found.", 404);
  }

  res.status(200).json({
    success: true,
    message: "Message marked as delivered.",
    data: message,
  });
});

/**
 * PATCH /api/messages/:id/seen
 * Mark message as seen (only the receiver may confirm this)
 */
export const markAsSeen = asyncHandler(async (req: Request, res: Response) => {
  const messageId = req.params.id;
  const userId = req.user!.id;

  if (!messageId) {
    throw new AppError("Message ID is required.", 400);
  }

  const message = await messageService.markAsSeen(messageId, userId);

  if (!message) {
    throw new AppError("Message not found.", 404);
  }

  res.status(200).json({
    success: true,
    message: "Message marked as seen.",
    data: message,
  });
});

/**
 * DELETE /api/messages/:id
 * Delete a message (only the original sender may delete it)
 */
export const deleteMessage = asyncHandler(async (req: Request, res: Response) => {
  const messageId = req.params.id;
  const userId = req.user!.id;

  if (!messageId) {
    throw new AppError("Message ID is required.", 400);
  }

  const { chatId } = await messageService.deleteMessage(messageId, userId);

  // Broadcast to the room so the other participant's UI removes the
  // message live instead of waiting for their next fetch.
  getIO().to(chatId).emit("message_deleted", { messageId, chatId });

  res.status(200).json({
    success: true,
    message: "Message deleted successfully.",
  });
});

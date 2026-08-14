import User from "../models/User.js";
import Chat from "../models/Chat.js";
import Message from "../models/Message.js";
import AppError from "../utils/AppError.js";
import { Types } from "mongoose";

class ChatService {
  /**
   * Chat Created
   */
  async createChat(senderId: string, receiverId: string) {
    // Cannot chat with yourself
    if (senderId === receiverId) {
      throw new AppError("You cannot create chat with yourself.", 400);
    }

    // Check both users exist
    const [sender, receiver] = await Promise.all([
      User.findById(senderId),
      User.findById(receiverId),
    ]);

    if (!sender) {
      throw new AppError("Sender not found.", 404);
    }

    if (!receiver) {
      throw new AppError("Receiver not found.", 404);
    }

    const pairKey = [senderId, receiverId].sort().join("_");

    // Check existing chat
    const existingChat = await Chat.findOne({ pairKey }).populate(
      "participants",
      "name email avatar",
    );

    if (existingChat) {
      return existingChat;
    }

    // Create new chat. If two requests race past the findOne check above,
    // the unique index on pairKey rejects the loser here (E11000) instead
    // of creating a duplicate chat — fall back to fetching the winner's chat.
    try {
      const chat = await Chat.create({
        participants: [senderId, receiverId],
      });

      return await Chat.findById(chat._id).populate(
        "participants",
        "name email avatar",
      );
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        const chat = await Chat.findOne({ pairKey }).populate(
          "participants",
          "name email avatar",
        );

        if (chat) return chat;
      }

      throw error;
    }
  }

  /**
   * Get Logged-in User's Chats
   * Each chat is annotated with `unreadCount` — the number of messages in
   * that chat addressed to this user that aren't yet marked "seen". Derived
   * from Message.status (already maintained by the delivered/seen socket
   * flow) via a single aggregation, rather than a separate read-state model
   * or notification bookkeeping — avoids N+1 queries and stays in sync for
   * free whenever a message's status changes.
   */
  async getUserChats(userId: string, page = 1, limit = 20) {
    const safeLimit = Math.min(limit, 50);
    const safePage = Math.max(page, 1);

    const chats = await Chat.find({
      participants: userId,
    })
      .populate("participants", "name email avatar isOnline")
      .sort({ updatedAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean();

    if (chats.length === 0) {
      return chats;
    }

    const chatIds = chats.map((chat) => chat._id);

    const unreadCounts = await Message.aggregate<{ _id: Types.ObjectId; count: number }>([
      {
        $match: {
          chat: { $in: chatIds },
          receiver: new Types.ObjectId(userId),
          status: { $ne: "seen" },
        },
      },
      { $group: { _id: "$chat", count: { $sum: 1 } } },
    ]);

    const unreadByChatId = new Map(
      unreadCounts.map((entry) => [entry._id.toString(), entry.count]),
    );

    return chats.map((chat) => ({
      ...chat,
      unreadCount: unreadByChatId.get(chat._id.toString()) ?? 0,
    }));
  }

  /**
   * Get chat by id
   */
  async getChatById(chatId: string, userId: string) {
    // Validate chat id
    if (!Types.ObjectId.isValid(chatId)) {
      throw new AppError("Invalid chat id.", 400);
    }

    // Find chat
    const chat = await Chat.findById(chatId).populate(
      "participants",
      "name email avatar isOnline",
    );

    if (!chat) {
      throw new AppError("Chat not found.", 404);
    }

    // Check if logged-in user is participant
    const isParticipant = chat.participants.some(
      (participant) => participant._id.toString() === userId,
    );

    if (!isParticipant) {
      throw new AppError("You are not authorized to access this chat.", 403);
    }

    return chat;
  }

  /**
   * Delete Chat
   */
  async deleteChat(chatId: string, userId: string) {
    // Validate Chat Id
    if (!Types.ObjectId.isValid(chatId)) {
      throw new AppError("Invalid chat id.", 400);
    }

    // Find Chat
    const chat = await Chat.findById(chatId);

    if (!chat) {
      throw new AppError("Chat not found.", 404);
    }

    // Check authorization
    const isParticipant = chat.participants.some(
      (participant) => participant.toString() === userId,
    );

    if (!isParticipant) {
      throw new AppError("You are not authorized to delete this chat.", 403);
    }

    // Delete Chat
    await Chat.findByIdAndDelete(chatId);

    return {
      success: true,
      message: "Chat deleted successfully.",
    };
  }

  /**
   * Check whether a user is a participant of a chat.
   * Used by Socket.IO handlers to authorize room joins / message sends,
   * since sockets have no middleware chain to lean on like REST routes do.
   */
  async isParticipant(chatId: string, userId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(chatId)) {
      return false;
    }

    const chat = await Chat.findById(chatId).select("participants");

    if (!chat) {
      return false;
    }

    return chat.participants.some(
      (participant) => participant.toString() === userId,
    );
  }
}

export default new ChatService();


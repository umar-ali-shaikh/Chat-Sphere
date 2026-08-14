import { Socket } from "socket.io";

import * as messageService from "../services/message.service.js";
import chatService from "../services/chat.service.js";
import AppError from "../utils/AppError.js";

import { SendMessagePayload, SocketData } from "../types/socket.js";
import { AppServer } from "../config/socket.js";

type AppSocket = Socket<any, any, any, SocketData>;

const registerChatSocket = (io: AppServer, socket: AppSocket): void => {
  const userId = socket.data.userId;

  /**
   * Join Chat — only a participant of the chat may join its room, otherwise
   * any client could eavesdrop on any conversation by guessing a chat id.
   */
  socket.on("join_chat", async (chatId: string) => {
    try {
      const allowed = await chatService.isParticipant(chatId, userId);

      if (!allowed) {
        socket.emit("error", { message: "You are not a participant of this chat." });
        return;
      }

      socket.join(chatId);
    } catch (error) {
      console.error(error);
      socket.emit("error", { message: "Could not join chat." });
    }
  });

  /**
   * Leave Chat
   */
  socket.on("leave_chat", (chatId: string) => {
    socket.leave(chatId);
  });

  /**
   * Send Message
   * `sender` is always the authenticated socket's userId — the value in
   * the payload (if any) is ignored so a client cannot send messages that
   * impersonate another user.
   */
  socket.on("send_message", async (payload: SendMessagePayload) => {
    try {
      const message = await messageService.sendMessage({
        chat: payload.chat,
        sender: userId,
        receiver: payload.receiver,
        text: payload.text,
        image: payload.image,
        replyTo: payload.replyTo,
      });

      io.to(payload.chat).emit("receive_message", message);

      io.to(payload.receiver).emit("new_notification", {
        title: "New Message",
        body: payload.text ?? "📷 Sent an image",
      });
    } catch (error) {
      const message =
        error instanceof AppError ? error.message : "Could not send message.";
      socket.emit("error", { message });
    }
  });

  /**
   * Message Delivered — only the receiver may confirm delivery.
   */
  socket.on("message_delivered", async (messageId: string) => {
    try {
      const message = await messageService.markAsDelivered(messageId, userId);

      if (!message) return;

      io.to(message.chat.toString()).emit("message_delivered", {
        messageId: message._id,
        deliveredAt: message.deliveredAt,
      });
    } catch (error) {
      console.error(error);
    }
  });

  /**
   * Message Seen — only the receiver may confirm it was seen.
   */
  socket.on("message_seen", async (messageId: string) => {
    try {
      const message = await messageService.markAsSeen(messageId, userId);

      if (!message) return;

      io.to(message.chat.toString()).emit("message_seen", {
        messageId: message._id,
        seenAt: message.seenAt,
      });
    } catch (error) {
      console.error(error);
    }
  });
};

export default registerChatSocket;

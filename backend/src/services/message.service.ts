import { Types } from "mongoose";
import Message, { IMessage } from "../models/Message.js";
import Chat from "../models/Chat.js";
import AppError from "../utils/AppError.js";
import * as notificationService from "./notification.service.js";

interface SendMessageInput {
  chat: string;
  sender: string;
  receiver: string;
  text?: string;
  image?: string;
  replyTo?: string;
}

const assertValidObjectId = (id: string, label: string): void => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${label}.`, 400);
  }
};

/** Lightweight quoted-preview populate for a message's `replyTo` reference. */
const REPLY_TO_POPULATE = {
  path: "replyTo",
  select: "text image sender",
  populate: { path: "sender", select: "name" },
};

/**
 * Send Message
 * Verifies the chat exists and the sender is actually a participant
 * before persisting — prevents sending messages into chats the caller
 * has no access to.
 */
export const sendMessage = async (
  data: SendMessageInput
): Promise<IMessage> => {
  assertValidObjectId(data.chat, "chat id");
  assertValidObjectId(data.receiver, "receiver id");

  const chat = await Chat.findById(data.chat);

  if (!chat) {
    throw new AppError("Chat not found.", 404);
  }

  const participantIds = chat.participants.map((p) => p.toString());

  if (!participantIds.includes(data.sender)) {
    throw new AppError("You are not a participant of this chat.", 403);
  }

  if (!participantIds.includes(data.receiver)) {
    throw new AppError("Receiver is not a participant of this chat.", 400);
  }

  let replyTo: string | undefined;
  if (data.replyTo) {
    assertValidObjectId(data.replyTo, "reply-to message id");
    const original = await Message.findById(data.replyTo).select("chat");
    // Silently drop an invalid/foreign reply reference rather than failing
    // the whole send — the reference is a UX nicety, not load-bearing, and
    // this also stops a caller from using it to probe whether a message id
    // from another chat exists.
    if (original && original.chat.toString() === data.chat) {
      replyTo = data.replyTo;
    }
  }

  const message = await Message.create({
    chat: data.chat,
    sender: data.sender,
    receiver: data.receiver,
    text: data.text,
    image: data.image,
    replyTo,
  });

  await Chat.findByIdAndUpdate(data.chat, {
    lastMessage: message.text || "📷 Image",
    lastMessageAt: new Date(),
  });

  await notificationService.createNotification({
    recipient: message.receiver,
    sender: message.sender,
    chat: message.chat,
    message: message._id,

    type: message.image ? "image" : "message",

    title: "New Message",

    body: message.text || "📷 Sent an image",
  });

  return message;
};

/**
 * Get Messages of a Chat (cursor-paginated, newest-first fetch, returned oldest-first)
 * Only a participant of the chat may read its messages.
 */
export const getMessages = async (
  chatId: string,
  userId: string,
  options: { limit?: number; before?: Date } = {}
): Promise<IMessage[]> => {
  assertValidObjectId(chatId, "chat id");

  const chat = await Chat.findById(chatId);

  if (!chat) {
    throw new AppError("Chat not found.", 404);
  }

  const isParticipant = chat.participants.some(
    (participant) => participant.toString() === userId,
  );

  if (!isParticipant) {
    throw new AppError("You are not authorized to view this chat.", 403);
  }

  const limit = Math.min(options.limit ?? 30, 100);
  const filter: Record<string, unknown> = { chat: chatId };

  if (options.before) {
    filter.createdAt = { $lt: options.before };
  }

  const messages = await Message.find(filter)
    .populate("sender", "name email avatar")
    .populate("receiver", "name email avatar")
    .populate(REPLY_TO_POPULATE)
    .sort({ createdAt: -1 })
    .limit(limit);

  return messages.reverse();
};

/**
 * Search messages within a single chat by text content (case-insensitive).
 * Scoped to one chat rather than a global search — cheap regex scan is fine
 * at the size of a single conversation's history, and it keeps the caller
 * from ever seeing a message from a chat they aren't a participant of.
 */
export const searchMessages = async (
  chatId: string,
  userId: string,
  query: string,
): Promise<IMessage[]> => {
  assertValidObjectId(chatId, "chat id");

  const trimmed = query.trim().slice(0, 200);
  if (!trimmed) {
    return [];
  }

  const chat = await Chat.findById(chatId);

  if (!chat) {
    throw new AppError("Chat not found.", 404);
  }

  const isParticipant = chat.participants.some(
    (participant) => participant.toString() === userId,
  );

  if (!isParticipant) {
    throw new AppError("You are not authorized to search this chat.", 403);
  }

  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(escaped, "i");

  const messages = await Message.find({ chat: chatId, text: regex })
    .populate("sender", "name email avatar")
    .populate("receiver", "name email avatar")
    .sort({ createdAt: -1 })
    .limit(50);

  return messages;
};

/**
 * Mark Message as Delivered
 * Only the receiver of the message can confirm delivery.
 */
export const markAsDelivered = async (
  messageId: string,
  userId: string
): Promise<IMessage | null> => {
  assertValidObjectId(messageId, "message id");

  return await Message.findOneAndUpdate(
    { _id: messageId, receiver: userId },
    {
      status: "delivered",
      deliveredAt: new Date(),
    },
    {
      new: true,
    }
  );
};

/**
 * Mark Message as Seen
 * Only the receiver of the message can confirm it was seen.
 */
export const markAsSeen = async (
  messageId: string,
  userId: string
): Promise<IMessage | null> => {
  assertValidObjectId(messageId, "message id");

  return await Message.findOneAndUpdate(
    { _id: messageId, receiver: userId },
    {
      status: "seen",
      seenAt: new Date(),
    },
    {
      new: true,
    }
  );
};

/**
 * Delete Message
 * Only the original sender can delete their own message. This is a hard
 * delete — i.e. "delete for everyone" — so the caller broadcasts a
 * `message_deleted` event to the chat room using the returned chat id to
 * update the other participant's UI in realtime.
 */
export const deleteMessage = async (
  messageId: string,
  userId: string
): Promise<{ chatId: string }> => {
  assertValidObjectId(messageId, "message id");

  const message = await Message.findById(messageId);

  if (!message) {
    throw new AppError("Message not found.", 404);
  }

  if (message.sender.toString() !== userId) {
    throw new AppError("You are not authorized to delete this message.", 403);
  }

  const chatId = message.chat.toString();

  await Message.findByIdAndDelete(messageId);

  return { chatId };
};

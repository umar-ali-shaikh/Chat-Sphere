import type { RawMessage } from "@/types/api";

/**
 * Mirrors backend/src/types/socket.ts and the events actually emitted by
 * backend/src/sockets/*.ts — kept in one place so client and server payload
 * shapes don't drift apart.
 */

export interface SendMessagePayload {
  chat: string;
  receiver: string;
  text?: string | undefined;
  image?: string | undefined;
  replyTo?: string | undefined;
}

export interface TypingEventPayload {
  chatId: string;
  userId: string;
}

export interface MessageStatusEventPayload {
  messageId: string;
  deliveredAt?: string;
  seenAt?: string;
}

export interface MessageDeletedEventPayload {
  messageId: string;
  chatId: string;
}

export interface NewNotificationPayload {
  title: string;
  body: string;
}

export interface OnlineUserEventPayload {
  userId: string;
}

export interface SocketErrorPayload {
  message: string;
}

export interface ServerToClientEvents {
  receive_message: (message: RawMessage) => void;
  message_delivered: (payload: MessageStatusEventPayload) => void;
  message_seen: (payload: MessageStatusEventPayload) => void;
  message_deleted: (payload: MessageDeletedEventPayload) => void;
  typing: (payload: TypingEventPayload) => void;
  stop_typing: (payload: TypingEventPayload) => void;
  online_users: (userIds: string[]) => void;
  user_online: (payload: OnlineUserEventPayload) => void;
  user_offline: (payload: OnlineUserEventPayload) => void;
  new_notification: (payload: NewNotificationPayload) => void;
  error: (payload: SocketErrorPayload) => void;
}

export interface ClientToServerEvents {
  join_chat: (chatId: string) => void;
  leave_chat: (chatId: string) => void;
  send_message: (payload: SendMessagePayload) => void;
  message_delivered: (messageId: string) => void;
  message_seen: (messageId: string) => void;
  typing: (chatId: string) => void;
  stop_typing: (chatId: string) => void;
  get_online_users: () => void;
}

/**
 * Per-connection socket state set by the auth middleware in config/socket.ts.
 * `userId` is the ONLY trustworthy source of identity for a socket — every
 * handler must use this instead of any client-supplied id in a payload.
 */
export interface SocketData {
  userId: string;
}

/**
 * Payload for sending a message over Socket.IO.
 * `sender` is accepted for backward-compatible payload shape but is never
 * trusted — handlers overwrite it with the authenticated socket.data.userId.
 */
export interface SendMessagePayload {
  chat: string;
  sender: string;
  receiver: string;

  text?: string;
  image?: string;
  replyTo?: string;
}

/**
 * Payload for message status
 */
export interface MessageStatusPayload {
  messageId: string;
}

/**
 * Emitted to a chat room after a message is deleted (delete-for-everyone).
 */
export interface MessageDeletedPayload {
  messageId: string;
  chatId: string;
}

/**
 * Payload for typing events
 */
export interface TypingPayload {
  chatId: string;
  userId: string;
}

/**
 * Payload for notifications
 */
export interface NotificationPayload {
  recipient: string;
  sender: string;
  chat: string;
  message: string;

  title: string;
  body: string;

  type: "message" | "image";
}

/**
 * Payload for joining a chat room
 */
export interface JoinChatPayload {
  chatId: string;
}

/**
 * Payload for joining a personal room
 */
export interface JoinUserPayload {
  userId: string;
}
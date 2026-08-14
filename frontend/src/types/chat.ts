export type PresenceStatus = "online" | "away" | "offline";

export interface User {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  status: PresenceStatus;
  bio?: string | undefined;
}

export type MessageState = "sending" | "sent" | "delivered" | "seen" | "failed";

export interface MessageReplyPreview {
  id: string;
  body?: string | undefined;
  imageUrl?: string | undefined;
  authorId?: string | undefined;
  authorName?: string | undefined;
}

export interface Message {
  id: string;
  conversationId: string;
  authorId: string;
  body: string;
  createdAt: string;
  state: MessageState;
  imageUrl?: string | undefined;
  replyTo?: MessageReplyPreview | undefined;
  /** Present only for optimistic messages not yet confirmed by the server. */
  clientId?: string | undefined;
}

export interface Conversation {
  id: string;
  participantId: string;
  unread: number;
  pinned?: boolean;
}
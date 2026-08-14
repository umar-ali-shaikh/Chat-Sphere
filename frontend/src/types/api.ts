/**
 * Raw shapes as returned by the backend (backend/src/models, controllers).
 * Mongoose documents serialize with `_id`; the few endpoints that build a
 * plain object by hand (auth register/login/me, profile update, avatar
 * upload) use `id` instead — both are accepted here and reconciled by the
 * normalize* helpers below.
 */

export interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  count?: number;
  data: T;
}

export interface RawAvatar {
  public_id: string;
  url: string;
}

export interface RawUser {
  _id?: string;
  id?: string;
  name: string;
  email: string;
  avatar?: RawAvatar;
  bio?: string;
  isOnline?: boolean;
  lastSeen?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RawChat {
  _id?: string;
  id?: string;
  participants: RawUser[];
  lastMessage?: string;
  lastMessageAt?: string | null;
  /** Count of messages addressed to the caller in this chat not yet marked "seen". */
  unreadCount?: number;
  createdAt: string;
  updatedAt: string;
}

export type MessageStatus = "sent" | "delivered" | "seen";

/**
 * Populated only on REST fetches (getMessages); the socket `send_message`
 * echo carries `replyTo` as a bare id string, same asymmetry as sender/receiver.
 */
export interface RawReplyTo {
  _id?: string;
  id?: string;
  text?: string;
  image?: string;
  sender?: RawUser | string;
}

export interface RawMessage {
  _id?: string;
  id?: string;
  chat: string;
  sender: RawUser | string;
  receiver: RawUser | string;
  text?: string;
  image?: string;
  replyTo?: RawReplyTo | string | null;
  status: MessageStatus;
  deliveredAt?: string;
  seenAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type NotificationType = "message" | "image";

export interface RawNotification {
  _id?: string;
  id?: string;
  recipient: string;
  sender: RawUser | string;
  chat: string;
  message?: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** Normalized shapes used throughout the frontend — always a plain string `id`. */

export interface AppUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | undefined;
  bio?: string | undefined;
  isOnline?: boolean | undefined;
  lastSeen?: string | undefined;
}

export interface AppChat {
  id: string;
  participants: AppUser[];
  lastMessage?: string | undefined;
  lastMessageAt?: string | null | undefined;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AppReplyTo {
  id: string;
  text?: string | undefined;
  image?: string | undefined;
  senderId?: string | undefined;
  senderName?: string | undefined;
}

export interface AppMessage {
  id: string;
  chat: string;
  sender: AppUser | string;
  receiver: AppUser | string;
  text?: string | undefined;
  image?: string | undefined;
  replyTo?: AppReplyTo | undefined;
  status: MessageStatus | "sending" | "failed";
  deliveredAt?: string | undefined;
  seenAt?: string | undefined;
  createdAt: string;
  clientId?: string | undefined;
}

export interface AppNotification {
  id: string;
  recipient: string;
  sender: AppUser | string;
  chat: string;
  message?: string | undefined;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  readAt?: string | undefined;
  createdAt: string;
}

const rawId = (entity: { _id?: string; id?: string }): string => entity.id ?? entity._id ?? "";

export function normalizeUser(raw: RawUser): AppUser {
  return {
    id: rawId(raw),
    name: raw.name,
    email: raw.email,
    avatarUrl: raw.avatar?.url || undefined,
    bio: raw.bio,
    isOnline: raw.isOnline,
    lastSeen: raw.lastSeen,
  };
}

function normalizeParty(raw: RawUser | string): AppUser | string {
  return typeof raw === "string" ? raw : normalizeUser(raw);
}

export function partyId(party: AppUser | string): string {
  return typeof party === "string" ? party : party.id;
}

export function normalizeChat(raw: RawChat): AppChat {
  return {
    id: rawId(raw),
    participants: raw.participants.map(normalizeUser),
    lastMessage: raw.lastMessage,
    lastMessageAt: raw.lastMessageAt,
    unreadCount: raw.unreadCount ?? 0,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

function normalizeReplyTo(raw: RawReplyTo | string | null | undefined): AppReplyTo | undefined {
  if (!raw) return undefined;
  if (typeof raw === "string") return { id: raw };
  const sender = raw.sender;
  return {
    id: rawId(raw),
    text: raw.text,
    image: raw.image,
    senderId: sender ? partyId(normalizeParty(sender)) : undefined,
    senderName: sender && typeof sender !== "string" ? sender.name : undefined,
  };
}

export function normalizeMessage(raw: RawMessage): AppMessage {
  return {
    id: rawId(raw),
    chat: raw.chat,
    sender: normalizeParty(raw.sender),
    receiver: normalizeParty(raw.receiver),
    text: raw.text,
    image: raw.image,
    replyTo: normalizeReplyTo(raw.replyTo),
    status: raw.status,
    deliveredAt: raw.deliveredAt,
    seenAt: raw.seenAt,
    createdAt: raw.createdAt,
  };
}

export function normalizeNotification(raw: RawNotification): AppNotification {
  return {
    id: rawId(raw),
    recipient: raw.recipient,
    sender: normalizeParty(raw.sender),
    chat: raw.chat,
    message: raw.message,
    type: raw.type,
    title: raw.title,
    body: raw.body,
    isRead: raw.isRead,
    readAt: raw.readAt,
    createdAt: raw.createdAt,
  };
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

import type { Conversation, Message, User } from "@/types/chat";

export const currentUser: User = {
  id: "u0",
  name: "Aria Chen",
  handle: "@aria",
  avatar: "AC",
  status: "online",
  bio: "Product designer. Ships pixels at 2am.",
};

export const users: User[] = [
  { id: "u1", name: "Noah Patel", handle: "@noah", avatar: "NP", status: "online", bio: "Backend @ Orbit" },
  { id: "u2", name: "Mira Lund", handle: "@mira", avatar: "ML", status: "online", bio: "Design systems" },
  { id: "u3", name: "Kai Rivera", handle: "@kai", avatar: "KR", status: "away", bio: "Infra gremlin" },
  { id: "u4", name: "Sofia Ahmed", handle: "@sofia", avatar: "SA", status: "offline", bio: "PM, coffee enjoyer" },
  { id: "u5", name: "Leo Marchetti", handle: "@leo", avatar: "LM", status: "online", bio: "Motion & 3D" },
  { id: "u6", name: "Ines Duarte", handle: "@ines", avatar: "ID", status: "offline", bio: "Writes docs nobody reads" },
];

export const conversations: Conversation[] = [
  { id: "c1", participantId: "u1", unread: 2, pinned: true },
  { id: "c2", participantId: "u2", unread: 0, pinned: true },
  { id: "c3", participantId: "u3", unread: 5 },
  { id: "c4", participantId: "u4", unread: 0 },
  { id: "c5", participantId: "u5", unread: 1 },
  { id: "c6", participantId: "u6", unread: 0 },
];

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

let seq = 0;
const msg = (
  conversationId: string,
  authorId: string,
  body: string,
  minutes: number,
  state: Message["state"] = "seen",
): Message => ({
  id: `m${++seq}`,
  conversationId,
  authorId,
  body,
  createdAt: minutesAgo(minutes),
  state,
});

export const messages: Message[] = [
  msg("c1", "u1", "Deploy went out — realtime latency is down to 40ms.", 240),
  msg("c1", "u0", "That's a huge jump. Did the socket pool change land too?", 232),
  msg("c1", "u1", "Yep, connection reuse plus a smaller heartbeat window.", 228),
  msg("c1", "u1", "Want me to write it up before standup?", 12, "delivered"),

  msg("c2", "u2", "Pushed the new glass tokens to the design file.", 180),
  msg("c2", "u0", "Love the border treatment. Softer than the last pass.", 176),
  msg("c2", "u2", "Exactly — 1px, 10% white. Reads better on dark.", 174),

  msg("c3", "u3", "Staging box is flapping again.", 90),
  msg("c3", "u3", "Rolled it back for now, no user impact.", 88),
  msg("c3", "u0", "Thanks for catching it early.", 60),

  msg("c4", "u4", "Roadmap review moved to Thursday.", 620),
  msg("c4", "u0", "Works for me.", 610),

  msg("c5", "u5", "Prototyped the particle field for the landing page.", 45),
  msg("c5", "u0", "Ship it if it stays above 60fps on a laptop.", 40),
  msg("c5", "u5", "It does. GPU cost is basically nothing.", 35),

  msg("c6", "u6", "Docs for the message API are updated.", 1500),
];

export const replyBank = [
  "Makes sense — I'll take a look shortly.",
  "On it. Give me ten minutes.",
  "Interesting, hadn't thought about it that way.",
  "Can you share a screenshot?",
  "Agreed. Let's ship it.",
  "Perfect timing, I was just about to ask.",
];
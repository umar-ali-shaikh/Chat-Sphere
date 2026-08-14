/**
 * Full-stack protocol integration test: REST + Socket.IO, against a real
 * running server and a real database (no mocks). Requires the dev server
 * already running — see `npm run test:e2e` in package.json.
 *
 * This intentionally uses Node's built-in test runner + assert instead of
 * an external test framework: the whole suite is one linear flow (register
 * two users, create a chat, exercise realtime + REST together), which is
 * exactly what `node:test`'s sequential-by-default execution gives for
 * free without extra dependencies.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { io, type Socket } from "socket.io-client";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:5000";
const API = `${BASE}/api`;
const PASSWORD = "Passw0rd!23";
const stamp = Date.now();

interface ApiResponse<T = unknown> {
  status: number;
  data: {
    success: boolean;
    message?: string;
    count?: number;
    data?: T;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  };
}

/** Minimal per-session cookie jar — Node's fetch doesn't manage cookies automatically. */
function makeSession() {
  let cookie = "";

  async function request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<ApiResponse<T>> {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const setCookie = res.headers.getSetCookie?.() ?? [];
    if (setCookie.length > 0) {
      cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
    }

    const data = (await res.json().catch(() => ({}))) as ApiResponse<T>["data"];
    return { status: res.status, data };
  }

  return {
    get: <T = unknown>(path: string) => request<T>("GET", path),
    post: <T = unknown>(path: string, body?: unknown) => request<T>("POST", path, body),
    put: <T = unknown>(path: string, body?: unknown) => request<T>("PUT", path, body),
    patch: <T = unknown>(path: string, body?: unknown) => request<T>("PATCH", path, body),
    delete: <T = unknown>(path: string) => request<T>("DELETE", path),
    getCookie: () => cookie,
  };
}

function waitForEvent<T>(socket: Socket, event: string, timeoutMs = 4000): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

function chatIdOf(chat: { chat: string } | string | { _id: string }): string {
  if (typeof chat === "string") return chat;
  return "_id" in chat ? chat._id : (chat as { chat: string }).chat;
}

const A = makeSession();
const B = makeSession();
const C = makeSession();
const emailA = `alice.e2e.${stamp}@example.com`;
const emailB = `bob.e2e.${stamp}@example.com`;
const emailC = `carol.e2e.${stamp}@example.com`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let userA: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let userB: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let chat: any;
let socketA: Socket;
let socketB: Socket;
let messageId: string;

test("register A -> 201, sets httpOnly cookie", async () => {
  const res = await A.post("/auth/register", { name: "Alice E2E", email: emailA, password: PASSWORD });
  assert.equal(res.status, 201);
  userA = res.data.data;
  assert.ok(A.getCookie().includes("token="));
});

test("register B -> 201", async () => {
  const res = await B.post("/auth/register", { name: "Bob E2E", email: emailB, password: PASSWORD });
  assert.equal(res.status, 201);
  userB = res.data.data;
});

test("register C -> 201 (used only for message-search authorization checks)", async () => {
  const res = await C.post("/auth/register", { name: "Carol E2E", email: emailC, password: PASSWORD });
  assert.equal(res.status, 201);
});

test("duplicate register -> 409", async () => {
  const res = await A.post("/auth/register", { name: "Alice E2E", email: emailA, password: PASSWORD });
  assert.equal(res.status, 409);
});

test("invalid login -> 401", async () => {
  const res = await A.post("/auth/login", { email: emailA, password: "wrongpassword" });
  assert.equal(res.status, 401);
});

test("GET /auth/me -> 200, matches registered user", async () => {
  const res = await A.get<{ email: string }>("/auth/me");
  assert.equal(res.status, 200);
  assert.equal(res.data.data?.email, emailA);
});

test("protected route without cookie -> 401", async () => {
  const anon = makeSession();
  const res = await anon.get("/auth/me");
  assert.equal(res.status, 401);
});

test("user search finds the other user, excludes self", async () => {
  const res = await A.get<{ email: string }[]>("/user?q=Bob");
  assert.equal(res.status, 200);
  const emails = (res.data.data ?? []).map((u) => u.email);
  assert.ok(emails.includes(emailB));
  assert.ok(!emails.includes(emailA));
});

test("create chat -> 201", async () => {
  const res = await A.post("/chat", { receiverId: userB.id });
  assert.equal(res.status, 201);
  chat = res.data.data;
});

test("duplicate create chat is race-safe (returns the same chat, no dupe)", async () => {
  const res = await A.post("/chat", { receiverId: userB.id });
  assert.equal(res.status, 201);
  assert.equal(res.data.data._id, chat._id);
});

test("B's chat list includes the new chat", async () => {
  const res = await B.get<{ _id: string }[]>("/chat");
  assert.ok((res.data.data ?? []).some((c) => c._id === chat._id));
});

test("socket auth: unauthenticated socket is rejected", async () => {
  const anonSocket = io(BASE, { transports: ["websocket"], reconnection: false });
  const rejected = await new Promise<boolean>((resolve) => {
    anonSocket.on("connect_error", () => resolve(true));
    anonSocket.on("connect", () => resolve(false));
    setTimeout(() => resolve(false), 3000);
  });
  anonSocket.close();
  assert.equal(rejected, true);
});

before(async () => {
  // Nothing global — sockets are opened inside the test that needs them, once
  // both users' cookies exist. Kept as a placeholder hook for symmetry with `after`.
});

test("socket auth: authenticated sockets connect for both users", async () => {
  socketA = io(BASE, { extraHeaders: { Cookie: A.getCookie() }, transports: ["websocket"] });
  socketB = io(BASE, { extraHeaders: { Cookie: B.getCookie() }, transports: ["websocket"] });

  await Promise.all([
    new Promise<void>((resolve, reject) => {
      socketA.on("connect", () => resolve());
      socketA.on("connect_error", reject);
    }),
    new Promise<void>((resolve, reject) => {
      socketB.on("connect", () => resolve());
      socketB.on("connect_error", reject);
    }),
  ]);

  assert.equal(socketA.connected, true);
  assert.equal(socketB.connected, true);
});

test("presence: online_users includes both connected users", async () => {
  const onlineUsers = await new Promise<string[]>((resolve) => {
    socketB.emit("get_online_users");
    socketB.once("online_users", resolve);
  });
  assert.ok(onlineUsers.includes(userA.id));
  assert.ok(onlineUsers.includes(userB.id));
});

test("join_chat rooms for both participants", async () => {
  socketA.emit("join_chat", chat._id);
  socketB.emit("join_chat", chat._id);
  await new Promise((r) => setTimeout(r, 250));
});

test("typing: B receives typing event from A", async () => {
  const pending = waitForEvent<{ chatId: string; userId: string }>(socketB, "typing");
  socketA.emit("typing", chat._id);
  const payload = await pending;
  assert.equal(payload?.userId, userA.id);
  assert.equal(payload?.chatId, chat._id);
});

test("stop typing: B receives stop_typing event from A", async () => {
  const pending = waitForEvent(socketB, "stop_typing");
  socketA.emit("stop_typing", chat._id);
  const payload = await pending;
  assert.ok(payload);
});

test("realtime: send_message delivers to both participants", async () => {
  const text = `Hello from Alice ${stamp}`;
  const toB = waitForEvent<{ _id: string; text: string; sender: string }>(socketB, "receive_message");
  const toA = waitForEvent<{ _id: string; text: string }>(socketA, "receive_message");

  socketA.emit("send_message", { chat: chat._id, receiver: userB.id, text });

  const [msgB, msgA] = await Promise.all([toB, toA]);
  assert.equal(msgB?.text, text);
  assert.equal(msgA?.text, text);
  assert.equal(msgB?.sender, userA.id, "sender must be server-derived, not spoofable");
  assert.ok(msgB?._id);
  messageId = msgB!._id;
});

test("unread count: B's chat list shows the new unseen message", async () => {
  const res = await B.get<{ _id: string; unreadCount: number }[]>("/chat");
  const found = (res.data.data ?? []).find((c) => c._id === chat._id);
  assert.equal(found?.unreadCount, 1);
});

test("sender spoofing: a forged 'sender' field is ignored", async () => {
  await B.get("/auth/me"); // sanity keep-alive, no-op
  socketB.emit("send_message", {
    chat: chat._id,
    receiver: userA.id,
    sender: userA.id, // forged — must be ignored server-side
    text: "spoof attempt",
  });
  await new Promise((r) => setTimeout(r, 500));

  const history = await A.get<{ text: string; sender: { _id: string } }[]>(`/messages/${chat._id}`);
  const spoofed = (history.data.data ?? []).find((m) => m.text === "spoof attempt");
  assert.ok(spoofed);
  assert.equal(spoofed!.sender._id, userB.id, "message must be attributed to the real authenticated socket");
});

test("delivered: A sees a delivered ack after B confirms", async () => {
  const pending = waitForEvent<{ messageId: string }>(socketA, "message_delivered");
  socketB.emit("message_delivered", messageId);
  const payload = await pending;
  assert.equal(payload?.messageId, messageId);
});

test("seen: A sees a seen ack after B confirms", async () => {
  const pending = waitForEvent<{ messageId: string }>(socketA, "message_seen");
  socketB.emit("message_seen", messageId);
  const payload = await pending;
  assert.equal(payload?.messageId, messageId);
});

test("unread count: resets to 0 once the message is seen", async () => {
  const res = await B.get<{ _id: string; unreadCount: number }[]>("/chat");
  const found = (res.data.data ?? []).find((c) => c._id === chat._id);
  assert.equal(found?.unreadCount, 0);
});

test("message history: REST reflects seen status", async () => {
  const history = await B.get<{ _id: string; status: string }[]>(`/messages/${chat._id}`);
  const stored = (history.data.data ?? []).find((m) => m._id === messageId);
  assert.equal(stored?.status, "seen");
});

test("reply-to: a reply carries a populated preview of the original message", async () => {
  const sent = await B.post<{ _id: string }>("/messages", {
    chat: chat._id,
    receiver: userA.id,
    text: "Sounds good!",
    replyTo: messageId,
  });
  assert.equal(sent.status, 201);

  // The create response doesn't populate replyTo (only the socket path is
  // used for real sends in the app); fetching history does, same as sender/receiver.
  const history = await A.get<{ _id: string; replyTo?: { _id: string; text: string; sender: { name: string } } }[]>(
    `/messages/${chat._id}`,
  );
  const reply = (history.data.data ?? []).find((m) => m._id === sent.data.data!._id);
  assert.equal(reply?.replyTo?._id, messageId);
  assert.equal(reply?.replyTo?.text, `Hello from Alice ${stamp}`);
  assert.equal(reply?.replyTo?.sender?.name, "Alice E2E");
});

test("reply-to: a reference to a message in a different chat is silently dropped", async () => {
  const otherChat = await A.post<{ _id: string }>("/chat", { receiverId: (await C.get<{ id: string }>("/auth/me")).data.data!.id });
  const foreignMessage = await A.post<{ _id: string }>("/messages", {
    chat: otherChat.data.data!._id,
    receiver: (await C.get<{ id: string }>("/auth/me")).data.data!.id,
    text: "message in a different chat",
  });

  const res = await A.post<{ replyTo: unknown }>("/messages", {
    chat: chat._id,
    receiver: userB.id,
    text: "trying to reply across chats",
    replyTo: foreignMessage.data.data!._id,
  });
  assert.equal(res.status, 201);
  assert.equal(res.data.data?.replyTo, undefined);
});

test("message search: finds a matching message for a participant", async () => {
  const res = await A.get<{ _id: string; text: string }[]>(`/messages/${chat._id}/search?q=Hello%20from%20Alice`);
  assert.equal(res.status, 200);
  assert.ok((res.data.data ?? []).some((m) => m._id === messageId));
});

test("message search: no matches for an unrelated query", async () => {
  const res = await A.get<unknown[]>(`/messages/${chat._id}/search?q=zzz-does-not-exist-zzz`);
  assert.equal(res.status, 200);
  assert.equal(res.data.data?.length, 0);
});

test("message search: a non-participant is rejected -> 403", async () => {
  const res = await C.get(`/messages/${chat._id}/search?q=Hello`);
  assert.equal(res.status, 403);
});

test("notifications: B has an unread notification for the message", async () => {
  const unread = await B.get<{ count: number }>("/notifications/unread-count");
  assert.ok((unread.data.data?.count ?? 0) >= 1);

  const list = await B.get<{ chat: { _id: string } | string }[]>("/notifications");
  const notif = (list.data.data ?? []).find((n) => chatIdOf(n.chat) === chat._id);
  assert.ok(notif, "notification for the message must exist and reference the correct chat");
});

test("message deletion: only the sender may delete -> 403 for others", async () => {
  const res = await B.delete(`/messages/${messageId}`);
  assert.equal(res.status, 403);
});

test("message deletion: sender can delete their own message -> 200, and broadcasts message_deleted", async () => {
  const deletedForB = waitForEvent<{ messageId: string; chatId: string }>(socketB, "message_deleted");

  const res = await A.delete(`/messages/${messageId}`);
  assert.equal(res.status, 200);

  const payload = await deletedForB;
  assert.equal(payload?.messageId, messageId, "the other participant's socket must see the deletion in realtime");
  assert.equal(payload?.chatId, chat._id);
});

test("profile update", async () => {
  const res = await A.put<{ name: string }>("/user/profile", { name: "Alice E2E Updated", bio: "e2e bio" });
  assert.equal(res.status, 200);
  assert.equal(res.data.data?.name, "Alice E2E Updated");
});

test("password change invalidates the old password", async () => {
  const change = await A.put("/user/change-password", {
    currentPassword: PASSWORD,
    newPassword: "NewPassw0rd!23",
  });
  assert.equal(change.status, 200);

  const oldLogin = await makeSession().post("/auth/login", { email: emailA, password: PASSWORD });
  assert.equal(oldLogin.status, 401);

  const newLogin = await makeSession().post("/auth/login", { email: emailA, password: "NewPassw0rd!23" });
  assert.equal(newLogin.status, 200);
});

test("delete chat", async () => {
  const res = await A.delete(`/chat/${chat._id}`);
  assert.equal(res.status, 200);

  const list = await A.get<{ _id: string }[]>("/chat");
  assert.ok(!(list.data.data ?? []).some((c) => c._id === chat._id));
});

test("logout, then protected route is blocked", async () => {
  const logout = await A.post("/auth/logout");
  assert.equal(logout.status, 200);

  const me = await A.get("/auth/me");
  assert.equal(me.status, 401);
});

after(() => {
  socketA?.close();
  socketB?.close();
});

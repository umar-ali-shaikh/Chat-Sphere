# ChatSphere API

Base URL: `http://localhost:5000/api` (dev). All endpoints are JSON over HTTPS/HTTP.

Auth is a JWT stored in an **httpOnly** `token` cookie, set on register/login. Every
protected route requires that cookie (sent automatically by the browser for same-origin
requests; cross-origin clients must forward it manually). There is no Authorization
header / bearer token — do not send the JWT any other way.

Every response is `{ success: boolean, message?: string, count?: number, data?: T }`.
Errors are `{ success: false, message: string }` with a non-2xx status code.

---

## Auth — `/api/auth`

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| POST | `/register` | — | `{ name, email, password }` | Password needs upper+lower+digit+symbol, 8+ chars. Rate-limited (20/15min per IP). Sets the `token` cookie. |
| POST | `/login` | — | `{ email, password }` | Rate-limited (20/15min per IP). Sets the `token` cookie. |
| GET | `/me` | ✓ | — | Returns the current session's `{ id, name, email }`. |
| POST | `/logout` | ✓ | — | Clears the `token` cookie. |

## Users — `/api/user`

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/?q=` | ✓ | List/search users by name or email, excludes the caller, capped at 50. |
| GET | `/profile` | ✓ | Full profile of the caller. |
| PUT | `/profile` | ✓ | Body `{ name?, bio? }`. |
| PUT | `/change-password` | ✓ | Body `{ currentPassword, newPassword }`. |
| POST | `/avatar` | ✓ | Multipart `avatar` file field, ≤5MB. Uploaded to Cloudinary. |

## Chats — `/api/chat`

1:1 chats only — creating a chat with a `receiverId` you've already chatted with returns
the existing chat instead of a duplicate (enforced at the DB level, race-safe).

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/` | ✓ | Body `{ receiverId }`. |
| GET | `/?page=&limit=` | ✓ | Caller's chats, newest-updated first. Each chat includes `unreadCount` (messages addressed to the caller not yet marked "seen"). |
| GET | `/:chatId` | ✓ | 403 if the caller isn't a participant. |
| DELETE | `/:chatId` | ✓ | 403 if the caller isn't a participant. |

## Messages — `/api/messages`

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/` | ✓ | Body `{ chat, receiver, text?, image?, replyTo? }` — at least one of `text`/`image` required. `replyTo` is a message id in the *same* chat; invalid or cross-chat references are silently dropped, not rejected. **Not used for realtime send in the app** — see Socket.IO below; this REST endpoint persists but doesn't broadcast. |
| GET | `/:chatId?limit=&before=` | ✓ | Cursor-paginated history, oldest→newest per page. `before` is an ISO date; omit for the newest page. `limit` capped at 100 (default 30). |
| GET | `/:chatId/search?q=` | ✓ | Case-insensitive substring search within one chat. 403 if not a participant. |
| PATCH | `/:id/delivered` | ✓ | Only the message's `receiver` may call this. |
| PATCH | `/:id/seen` | ✓ | Only the message's `receiver` may call this. |
| DELETE | `/:id` | ✓ | Only the original `sender` may call this. Hard delete (delete-for-everyone); broadcasts `message_deleted` to the chat room. |

## Uploads — `/api/upload`

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/image` | ✓ | Multipart `image` field. Returns `{ url, publicId }`. Stored under `chat-app/messages/<userId>/...`. |
| DELETE | `/?publicId=` | ✓ | Only assets under the caller's own folder prefix may be deleted. |

## Notifications — `/api/notifications`

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/` | ✓ | Caller's notifications, newest first. |
| GET | `/unread-count` | ✓ | `{ count }`. |
| PATCH | `/:id/read` | ✓ | |
| PATCH | `/read-all` | ✓ | |
| DELETE | `/:id` | ✓ | |

---

## Socket.IO

Connect to the same origin as the REST API. Auth rides on the same `token` cookie —
the handshake is rejected (`connect_error`) if it's missing/invalid. There is no
separate auth event; identity is fixed for the socket's lifetime as `socket.data.userId`,
derived from the verified JWT — **never** trust a client-supplied user id in any payload.

On connect, the server auto-joins the socket to a personal room (`userId`) for
`new_notification` delivery, and broadcasts presence (`online_users` to everyone,
`user_online` if this is the user's first open connection).

### Client → server

| Event | Payload | Notes |
|---|---|---|
| `join_chat` | `chatId: string` | Rejected (no-op + `error` event) if the caller isn't a participant. |
| `leave_chat` | `chatId: string` | |
| `send_message` | `{ chat, receiver, text?, image?, replyTo? }` | `sender` is never read from the payload. This is the only path that broadcasts `receive_message` — use it, not the REST POST, for anything the UI needs to show live. |
| `message_delivered` | `messageId: string` | Only takes effect if the caller is that message's `receiver`. |
| `message_seen` | `messageId: string` | Same. |
| `typing` / `stop_typing` | `chatId: string` | Broadcast to the room as `{ chatId, userId }`, `userId` always the authenticated socket's own id. |
| `get_online_users` | — | Server replies with `online_users`. |

### Server → client

| Event | Payload | Notes |
|---|---|---|
| `receive_message` | full message document (sender/receiver **not** populated — bare ids) | Sent to everyone in the chat room, including the sender's own socket (echo). |
| `message_delivered` / `message_seen` | `{ messageId, deliveredAt? \| seenAt? }` | |
| `message_deleted` | `{ messageId, chatId }` | Delete-for-everyone; remove the message from any cached view of that chat. |
| `typing` / `stop_typing` | `{ chatId, userId }` | |
| `online_users` | `string[]` | Full list of currently-online user ids. |
| `user_online` / `user_offline` | `{ userId }` | |
| `new_notification` | `{ title, body }` | No `chat`/`sender`/`message` id — treat as a signal to refetch the notifications list, not as structured data. |
| `error` | `{ message }` | Generic; not correlated to a specific request. |

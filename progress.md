# ChatSphere — Progress

_Last updated: 2026-08-13_
_Scope: `backend/` and `frontendnew/nexus-chat-33/` (the legacy `frontend/` folder is excluded/not the primary frontend)_

## Overall status: Feature-complete for the planned scope, hardened, documented, CI-ready. ~95% production-ready.

The frontend is wired to the real backend for auth, chats, messages, realtime (Socket.IO),
notifications, profile and image uploads (see earlier sections). **Phase 1** added a
committed integration test and a real backend-derived unread count. **Phase 2** (below)
added SSR-aware auth guards, message search, infinite-scroll message pagination,
reply-to-message, realtime delete-for-everyone, an in-app image lightbox, connection-state
UX, a security/production audit, API docs, and a CI workflow.

---

# Phase 1 — Testing & Unread Architecture (2026-08-13)

## 1. Integration test committed to the repo

- **Location**: `backend/tests/e2e.test.ts`. **Run**: `npm run test:e2e` from `backend/` (requires the dev server already running against a real database — no mocks).
- Built on Node's built-in `node:test` + `assert/strict` + `socket.io-client` (added as a backend devDependency) — deliberately no external test framework, since the whole suite is one linear flow. Uses native `fetch` with a small per-session cookie jar (`response.headers.getSetCookie()`) rather than adding `axios` as a backend dependency.
- **Fixed the notification comparison bug** from the earlier scratch script: `notification.chat` comes back populated (an object), not a bare id — the test now unwraps it (`chatIdOf()` helper) before comparing.
- **30/30 assertions pass.** Coverage: register, duplicate register, invalid login, protected-route 401, user search (excludes self), chat creation + race-safe dedupe, socket auth (rejects unauthenticated, accepts authenticated), presence (`online_users`), `join_chat`, `typing`/`stop_typing`, realtime `send_message` → `receive_message` to both participants, **sender-spoofing rejected**, unread count (see below) before and after seen, `message_delivered`/`message_seen` acks, REST history reflecting status, notifications + unread-count endpoint, message-delete authorization (403 non-sender / 200 owner), profile update, password change invalidating the old password, chat deletion, logout + session invalidation.

## 2. Real unread-count architecture (replaces the notification-loop workaround)

**Backend** (`backend/src/services/chat.service.ts`, `getUserChats`): after fetching the user's chats, one MongoDB aggregation —
```js
Message.aggregate([
  { $match: { chat: { $in: chatIds }, receiver: userId, status: { $ne: "seen" } } },
  { $group: { _id: "$chat", count: { $sum: 1 } } },
])
```
— computes unread counts for all chats in a single round trip (no N+1), merged onto each chat as `unreadCount`. This reuses the `Message.status` field the delivered/seen socket flow already maintains — no new model, no new endpoint, no separate read-state bookkeeping. `GET /api/chat` now returns `unreadCount` per chat.

**Frontend**: `RawChat`/`AppChat` types gained `unreadCount`; `use-chat-store.ts`'s `convos` now reads it directly. Removed: the `notifications`-query-in-the-chat-store, the per-chat `.filter(n => n.chat === id && !n.isRead)` scan, and the `markChatRead` loop that called `PATCH /notifications/:id/read` once per unread notification. Replaced with:
- `openConversation` optimistically zeroes that chat's `unreadCount` in the TanStack Query cache immediately (the actual server-side clear happens via the existing "mark inbound messages as seen" effect, which was already emitting `message_seen` for the active thread — that part didn't need to change).
- `onReceiveMessage`'s `bumpChatPreview` now also optimistically increments the target chat's `unreadCount` when the message is from the peer and that chat isn't the active one.
- The Notifications bell (`notifications-menu.tsx`) is unaffected — it still owns its own `["notifications"]` query and remains a separate "activity inbox" concern, independent from per-chat unread.

## Phase 1 verification

- `npx tsc --noEmit` clean: backend and frontend
- `npm run test:e2e` (backend): **30/30 pass**
- `npm run build`: backend (`tsc`) and frontend (`vite build`, Nitro/Cloudflare preset) both succeed
- `npx eslint` on the touched file (`use-chat-store.ts`): 0 real findings

## Phase 1 files changed

- **Backend**: `src/services/chat.service.ts` (unread aggregation), `tests/e2e.test.ts` (new), `package.json` (`test:e2e` script, `socket.io-client` devDependency)
- **Frontend**: `src/types/api.ts` (`unreadCount` field), `src/features/chat/use-chat-store.ts` (unread wiring, removed notification-loop)

Phase 1 status: **complete**.

---

# Phase 2 — Production Feature Hardening (2026-08-13)

## 3. SSR-aware auth guard

Investigated whether TanStack Start (this project's version, `@tanstack/react-start` 1.168.x
/ `@tanstack/start-server-core` 1.169.x) exposes a clean server-side cookie read for use in
`beforeLoad` — it does: `getCookie()` from `@tanstack/start-server-core`, used inside a
`createServerFn`. Implemented cleanly, no insecure workaround needed:

- `src/lib/server-auth.ts` (new) — `fetchServerUser()`, a `createServerFn` that reads the
  `token` cookie off the incoming request to the **frontend** server (same-origin, sent
  automatically) and forwards it by hand as a `Cookie` header to the **backend** (different
  origin, needs an explicit header). Returns `{ user, checked }` — `checked: false` means
  the backend couldn't be reached or returned something other than 200/401, and callers
  must NOT redirect in that case (a transient backend hiccup would otherwise force-log-out
  every user on their next navigation). Only a confirmed 401 counts as "definitely
  unauthenticated."
- `src/routes/chat.tsx` — `beforeLoad` redirects to `/login` only when `checked && !user`.
- `src/routes/login.tsx`, `register.tsx` — `beforeLoad` redirects to `/chat` when `user` is present.
- The existing client-side `AuthProvider` check is unchanged and still runs (the instruction's
  "preserve existing client-side fallback" — also covers the `checked: false` case above).
- **Gotcha hit and fixed**: the scaffold's import-protection Vite plugin blocks any import
  matching `**/server/**` by path pattern (not semantics — it doesn't know `createServerFn`
  is safe), even though this is the officially sanctioned pattern. The file was first placed
  at `src/server/session.ts` and had to be moved to `src/lib/server-auth.ts` to build. Noting
  this in case anyone adds another server function later and hits the same wall.
- **Verified at the HTTP level** (`curl`, bypassing any browser-tooling flakiness): authenticated
  → `/login` and `/register` both return `307` to `/chat`; authenticated → `/chat` returns `200`;
  unauthenticated → `/chat` returns `307` to `/login`; unauthenticated → `/register` returns `200`.
  All five scenarios correct.

## 4. Message search

- **Backend**: `GET /api/messages/:chatId/search?q=` — `message.service.ts`'s `searchMessages()`,
  authorization-checked (participant only, 403 otherwise), case-insensitive regex match on
  `text` scoped to one chat (regex-escaped input, no ReDoS surface, query capped at 200 chars).
  No new index needed — the existing `{ chat: 1, createdAt: -1 }` index narrows to the chat first.
- **Frontend**: `src/components/chat/message-search.tsx` (new) — debounced (300ms) search panel
  in the chat header, loading/empty/error states, results show sender + highlighted match text,
  clicking a result scrolls to and briefly highlights the message in the open thread (falls back
  to a toast if that message isn't in the currently loaded page — see pagination below).

## 5. Message pagination (infinite scroll)

Backend cursor pagination (`GET /api/messages/:chatId?limit=&before=`) already existed and
was verified correct rather than changed (dedicated script: seeded 35 messages, confirmed
page 1 + page 2 are gapless, non-overlapping, and exactly sequential).

- **Frontend**: `use-chat-store.ts`'s `messagesQuery` converted from `useQuery` to
  `useInfiniteQuery`. Cache shape is `InfiniteData<Message[]>` with `pages[0]` always the
  newest page; `flattenMessagePages()` reverses page order for chronological display.
  `withLatestPage()`/`withAllPages()` helpers replace every direct cache mutation (optimistic
  send, reconciliation, status patches, deletes) to operate on the new shape correctly.
- `src/routes/chat.tsx` — scroll-position preservation: `onScroll` near the top captures
  `scrollHeight` before `fetchNextPage()`, a `useLayoutEffect` restores the equivalent
  `scrollTop` after older messages render, so the viewport doesn't jump. Distinguished from
  "new message arrived, scroll to bottom" via a ref flag, not a length comparison.
- Realtime insertion (`receive_message`) still appends to the correct (newest) page — did not
  break when switching from a flat array.

## 6. Chat list — reviewed, no changes needed

Unread counts, last-message preview, online state and stable sort-on-new-message were already
correct from Phase 1 / earlier integration work. Server-side chat-list pagination/search would
be premature complexity at this scale (small chat lists, client-side filter of the loaded list
is sufficient) — explicitly not added, per the brief's own guidance not to over-engineer.

## 7. Reply-to-message

- **Backend**: `Message.replyTo` (optional `ObjectId` ref `Message`, additive schema change).
  `sendMessageSchema` gained an optional `replyTo` field. `messageService.sendMessage` validates
  the referenced message exists **and belongs to the same chat** — an invalid or cross-chat
  reference is silently dropped (not an error), so it can't be used as an oracle to probe
  whether a message id exists in a chat the caller can't see (verified: both cases produce an
  identical 201 response). `getMessages`/history populates `replyTo` with a lightweight preview
  (`text`, `image`, `sender.name`) via nested `.populate()`.
- **Socket**: `send_message` payload carries `replyTo` as a bare id (not populated — same
  asymmetry as `sender`/`receiver` on the realtime path, already documented in the codebase).
- **Frontend**: optimistic replies build their preview directly from the in-memory message
  being replied to (no round trip needed); reconciliation preserves that preview across the
  optimistic→real swap since the socket echo never carries the populated form. `composer.tsx`
  shows a "Replying to X" strip with cancel; `message-bubble.tsx` shows a quoted preview,
  clickable to jump to the original (reuses the search feature's jump/highlight code).

## 8. Delete-for-everyone — realtime propagation

The existing `deleteMessage` was already a hard delete (i.e. already "for everyone" in DB
terms) but never told the *other* participant — they'd only see it gone on next fetch. Fixed
by broadcasting instead of introducing a new soft-delete/per-user-visibility model (which
would have been disproportionate and wasn't asked for):
- `messageService.deleteMessage` now returns the message's `chatId`.
- `message.controller.ts` emits `getIO().to(chatId).emit("message_deleted", { messageId, chatId })`
  after a successful delete.
- Frontend listens for `message_deleted` and removes the message from any cached page of that
  chat's history — verified live between two independent sockets in the integration test.

## 9. Image lightbox

`src/components/chat/image-lightbox.tsx` (new) — replaces `window.open(imageUrl)` with an
in-app viewer built on the same Radix `Dialog` primitive already used elsewhere (Settings,
New Chat), so Escape-to-close, overlay-click-to-close, focus trap and background-interaction
blocking are inherited for free rather than reimplemented. `message-bubble.tsx`'s image now
opens it via a lifted `lightboxImage` state in `chat.tsx` (one dialog instance, not one per bubble).

## 10. UX hardening

- **Socket disconnect/reconnect state** (previously entirely absent): `use-chat-store.ts`
  exposes `connectionStatus` (`connecting`/`connected`/`disconnected`), driven by the socket's
  own `connect`/`disconnect` events. `chat.tsx` shows a persistent top banner while disconnected
  plus a toast on disconnect and on reconnect ("Back online").
- **Notifications loading state**: previously showed "You're all caught up" while the initial
  fetch was still in flight (misleading — looked like a confirmed empty state). Added an
  explicit loading spinner state.
- **Unhandled-promise fixes** (surfaced during the security audit, folded in here): three
  `async onClick`/`onSelect` handlers in `notifications-menu.tsx` (mark-all-read, mark-one-read,
  delete) had no error handling — a failed request silently vanished with an unhandled
  rejection and no user feedback. Consolidated into a `runAction()` helper with a toast on
  failure. Same fix applied to the sign-out button in `chat.tsx`.

## Phase 2 security audit

Scoped to code touched in this phase (per the task's own instruction), reviewed against a
fixed checklist:

| Check | Result |
|---|---|
| Authorization on message search | ✓ 403 for non-participants (tested) |
| Authorization on chat/message access | ✓ unchanged, still enforced |
| No JWT/token in localStorage | ✓ confirmed via repo-wide grep — only theme preference uses localStorage |
| httpOnly cookie still enabled | ✓ `cookieOptions.ts` untouched |
| CORS still restricted | ✓ `app.ts` untouched |
| Validation still enabled | ✓ `replyTo` added to the Zod schema; search query is regex-escaped + length-capped |
| No sender spoofing | ✓ `replyTo` reuses the same server-derived-identity pattern; existence-oracle check passed (see §7) |
| No sensitive data exposed | ✓ reply preview populate is scoped to `text image sender.name` only |
| No unsafe query construction | ✓ search regex is escaped (no ReDoS, no injection); ids used in `getIO().to(chatId)` are server-derived, never client input |
| No unhandled promises | **2 real findings, fixed** — see UX hardening above |
| No duplicate Socket.IO listeners | ✓ new listeners (`message_deleted`, `disconnect`) added to the same effect with matching `off()` cleanup |
| No memory leaks from new subscriptions | ✓ no new global listeners outside the existing effect lifecycle |
| No sensitive logs | ✓ grepped Phase 2 files — zero `console.*` added; pre-existing backend logs are lifecycle-only (no tokens/passwords) |

## Phase 2 production audit

Repo-wide grep for `mock-data`, `setTimeout` (fakes), `fake login/register/reply`,
`localStorage auth`, `coming soon`, `TODO`, `FIXME`, `console.log`, `debugger`:
- No fake auth, no mock data imports, no `TODO`/`FIXME` anywhere in either app.
- The only `"coming soon"` hits are the voice/video call buttons — intentionally kept, per
  explicit instruction not to build calling.
- `src/lib/mock-data.ts` still exists but remains unimported by any production path (unchanged
  from Phase 1's audit).
- Backend `console.log` calls are all server-lifecycle logging (startup, DB connect, socket
  connect/disconnect) — no debug scaffolding, nothing sensitive.

## API documentation

`backend/docs/api.md` (new) — every REST route (method, auth requirement, body, notable
behavior) and every Socket.IO event (client→server and server→client) in one page. Chose
plain Markdown over OpenAPI/Swagger per the task's own "avoid unnecessary complexity" guidance.

## CI

`.github/workflows/ci.yml` (new) — two jobs:
- **backend**: install → typecheck → build → boot the built server against a `mongo:7`
  service container (no real credentials, ephemeral CI-only `JWT_SECRET`) → run `npm run test:e2e`.
- **frontend**: install → typecheck → build.

Not yet exercised for real — there is no git remote configured for this repo (`.git/` exists
but is empty, no commits), so this workflow will only run once the project is pushed to GitHub.

## Phase 2 testing performed

- `npx tsc --noEmit`: clean, backend and frontend, after every individual change (not just at the end)
- `npx eslint`: zero real findings in every touched file (pre-existing CRLF/Prettier noise in
  untouched files unrelated, as established in Phase 1)
- `npm run build`: backend + frontend, clean, run repeatedly through the phase
- `npm run test:e2e`: **36/36 pass** on the final run — grew from 30 (Phase 1) to 36 by adding:
  unread-count-in-chat-list assertions, message search (match/no-match/403), reply-to
  (populated preview + cross-chat reference silently dropped), and `message_deleted` realtime
  broadcast to the other participant's socket
- Dedicated pagination-cursor script (not part of the committed suite): seeded 35 messages,
  confirmed exact gapless/non-overlapping cursor pagination end-to-end
- Direct `curl` verification of all 5 SSR-guard redirect scenarios (see §3)
- **Not done**: a fresh live-browser walkthrough of the Phase 2 UI (search panel, reply strip,
  lightbox, connection banner). The browser automation tooling became unresponsive partway
  through this phase (confirmed unrelated to the app — it failed to load even a fresh tab
  before the app loaded). Earlier in this same overall project, a full manual browser
  walkthrough of the core flows (register → chat → message → settings → session-restore →
  logout) did pass with no console errors — that verification stands, but the *new* Phase 2
  UI has only been verified via typecheck/build/lint plus the backend integration tests that
  exercise the identical REST/socket contract the UI calls, not via a live rendered check.
  Flagged here rather than silently claimed.

## Known limitations after Phase 2

- Live-browser visual verification of the Phase 2 UI is outstanding (see above) — recommend
  a manual pass (or fixing the browser-automation tooling) before shipping.
- No refresh-token flow (single JWT, 7-day expiry) — carried over from before.
- CI workflow is unexercised (no git remote/push yet).
- `dist/` still committed alongside `src/` in the backend — unconfirmed if intentional.
- Voice/video calling, message reactions, pin/mute/archive: not implemented, explicitly out
  of scope for this project's phases.
- Message search is per-chat only (matches the brief: "search within current conversation
  first") — no cross-chat/global search.

## Phase 2 files changed

**Backend**: `src/models/Message.ts` (`replyTo` field), `src/services/message.service.ts`
(`searchMessages`, reply validation/populate, `deleteMessage` returns `chatId`),
`src/services/chat.service.ts` (unchanged this phase — see Phase 1), `src/controllers/message.controller.ts`
(search route handler, `message_deleted` broadcast), `src/routes/message.routes.ts` (search route),
`src/validations/message.validation.ts` (`replyTo`), `src/types/socket.ts` (`replyTo`,
`MessageDeletedPayload`), `src/sockets/chat.socket.ts` (`replyTo` passthrough), `docs/api.md` (new),
`tests/e2e.test.ts` (6 new tests)

**Frontend**: `src/lib/server-auth.ts` (new), `src/routes/{chat,login,register}.tsx` (`beforeLoad`
guards, pagination scroll handling, reply/search/lightbox/connection-banner wiring),
`src/features/chat/use-chat-store.ts` (infinite query conversion, reply-preview building,
`message_deleted`/`disconnect` handling, `connectionStatus`), `src/components/chat/message-search.tsx`
(new), `src/components/chat/image-lightbox.tsx` (new), `src/components/chat/composer.tsx`
(reply preview strip), `src/components/chat/message-bubble.tsx` (reply preview + reply action +
lightbox trigger), `src/components/chat/notifications-menu.tsx` (loading state, error handling),
`src/types/api.ts` (`RawReplyTo`/`AppReplyTo`), `src/types/chat.ts` (`MessageReplyPreview`),
`src/types/socket.ts` (`MessageDeletedEventPayload`), `src/api/messages.ts` (`search`, options
types), `package.json` (`@tanstack/start-server-core` dependency)

**Repo root**: `.github/workflows/ci.yml` (new)

Phase 2 status: **complete**.

## Recommended Phase 3 (not started)

1. Live-browser verification of the Phase 2 UI once tooling is available (highest priority —
   this is verification debt, not a feature gap).
2. Push to a real GitHub remote and confirm the CI workflow actually runs green.
3. Refresh-token flow.
4. Decide `dist/`-in-git question; add a `.gitignore` entry if unintentional.
5. If usage grows: server-side chat-list pagination/search (explicitly deferred in §6),
   global (cross-chat) message search.

---

# Backend

## Stack

- Node.js + Express 4, TypeScript, ESM (`type: module`)
- MongoDB via Mongoose 9
- Socket.IO 4 for realtime
- JWT auth (httpOnly cookie), bcrypt password hashing
- Cloudinary + Multer for image uploads
- Zod for request validation, Helmet + CORS + express-rate-limit for hardening
- Dev: `tsx watch`; Build: `tsc` → `dist/`

## What's built

### Auth (`/api/auth`)
- `POST /register`, `POST /login` — Zod-validated, rate-limited (20 req / 15 min)
- `GET /me`, `POST /logout` — cookie-based session (`protect` middleware)
- JWT stored in httpOnly cookie; `env.ts` fails fast at boot if `JWT_SECRET` is missing or under 32 chars

### Users (`/api/user`)
- `GET /` — **new this session**: list/search users by name or email, excludes the caller, capped at 50 results. Added because the frontend had no way to discover other users to start a chat with.
- `GET /profile`, `PUT /profile`, `PUT /change-password`
- `POST /avatar` — Multer + Cloudinary upload

### Chats (`/api/chat`)
- Create / list / get-by-id / delete, all `protect`-gated
- 1:1 chat uniqueness enforced at the DB level via a `pairKey` (`sort(participantIds).join("_")`) with a sparse unique index

### Messages (`/api/messages`)
- Send, list by chat, mark delivered/seen, delete
- Compound index `{ chat: 1, createdAt: -1 }` for cursor-paginated history

### Uploads (`/api/upload`)
- Generic image upload/delete via Cloudinary (separate from the avatar-specific route)

### Notifications (`/api/notifications`)
- List, unread count, mark one/all read, delete

### Realtime (Socket.IO)
- `chat.socket.ts` — `join_chat` (authz-checked), `leave_chat`, `send_message` (sender always server-derived), `message_delivered`, `message_seen`
- `typing.socket.ts` — `typing` / `stop_typing`
- `online.socket.ts` — presence tracking, multi-tab safe

### Cross-cutting
- Global middleware: `helmet`, `morgan`, CORS locked to `CLIENT_URL` with credentials, `express.json`, `cookie-parser`
- Centralized `notFound` + `errorHandler`
- Layered structure: routes → controllers → services → models, with a `validations/` (Zod) layer

## Known gaps / not yet done

- ~~No automated test suite~~ — **done in Phase 1**: `backend/tests/e2e.test.ts`, run via `npm run test:e2e`
- No refresh-token flow (single JWT, default 7d expiry)
- ~~No per-chat unread~~ — **done in Phase 1**: `GET /api/chat` returns a real `unreadCount` per chat (see Phase 1 above)
- ~~No API documentation~~ — **done in Phase 2**: `backend/docs/api.md`
- ~~No CI config~~ — **done in Phase 2**: `.github/workflows/ci.yml` (unexercised — no git remote yet)
- `dist/` is committed alongside `src/` — confirm intentional

---

# Frontend (`frontendnew/nexus-chat-33`)

## Stack

- TanStack Start (React 19) + TanStack Router (file-based routes) + TanStack Query, built on Vite 8
- Tailwind CSS v4 + shadcn/ui
- `axios` (REST) + `socket.io-client` (realtime) — **added this session**
- `react-hook-form` + Zod, `motion`, `@react-three/fiber` (ambient background)
- Dev: `vite dev` (runs on **port 8080**, not Vite's default 5173); Build: `vite build`

## Status: Wired to the real backend. No mock data or fake auth left in production paths.

## What changed this session (mock → real)

### API layer (new)
- `src/lib/api-client.ts` — axios instance, `baseURL` from `VITE_API_URL` env var (`.env` / `.env.example` added), `withCredentials: true`, centralized `ApiError` + `apiErrorMessage()` for toasts
- `src/lib/socket-client.ts` — one `socket.io-client` instance for the app lifetime, `withCredentials: true`, connects/disconnects with auth state
- `src/types/api.ts` — raw backend shapes (`RawUser`/`RawChat`/`RawMessage`/`RawNotification`) + `normalize*()` helpers, because Mongoose documents serialize as `_id` while a few hand-built responses (auth register/login/me, profile update, avatar upload) use `id` — normalized to a consistent `AppUser`/`AppChat`/etc. everywhere else
- `src/types/socket.ts` — typed client/server Socket.IO event contracts mirroring `backend/src/types/socket.ts` and the events actually emitted in `backend/src/sockets/*.ts`
- `src/api/{auth,users,chats,messages,notifications,upload}.ts` — thin typed wrappers per resource

### Auth (real, replaces localStorage mock)
- `src/hooks/use-auth.tsx` (new, replaces the old `use-auth.ts`) — `AuthProvider` backed by `useQuery(["auth","me"])`, plus login/register/logout mutations. Wraps the app in `src/routes/__root.tsx`
- `src/routes/login.tsx`, `register.tsx` — real `POST /api/auth/login|register`, server error shown via toast, submit disabled while pending (no double-submit), redirect to `/chat` if already authenticated
- `src/routes/chat.tsx` — redirects to `/login` if the auth check resolves to unauthenticated; shows a loading state while it resolves
- **Simplification**: the auth check runs client-side after hydration (`useQuery` in `AuthProvider`), not as a TanStack Router `beforeLoad` SSR guard. A `beforeLoad` guard would need the incoming request's cookie forwarded through TanStack Start's SSR fetch, which isn't wired up — doing so is a reasonable follow-up but out of scope here. Verified in a real browser: a full page reload on `/chat` while logged in correctly restores the session and message history; navigating to `/chat` while logged out redirects to `/login`.

### Chat data + realtime (real, replaces `mock-data.ts` + `setTimeout` simulation)
- `src/features/chat/use-chat-store.ts` — fully rewritten. Backed by TanStack Query (`chats`, `messages/:chatId`, `notifications`) with the Socket.IO client patching the query cache directly on `receive_message` / `message_delivered` / `message_seen` / `typing` / `stop_typing` / `online_users` / `user_online` / `user_offline` / `new_notification`. Keeps the same hook surface (`convos`, `msgs`, `activeId`, `typingIn`, `userById`, `lastMessageOf`, `openConversation`, `sendMessage`) so `chat.tsx` and the existing UI components didn't need a rewrite, plus new methods (`retryMessage`, `deleteMessage`, `deleteChat`, `startChatWith`, `notifyTyping`)
- Sending goes over the socket (`send_message`), not the REST `POST /api/messages` endpoint, because only the socket path broadcasts `receive_message` to the other participant — matches what the backend actually implements
- Optimistic sends: a temp message is added immediately with a `clientId`, reconciled against the server's `receive_message` echo (sender is also in the room) by matching chat+text+image; a 10s timeout marks it `failed` if no reconciliation happens, with a retry affordance
- Per-conversation unread count is approximated from the Notification list (`chat` field), since the backend has no per-chat unread counter — this is called out as a known simplification, not silently assumed
- `src/types/chat.ts` — `MessageState` extended with `"sending" | "failed"` for the optimistic/retry UI

### New UI surfaces (previously didn't exist)
- `src/components/chat/new-chat-dialog.tsx` — command-palette style user search (debounced, hits `GET /api/user?q=`) + create chat
- `src/components/chat/notifications-menu.tsx` — bell with unread badge, list, mark read/all, delete
- `src/components/chat/settings-dialog.tsx` — profile edit, avatar upload, change password
- `src/components/chat/composer.tsx` — real image upload (`POST /api/upload/image`) with preview/progress/error, replacing the old hardcoded Unsplash URL fake
- `src/components/chat/message-bubble.tsx` — failed-state + retry button, delete-own-message button, image click opens full-size
- `src/components/chat/conversation-list.tsx` — delete-chat button on hover

## Testing performed

1. **Typecheck**: `npx tsc --noEmit` clean on both backend and frontend (including `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, etc.)
2. **Lint**: `npx eslint src` on the frontend — the only findings in code touched this session were fixed (missing `useMemo` on two query-derived arrays, one stale `eslint-disable` comment); the remaining ~5700 reported issues are pre-existing CRLF-vs-Prettier-LF noise across files this session didn't touch (confirmed by checking untouched files like `server.ts`/`start.ts` — not a regression)
3. **Build**: `npm run build` succeeds for both backend (`tsc`) and frontend (`vite build`, Nitro/Cloudflare preset)
4. **Automated protocol test** (scratch script, not committed — see note below): registered two real users against the running backend, then exercised the exact REST + Socket.IO contract the frontend uses — 31/32 assertions passed (the 1 "failure" was a bug in the test script's own comparison, not the app: it compared a populated `notification.chat` object to a bare id string). Covered: register/duplicate-register/invalid-login, protected-route 401, user search excluding self, chat creation + dedupe-on-race, unauthenticated socket rejection, presence (`online_users`/`user_online`), `typing`/`stop_typing`, realtime `send_message` → `receive_message` to both participants, **sender-spoofing rejected** (a payload with a forged `sender` field is attributed to the actual authenticated socket, not the claimed id), `message_delivered`/`message_seen` acks, REST history reflecting status, notification creation + unread count, message-delete authorization (403 for non-sender, 200 for owner), profile update, password change invalidating the old password, chat deletion, logout + session invalidation.
5. **Manual browser walkthrough** (Chrome, two tabs against the real dev servers): registered a new user end-to-end from the landing page → workspace; opened the "New chat" search dialog and saw real users from the database; started a chat and sent a real message (persisted, appeared in the conversation list preview with live relative timestamp); opened Settings, edited and saved the bio via `PUT /api/user/profile` (toast confirmed); **full page reload on `/chat` correctly restored the session and prior message** (validates `GET /api/auth/me` restoration); logged out (toast, redirect to `/login`, cookie cleared); confirmed navigating to `/chat` while logged out redirects to `/login`. No console errors observed at any step.
   - Note: two-different-user realtime (typing/delivered/seen visible live between two people) was validated via the automated protocol test above, not the browser pass — both browser tabs shared the same Chrome profile's cookie jar, so a second tab couldn't hold an independent second session. This is an artifact of the test setup, not the app.

## Known gaps / not yet done

- ~~No committed test suite~~ — **done in Phase 1**, see above.
- ~~SSR auth guard is client-only~~ — **done in Phase 2** (§3): `beforeLoad` guards on `/chat`, `/login`, `/register` using `getCookie()` inside a `createServerFn`, verified via curl.
- ~~Per-chat unread count is approximated from notifications~~ — **done in Phase 1**: real backend-derived `unreadCount`, see above.
- **Voice/video call buttons are still a "coming soon" toast** — intentionally not implemented; the backend has no WebRTC/signaling infrastructure, and building one was explicitly out of scope for both passes.
- ~~Image "lightbox" is just `window.open`~~ — **done in Phase 2** (§9): in-app Radix Dialog viewer.
- ~~No message search~~ — **done in Phase 2** (§4): per-chat search, debounced, click-to-jump.
- ~~No reply-to-message~~ — **done in Phase 2** (§7).
- ~~No delete-for-everyone~~ — **done in Phase 2** (§8): existing hard-delete now broadcasts realtime to the other participant.
- Chat-list server-side pagination/search and global (cross-chat) message search: deliberately not built — premature at current scale, see Phase 2 §6.
- No pin/mute/archive — not attempted, not requested.
- Backend gaps carried over: no refresh tokens; API docs and CI now exist (Phase 2) but CI is unexercised (no git remote).
- **Live-browser verification of the Phase 2 UI is outstanding** — see Phase 2's "Known limitations."

## Files touched this session

**Backend**: `src/services/user.service.ts`, `src/controllers/user.controller.ts`, `src/routes/user.routes.ts` (new user-search endpoint), `.env` (added `CLIENT_URL` for CORS)

**Frontend — new**: `.env`, `.env.example`, `src/lib/api-client.ts`, `src/lib/socket-client.ts`, `src/types/api.ts`, `src/types/socket.ts`, `src/api/{auth,users,chats,messages,notifications,upload}.ts`, `src/hooks/use-auth.tsx`, `src/components/chat/{new-chat-dialog,notifications-menu,settings-dialog}.tsx`

**Frontend — rewritten/edited**: `src/features/chat/use-chat-store.ts`, `src/routes/{__root,login,register,chat}.tsx`, `src/components/chat/{composer,message-bubble,conversation-list}.tsx`, `src/types/chat.ts`, `package.json` (added `axios`, `socket.io-client`)

**Frontend — removed**: `src/hooks/use-auth.ts` (old localStorage mock, superseded by `use-auth.tsx`)

`src/lib/mock-data.ts` is kept but no longer imported anywhere in production code.

## Next task

Superseded — see "Recommended Phase 3" under the Phase 2 section above for the current punch list.

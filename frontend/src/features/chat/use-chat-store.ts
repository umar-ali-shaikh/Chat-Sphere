import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { chatsApi } from "@/api/chats";
import { messagesApi } from "@/api/messages";
import { connectSocket, getSocket } from "@/lib/socket-client";
import { apiErrorMessage } from "@/lib/api-client";
import {
  initialsOf,
  normalizeMessage,
  partyId,
  type AppChat,
  type AppUser,
} from "@/types/api";
import type { Conversation, Message, MessageReplyPreview, User } from "@/types/chat";

export const CHATS_KEY = ["chats"] as const;
export const messagesKey = (chatId: string) => ["messages", chatId] as const;
export const NOTIFICATIONS_KEY = ["notifications"] as const;
export const UNREAD_COUNT_KEY = ["notifications", "unread-count"] as const;

const TYPING_STOP_DELAY = 1500;
const SEND_TIMEOUT_MS = 10_000;
const MESSAGES_PAGE_SIZE = 30;

/**
 * Cache shape for a chat's message history: `pages[0]` is always the most
 * recently fetched (newest) batch — the initial fetch — and each later page
 * (loaded by scrolling up) is progressively older. Flattening for display
 * therefore means reversing the page order first, see `flattenMessagePages`.
 */
type MessagesCache = InfiniteData<Message[], string | undefined>;

function flattenMessagePages(cache: MessagesCache | undefined): Message[] {
  if (!cache) return [];
  return cache.pages.slice().reverse().flat();
}

/** Applies `updater` to the newest page (index 0), creating the cache if absent. */
function withLatestPage(
  prev: MessagesCache | undefined,
  updater: (latest: Message[]) => Message[],
): MessagesCache {
  if (!prev || prev.pages.length === 0) {
    return { pages: [updater([])], pageParams: [undefined] };
  }
  const pages = prev.pages.slice();
  pages[0] = updater(pages[0] ?? []);
  return { ...prev, pages };
}

/** Applies `updater` to every page — for edits (status patch, delete) that could target any loaded message. */
function withAllPages(
  prev: MessagesCache | undefined,
  updater: (page: Message[]) => Message[],
): MessagesCache | undefined {
  if (!prev) return prev;
  return { ...prev, pages: prev.pages.map(updater) };
}

function toLocalUser(user: AppUser, online: boolean): User {
  return {
    id: user.id,
    name: user.name,
    handle: `@${user.email.split("@")[0]}`,
    avatar: initialsOf(user.name),
    status: online ? "online" : "offline",
    bio: user.bio,
  };
}

function toLocalMessage(m: ReturnType<typeof normalizeMessage>, meId: string): Message {
  return {
    id: m.id,
    conversationId: m.chat,
    authorId: partyId(m.sender) || meId,
    body: m.text ?? "",
    createdAt: m.createdAt,
    state: m.status,
    imageUrl: m.image,
    replyTo: m.replyTo
      ? {
          id: m.replyTo.id,
          body: m.replyTo.text,
          imageUrl: m.replyTo.image,
          authorId: m.replyTo.senderId,
          authorName: m.replyTo.senderName,
        }
      : undefined,
  };
}

interface PendingSend {
  clientId: string;
  chatId: string;
  text?: string | undefined;
  image?: string | undefined;
  timeout: ReturnType<typeof setTimeout>;
}

/**
 * Backs the chat workspace with the real API + Socket.IO transport.
 * Keeps the same surface the UI (chat.tsx, conversation-list, composer,
 * message-bubble) already expects, so those components didn't need a
 * rewrite — only real data flowing through them.
 */
export function useChatStore() {
  const { user } = useAuth();
  const meId = user?.id ?? "";
  const queryClient = useQueryClient();

  const [activeId, setActiveIdState] = useState<string | null>(null);
  const [typingIn, setTypingIn] = useState<string | null>(null);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">(
    "connecting",
  );

  const pendingRef = useRef<Map<string, PendingSend>>(new Map());
  const typingStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peerTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const joinedRooms = useRef<Set<string>>(new Set());

  const chatsQuery = useQuery({
    queryKey: CHATS_KEY,
    queryFn: chatsApi.list,
    enabled: !!meId,
  });
  const chats = useMemo(() => chatsQuery.data ?? [], [chatsQuery.data]);

  useEffect(() => {
    if (!activeId && chats.length > 0) {
      setActiveIdState(chats[0]!.id);
    }
  }, [chats, activeId]);

  const messagesQuery = useInfiniteQuery<Message[], Error, MessagesCache, readonly unknown[], string | undefined>({
    queryKey: activeId ? messagesKey(activeId) : ["messages", "__none__"],
    queryFn: async ({ pageParam }) => {
      const raw = await messagesApi.list(activeId as string, {
        limit: MESSAGES_PAGE_SIZE,
        before: pageParam,
      });
      return raw.map((m) => toLocalMessage(m, meId));
    },
    enabled: !!activeId,
    initialPageParam: undefined,
    getNextPageParam: (lastPage) =>
      lastPage.length === MESSAGES_PAGE_SIZE ? lastPage[0]?.createdAt : undefined,
  });
  const activeMessages = useMemo(() => flattenMessagePages(messagesQuery.data), [messagesQuery.data]);

  const loadOlderMessages = useCallback(() => {
    if (messagesQuery.hasNextPage && !messagesQuery.isFetchingNextPage) {
      void messagesQuery.fetchNextPage();
    }
  }, [messagesQuery]);

  const userById = useMemo(() => {
    const map = new Map<string, User>();
    for (const chat of chats) {
      for (const participant of chat.participants) {
        map.set(participant.id, toLocalUser(participant, onlineUserIds.has(participant.id)));
      }
    }
    if (user) {
      map.set(user.id, toLocalUser(user, true));
    }
    return map;
  }, [chats, onlineUserIds, user]);

  const convos: Conversation[] = useMemo(
    () =>
      chats.map((chat) => {
        const peer = chat.participants.find((p) => p.id !== meId);
        return {
          id: chat.id,
          participantId: peer?.id ?? "",
          unread: chat.unreadCount,
        };
      }),
    [chats, meId],
  );

  const chatById = useCallback((chatId: string): AppChat | undefined => chats.find((c) => c.id === chatId), [chats]);

  const lastMessageOf = useCallback(
    (conversationId: string): Message | null => {
      const chat = chatById(conversationId);
      if (!chat?.lastMessage && !chat?.lastMessageAt) return null;
      if (!chat.lastMessageAt) return null;
      return {
        id: `${chat.id}:preview`,
        conversationId: chat.id,
        authorId: "",
        body: chat.lastMessage || "📷 Image",
        createdAt: chat.lastMessageAt,
        state: "sent",
      };
    },
    [chatById],
  );

  // --- socket lifecycle -----------------------------------------------

  useEffect(() => {
    if (!meId) return;
    const socket = connectSocket();

    const onOnlineUsers = (ids: string[]) => setOnlineUserIds(new Set(ids));
    const onUserOnline = ({ userId }: { userId: string }) =>
      setOnlineUserIds((prev) => new Set(prev).add(userId));
    const onUserOffline = ({ userId }: { userId: string }) =>
      setOnlineUserIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });

    const onTyping = ({ chatId, userId }: { chatId: string; userId: string }) => {
      if (userId === meId) return;
      setTypingIn(chatId);
      if (peerTypingTimer.current) clearTimeout(peerTypingTimer.current);
      peerTypingTimer.current = setTimeout(() => setTypingIn((prev) => (prev === chatId ? null : prev)), 3000);
    };
    const onStopTyping = ({ chatId }: { chatId: string }) => {
      setTypingIn((prev) => (prev === chatId ? null : prev));
    };

    const reconcile = (chatId: string, real: Message) => {
      let matchedClientId: string | null = null;
      for (const pending of pendingRef.current.values()) {
        if (
          pending.chatId === chatId &&
          (pending.text ?? "") === real.body &&
          (pending.image ?? "") === (real.imageUrl ?? "")
        ) {
          matchedClientId = pending.clientId;
          break;
        }
      }

      queryClient.setQueryData<MessagesCache>(messagesKey(chatId), (prev) =>
        withLatestPage(prev, (latest) => {
          if (matchedClientId) {
            // The socket echo never carries a populated replyTo preview
            // (see RawReplyTo docs) — keep whatever we already rendered
            // optimistically from the client's own in-memory message.
            return latest.map((m) =>
              m.id === matchedClientId ? { ...real, replyTo: m.replyTo ?? real.replyTo } : m,
            );
          }
          if (latest.some((m) => m.id === real.id)) return latest;
          return [...latest, real];
        }),
      );

      if (matchedClientId) {
        const pending = pendingRef.current.get(matchedClientId);
        if (pending) clearTimeout(pending.timeout);
        pendingRef.current.delete(matchedClientId);
      }
    };

    const bumpChatPreview = (chatId: string, body: string, at: string, incomingUnread: boolean) => {
      queryClient.setQueryData<AppChat[]>(CHATS_KEY, (prev = []) => {
        const idx = prev.findIndex((c) => c.id === chatId);
        if (idx === -1) return prev;
        const current = prev[idx]!;
        const updated: AppChat = {
          ...current,
          lastMessage: body,
          lastMessageAt: at,
          unreadCount: incomingUnread ? current.unreadCount + 1 : current.unreadCount,
        };
        const next = prev.slice();
        next.splice(idx, 1);
        return [updated, ...next];
      });
    };

    const onReceiveMessage = (raw: Parameters<typeof normalizeMessage>[0]) => {
      const normalized = normalizeMessage(raw);
      const local = toLocalMessage(normalized, meId);
      const chatId = normalized.chat;
      const senderId = partyId(normalized.sender);
      const isActiveChat = chatId === activeIdRef.current;

      if (senderId === meId) {
        reconcile(chatId, local);
      } else {
        // Only append if this chat's history is already cached (i.e. has been
        // opened before) — don't fabricate a cache entry for a chat nobody's
        // looked at yet, the next real fetch will pick this message up.
        queryClient.setQueryData<MessagesCache>(messagesKey(chatId), (prev) =>
          prev
            ? withLatestPage(prev, (latest) => (latest.some((m) => m.id === local.id) ? latest : [...latest, local]))
            : prev,
        );

        const socketNow = getSocket();
        if (isActiveChat) {
          socketNow.emit("message_seen", local.id);
        } else {
          socketNow.emit("message_delivered", local.id);
        }
      }

      bumpChatPreview(
        chatId,
        local.body || (local.imageUrl ? "📷 Image" : ""),
        local.createdAt,
        senderId !== meId && !isActiveChat,
      );
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
    };

    const patchMessageStatus = (messageId: string, status: "delivered" | "seen") => {
      queryClient.setQueriesData<MessagesCache>({ queryKey: ["messages"] }, (prev) =>
        withAllPages(prev, (page) =>
          page.map((m) => (m.id === messageId && m.state !== "seen" ? { ...m, state: status } : m)),
        ),
      );
    };

    const onMessageDelivered = (payload: { messageId: string }) =>
      patchMessageStatus(payload.messageId, "delivered");
    const onMessageSeen = (payload: { messageId: string }) => patchMessageStatus(payload.messageId, "seen");

    // Delete-for-everyone: the sender already removes it optimistically via
    // the REST call in deleteMessage(); this is what makes it disappear for
    // the *other* participant without them needing to refetch.
    const onMessageDeleted = (payload: { messageId: string; chatId: string }) => {
      queryClient.setQueryData<MessagesCache>(messagesKey(payload.chatId), (prev) =>
        withAllPages(prev, (page) => page.filter((m) => m.id !== payload.messageId)),
      );
    };

    const onNewNotification = () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
    };

    const onSocketError = (payload: { message: string }) => {
      toast.error(payload.message || "Something went wrong.");
    };

    const onConnect = () => {
      setConnectionStatus((prev) => {
        if (prev === "disconnected") toast.success("Back online");
        return "connected";
      });
      socket.emit("get_online_users");
      for (const chatId of joinedRooms.current) {
        socket.emit("join_chat", chatId);
      }
    };

    const onDisconnect = () => {
      setConnectionStatus("disconnected");
      toast.error("Connection lost — trying to reconnect…");
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("online_users", onOnlineUsers);
    socket.on("user_online", onUserOnline);
    socket.on("user_offline", onUserOffline);
    socket.on("typing", onTyping);
    socket.on("stop_typing", onStopTyping);
    socket.on("receive_message", onReceiveMessage);
    socket.on("message_delivered", onMessageDelivered);
    socket.on("message_seen", onMessageSeen);
    socket.on("message_deleted", onMessageDeleted);
    socket.on("new_notification", onNewNotification);
    socket.on("error", onSocketError);

    if (socket.connected) setConnectionStatus("connected");

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("online_users", onOnlineUsers);
      socket.off("user_online", onUserOnline);
      socket.off("user_offline", onUserOffline);
      socket.off("typing", onTyping);
      socket.off("stop_typing", onStopTyping);
      socket.off("receive_message", onReceiveMessage);
      socket.off("message_delivered", onMessageDelivered);
      socket.off("message_seen", onMessageSeen);
      socket.off("message_deleted", onMessageDeleted);
      socket.off("new_notification", onNewNotification);
      socket.off("error", onSocketError);
    };
  }, [meId, queryClient]);

  // Track the active chat id in a ref so the (stable) socket effect above
  // can read the latest value without re-subscribing on every switch.
  const activeIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  // Join every chat's room once the list loads, so background chats still
  // receive receive_message/typing for accurate previews & notifications.
  useEffect(() => {
    if (!meId || chats.length === 0) return;
    const socket = getSocket();
    for (const chat of chats) {
      if (!joinedRooms.current.has(chat.id)) {
        joinedRooms.current.add(chat.id);
        if (socket.connected) socket.emit("join_chat", chat.id);
      }
    }
  }, [chats, meId]);

  // Unread is server-derived from Message.status (see chatService.getUserChats).
  // Opening a chat triggers the "mark inbound messages as seen" effect below,
  // which is what actually clears it server-side; this just avoids a round
  // trip before the badge updates in the UI.
  const markChatReadLocally = useCallback(
    (chatId: string) => {
      queryClient.setQueryData<AppChat[]>(CHATS_KEY, (prev = []) =>
        prev.map((c) => (c.id === chatId && c.unreadCount !== 0 ? { ...c, unreadCount: 0 } : c)),
      );
    },
    [queryClient],
  );

  const openConversation = useCallback(
    (id: string) => {
      setActiveIdState(id);
      markChatReadLocally(id);
    },
    [markChatReadLocally],
  );

  // Mark inbound messages in the active thread as seen once they're loaded/visible.
  // seenRequested avoids re-emitting for a message we've already asked the
  // server to mark, while its "seen" ack round-trips back.
  const seenRequested = useRef<Set<string>>(new Set());
  useEffect(() => {
    seenRequested.current.clear();
  }, [activeId]);
  useEffect(() => {
    if (!activeId || !meId) return;
    const socket = getSocket();
    const unseen = activeMessages.filter(
      (m) => m.authorId !== meId && m.state !== "seen" && !seenRequested.current.has(m.id),
    );
    for (const m of unseen) {
      seenRequested.current.add(m.id);
      socket.emit("message_seen", m.id);
    }
  }, [activeId, activeMessages, meId]);

  const notifyTyping = useCallback(
    (chatId: string) => {
      const socket = getSocket();
      socket.emit("typing", chatId);
      if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
      typingStopTimer.current = setTimeout(() => {
        socket.emit("stop_typing", chatId);
      }, TYPING_STOP_DELAY);
    },
    [],
  );

  const sendRaw = useCallback(
    (chatId: string, text?: string, image?: string, replyTo?: MessageReplyPreview) => {
      const chat = chatById(chatId);
      const receiver = chat?.participants.find((p) => p.id !== meId);
      if (!receiver) {
        toast.error("Can't send — this conversation has no other participant.");
        return;
      }

      const clientId = `pending-${crypto.randomUUID()}`;
      const optimistic: Message = {
        id: clientId,
        conversationId: chatId,
        authorId: meId,
        body: text ?? "",
        createdAt: new Date().toISOString(),
        state: "sending",
        imageUrl: image,
        clientId,
        // Built straight from the message/author already in memory — no
        // need to wait on the server to know what we're replying to.
        replyTo,
      };

      queryClient.setQueryData<MessagesCache>(messagesKey(chatId), (prev) =>
        withLatestPage(prev, (latest) => [...latest, optimistic]),
      );

      const socket = getSocket();
      if (!socket.connected) {
        queryClient.setQueryData<MessagesCache>(messagesKey(chatId), (prev) =>
          withLatestPage(prev, (latest) => latest.map((m) => (m.id === clientId ? { ...m, state: "failed" } : m))),
        );
        toast.error("You're offline — message not sent.");
        return;
      }

      const timeout = setTimeout(() => {
        pendingRef.current.delete(clientId);
        queryClient.setQueryData<MessagesCache>(messagesKey(chatId), (prev) =>
          withLatestPage(prev, (latest) =>
            latest.map((m) => (m.id === clientId && m.state === "sending" ? { ...m, state: "failed" } : m)),
          ),
        );
      }, SEND_TIMEOUT_MS);

      pendingRef.current.set(clientId, { clientId, chatId, text, image, timeout });

      socket.emit("send_message", {
        chat: chatId,
        receiver: receiver.id,
        text,
        image,
        replyTo: replyTo?.id,
      });
    },
    [chatById, meId, queryClient],
  );

  const sendMessage = useCallback(
    (conversationId: string, body: string, imageUrl?: string, replyTo?: MessageReplyPreview) => {
      sendRaw(conversationId, body || undefined, imageUrl, replyTo);
    },
    [sendRaw],
  );

  const retryMessage = useCallback(
    (chatId: string, message: Message) => {
      queryClient.setQueryData<MessagesCache>(messagesKey(chatId), (prev) =>
        withAllPages(prev, (page) => page.filter((m) => m.id !== message.id)),
      );
      sendRaw(chatId, message.body || undefined, message.imageUrl, message.replyTo);
    },
    [queryClient, sendRaw],
  );

  const deleteMessage = useCallback(
    async (chatId: string, messageId: string) => {
      if (messageId.startsWith("pending-")) {
        queryClient.setQueryData<MessagesCache>(messagesKey(chatId), (prev) =>
          withAllPages(prev, (page) => page.filter((m) => m.id !== messageId)),
        );
        return;
      }
      const previous = queryClient.getQueryData<MessagesCache>(messagesKey(chatId));
      queryClient.setQueryData<MessagesCache>(messagesKey(chatId), (prev) =>
        withAllPages(prev, (page) => page.filter((m) => m.id !== messageId)),
      );
      try {
        await messagesApi.remove(messageId);
      } catch (error) {
        if (previous) queryClient.setQueryData(messagesKey(chatId), previous);
        toast.error(apiErrorMessage(error, "Couldn't delete message."));
      }
    },
    [queryClient],
  );

  const deleteChat = useCallback(
    async (chatId: string) => {
      const previous = queryClient.getQueryData<AppChat[]>(CHATS_KEY);
      queryClient.setQueryData<AppChat[]>(CHATS_KEY, (prev = []) => prev.filter((c) => c.id !== chatId));
      if (activeId === chatId) {
        const remaining = (previous ?? []).filter((c) => c.id !== chatId);
        setActiveIdState(remaining[0]?.id ?? null);
      }
      try {
        await chatsApi.remove(chatId);
        getSocket().emit("leave_chat", chatId);
        joinedRooms.current.delete(chatId);
        queryClient.removeQueries({ queryKey: messagesKey(chatId) });
      } catch (error) {
        if (previous) queryClient.setQueryData(CHATS_KEY, previous);
        toast.error(apiErrorMessage(error, "Couldn't delete chat."));
      }
    },
    [activeId, queryClient],
  );

  const startChatWith = useCallback(
    async (otherUserId: string) => {
      try {
        const chat = await chatsApi.create(otherUserId);
        queryClient.setQueryData<AppChat[]>(CHATS_KEY, (prev = []) => {
          if (prev.some((c) => c.id === chat.id)) return prev;
          return [chat, ...prev];
        });
        const socket = getSocket();
        if (socket.connected) socket.emit("join_chat", chat.id);
        joinedRooms.current.add(chat.id);
        setActiveIdState(chat.id);
        return chat;
      } catch (error) {
        toast.error(apiErrorMessage(error, "Couldn't start conversation."));
        return null;
      }
    },
    [queryClient],
  );

  return {
    convos,
    msgs: activeMessages,
    activeId,
    typingIn,
    userById,
    lastMessageOf,
    openConversation,
    sendMessage,
    retryMessage,
    deleteMessage,
    deleteChat,
    startChatWith,
    notifyTyping,
    chatsLoading: chatsQuery.isLoading,
    messagesLoading: messagesQuery.isLoading,
    loadOlderMessages,
    hasOlderMessages: messagesQuery.hasNextPage,
    loadingOlderMessages: messagesQuery.isFetchingNextPage,
    onlineUserIds,
    connectionStatus,
  };
}

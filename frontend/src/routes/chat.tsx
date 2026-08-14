import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Loader2, LogOut, MessageSquarePlus, Moon, Phone, Search, Sun, Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar } from "@/components/chat/avatar";
import { ConversationList } from "@/components/chat/conversation-list";
import { MessageBubble } from "@/components/chat/message-bubble";
import { TypingIndicator } from "@/components/chat/typing-indicator";
import { Composer } from "@/components/chat/composer";
import { AmbientScene } from "@/components/three/ambient-scene";
import { NewChatDialog } from "@/components/chat/new-chat-dialog";
import { NotificationsMenu } from "@/components/chat/notifications-menu";
import { SettingsDialog } from "@/components/chat/settings-dialog";
import { MessageSearch } from "@/components/chat/message-search";
import { ImageLightbox } from "@/components/chat/image-lightbox";
import { useChatStore } from "@/features/chat/use-chat-store";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/hooks/use-auth";
import { initialsOf } from "@/types/api";
import type { Message, MessageReplyPreview } from "@/types/chat";
import { cn } from "@/lib/utils";
import { fetchServerUser } from "@/lib/server-auth";
import { apiErrorMessage } from "@/lib/api-client";

export const Route = createFileRoute("/chat")({
  beforeLoad: async () => {
    const { user, checked } = await fetchServerUser();
    // Only a confirmed 401 redirects — an unreachable/erroring backend falls
    // through to the client-side check in ChatWorkspace instead of bouncing
    // an actually-authenticated user to /login.
    if (checked && !user) {
      throw redirect({ to: "/login" });
    }
  },
  head: () => ({
    meta: [
      { title: "Workspace — ChatSphere" },
      { name: "description", content: "Your ChatSphere workspace: recent chats, presence, typing indicators, read receipts and image sharing." },
      { property: "og:title", content: "Workspace — ChatSphere" },
      { property: "og:description", content: "Recent chats, presence, typing indicators and read receipts in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChatWorkspace,
});

function ChatWorkspace() {
  const { user, status, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === "unauthenticated") {
      navigate({ to: "/login" });
    }
  }, [status, navigate]);

  if (status !== "authenticated" || !user) {
    return (
      <div className="grid h-screen place-items-center">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="size-2 animate-pulse rounded-full bg-primary" />
          Loading your workspace…
        </div>
      </div>
    );
  }

  return <ChatWorkspaceInner userName={user.name} meId={user.id} onLogout={logout} />;
}

function ChatWorkspaceInner({
  userName,
  meId,
  onLogout,
}: {
  userName: string;
  meId: string;
  onLogout: () => Promise<void>;
}) {
  const {
    convos,
    msgs,
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
    chatsLoading,
    messagesLoading,
    loadOlderMessages,
    hasOlderMessages,
    loadingOlderMessages,
    connectionStatus,
  } = useChatStore();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [mobileThread, setMobileThread] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [threadSearchOpen, setThreadSearchOpen] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const jumpToMessage = (messageId: string) => {
    const el = document.getElementById(`message-${messageId}`);
    if (!el) {
      toast("That message is outside the currently loaded history.");
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedMessageId(messageId);
    setThreadSearchOpen(false);
    setTimeout(() => setHighlightedMessageId((prev) => (prev === messageId ? null : prev)), 2000);
  };

  useEffect(() => {
    setThreadSearchOpen(false);
    setHighlightedMessageId(null);
    setReplyingTo(null);
  }, [activeId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return convos;
    return convos.filter((c) => userById.get(c.participantId)?.name.toLowerCase().includes(q));
  }, [convos, query, userById]);

  const activeConvo = convos.find((c) => c.id === activeId);
  const peer = activeConvo ? userById.get(activeConvo.participantId) : undefined;
  const thread = activeId ? msgs.filter((m) => m.conversationId === activeId) : [];

  const scrollRef = useRef<HTMLDivElement>(null);
  // Set right before triggering an older-page fetch; consumed by the layout
  // effect below to keep the viewport anchored instead of jumping to bottom.
  const olderLoadScrollHeight = useRef<number | null>(null);

  useEffect(() => {
    olderLoadScrollHeight.current = null;
  }, [activeId]);

  const handleThreadScroll = () => {
    const el = scrollRef.current;
    if (!el || !hasOlderMessages || loadingOlderMessages) return;
    if (el.scrollTop < 120) {
      olderLoadScrollHeight.current = el.scrollHeight;
      loadOlderMessages();
    }
  };

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (olderLoadScrollHeight.current !== null) {
      el.scrollTop += el.scrollHeight - olderLoadScrollHeight.current;
      olderLoadScrollHeight.current = null;
      return;
    }
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [thread.length, typingIn]);

  return (
    <div className="relative flex h-screen overflow-hidden">
      <AmbientScene withOrb={false} className="opacity-30" />

      <NewChatDialog
        open={newChatOpen}
        onOpenChange={setNewChatOpen}
        onPick={(userId) => {
          void startChatWith(userId);
          setMobileThread(true);
        }}
      />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <ImageLightbox src={lightboxImage} onClose={() => setLightboxImage(null)} />

      {connectionStatus === "disconnected" ? (
        <div
          role="status"
          className="absolute inset-x-0 top-0 z-30 flex items-center justify-center gap-2 bg-destructive/90 py-1.5 text-xs font-medium text-destructive-foreground"
        >
          <span className="size-1.5 animate-pulse rounded-full bg-current" />
          Connection lost — reconnecting…
        </div>
      ) : null}

      {/* Sidebar */}
      <aside
        className={cn(
          "relative z-10 flex w-full flex-col border-r border-border/60 bg-background/70 backdrop-blur-xl md:w-80 lg:w-96",
          mobileThread ? "hidden md:flex" : "flex",
        )}
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 pt-5 pb-3">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="flex min-w-0 items-center gap-3 rounded-2xl text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Avatar initials={initialsOf(userName)} status="online" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{userName}</p>
              <p className="truncate text-xs text-muted-foreground">Active now</p>
            </div>
          </button>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Start a new conversation"
              onClick={() => setNewChatOpen(true)}
              className="min-h-11 min-w-11 rounded-2xl"
            >
              <MessageSquarePlus className="size-5" />
            </Button>
            <NotificationsMenu />
            <Button
              variant="ghost"
              size="icon"
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              onClick={toggle}
              className="min-h-11 min-w-11 rounded-2xl"
            >
              {theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Sign out"
              className="min-h-11 min-w-11 rounded-2xl"
              onClick={() => {
                onLogout()
                  .then(() => {
                    toast("Signed out");
                    navigate({ to: "/" });
                  })
                  .catch((error: unknown) => {
                    toast.error(apiErrorMessage(error, "Couldn't sign out. Please try again."));
                  });
              }}
            >
              <LogOut className="size-5" />
            </Button>
          </div>
        </div>

        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <label htmlFor="search" className="sr-only">
              Search conversations
            </label>
            <Input
              id="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people"
              className="rounded-2xl pl-9"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar">
          {chatsLoading ? (
            <div className="space-y-3 px-4 py-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="size-10 rounded-2xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-1/3" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 && convos.length === 0 ? (
            <div className="px-4 py-14 text-center">
              <p className="text-sm font-medium">No conversations yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Start one from the compose button above.</p>
              <Button size="sm" className="mt-4 rounded-xl" onClick={() => setNewChatOpen(true)}>
                <MessageSquarePlus className="mr-1.5 size-4" /> New chat
              </Button>
            </div>
          ) : (
            <ConversationList
              conversations={filtered}
              activeId={activeId ?? ""}
              userById={userById}
              lastMessageOf={lastMessageOf}
              onSelect={(id) => {
                openConversation(id);
                setMobileThread(true);
              }}
              onDelete={(id) => {
                void deleteChat(id);
              }}
            />
          )}
        </div>
      </aside>

      {/* Thread */}
      <main
        className={cn(
          "relative z-10 min-w-0 flex-1 flex-col",
          mobileThread ? "flex" : "hidden md:flex",
        )}
      >
        {peer ? (
          <>
            <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border/60 bg-background/60 px-3 py-3 backdrop-blur-xl sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Back to conversations"
                  className="min-h-11 min-w-11 rounded-2xl md:hidden"
                  onClick={() => setMobileThread(false)}
                >
                  <ArrowLeft className="size-5" />
                </Button>
                <Avatar initials={peer.avatar} status={peer.status} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{peer.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {typingIn === activeId ? "typing…" : peer.status === "online" ? "Online" : peer.bio || "Offline"}
                  </p>
                </div>
              </div>
              <span />
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Search this conversation"
                  className="min-h-11 min-w-11 rounded-2xl"
                  onClick={() => setThreadSearchOpen((v) => !v)}
                >
                  <Search className="size-5" />
                </Button>
                <Button variant="ghost" size="icon" aria-label="Start voice call" className="min-h-11 min-w-11 rounded-2xl" onClick={() => toast("Calls are coming soon")}>
                  <Phone className="size-5" />
                </Button>
                <Button variant="ghost" size="icon" aria-label="Start video call" className="min-h-11 min-w-11 rounded-2xl" onClick={() => toast("Calls are coming soon")}>
                  <Video className="size-5" />
                </Button>
              </div>
            </header>

            {threadSearchOpen && activeId ? (
              <MessageSearch chatId={activeId} meId={meId} onJump={jumpToMessage} onClose={() => setThreadSearchOpen(false)} />
            ) : null}

            <div ref={scrollRef} onScroll={handleThreadScroll} className="flex-1 overflow-y-auto px-3 py-6 sm:px-6">
              {messagesLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton
                      key={i}
                      className={cn("h-12 rounded-3xl", i % 2 ? "ml-auto w-2/5" : "w-1/2")}
                    />
                  ))}
                </div>
              ) : thread.length === 0 ? (
                <div className="grid h-full place-items-center text-center">
                  <div>
                    <p className="text-sm font-medium">Say hello to {peer.name.split(" ")[0]}</p>
                    <p className="mt-1 text-xs text-muted-foreground">No messages yet in this conversation.</p>
                  </div>
                </div>
              ) : (
                <ul className="mx-auto flex max-w-3xl flex-col gap-3">
                  {loadingOlderMessages ? (
                    <li className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin" /> Loading earlier messages…
                    </li>
                  ) : !hasOlderMessages ? (
                    <li className="py-2 text-center text-xs text-muted-foreground">Start of your conversation</li>
                  ) : null}
                  <AnimatePresence initial={false}>
                    {thread.map((m) => (
                      <MessageBubble
                        key={m.id}
                        message={m}
                        mine={m.authorId !== peer.id}
                        onRetry={
                          m.state === "failed"
                            ? () => {
                                if (activeId) retryMessage(activeId, m);
                              }
                            : undefined
                        }
                        onDelete={
                          m.authorId !== peer.id && !m.id.startsWith("pending-")
                            ? () => {
                                if (activeId) void deleteMessage(activeId, m.id);
                              }
                            : undefined
                        }
                        onReply={!m.id.startsWith("pending-") ? () => setReplyingTo(m) : undefined}
                        onJumpToReplied={jumpToMessage}
                        onImageClick={setLightboxImage}
                        highlighted={m.id === highlightedMessageId}
                      />
                    ))}
                    {typingIn === activeId ? (
                      <TypingIndicator key="typing" name={peer.name.split(" ")[0] ?? peer.name} />
                    ) : null}
                  </AnimatePresence>
                </ul>
              )}
              <div ref={endRef} />
            </div>

            <Composer
              peerName={peer.name.split(" ")[0] ?? peer.name}
              onSend={(body, imageUrl) => {
                if (!activeId) return;
                const replyPreview: MessageReplyPreview | undefined = replyingTo
                  ? {
                      id: replyingTo.id,
                      body: replyingTo.body,
                      imageUrl: replyingTo.imageUrl,
                      authorId: replyingTo.authorId,
                      authorName: replyingTo.authorId === meId ? "You" : peer.name,
                    }
                  : undefined;
                sendMessage(activeId, body, imageUrl, replyPreview);
                setReplyingTo(null);
              }}
              onTyping={() => activeId && notifyTyping(activeId)}
              replyingTo={
                replyingTo
                  ? {
                      authorName: replyingTo.authorId === meId ? "You" : peer.name,
                      body: replyingTo.body,
                      imageUrl: replyingTo.imageUrl,
                    }
                  : null
              }
              onCancelReply={() => setReplyingTo(null)}
            />
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid flex-1 place-items-center p-10 text-center"
          >
            <div>
              <h2 className="text-lg font-semibold">
                {chatsLoading ? "Loading your conversations…" : "Pick a conversation"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {chatsLoading ? (
                  "One moment."
                ) : (
                  <>
                    Your threads live on the left, or{" "}
                    <button type="button" className="text-primary underline-offset-2 hover:underline" onClick={() => setNewChatOpen(true)}>
                      start a new one
                    </button>
                    .
                  </>
                )}
              </p>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}

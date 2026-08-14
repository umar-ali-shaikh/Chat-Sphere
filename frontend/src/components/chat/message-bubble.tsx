import { memo } from "react";
import { format } from "date-fns";
import { motion } from "motion/react";
import { AlertCircle, Check, CheckCheck, Clock, Reply, RotateCw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message } from "@/types/chat";

export const MessageBubble = memo(function MessageBubble({
  message,
  mine,
  onRetry,
  onDelete,
  onReply,
  onJumpToReplied,
  onImageClick,
  highlighted,
}: {
  message: Message;
  mine: boolean;
  onRetry?: (() => void) | undefined;
  onDelete?: (() => void) | undefined;
  onReply?: (() => void) | undefined;
  onJumpToReplied?: ((messageId: string) => void) | undefined;
  onImageClick?: ((url: string) => void) | undefined;
  highlighted?: boolean;
}) {
  const Icon =
    message.state === "seen"
      ? CheckCheck
      : message.state === "delivered"
        ? Check
        : message.state === "failed"
          ? AlertCircle
          : Clock;
  const failed = message.state === "failed";

  return (
    <motion.li
      id={`message-${message.id}`}
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 360, damping: 28 }}
      className={cn(
        "group flex w-full items-center gap-2 rounded-2xl transition-colors",
        mine ? "justify-end" : "justify-start",
        highlighted && "bg-primary/10 ring-2 ring-primary/50",
      )}
    >
      <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        {onReply ? (
          <button
            type="button"
            aria-label="Reply to this message"
            onClick={onReply}
            className="rounded-lg p-1 text-muted-foreground hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Reply className="size-3.5" />
          </button>
        ) : null}
        {mine && onDelete && !failed ? (
          <button
            type="button"
            aria-label="Delete message"
            onClick={onDelete}
            className="rounded-lg p-1 text-muted-foreground hover:text-destructive focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Trash2 className="size-3.5" />
          </button>
        ) : null}
      </div>
      <div
        className={cn(
          "max-w-[min(78%,34rem)] rounded-3xl px-4 py-2.5 text-sm leading-relaxed shadow-sm",
          mine
            ? "rounded-br-lg bg-primary text-primary-foreground"
            : "rounded-bl-lg bg-bubble-in text-bubble-in-foreground",
          failed && "opacity-80 ring-1 ring-destructive",
        )}
      >
        {message.replyTo ? (
          <button
            type="button"
            onClick={() => onJumpToReplied?.(message.replyTo!.id)}
            className={cn(
              "mb-1.5 block w-full truncate rounded-xl border-l-2 px-2 py-1 text-left text-xs opacity-80 transition-opacity hover:opacity-100",
              mine ? "border-primary-foreground/50 bg-black/10" : "border-foreground/30 bg-black/5",
            )}
          >
            <span className="font-medium">{message.replyTo.authorName ?? "Original message"}</span>
            {message.replyTo.body || message.replyTo.imageUrl ? (
              <span> · {message.replyTo.body || "📷 Image"}</span>
            ) : null}
          </button>
        ) : null}
        {message.imageUrl ? (
          <button
            type="button"
            aria-label="View image full size"
            onClick={() => onImageClick?.(message.imageUrl!)}
            className="mb-2 block w-full cursor-zoom-in rounded-2xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <img
              src={message.imageUrl}
              alt="Shared attachment"
              loading="lazy"
              className="aspect-video w-full rounded-2xl object-cover"
            />
          </button>
        ) : null}
        {message.body ? <p className="whitespace-pre-wrap break-words">{message.body}</p> : null}
        <span
          className={cn(
            "mt-1 flex items-center justify-end gap-1 text-[10px]",
            mine ? "text-primary-foreground/70" : "text-muted-foreground",
          )}
        >
          {failed ? (
            <button
              type="button"
              onClick={onRetry}
              className="flex items-center gap-1 underline-offset-2 hover:underline"
            >
              Failed to send · Retry
              <RotateCw className="size-3" aria-hidden />
            </button>
          ) : (
            <>
              {format(new Date(message.createdAt), "HH:mm")}
              {mine ? (
                <>
                  <Icon className="size-3" aria-hidden />
                  <span className="sr-only">{message.state}</span>
                </>
              ) : null}
            </>
          )}
        </span>
      </div>
    </motion.li>
  );
});
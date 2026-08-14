import { memo } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { motion } from "motion/react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "./avatar";
import type { Conversation, Message, User } from "@/types/chat";

interface Props {
  conversations: Conversation[];
  activeId: string;
  userById: Map<string, User>;
  lastMessageOf: (id: string) => Message | null;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => void;
}

export const ConversationList = memo(function ConversationList({
  conversations,
  activeId,
  userById,
  lastMessageOf,
  onSelect,
  onDelete,
}: Props) {
  if (conversations.length === 0) {
    return (
      <div className="px-4 py-14 text-center">
        <p className="text-sm font-medium">No conversations found</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Try a different name or start a new thread.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-1 px-2 pb-4">
      {conversations.map((c) => {
        const user = userById.get(c.participantId);
        const last = lastMessageOf(c.id);
        const active = c.id === activeId;
        if (!user) return null;

        return (
          <li key={c.id} className="group relative">
            <button
              type="button"
              onClick={() => onSelect(c.id)}
              aria-current={active ? "true" : undefined}
              className={cn(
                "relative grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                active ? "bg-secondary" : "hover:bg-secondary/60",
              )}
            >
              {active ? (
                <motion.span
                  layoutId="convo-active"
                  className="absolute inset-y-2 left-0 w-1 rounded-full bg-primary"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              ) : null}
              <Avatar initials={user.avatar} status={user.status} />
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold">{user.name}</span>
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {last ? last.body : "Say hello"}
                </span>
              </span>
              <span className="flex flex-col items-end gap-1">
                <span className="text-[10px] text-muted-foreground">
                  {last
                    ? formatDistanceToNowStrict(new Date(last.createdAt), { addSuffix: false })
                    : ""}
                </span>
                {c.unread > 0 ? (
                  <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                    {c.unread}
                  </span>
                ) : null}
              </span>
            </button>
            {onDelete ? (
              <button
                type="button"
                aria-label={`Delete conversation with ${user.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(c.id);
                }}
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded-xl bg-background/80 p-1.5 text-muted-foreground opacity-0 backdrop-blur transition-opacity hover:text-destructive focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none group-hover:opacity-100"
              >
                <Trash2 className="size-3.5" />
              </button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
});
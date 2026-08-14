import { formatDistanceToNowStrict } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { notificationsApi } from "@/api/notifications";
import { NOTIFICATIONS_KEY, UNREAD_COUNT_KEY } from "@/features/chat/use-chat-store";
import { apiErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export function NotificationsMenu() {
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: notificationsApi.list,
  });

  const unread = notifications.filter((n) => !n.isRead).length;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
  };

  const runAction = async (action: () => Promise<void>, fallback: string) => {
    try {
      await action();
      invalidate();
    } catch (error) {
      toast.error(apiErrorMessage(error, fallback));
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={unread > 0 ? `${unread} unread notifications` : "Notifications"}
          className="relative min-h-11 min-w-11 rounded-2xl"
        >
          <Bell className="size-5" />
          {unread > 0 ? (
            <span className="absolute top-1.5 right-1.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 rounded-2xl p-2">
        <div className="flex items-center justify-between px-2 py-1">
          <DropdownMenuLabel className="p-0 text-sm">Notifications</DropdownMenuLabel>
          {unread > 0 ? (
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-primary hover:underline"
              onClick={() => void runAction(notificationsApi.markAllRead, "Couldn't mark all as read.")}
            >
              <Check className="size-3" /> Mark all read
            </button>
          ) : null}
        </div>
        <DropdownMenuSeparator />
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : notifications.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">You're all caught up.</p>
        ) : (
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {notifications.map((n) => (
              <DropdownMenuItem
                key={n.id}
                className={cn("flex-col items-start gap-0.5 rounded-xl py-2", !n.isRead && "bg-secondary/60")}
                onSelect={(e) => {
                  e.preventDefault();
                  if (!n.isRead) {
                    void runAction(() => notificationsApi.markRead(n.id), "Couldn't mark as read.");
                  }
                }}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="truncate text-xs font-semibold">{n.title}</span>
                  <button
                    type="button"
                    aria-label="Delete notification"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      void runAction(() => notificationsApi.remove(n.id), "Couldn't delete notification.");
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                <span className="line-clamp-2 text-xs text-muted-foreground">{n.body}</span>
                <span className="text-[10px] text-muted-foreground">
                  {formatDistanceToNowStrict(new Date(n.createdAt), { addSuffix: true })}
                </span>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

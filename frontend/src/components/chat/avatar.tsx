import { memo } from "react";
import { cn } from "@/lib/utils";
import type { PresenceStatus } from "@/types/chat";

const dot: Record<PresenceStatus, string> = {
  online: "bg-accent",
  away: "bg-chart-5",
  offline: "bg-muted-foreground/50",
};

export const Avatar = memo(function Avatar({
  initials,
  status,
  size = "md",
  className,
}: {
  initials: string;
  status?: PresenceStatus;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    sm: "size-8 text-[11px]",
    md: "size-10 text-xs",
    lg: "size-14 text-sm",
  } as const;

  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <span
        className={cn(
          "grid place-items-center rounded-2xl font-semibold tracking-wide text-primary-foreground",
          sizes[size],
        )}
        style={{ backgroundImage: "var(--gradient-brand)" }}
      >
        {initials}
      </span>
      {status ? (
        <span
          className={cn(
            "absolute -right-0.5 -bottom-0.5 size-3 rounded-full ring-2 ring-background",
            dot[status],
          )}
        >
          <span className="sr-only">{status}</span>
        </span>
      ) : null}
    </span>
  );
});
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { messagesApi } from "@/api/messages";
import { partyId } from "@/types/api";

function highlight(text: string, query: string) {
  if (!query.trim()) return text;
  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === query.trim().toLowerCase() ? (
      <mark key={i} className="rounded bg-primary/30 text-inherit">
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export function MessageSearch({
  chatId,
  meId,
  onJump,
  onClose,
}: {
  chatId: string;
  meId: string;
  onJump: (messageId: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data: results, isLoading, isError } = useQuery({
    queryKey: ["messages", "search", chatId, debounced],
    queryFn: () => messagesApi.search(chatId, debounced),
    enabled: debounced.trim().length > 0,
  });

  return (
    <div className="relative z-20 border-b border-border/60 bg-background/95 backdrop-blur-xl">
      <div className="flex items-center gap-2 px-3 py-3 sm:px-5">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search this conversation…"
          className="h-9 rounded-xl border-none bg-secondary/60 focus-visible:ring-1"
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
          }}
        />
        <Button variant="ghost" size="icon" aria-label="Close search" className="size-9 shrink-0 rounded-xl" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      {debounced.trim() ? (
        <div className="max-h-72 overflow-y-auto border-t border-border/60 px-2 py-2">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Searching…
            </div>
          ) : isError ? (
            <p className="py-6 text-center text-sm text-destructive">Search failed. Try again.</p>
          ) : results && results.length > 0 ? (
            <ul className="space-y-1">
              {results.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => onJump(m.id)}
                    className="flex w-full flex-col items-start gap-0.5 rounded-xl px-3 py-2 text-left transition-colors hover:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <span className="flex w-full items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>{partyId(m.sender) === meId ? "You" : "Them"}</span>
                      <span>{formatDistanceToNowStrict(new Date(m.createdAt), { addSuffix: true })}</span>
                    </span>
                    <span className="line-clamp-2 text-sm">{highlight(m.text ?? "", debounced)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">No messages match "{debounced}".</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

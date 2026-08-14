import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usersApi } from "@/api/users";
import { initialsOf } from "@/types/api";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Avatar } from "@/components/chat/avatar";

export function NewChatDialog({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (userId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const { data: results, isLoading } = useQuery({
    queryKey: ["users", "search", debounced],
    queryFn: () => usersApi.search(debounced || undefined),
    enabled: open,
  });

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search people by name or email…" value={query} onValueChange={setQuery} />
      <CommandList>
        {isLoading ? <div className="py-6 text-center text-sm text-muted-foreground">Searching…</div> : null}
        {!isLoading ? <CommandEmpty>No one matches that search.</CommandEmpty> : null}
        <CommandGroup heading="People">
          {(results ?? []).map((person) => (
            <CommandItem
              key={person.id}
              value={`${person.name} ${person.email}`}
              onSelect={() => {
                onPick(person.id);
                onOpenChange(false);
              }}
              className="gap-3"
            >
              <Avatar initials={initialsOf(person.name)} size="sm" status={person.isOnline ? "online" : "offline"} />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">{person.name}</span>
                <span className="truncate text-xs text-muted-foreground">{person.email}</span>
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

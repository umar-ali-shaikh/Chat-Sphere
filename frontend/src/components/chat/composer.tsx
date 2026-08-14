import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Reply, SendHorizonal, Smile, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { uploadApi } from "@/api/upload";
import { apiErrorMessage } from "@/lib/api-client";

const EMOJI = ["😀", "😂", "🥲", "😍", "🤝", "👍", "🙏", "🔥", "🎉", "🚀", "💜", "✅", "👀", "☕", "🧠", "✨"];
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export interface ComposerReplyContext {
  authorName: string;
  body?: string | undefined;
  imageUrl?: string | undefined;
}

export function Composer({
  onSend,
  onTyping,
  peerName,
  replyingTo,
  onCancelReply,
}: {
  onSend: (body: string, imageUrl?: string) => void;
  onTyping?: () => void;
  peerName: string;
  replyingTo?: ComposerReplyContext | null;
  onCancelReply?: () => void;
}) {
  const [value, setValue] = useState("");
  const [pendingImage, setPendingImage] = useState<{ file: File; previewUrl: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearImage = useCallback(() => {
    setPendingImage((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  }, []);

  const submit = useCallback(async () => {
    const body = value.trim();
    if (!body && !pendingImage) return;

    if (pendingImage) {
      setUploading(true);
      try {
        const uploaded = await uploadApi.image(pendingImage.file);
        onSend(body, uploaded.url);
        clearImage();
        setValue("");
        onCancelReply?.();
        inputRef.current?.focus();
      } catch (error) {
        toast.error(apiErrorMessage(error, "Couldn't upload image."));
      } finally {
        setUploading(false);
      }
      return;
    }

    onSend(body);
    setValue("");
    onCancelReply?.();
    inputRef.current?.focus();
  }, [clearImage, onCancelReply, onSend, pendingImage, value]);

  return (
    <div className="border-t border-border/70 bg-background/60 px-3 py-3 backdrop-blur-xl sm:px-5">
      {replyingTo ? (
        <div className="mx-auto mb-2 flex max-w-3xl items-start gap-2 rounded-2xl bg-secondary/60 p-2 pl-3">
          <Reply className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">Replying to {replyingTo.authorName}</p>
            <p className="truncate text-xs">{replyingTo.body || (replyingTo.imageUrl ? "📷 Image" : "")}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Cancel reply"
            className="size-8 shrink-0 rounded-xl"
            onClick={onCancelReply}
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : null}

      {pendingImage ? (
        <div className="mx-auto mb-2 flex max-w-3xl items-center gap-3 rounded-2xl bg-secondary/60 p-2">
          <img src={pendingImage.previewUrl} alt="Selected attachment" className="size-14 rounded-xl object-cover" />
          <span className="flex-1 truncate text-xs text-muted-foreground">{pendingImage.file.name}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Remove image"
            className="size-8 rounded-xl"
            onClick={clearImage}
            disabled={uploading}
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : null}

      <div className="glass flex items-end gap-2 rounded-3xl px-2 py-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon" aria-label="Insert emoji" className="min-h-11 min-w-11 rounded-2xl">
              <Smile className="size-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 rounded-2xl p-2">
            <div className="grid grid-cols-8 gap-1">
              {EMOJI.map((e) => (
                <button
                  key={e}
                  type="button"
                  aria-label={`Insert ${e}`}
                  onClick={() => setValue((v) => v + e)}
                  className="rounded-lg p-1 text-lg transition-transform hover:scale-125 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {e}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            if (file.size > MAX_IMAGE_BYTES) {
              toast.error("Image must be under 8MB.");
              return;
            }
            clearImage();
            setPendingImage({ file, previewUrl: URL.createObjectURL(file) });
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Attach image"
          className="min-h-11 min-w-11 rounded-2xl"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          <ImagePlus className="size-5" />
        </Button>

        <label className="sr-only" htmlFor="composer">
          Message {peerName}
        </label>
        <textarea
          id="composer"
          ref={inputRef}
          rows={1}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            onTyping?.();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder={`Message ${peerName}`}
          className="max-h-32 min-h-11 flex-1 resize-none bg-transparent py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none"
        />

        <Button
          type="button"
          size="icon"
          aria-label="Send message"
          disabled={(!value.trim() && !pendingImage) || uploading}
          onClick={() => void submit()}
          className="min-h-11 min-w-11 rounded-2xl"
        >
          {uploading ? <Loader2 className="size-5 animate-spin" /> : <SendHorizonal className="size-5" />}
        </Button>
      </div>
    </div>
  );
}

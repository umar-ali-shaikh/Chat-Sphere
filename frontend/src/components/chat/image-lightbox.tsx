import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

/**
 * Full-size in-app image viewer. Built on the same Radix Dialog primitive as
 * the rest of the app's modals, so Escape-to-close, overlay-click-to-close,
 * focus trapping and background-interaction blocking all come for free.
 */
export function ImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string | null;
  alt?: string;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!src} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90vh] w-fit max-w-[95vw] items-center justify-center border-none bg-transparent p-0 shadow-none sm:max-w-[90vw]">

        <DialogTitle className="sr-only">{alt ?? "Shared image"}</DialogTitle>
        {src ? (
          <img
            src={src}
            alt={alt ?? "Shared image, full size"}
            className="max-h-[90vh] w-auto max-w-full rounded-2xl object-contain"
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

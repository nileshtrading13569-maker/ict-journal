import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { Camera, ClipboardPaste, ImagePlus, Loader2, Monitor, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  captureScreenFrame,
  imageFileFromDataTransfer,
  prepareScreenshotFile,
  SCREENSHOT_LABELS,
  SCREENSHOT_SLOTS,
  type ScreenshotSlot,
} from "@/lib/screenshot";

interface ScreenshotAttachDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultSlot: ScreenshotSlot;
  attachedSlots: Record<ScreenshotSlot, boolean>;
  onAttach: (slot: ScreenshotSlot, dataUrl: string) => void;
}

type BusyState = "capture" | "file" | null;

export function ScreenshotAttachDialog({
  open,
  onOpenChange,
  defaultSlot,
  attachedSlots,
  onAttach,
}: ScreenshotAttachDialogProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [slot, setSlot] = useState<ScreenshotSlot>(defaultSlot);
  const [busy, setBusy] = useState<BusyState>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSlot(defaultSlot);
    setBusy(null);
    setDragging(false);
  }, [open, defaultSlot]);

  const attach = useCallback(
    (dataUrl: string) => {
      onAttach(slot, dataUrl);
      onOpenChange(false);
    },
    [onAttach, onOpenChange, slot],
  );

  const handleFile = useCallback(
    async (file: File | null | undefined) => {
      if (!file) return;
      setBusy("file");
      try {
        const dataUrl = await prepareScreenshotFile(file);
        attach(dataUrl);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not read that screenshot.");
      } finally {
        setBusy(null);
      }
    },
    [attach],
  );

  // Paste anywhere while the dialog is open (Win+Shift+S / Cmd+Shift+4 workflow).
  useEffect(() => {
    if (!open) return;
    const onPaste = (event: ClipboardEvent) => {
      const file = imageFileFromDataTransfer(event.clipboardData);
      if (!file) return;
      event.preventDefault();
      void handleFile(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [open, handleFile]);

  const handlePickFile = (event: ChangeEvent<HTMLInputElement>) => {
    void handleFile(event.target.files?.[0]);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = imageFileFromDataTransfer(event.dataTransfer);
    if (!file) {
      toast.error("Drop an image file (PNG, JPG, WebP or GIF).");
      return;
    }
    void handleFile(file);
  };

  const handleCapture = async () => {
    setBusy("capture");
    try {
      const dataUrl = await captureScreenFrame();
      attach(dataUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not capture the screen.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby="screenshot-dialog-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Camera className="size-5 text-accent" />
            Attach screenshot
          </DialogTitle>
          <DialogDescription id="screenshot-dialog-description">
            Paste a chart, drop an image, or capture your screen. It is saved to this trade automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              Save to
            </p>
            <div className="grid grid-cols-2 gap-2">
              {SCREENSHOT_SLOTS.map((option) => {
                const selected = slot === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setSlot(option)}
                    aria-pressed={selected}
                    className={cn(
                      "flex h-11 flex-col items-start justify-center rounded-lg border px-3 text-left text-[12px] transition-colors",
                      selected
                        ? "border-accent/60 bg-accent/10 text-white"
                        : "border-white/[0.1] bg-white/[0.03] text-muted-foreground hover:border-white/[0.2] hover:text-white",
                    )}
                  >
                    <span className="font-medium">{SCREENSHOT_LABELS[option]}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {attachedSlots[option] ? "Will replace current image" : "Empty slot"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={cn(
              "flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-5 py-6 text-center transition-colors",
              dragging
                ? "border-accent bg-accent/10"
                : "border-white/[0.14] bg-white/[0.02] hover:border-white/[0.24]",
            )}
          >
            {busy ? (
              <>
                <Loader2 className="size-6 animate-spin text-accent" />
                <p className="mt-2 text-sm text-white">
                  {busy === "capture" ? "Capturing screen…" : "Reading image…"}
                </p>
              </>
            ) : (
              <>
                <ClipboardPaste className="size-6 text-[#a2a2a0]" />
                <p className="mt-2 text-sm font-medium text-white">
                  Paste with <kbd className="rounded border border-white/20 bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px]">Ctrl</kbd>
                  {" + "}
                  <kbd className="rounded border border-white/20 bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px]">V</kbd>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">or drag &amp; drop an image here</p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-3"
                >
                  <Upload className="size-3.5" /> Choose file
                </Button>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              aria-label="Choose screenshot file"
              onChange={handlePickFile}
            />
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
            <Monitor className="mt-0.5 size-4 shrink-0 text-accent" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-white">Capture your screen</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                Pick the window or tab that shows your chart, then it attaches here.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void handleCapture()}
              disabled={busy !== null}
              className="shrink-0"
            >
              {busy === "capture" ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />}
              Capture
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { MonocleLogo } from "@/features/connection/components/monocle-logo";
import { useAppVersion } from "@/hooks/useAppVersion";

interface AboutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
  const version = useAppVersion();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="sr-only">About Monocle</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center py-2">
          <MonocleLogo className="mb-4 h-14 w-14" />
          <h2 className="text-lg font-bold tracking-wide">Monocle</h2>
          {version && (
            <span className="mt-3 rounded-sm border px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground">
              v{version}
            </span>
          )}
          <p className="mt-4 text-[11px] text-muted-foreground">
            By Elliot Layen
          </p>
          <button
            type="button"
            onClick={() =>
              openUrl("https://github.com/elliotlayen/Monocle").catch(
                console.error
              )
            }
            className="mt-1 text-[10px] text-muted-foreground underline underline-offset-4 transition-colors duration-[var(--duration-fast)] hover:text-foreground"
          >
            Documentation
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

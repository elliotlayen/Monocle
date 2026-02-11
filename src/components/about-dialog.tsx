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
      <DialogContent className="sm:max-w-sm bg-muted">
        <DialogHeader>
          <DialogTitle className="sr-only">About Monocle</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center py-4">
          <MonocleLogo className="w-20 h-20 mb-4" />
          <h2
            className="text-2xl font-bold mb-1"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Monocle
          </h2>
          {version && (
            <p className="text-sm text-muted-foreground mb-4">
              Version {version}
            </p>
          )}
          <p className="text-sm text-muted-foreground">By Elliot Layen</p>
          <button
            type="button"
            onClick={() =>
              openUrl("https://github.com/elliotlayen/Monocle").catch(
                console.error
              )
            }
            className="mt-1 text-[10px] text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
          >
            Documentation
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

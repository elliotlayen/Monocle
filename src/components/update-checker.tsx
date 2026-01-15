import { useEffect, useState } from "react";
import { check, Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { useAppVersion } from "@/hooks/useAppVersion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function UpdateChecker() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const currentVersion = useAppVersion();

  useEffect(() => {
    checkForUpdates();
  }, []);

  async function checkForUpdates() {
    try {
      const updateResult = await check();
      if (updateResult) {
        setUpdate(updateResult);
        setIsOpen(true);
      }
    } catch (err) {
      console.error("Failed to check for updates:", err);
    }
  }

  async function installUpdate() {
    if (!update) return;

    setIsDownloading(true);
    setError(null);

    try {
      let downloaded = 0;
      let contentLength = 0;

      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          contentLength = event.data.contentLength ?? 0;
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          if (contentLength > 0) {
            setDownloadProgress(Math.round((downloaded / contentLength) * 100));
          }
        } else if (event.event === "Finished") {
          setDownloadProgress(100);
        }
      });

      await relaunch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to install update");
      setIsDownloading(false);
    }
  }

  if (!update) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent showCloseButton={!isDownloading}>
        <DialogHeader>
          <DialogTitle>Update Available</DialogTitle>
          <DialogDescription>
            Version {update.version} is available.{" "}
            {currentVersion
              ? `You are currently on version ${currentVersion}.`
              : "You are currently on an older version."}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {isDownloading && (
          <div className="space-y-2">
            <div className="h-2 w-full rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Downloading... {downloadProgress}%
            </p>
          </div>
        )}

        <DialogFooter>
          {!isDownloading && (
            <>
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Later
              </Button>
              <Button onClick={installUpdate}>Install Update</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

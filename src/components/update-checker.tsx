import { useEffect, useRef } from "react";
import { check, Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { useToastStore } from "@/features/notifications/store";
import { useAppVersion } from "@/hooks/useAppVersion";

export function UpdateChecker() {
  const updateRef = useRef<Update | null>(null);
  const toastIdRef = useRef<string | null>(null);
  const currentVersion = useAppVersion();
  const { addToast, updateToast, removeToast } = useToastStore();

  useEffect(() => {
    checkForUpdates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkForUpdates() {
    try {
      const updateResult = await check();
      if (updateResult) {
        updateRef.current = updateResult;
        showUpdateAvailableToast(updateResult.version);
      }
    } catch (err) {
      console.error("Failed to check for updates:", err);
    }
  }

  function showUpdateAvailableToast(newVersion: string) {
    const versionText = currentVersion
      ? `Version ${newVersion} is available. You have ${currentVersion}.`
      : `Version ${newVersion} is available.`;

    toastIdRef.current = addToast({
      type: "update",
      title: "Update Available",
      message: versionText,
      duration: 0,
      actions: [
        {
          label: "Later",
          onClick: () => {
            if (toastIdRef.current) {
              removeToast(toastIdRef.current);
              toastIdRef.current = null;
            }
          },
        },
        {
          label: "Update",
          onClick: installUpdate,
        },
      ],
    });
  }

  async function installUpdate() {
    const update = updateRef.current;
    if (!update || !toastIdRef.current) return;

    // Update toast to show downloading state
    updateToast(toastIdRef.current, {
      title: "Downloading Update",
      message: "Downloading...",
      progress: { current: 0, total: 100 },
      actions: [], // Remove actions during download
    });

    try {
      let downloaded = 0;
      let contentLength = 0;

      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          contentLength = event.data.contentLength ?? 0;
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          if (contentLength > 0 && toastIdRef.current) {
            const percent = Math.round((downloaded / contentLength) * 100);
            updateToast(toastIdRef.current, {
              message: `Downloading... ${percent}%`,
              progress: { current: percent, total: 100 },
            });
          }
        } else if (event.event === "Finished") {
          if (toastIdRef.current) {
            updateToast(toastIdRef.current, {
              title: "Update Ready",
              message: "Restarting...",
              progress: { current: 100, total: 100 },
            });
          }
        }
      });

      await relaunch();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to install update";
      if (toastIdRef.current) {
        updateToast(toastIdRef.current, {
          type: "error",
          title: "Update Failed",
          message: errorMessage,
          progress: undefined,
          actions: [
            {
              label: "Dismiss",
              onClick: () => {
                if (toastIdRef.current) {
                  removeToast(toastIdRef.current);
                  toastIdRef.current = null;
                }
              },
            },
            {
              label: "Retry",
              onClick: installUpdate,
            },
          ],
        });
      }
    }
  }

  // This component doesn't render anything visible
  return null;
}

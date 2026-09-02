import { useEffect, useState } from "react";
import {
  settingsService,
  type ServerSource,
} from "@/features/settings/services/settings-service";

/**
 * Saved Schema Browser servers from settings. Refetches whenever `active`
 * turns true so a dialog picks up edits made in Settings since it last
 * opened.
 */
export function useServerSources(active: boolean): ServerSource[] {
  const [sources, setSources] = useState<ServerSource[]>([]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    settingsService
      .getSettings()
      .then((settings) => {
        if (!cancelled) setSources(settings.serverSources ?? []);
      })
      .catch(() => {
        // Leave whatever we had; the form falls back to free-text entry.
      });
    return () => {
      cancelled = true;
    };
  }, [active]);

  return sources;
}

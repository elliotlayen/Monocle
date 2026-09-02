import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  settingsService,
  type ServerSource,
} from "@/features/settings/services/settings-service";

/** Debounce for persisting edits while the user is still typing. */
const SAVE_DEBOUNCE_MS = 500;

export function ServerSourcesSection() {
  const [sources, setSources] = useState<ServerSource[]>([]);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    settingsService
      .getSettings()
      .then((settings) => {
        if (!cancelled) setSources(settings.serverSources ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const persist = useCallback((next: ServerSource[]) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      // Rows still missing a server address are drafts; persist the rest.
      const complete = next.filter((s) => s.server.trim().length > 0);
      settingsService.saveSettings({ serverSources: complete }).catch(() => {});
    }, SAVE_DEBOUNCE_MS);
  }, []);

  const update = (next: ServerSource[]) => {
    setSources(next);
    persist(next);
  };

  const handleFieldChange = (
    id: string,
    field: "label" | "server",
    value: string
  ) => {
    update(
      sources.map((source) =>
        source.id === id ? { ...source, [field]: value } : source
      )
    );
  };

  const handleRemove = (id: string) => {
    update(sources.filter((source) => source.id !== id));
  };

  const handleAdd = () => {
    update([
      ...sources,
      { id: crypto.randomUUID(), label: "", server: "" },
    ]);
  };

  return (
    <div className="space-y-6 px-1">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Server Sources</h3>
        <p className="text-xs text-muted-foreground">
          Saved SQL Servers offered in the Schema Browser connection dialog.
        </p>
      </div>

      <div className="space-y-2">
        {sources.map((source) => (
          <div
            key={source.id}
            className="flex items-center gap-2 rounded-lg border p-2"
          >
            <Input
              aria-label="Label"
              placeholder="Label"
              className="w-36"
              value={source.label}
              onChange={(e) =>
                handleFieldChange(source.id, "label", e.target.value)
              }
            />
            <Input
              aria-label="Server"
              placeholder="HOST\\INSTANCE"
              className="flex-1"
              value={source.server}
              onChange={(e) =>
                handleFieldChange(source.id, "server", e.target.value)
              }
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-destructive"
              aria-label={`Remove ${source.label || source.server}`}
              onClick={() => handleRemove(source.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}

        {sources.length === 0 && (
          <p className="rounded-lg border border-dashed px-4 py-6 text-center text-xs text-muted-foreground">
            No servers saved yet. Add one to turn the connection dialog's
            server field into a dropdown.
          </p>
        )}

        <Button variant="outline" size="sm" onClick={handleAdd}>
          <Plus className="h-4 w-4" />
          Add Server
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Examples: HOST\INSTANCE, HOST,1433, localhost. Credentials are never
        stored with a server.
      </p>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useExplorerStore } from "@/features/explorer/store";
import { useShallow } from "zustand/shallow";
import { open } from "@tauri-apps/plugin-dialog";
import type { FolderSource } from "@/features/explorer/types";
import { FolderSourceRow } from "./folder-source-row";

export function FolderSourcesSection() {
  const { folderSources, reorderSources, saveSources, loadSources } =
    useExplorerStore(
      useShallow((state) => ({
        folderSources: state.folderSources,
        reorderSources: state.reorderSources,
        saveSources: state.saveSources,
        loadSources: state.loadSources,
      }))
    );

  const [localSources, setLocalSources] = useState<FolderSource[]>([]);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadDone = useRef(false);

  // Load sources from settings on mount
  useEffect(() => {
    loadSources();
  }, [loadSources]);

  // Sync local state from store when store changes
  useEffect(() => {
    setLocalSources(folderSources);
    initialLoadDone.current = true;
  }, [folderSources]);

  // Debounced persist: when local sources differ from store, save after 500ms
  const persistSources = useCallback(
    (sources: FolderSource[]) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        reorderSources(sources);
        saveSources();
      }, 500);
    },
    [reorderSources, saveSources]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = localSources.findIndex((s) => s.id === active.id);
    const newIndex = localSources.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(localSources, oldIndex, newIndex);
    setLocalSources(reordered);
    persistSources(reordered);
  };

  const handleAddSource = () => {
    const newSource: FolderSource = {
      id: crypto.randomUUID(),
      path: "",
      label: "",
      tag: "",
      favorites: [],
    };
    const updated = [...localSources, newSource];
    setLocalSources(updated);
    persistSources(updated);
  };

  const handleRemove = (sourceId: string) => {
    const updated = localSources.filter((s) => s.id !== sourceId);
    setLocalSources(updated);
    persistSources(updated);
  };

  const handleUpdate = (sourceId: string, partial: Partial<FolderSource>) => {
    const updated = localSources.map((s) =>
      s.id === sourceId ? { ...s, ...partial } : s
    );
    setLocalSources(updated);
    persistSources(updated);
  };

  const handleBrowse = async (sourceId: string) => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select folder source",
      });
      if (selected) {
        handleUpdate(sourceId, { path: selected });
      }
    } catch {
      // User cancelled or dialog error
    }
  };

  return (
    <div className="space-y-6 px-1">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Folder Sources</h3>
        <p className="text-xs text-muted-foreground">
          Configure root folder paths to browse in the explorer.
        </p>
      </div>

      {localSources.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            No folder sources configured
          </p>
          <Button variant="outline" onClick={handleAddSource}>
            <Plus className="h-4 w-4" />
            Add Source
          </Button>
        </div>
      ) : (
        <>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={localSources.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {localSources.map((source) => (
                  <FolderSourceRow
                    key={source.id}
                    source={source}
                    onUpdate={(partial) => handleUpdate(source.id, partial)}
                    onRemove={() => handleRemove(source.id)}
                    onBrowse={handleBrowse}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <Button variant="outline" onClick={handleAddSource}>
            <Plus className="h-4 w-4" />
            Add Source
          </Button>
        </>
      )}
    </div>
  );
}

import { useState } from "react";
import { Box, Network } from "lucide-react";
import { useSchemaStore } from "@/features/schema-graph/store";
import { useShallow } from "zustand/shallow";
import { useFilteredCounts } from "@/features/schema-graph/hooks/useFilteredCounts";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  EDGE_TYPE_LABELS,
  EDGE_COLORS,
  OBJECT_COLORS,
} from "@/constants/edge-colors";
import {
  OBJECT_TYPE_LABELS,
  OBJECT_TYPE_ORDER,
} from "@/constants/object-type-meta";
import type { EdgeType } from "@/features/schema-graph/store";

const EDGE_TYPE_ORDER = Object.keys(EDGE_TYPE_LABELS) as EdgeType[];

function BreakdownRow({
  label,
  color,
  filtered,
  total,
}: {
  label: string;
  color: string;
  filtered: number;
  total: number;
}) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span
        aria-hidden
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto pl-6 tabular-nums">
        {filtered} / {total}
      </span>
    </div>
  );
}

export function StatusBar() {
  const {
    schema,
    debouncedSearchFilter,
    schemaFilter,
    focusedTableId,
    viewMode,
    focusRoots,
    objectTypeFilter,
    excludedObjectIds,
    edgeTypeFilter,
    selectedEdgeIds,
    connectionInfo,
    mode,
    canvasFilePath,
  } = useSchemaStore(
    useShallow((state) => ({
      schema: state.schema,
      debouncedSearchFilter: state.debouncedSearchFilter,
      schemaFilter: state.schemaFilter,
      focusedTableId: state.focusedTableId,
      viewMode: state.viewMode,
      focusRoots: state.focusRoots,
      objectTypeFilter: state.objectTypeFilter,
      excludedObjectIds: state.excludedObjectIds,
      edgeTypeFilter: state.edgeTypeFilter,
      selectedEdgeIds: state.selectedEdgeIds,
      connectionInfo: state.connectionInfo,
      mode: state.mode,
      canvasFilePath: state.canvasFilePath,
    }))
  );

  const counts = useFilteredCounts(
    schema,
    debouncedSearchFilter,
    schemaFilter,
    objectTypeFilter,
    excludedObjectIds,
    edgeTypeFilter,
    focusedTableId
  );

  const isCanvasMode = mode === "canvas";

  const allObjectsSelected = objectTypeFilter.size === 5;
  const allEdgesSelected =
    edgeTypeFilter.size === Object.keys(EDGE_TYPE_LABELS).length;
  const isBrowseView = viewMode === "browse";
  const hasActiveFilters =
    debouncedSearchFilter !== "" ||
    schemaFilter !== "all" ||
    focusedTableId !== null ||
    (isBrowseView && focusRoots.size > 0) ||
    !allObjectsSelected ||
    excludedObjectIds.size > 0 ||
    !allEdgesSelected;

  const [objectsOpen, setObjectsOpen] = useState(false);
  const [edgesOpen, setEdgesOpen] = useState(false);

  const connectionLabel = isCanvasMode
    ? (canvasFilePath?.split("/").pop()?.split("\\").pop() ?? "Untitled")
    : connectionInfo
      ? `${connectionInfo.server}${connectionInfo.database ? ` / ${connectionInfo.database}` : ""}`
      : null;

  // Show minimal status bar when connected but no schema loaded
  if (!schema) {
    if (!connectionLabel) return null;
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-end px-3 pb-2">
        <div className="pointer-events-auto panel-glass flex h-7 items-center gap-4 px-3 text-[11px] text-muted-foreground">
          <span>{connectionLabel}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex px-3 pb-2">
      <div className="pointer-events-auto panel-glass flex h-7 w-full items-center gap-4 px-3 text-[11px] text-muted-foreground">
        <Popover open={objectsOpen} onOpenChange={setObjectsOpen}>
          <PopoverTrigger asChild>
            <button
              className="flex items-center gap-1.5 transition-colors duration-[var(--duration-fast)] hover:text-foreground"
              onMouseEnter={() => setObjectsOpen(true)}
              onMouseLeave={() => setObjectsOpen(false)}
            >
              <Box className="h-3 w-3" />
              <span className="tabular-nums">
                {hasActiveFilters
                  ? `${counts.filteredObjects} / ${counts.totalObjects} Objects`
                  : `${counts.totalObjects} Objects`}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto p-3 text-xs"
            onMouseEnter={() => setObjectsOpen(true)}
            onMouseLeave={() => setObjectsOpen(false)}
          >
            <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Objects
            </div>
            {OBJECT_TYPE_ORDER.map((type) => (
              <BreakdownRow
                key={type}
                label={OBJECT_TYPE_LABELS[type]}
                color={OBJECT_COLORS[type]}
                filtered={counts.breakdown[type].filtered}
                total={counts.breakdown[type].total}
              />
            ))}
          </PopoverContent>
        </Popover>
        <Popover open={edgesOpen} onOpenChange={setEdgesOpen}>
          <PopoverTrigger asChild>
            <button
              className="flex items-center gap-1.5 transition-colors duration-[var(--duration-fast)] hover:text-foreground"
              onMouseEnter={() => setEdgesOpen(true)}
              onMouseLeave={() => setEdgesOpen(false)}
            >
              <Network className="h-3 w-3" />
              <span className="tabular-nums">
                {hasActiveFilters
                  ? `${counts.filteredEdges} / ${counts.totalEdges} Edges`
                  : `${counts.totalEdges} Edges`}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto p-3 text-xs"
            onMouseEnter={() => setEdgesOpen(true)}
            onMouseLeave={() => setEdgesOpen(false)}
          >
            <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Edges
            </div>
            {EDGE_TYPE_ORDER.map((type) => (
              <BreakdownRow
                key={type}
                label={EDGE_TYPE_LABELS[type]}
                color={EDGE_COLORS[type]}
                filtered={counts.edgeBreakdown[type].filtered}
                total={counts.edgeBreakdown[type].total}
              />
            ))}
          </PopoverContent>
        </Popover>

        <div className="flex-1" />

        {/* Selection info */}
        {focusedTableId && <span className="truncate">Focus: {focusedTableId}</span>}
        {isBrowseView && focusRoots.size > 0 && (
          <span className="truncate">
            Focus:{" "}
            {focusRoots.size === 1
              ? [...focusRoots][0]
              : `${focusRoots.size} objects`}
          </span>
        )}
        {selectedEdgeIds.size > 0 && (
          <span className="tabular-nums">
            {selectedEdgeIds.size} edge{selectedEdgeIds.size !== 1 ? "s" : ""}{" "}
            selected
          </span>
        )}

        {connectionLabel && <span className="truncate">{connectionLabel}</span>}
      </div>
    </div>
  );
}

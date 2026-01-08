import { useState } from "react";
import { Box, Network } from "lucide-react";
import { useSchemaStore } from "@/stores/schemaStore";
import { useShallow } from "zustand/shallow";
import { useFilteredCounts } from "@/hooks/useFilteredCounts";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function StatusBar() {
  const {
    schema,
    debouncedSearchFilter,
    schemaFilter,
    focusedTableId,
    objectTypeFilter,
    edgeTypeFilter,
    selectedEdgeIds,
    connectionInfo,
  } = useSchemaStore(
    useShallow((state) => ({
      schema: state.schema,
      debouncedSearchFilter: state.debouncedSearchFilter,
      schemaFilter: state.schemaFilter,
      focusedTableId: state.focusedTableId,
      objectTypeFilter: state.objectTypeFilter,
      edgeTypeFilter: state.edgeTypeFilter,
      selectedEdgeIds: state.selectedEdgeIds,
      connectionInfo: state.connectionInfo,
    }))
  );

  const counts = useFilteredCounts(
    schema,
    debouncedSearchFilter,
    schemaFilter,
    objectTypeFilter,
    edgeTypeFilter,
    focusedTableId
  );

  const allObjectsSelected = objectTypeFilter.size === 5;
  const allEdgesSelected = edgeTypeFilter.size === 7;
  const hasActiveFilters =
    debouncedSearchFilter !== "" ||
    schemaFilter !== "all" ||
    focusedTableId !== null ||
    !allObjectsSelected ||
    !allEdgesSelected;

  const [objectsOpen, setObjectsOpen] = useState(false);
  const [edgesOpen, setEdgesOpen] = useState(false);

  if (!schema) return null;

  return (
    <div className="flex items-center gap-4 h-6 px-3 text-xs bg-background border-t border-border text-muted-foreground">
      <Popover open={objectsOpen} onOpenChange={setObjectsOpen}>
        <PopoverTrigger asChild>
          <button
            className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            onMouseEnter={() => setObjectsOpen(true)}
            onMouseLeave={() => setObjectsOpen(false)}
          >
            <Box className="w-3 h-3" />
            <span>
              {hasActiveFilters
                ? `${counts.filteredObjects} / ${counts.totalObjects} Objects`
                : `${counts.totalObjects} Objects`}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-3"
          onMouseEnter={() => setObjectsOpen(true)}
          onMouseLeave={() => setObjectsOpen(false)}
        >
          <div className="text-xs">
            <div className="font-medium mb-1">Objects</div>
            <div>Tables: {counts.breakdown.tables.filtered} / {counts.breakdown.tables.total}</div>
            <div>Views: {counts.breakdown.views.filtered} / {counts.breakdown.views.total}</div>
            <div>Triggers: {counts.breakdown.triggers.filtered} / {counts.breakdown.triggers.total}</div>
            <div>Procedures: {counts.breakdown.storedProcedures.filtered} / {counts.breakdown.storedProcedures.total}</div>
            <div>Functions: {counts.breakdown.scalarFunctions.filtered} / {counts.breakdown.scalarFunctions.total}</div>
          </div>
        </PopoverContent>
      </Popover>
      <Popover open={edgesOpen} onOpenChange={setEdgesOpen}>
        <PopoverTrigger asChild>
          <button
            className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            onMouseEnter={() => setEdgesOpen(true)}
            onMouseLeave={() => setEdgesOpen(false)}
          >
            <Network className="w-3 h-3" />
            <span>
              {hasActiveFilters
                ? `${counts.filteredEdges} / ${counts.totalEdges} Edges`
                : `${counts.totalEdges} Edges`}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-3"
          onMouseEnter={() => setEdgesOpen(true)}
          onMouseLeave={() => setEdgesOpen(false)}
        >
          <div className="text-xs">
            <div className="font-medium mb-1">Edges</div>
            <div>Foreign Keys: {counts.edgeBreakdown.foreignKeys.filtered} / {counts.edgeBreakdown.foreignKeys.total}</div>
            <div>Trigger Dependencies: {counts.edgeBreakdown.triggerDependencies.filtered} / {counts.edgeBreakdown.triggerDependencies.total}</div>
            <div>Trigger Writes: {counts.edgeBreakdown.triggerWrites.filtered} / {counts.edgeBreakdown.triggerWrites.total}</div>
            <div>Procedure Reads: {counts.edgeBreakdown.procedureReads.filtered} / {counts.edgeBreakdown.procedureReads.total}</div>
            <div>Procedure Writes: {counts.edgeBreakdown.procedureWrites.filtered} / {counts.edgeBreakdown.procedureWrites.total}</div>
            <div>View Dependencies: {counts.edgeBreakdown.viewDependencies.filtered} / {counts.edgeBreakdown.viewDependencies.total}</div>
            <div>Function Reads: {counts.edgeBreakdown.functionReads.filtered} / {counts.edgeBreakdown.functionReads.total}</div>
          </div>
        </PopoverContent>
      </Popover>

      <div className="flex-1" />

      {/* Selection info */}
      {focusedTableId && (
        <span>Focus: {focusedTableId}</span>
      )}
      {selectedEdgeIds.size > 0 && (
        <span>{selectedEdgeIds.size} edge{selectedEdgeIds.size !== 1 ? "s" : ""} selected</span>
      )}

      {/* Connection info */}
      {connectionInfo && (
        <span>{connectionInfo.server} / {connectionInfo.database}</span>
      )}
    </div>
  );
}

import { useSchemaStore, type ObjectType, type EdgeType } from "@/stores/schemaStore";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Database, ChevronDown, Layers, GitBranch, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SettingsSheet } from "@/components/settings-sheet";
import { SearchBar } from "@/components/search-bar";
import { useFilteredCounts } from "@/hooks/useFilteredCounts";
import { EDGE_TYPE_LABELS } from "@/constants/edge-colors";

const OBJECT_TYPE_LABELS: Record<ObjectType, string> = {
  tables: "Tables",
  views: "Views",
  triggers: "Triggers",
  storedProcedures: "Stored Procedures",
};

export function Toolbar() {
  const {
    schema,
    focusedTableId,
    objectTypeFilter,
    edgeTypeFilter,
    selectedEdgeIds,
    debouncedSearchFilter,
    schemaFilter,
    setFocusedTable,
    clearFocus,
    toggleObjectType,
    selectAllObjectTypes,
    toggleEdgeType,
    selectAllEdgeTypes,
    clearEdgeSelection,
    disconnect,
  } = useSchemaStore();

  const counts = useFilteredCounts(
    schema,
    debouncedSearchFilter,
    schemaFilter,
    objectTypeFilter,
    edgeTypeFilter,
    focusedTableId
  );

  if (!schema) return null;

  const selectedObjectCount = objectTypeFilter.size;
  const allObjectsSelected = selectedObjectCount === 4;

  const selectedEdgeCount = edgeTypeFilter.size;
  const allEdgesSelected = selectedEdgeCount === 6;

  const hasActiveFilters =
    debouncedSearchFilter !== "" ||
    schemaFilter !== "all" ||
    focusedTableId !== null ||
    !allObjectsSelected ||
    !allEdgesSelected;

  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-background border-b border-border shadow-sm">
      {/* App title */}
      <div className="flex items-center gap-2 mr-2">
        <Database className="w-5 h-5 text-blue-600" />
        <div className="flex flex-col">
          <span className="font-semibold text-foreground leading-tight">Relova</span>
          <span className="text-[10px] text-muted-foreground leading-tight">By Elliot Layen</span>
        </div>
      </div>

      <div className="w-px h-6 bg-border" />

      {/* Search */}
      <SearchBar />

      {/* Object type filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 h-9 px-3 text-sm border border-input rounded-md bg-background hover:bg-accent">
            <span>
              {allObjectsSelected ? "All Objects" : `${selectedObjectCount} Object${selectedObjectCount !== 1 ? "s" : ""}`}
            </span>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-48">
          {!allObjectsSelected && (
            <>
              <DropdownMenuItem onSelect={selectAllObjectTypes}>
                All Objects
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          {(Object.keys(OBJECT_TYPE_LABELS) as ObjectType[]).map((type) => (
            <DropdownMenuCheckboxItem
              key={type}
              checked={objectTypeFilter.has(type)}
              onCheckedChange={() => toggleObjectType(type)}
            >
              {OBJECT_TYPE_LABELS[type]}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edge type filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 h-9 px-3 text-sm border border-input rounded-md bg-background hover:bg-accent">
            <span>
              {allEdgesSelected ? "All Edges" : `${selectedEdgeCount} Edge${selectedEdgeCount !== 1 ? "s" : ""}`}
            </span>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          {!allEdgesSelected && (
            <>
              <DropdownMenuItem onSelect={selectAllEdgeTypes}>
                All Edges
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          {(Object.keys(EDGE_TYPE_LABELS) as EdgeType[]).map((type) => (
            <DropdownMenuCheckboxItem
              key={type}
              checked={edgeTypeFilter.has(type)}
              onCheckedChange={() => toggleEdgeType(type)}
            >
              {EDGE_TYPE_LABELS[type]}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Focus mode */}
      <Select
        value={focusedTableId || "none"}
        onValueChange={(v) => setFocusedTable(v === "none" ? null : v)}
      >
        <SelectTrigger className="w-[180px] h-9">
          <SelectValue placeholder="Focus: None" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Focus: None</SelectItem>
          {schema.tables.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.id}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {focusedTableId && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFocus}
          className="h-9 px-2"
        >
          <X className="w-4 h-4 mr-1" />
          Clear
        </Button>
      )}

      <div className="flex-1" />

      {/* Deselect edges button */}
      {selectedEdgeIds.size > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearEdgeSelection}
          className="h-9 px-2"
        >
          <X className="w-4 h-4 mr-1" />
          Deselect ({selectedEdgeIds.size})
        </Button>
      )}

      {/* Stats */}
      <TooltipProvider>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="slate" className="gap-1 cursor-default">
                <Layers className="w-3 h-3" />
                {hasActiveFilters
                  ? `${counts.filteredObjects} / ${counts.totalObjects} Objects`
                  : `${counts.totalObjects} Objects`}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs">
                <div className="font-medium mb-1">Objects</div>
                <div>Tables: {counts.breakdown.tables.filtered} / {counts.breakdown.tables.total}</div>
                <div>Views: {counts.breakdown.views.filtered} / {counts.breakdown.views.total}</div>
                <div>Triggers: {counts.breakdown.triggers.filtered} / {counts.breakdown.triggers.total}</div>
                <div>Procedures: {counts.breakdown.storedProcedures.filtered} / {counts.breakdown.storedProcedures.total}</div>
              </div>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="blue" className="gap-1 cursor-default">
                <GitBranch className="w-3 h-3" />
                {hasActiveFilters
                  ? `${counts.filteredEdges} / ${counts.totalEdges} Edges`
                  : `${counts.totalEdges} Edges`}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              {hasActiveFilters
                ? `${counts.filteredEdges} of ${counts.totalEdges} edges visible`
                : `${counts.totalEdges} edges`}
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      {/* Settings */}
      <SettingsSheet />

      {/* Disconnect */}
      <Button variant="outline" size="sm" onClick={disconnect} className="h-9">
        Disconnect
      </Button>
    </div>
  );
}

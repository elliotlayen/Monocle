import { useState } from "react";
import { useSchemaStore, type ObjectType, type EdgeType } from "@/features/schema-graph/store";
import { useShallow } from "zustand/shallow";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Target, Box, Network, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SettingsSheet } from "@/features/settings/components/settings-sheet";
import { ExportButton } from "@/features/export/components/export-button";
import { DatabaseSelector } from "./database-selector";
import { EDGE_TYPE_LABELS, EDGE_COLORS, OBJECT_COLORS } from "@/constants/edge-colors";

const OBJECT_TYPE_LABELS: Record<ObjectType, string> = {
  tables: "Tables",
  views: "Views",
  triggers: "Triggers",
  storedProcedures: "Stored Procedures",
  scalarFunctions: "Scalar Functions",
};

export function Toolbar() {
  const {
    schema,
    serverConnection,
    focusedTableId,
    objectTypeFilter,
    edgeTypeFilter,
    setFocusedTable,
    clearFocus,
    toggleObjectType,
    selectAllObjectTypes,
    toggleEdgeType,
    selectAllEdgeTypes,
  } = useSchemaStore(
    useShallow((state) => ({
      schema: state.schema,
      serverConnection: state.serverConnection,
      focusedTableId: state.focusedTableId,
      objectTypeFilter: state.objectTypeFilter,
      edgeTypeFilter: state.edgeTypeFilter,
      setFocusedTable: state.setFocusedTable,
      clearFocus: state.clearFocus,
      toggleObjectType: state.toggleObjectType,
      selectAllObjectTypes: state.selectAllObjectTypes,
      toggleEdgeType: state.toggleEdgeType,
      selectAllEdgeTypes: state.selectAllEdgeTypes,
    }))
  );

  const [focusSearch, setFocusSearch] = useState("");

  const hasSchema = Boolean(schema);
  const showDatabaseSelector = Boolean(serverConnection);

  const filterItems = (items: { id: string }[]) =>
    items.filter((item) =>
      item.id.toLowerCase().includes(focusSearch.toLowerCase())
    );

  const allObjectsSelected = objectTypeFilter.size === 5;
  const allEdgesSelected = edgeTypeFilter.size === 7;


  // Group objects by type for the focus popover
  const objectsByType = schema ? {
    tables: schema.tables,
    views: schema.views,
    triggers: schema.triggers,
    storedProcedures: schema.storedProcedures,
    scalarFunctions: schema.scalarFunctions,
  } : {
    tables: [],
    views: [],
    triggers: [],
    storedProcedures: [],
    scalarFunctions: [],
  };

  return (
    <div className="relative z-20 flex items-center gap-3 px-3 py-2 bg-background border-b border-border">
      {/* Left: Monocle branding */}
      <span className="font-semibold text-base" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Monocle</span>

      {/* Center: Database selector */}
      {showDatabaseSelector && (
        <div className="absolute left-1/2 -translate-x-1/2">
          <DatabaseSelector />
        </div>
      )}

      <div className="flex-1" />

      {/* Right: Button group + Settings */}
      <div className="flex items-center gap-2">
        {/* Button group - only show when schema loaded */}
        {hasSchema && (
        <TooltipProvider>
        <div className="flex">
          {/* Focus button */}
          <Popover onOpenChange={(open) => !open && setFocusSearch("")}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-r-none border-r-0"
                    style={focusedTableId ? { backgroundColor: '#22c55e' } : undefined}
                  >
                    <Target className="w-4 h-4" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Focus</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-56 p-0" align="end">
              <div className="p-2 border-b">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={focusSearch}
                    onChange={(e) => setFocusSearch(e.target.value)}
                    className="pl-8 h-8"
                    autoFocus
                  />
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {focusedTableId && (
                  <button
                    className="w-full px-3 py-2 text-left text-sm hover:bg-accent border-b"
                    onClick={clearFocus}
                  >
                    Clear Focus
                  </button>
                )}
                {(["tables", "views", "triggers", "storedProcedures", "scalarFunctions"] as const).map((type) => {
                  const filteredItems = filterItems(objectsByType[type]);
                  if (filteredItems.length === 0) return null;
                  return (
                    <div key={type}>
                      <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50">
                        {OBJECT_TYPE_LABELS[type]}
                      </div>
                      {filteredItems.map((item) => (
                        <button
                          key={item.id}
                          className={`w-full px-3 py-1.5 text-left text-sm hover:bg-accent ${
                            focusedTableId === item.id ? "bg-accent" : ""
                          }`}
                          style={{ color: OBJECT_COLORS[type] }}
                          onClick={() => setFocusedTable(item.id)}
                        >
                          {item.id}
                        </button>
                      ))}
                    </div>
                  );
                })}
                {focusSearch &&
                  (["tables", "views", "triggers", "storedProcedures", "scalarFunctions"] as const).every(
                    (type) => filterItems(objectsByType[type]).length === 0
                  ) && (
                    <div className="px-3 py-4 text-sm text-center text-muted-foreground">
                      No matches found
                    </div>
                  )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Objects button */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-none border-r-0"
                    style={!allObjectsSelected ? { backgroundColor: '#22c55e' } : undefined}
                  >
                    <Box className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Objects</TooltipContent>
            </Tooltip>
            <DropdownMenuContent className="w-48" align="end">
              <DropdownMenuLabel>Objects</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {!allObjectsSelected && (
                <>
                  <DropdownMenuItem onSelect={(e) => { e.preventDefault(); selectAllObjectTypes(); }}>
                    All Objects
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              {(Object.keys(OBJECT_TYPE_LABELS) as ObjectType[]).map((type) => (
                <DropdownMenuCheckboxItem
                  key={type}
                  checked={objectTypeFilter.has(type)}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={() => toggleObjectType(type)}
                >
                  <span style={{ color: OBJECT_COLORS[type] }}>{OBJECT_TYPE_LABELS[type]}</span>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Edges button */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-l-none"
                    style={!allEdgesSelected ? { backgroundColor: '#22c55e' } : undefined}
                  >
                    <Network className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Edges</TooltipContent>
            </Tooltip>
            <DropdownMenuContent className="w-56" align="end">
              <DropdownMenuLabel>Edges</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {!allEdgesSelected && (
                <>
                  <DropdownMenuItem onSelect={(e) => { e.preventDefault(); selectAllEdgeTypes(); }}>
                    All Edges
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              {(Object.keys(EDGE_TYPE_LABELS) as EdgeType[]).map((type) => (
                <DropdownMenuCheckboxItem
                  key={type}
                  checked={edgeTypeFilter.has(type)}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={() => toggleEdgeType(type)}
                >
                  <span style={{ color: EDGE_COLORS[type] }}>{EDGE_TYPE_LABELS[type]}</span>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        </TooltipProvider>
        )}

        {/* Export - only show when schema loaded */}
        {hasSchema && (
        <TooltipProvider>
          <ExportButton />
        </TooltipProvider>
        )}

        {/* Settings */}
        <SettingsSheet />
      </div>
    </div>
  );
}

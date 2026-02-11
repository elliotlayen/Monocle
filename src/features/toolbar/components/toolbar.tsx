import { useEffect, useRef, useState } from "react";
import {
  useSchemaStore,
  type ObjectType,
  type EdgeType,
} from "@/features/schema-graph/store";
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
import {
  Target,
  Box,
  Network,
  Search,
  Settings,
  LogOut,
  Save,
  FolderOpen,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { ExportButton } from "@/features/export/components/export-button";
import { DatabaseSelector } from "./database-selector";
import {
  EDGE_TYPE_LABELS,
  EDGE_COLORS,
  OBJECT_COLORS,
} from "@/constants/edge-colors";
import { AddObjectMenu } from "@/features/canvas/components/add-object-menu";

const OBJECT_TYPE_LABELS: Record<ObjectType, string> = {
  tables: "Tables",
  views: "Views",
  triggers: "Triggers",
  storedProcedures: "Stored Procedures",
  scalarFunctions: "Scalar Functions",
};

interface ToolbarProps {
  onOpenSettings?: () => void;
  onDisconnect?: () => void;
  canvasMode?: boolean;
  onSave?: () => void;
  onOpen?: () => void;
  onExitCanvas?: () => void;
  onImport?: () => void;
}

export function Toolbar({
  onOpenSettings,
  onDisconnect,
  canvasMode,
  onSave,
  onOpen,
  onExitCanvas,
  onImport,
}: ToolbarProps) {
  const {
    schema,
    serverConnection,
    isConnected,
    focusedTableId,
    objectTypeFilter,
    edgeTypeFilter,
    canvasFilePath,
    canvasIsDirty,
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
      isConnected: state.isConnected,
      focusedTableId: state.focusedTableId,
      objectTypeFilter: state.objectTypeFilter,
      edgeTypeFilter: state.edgeTypeFilter,
      canvasFilePath: state.canvasFilePath,
      canvasIsDirty: state.canvasIsDirty,
      setFocusedTable: state.setFocusedTable,
      clearFocus: state.clearFocus,
      toggleObjectType: state.toggleObjectType,
      selectAllObjectTypes: state.selectAllObjectTypes,
      toggleEdgeType: state.toggleEdgeType,
      selectAllEdgeTypes: state.selectAllEdgeTypes,
    }))
  );

  const [focusSearch, setFocusSearch] = useState("");
  const [isFocusOpen, setIsFocusOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasScrolledOnOpenRef = useRef(false);

  const hasSchema = Boolean(schema);
  const showDatabaseSelector = Boolean(serverConnection) && !canvasMode;

  const filterItems = (items: { id: string }[]) =>
    items.filter((item) =>
      item.id.toLowerCase().includes(focusSearch.toLowerCase())
    );

  const allObjectsSelected = objectTypeFilter.size === 5;
  const allEdgesSelected =
    edgeTypeFilter.size === Object.keys(EDGE_TYPE_LABELS).length;

  useEffect(() => {
    if (!isFocusOpen) {
      hasScrolledOnOpenRef.current = false;
      return;
    }

    if (hasScrolledOnOpenRef.current || !focusedTableId) {
      return;
    }

    hasScrolledOnOpenRef.current = true;
    let attempts = 0;
    const attemptScroll = () => {
      const container = scrollContainerRef.current;
      if (container) {
        const candidates =
          container.querySelectorAll<HTMLElement>("[data-item-id]");
        const selectedElement = Array.from(candidates).find(
          (element) => element.dataset.itemId === focusedTableId
        );
        if (selectedElement) {
          selectedElement.scrollIntoView({
            block: "center",
            inline: "nearest",
          });
          return;
        }
      }

      if (attempts < 2) {
        attempts += 1;
        requestAnimationFrame(attemptScroll);
      }
    };

    requestAnimationFrame(attemptScroll);
  }, [focusedTableId, isFocusOpen]);

  // Group objects by type for the focus popover
  const objectsByType = schema
    ? {
        tables: schema.tables,
        views: schema.views,
        triggers: schema.triggers,
        storedProcedures: schema.storedProcedures,
        scalarFunctions: schema.scalarFunctions,
      }
    : {
        tables: [],
        views: [],
        triggers: [],
        storedProcedures: [],
        scalarFunctions: [],
      };

  // Canvas mode file name display
  const canvasFileName = canvasFilePath
    ? canvasFilePath.split("/").pop()?.split("\\").pop() ?? "Untitled"
    : "Untitled";

  return (
    <div className="relative z-20 flex items-center gap-3 px-3 py-2 bg-background border-b border-border">
      {/* Left: Monocle branding + canvas controls */}
      <div className="flex items-center gap-2">
        <span
          className="font-semibold text-base"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          Monocle
        </span>

        {canvasMode && (
          <>
            <TooltipProvider>
              <AddObjectMenu onImport={onImport} />
            </TooltipProvider>
          </>
        )}
      </div>

      {/* Center: Database selector or canvas filename */}
      {showDatabaseSelector && (
        <div className="absolute left-1/2 -translate-x-1/2">
          <DatabaseSelector />
        </div>
      )}
      {canvasMode && (
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1 text-sm text-muted-foreground">
          <span>{canvasFileName}</span>
          {canvasIsDirty && (
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
          )}
        </div>
      )}

      <div className="flex-1" />

      {/* Right: Button group + Settings */}
      <div className="flex items-center gap-2">
        {/* Canvas mode file buttons */}
        {canvasMode && (
          <TooltipProvider>
            <div className="flex gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={onOpen}>
                    <FolderOpen className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Open File</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={onSave}>
                    <Save className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Save</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        )}

        {/* Button group - only show when schema loaded */}
        {hasSchema && (
          <TooltipProvider>
            <div className="flex">
              {/* Focus button */}
              <Popover
                open={isFocusOpen}
                onOpenChange={(open) => {
                  setIsFocusOpen(open);
                  if (!open) {
                    setFocusSearch("");
                  }
                }}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-r-none border-r-0"
                        style={
                          focusedTableId
                            ? { backgroundColor: "#22c55e" }
                            : undefined
                        }
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
                  <div
                    ref={scrollContainerRef}
                    className="max-h-80 overflow-y-auto"
                  >
                    {focusedTableId && (
                      <button
                        className="w-full px-3 py-2 text-left text-sm hover:bg-accent border-b"
                        onClick={clearFocus}
                      >
                        Clear Focus
                      </button>
                    )}
                    {(
                      [
                        "tables",
                        "views",
                        "triggers",
                        "storedProcedures",
                        "scalarFunctions",
                      ] as const
                    ).map((type) => {
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
                              data-item-id={item.id}
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
                      (
                        [
                          "tables",
                          "views",
                          "triggers",
                          "storedProcedures",
                          "scalarFunctions",
                        ] as const
                      ).every(
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
                        style={
                          !allObjectsSelected
                            ? { backgroundColor: "#22c55e" }
                            : undefined
                        }
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
                      <DropdownMenuItem
                        onSelect={(e) => {
                          e.preventDefault();
                          selectAllObjectTypes();
                        }}
                      >
                        All Objects
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  {(Object.keys(OBJECT_TYPE_LABELS) as ObjectType[]).map(
                    (type) => (
                      <DropdownMenuCheckboxItem
                        key={type}
                        checked={objectTypeFilter.has(type)}
                        onSelect={(e) => e.preventDefault()}
                        onCheckedChange={() => toggleObjectType(type)}
                      >
                        <span style={{ color: OBJECT_COLORS[type] }}>
                          {OBJECT_TYPE_LABELS[type]}
                        </span>
                      </DropdownMenuCheckboxItem>
                    )
                  )}
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
                        style={
                          !allEdgesSelected
                            ? { backgroundColor: "#22c55e" }
                            : undefined
                        }
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
                      <DropdownMenuItem
                        onSelect={(e) => {
                          e.preventDefault();
                          selectAllEdgeTypes();
                        }}
                      >
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
                      <span style={{ color: EDGE_COLORS[type] }}>
                        {EDGE_TYPE_LABELS[type]}
                      </span>
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
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-2"
                onClick={onOpenSettings}
              >
                <Settings className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Settings</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Canvas leave */}
        {canvasMode && onExitCanvas && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-9 px-2"
                  onClick={onExitCanvas}
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Leave Canvas</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Disconnect */}
        {!canvasMode && isConnected && onDisconnect && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-9 px-2"
                  onClick={onDisconnect}
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Disconnect</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}

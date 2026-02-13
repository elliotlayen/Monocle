import { useEffect, useMemo, useRef, useState } from "react";
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
import { Checkbox as CheckboxUI } from "@/components/ui/checkbox";
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
  ChevronDown,
  ChevronRight,
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
import {
  getFilteredObjectBuckets,
  type ObjectBuckets,
} from "@/features/schema-graph/utils/object-filtering";

const OBJECT_TYPE_LABELS: Record<ObjectType, string> = {
  tables: "Tables",
  views: "Views",
  triggers: "Triggers",
  storedProcedures: "Stored Procedures",
  scalarFunctions: "Scalar Functions",
};

const OBJECT_TYPE_ORDER: ObjectType[] = [
  "tables",
  "views",
  "triggers",
  "storedProcedures",
  "scalarFunctions",
];
const ALL_OBJECT_TYPES_FOR_PANEL = new Set<ObjectType>(OBJECT_TYPE_ORDER);

const EMPTY_OBJECT_BUCKETS: ObjectBuckets = {
  tables: [],
  views: [],
  triggers: [],
  storedProcedures: [],
  scalarFunctions: [],
};

const EMPTY_EXCLUDED_IDS = new Set<string>();

type ExpandedObjectSections = Record<ObjectType, boolean>;

export const createDefaultExpandedObjectSections =
  (): ExpandedObjectSections => ({
    tables: false,
    views: false,
    triggers: false,
    storedProcedures: false,
    scalarFunctions: false,
  });

export const createDefaultExpandedFocusSections =
  (): ExpandedObjectSections => ({
    tables: true,
    views: true,
    triggers: true,
    storedProcedures: true,
    scalarFunctions: true,
  });

export const isObjectSectionExpanded = (
  sectionExpanded: boolean,
  searchText: string,
  matchCount: number
) => (searchText.trim().length > 0 ? matchCount > 0 : sectionExpanded);

export const shouldRenderObjectSection = (visibleCount: number) =>
  visibleCount > 0;

export const filterRowsBySearch = <T extends { id: string }>(
  rows: T[],
  searchText: string
) => {
  const lowerSearch = searchText.trim().toLowerCase();
  if (!lowerSearch) return rows;
  return rows.filter((row) => row.id.toLowerCase().includes(lowerSearch));
};

export const sortRowsById = <T extends { id: string }>(rows: T[]) =>
  [...rows].sort((a, b) =>
    a.id.localeCompare(b.id, undefined, { sensitivity: "base" })
  );

export const mergeRowsById = <T extends { id: string }>(
  rows: T[],
  extraRows: T[]
) => {
  const merged = new Map<string, T>();
  rows.forEach((row) => merged.set(row.id, row));
  extraRows.forEach((row) => merged.set(row.id, row));
  return [...merged.values()];
};

export const stopSectionHeaderToggle = (event: { stopPropagation: () => void }) => {
  event.stopPropagation();
};

export const getTypeOffSelectionToggleIds = (
  contextRows: { id: string }[],
  excludedObjectIds: Set<string>,
  selectedRowId: string
) => {
  const idsToToggle: string[] = [];
  contextRows.forEach((row) => {
    const shouldBeExcluded = row.id !== selectedRowId;
    const isExcluded = excludedObjectIds.has(row.id);
    if (shouldBeExcluded !== isExcluded) {
      idsToToggle.push(row.id);
    }
  });
  return idsToToggle;
};

export const getSectionSelectionState = (
  contextRows: { id: string }[],
  excludedObjectIds: Set<string>,
  typeEnabled: boolean
) => {
  const totalCount = contextRows.length;
  const selectedCount = typeEnabled
    ? contextRows.filter((row) => !excludedObjectIds.has(row.id)).length
    : 0;
  const sectionChecked = typeEnabled && selectedCount > 0;
  return { totalCount, selectedCount, sectionChecked };
};

export const formatSectionCountLabel = (
  label: string,
  selectedCount: number,
  totalCount: number
) => `${label} (${selectedCount}/${totalCount})`;

export const shouldToggleSectionFromKey = (key: string) =>
  key === "Enter" || key === " ";

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
    debouncedSearchFilter,
    schemaFilter,
    focusedTableId,
    objectTypeFilter,
    excludedObjectIds,
    edgeTypeFilter,
    canvasFilePath,
    canvasIsDirty,
    setFocusedTable,
    clearFocus,
    toggleObjectType,
    toggleObjectExclusion,
    resetObjectFilters,
    toggleEdgeType,
    selectAllEdgeTypes,
  } = useSchemaStore(
    useShallow((state) => ({
      schema: state.schema,
      serverConnection: state.serverConnection,
      isConnected: state.isConnected,
      debouncedSearchFilter: state.debouncedSearchFilter,
      schemaFilter: state.schemaFilter,
      focusedTableId: state.focusedTableId,
      objectTypeFilter: state.objectTypeFilter,
      excludedObjectIds: state.excludedObjectIds,
      edgeTypeFilter: state.edgeTypeFilter,
      canvasFilePath: state.canvasFilePath,
      canvasIsDirty: state.canvasIsDirty,
      setFocusedTable: state.setFocusedTable,
      clearFocus: state.clearFocus,
      toggleObjectType: state.toggleObjectType,
      toggleObjectExclusion: state.toggleObjectExclusion,
      resetObjectFilters: state.resetObjectFilters,
      toggleEdgeType: state.toggleEdgeType,
      selectAllEdgeTypes: state.selectAllEdgeTypes,
    }))
  );

  const [focusSearch, setFocusSearch] = useState("");
  const [objectsSearch, setObjectsSearch] = useState("");
  const [isFocusOpen, setIsFocusOpen] = useState(false);
  const [isObjectsOpen, setIsObjectsOpen] = useState(false);
  const [expandedFocusSections, setExpandedFocusSections] =
    useState<ExpandedObjectSections>(createDefaultExpandedFocusSections);
  const [expandedObjectSections, setExpandedObjectSections] =
    useState<ExpandedObjectSections>(createDefaultExpandedObjectSections);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasScrolledOnOpenRef = useRef(false);

  const hasSchema = Boolean(schema);
  const showDatabaseSelector = Boolean(serverConnection) && !canvasMode;

  const toggleObjectSection = (type: ObjectType) => {
    setExpandedObjectSections((prev) => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

  const toggleFocusSection = (type: ObjectType) => {
    setExpandedFocusSections((prev) => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

  const setSectionCheckedState = (
    type: ObjectType,
    checked: boolean,
    contextRows: { id: string }[]
  ) => {
    const typeEnabled = objectTypeFilter.has(type);
    if (checked && !typeEnabled) {
      toggleObjectType(type);
    }
    if (checked) {
      contextRows.forEach((row) => {
        if (excludedObjectIds.has(row.id)) {
          toggleObjectExclusion(row.id);
        }
      });
      return;
    }
    if (typeEnabled) {
      toggleObjectType(type);
    }
  };

  const handleRowCheckedChange = (
    type: ObjectType,
    rowId: string,
    contextRows: { id: string }[],
    checked: boolean
  ) => {
    const typeEnabled = objectTypeFilter.has(type);
    const currentlyExcluded = excludedObjectIds.has(rowId);
    const currentlyChecked = typeEnabled && !currentlyExcluded;
    if (checked === currentlyChecked) return;

    if (!typeEnabled) {
      if (!checked) return;
      toggleObjectType(type);
      getTypeOffSelectionToggleIds(contextRows, excludedObjectIds, rowId).forEach(
        (id) => toggleObjectExclusion(id)
      );
      return;
    }

    if (checked) {
      toggleObjectExclusion(rowId);
      return;
    }

    const selectedCount = contextRows.filter((row) => !excludedObjectIds.has(row.id))
      .length;
    const nextSelectedCount = selectedCount - 1;

    toggleObjectExclusion(rowId);
    if (nextSelectedCount <= 0) {
      toggleObjectType(type);
    }
  };

  const allObjectsSelected = objectTypeFilter.size === 5;
  const hasObjectExclusions = excludedObjectIds.size > 0;
  const hasObjectFilters = !allObjectsSelected || hasObjectExclusions;
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

  const filteredFocusRowsByType = useMemo<ObjectBuckets>(() => {
    if (!schema) return EMPTY_OBJECT_BUCKETS;
    return {
      tables: sortRowsById(filterRowsBySearch(schema.tables, focusSearch)),
      views: sortRowsById(filterRowsBySearch(schema.views, focusSearch)),
      triggers: sortRowsById(filterRowsBySearch(schema.triggers, focusSearch)),
      storedProcedures: sortRowsById(
        filterRowsBySearch(schema.storedProcedures, focusSearch)
      ),
      scalarFunctions: sortRowsById(
        filterRowsBySearch(schema.scalarFunctions, focusSearch)
      ),
    };
  }, [schema, focusSearch]);

  const hasFocusSearchMatches = OBJECT_TYPE_ORDER.some(
    (type) => filteredFocusRowsByType[type].length > 0
  );

  const contextVisibleByType = useMemo<ObjectBuckets>(() => {
    if (!schema) return EMPTY_OBJECT_BUCKETS;
    const buckets = getFilteredObjectBuckets({
      schema,
      searchFilter: debouncedSearchFilter,
      schemaFilter,
      objectTypeFilter: ALL_OBJECT_TYPES_FOR_PANEL,
      excludedObjectIds: EMPTY_EXCLUDED_IDS,
      focusedTableId,
    });
    return {
      tables: buckets.tables,
      views: buckets.views,
      triggers: buckets.triggers,
      storedProcedures: buckets.storedProcedures,
      scalarFunctions: buckets.scalarFunctions,
    };
  }, [
    schema,
    debouncedSearchFilter,
    schemaFilter,
    focusedTableId,
  ]);

  const panelRowsByType = useMemo<ObjectBuckets>(() => {
    if (!schema) return EMPTY_OBJECT_BUCKETS;

    return {
      tables: sortRowsById(
        mergeRowsById(
          contextVisibleByType.tables,
          contextVisibleByType.tables.filter((item) =>
            excludedObjectIds.has(item.id)
          )
        )
      ),
      views: sortRowsById(
        mergeRowsById(
          contextVisibleByType.views,
          contextVisibleByType.views.filter((item) =>
            excludedObjectIds.has(item.id)
          )
        )
      ),
      triggers: sortRowsById(
        mergeRowsById(
          contextVisibleByType.triggers,
          contextVisibleByType.triggers.filter((item) =>
            excludedObjectIds.has(item.id)
          )
        )
      ),
      storedProcedures: sortRowsById(
        mergeRowsById(
          contextVisibleByType.storedProcedures,
          contextVisibleByType.storedProcedures.filter((item) =>
            excludedObjectIds.has(item.id)
          )
        )
      ),
      scalarFunctions: sortRowsById(
        mergeRowsById(
          contextVisibleByType.scalarFunctions,
          contextVisibleByType.scalarFunctions.filter((item) =>
            excludedObjectIds.has(item.id)
          )
        )
      ),
    };
  }, [schema, contextVisibleByType, excludedObjectIds]);

  const filteredPanelRowsByType = useMemo<ObjectBuckets>(() => {
    const lowerFilter = objectsSearch.toLowerCase();
    const applyLocalFilter = <T extends { id: string }>(items: T[]) =>
      !lowerFilter
        ? items
        : items.filter((item) => item.id.toLowerCase().includes(lowerFilter));

    return {
      tables: applyLocalFilter(panelRowsByType.tables),
      views: applyLocalFilter(panelRowsByType.views),
      triggers: applyLocalFilter(panelRowsByType.triggers),
      storedProcedures: applyLocalFilter(panelRowsByType.storedProcedures),
      scalarFunctions: applyLocalFilter(panelRowsByType.scalarFunctions),
    };
  }, [panelRowsByType, objectsSearch]);

  const hasPanelSearchMatches = OBJECT_TYPE_ORDER.some(
    (type) => filteredPanelRowsByType[type].length > 0
  );

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
                    setExpandedFocusSections(createDefaultExpandedFocusSections());
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
                <PopoverContent className="w-72 p-0" align="end">
                  <div className="p-2 border-b">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Focus on..."
                        value={focusSearch}
                        onChange={(e) => setFocusSearch(e.target.value)}
                        className="pl-8 h-8"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div ref={scrollContainerRef} className="max-h-80 overflow-auto">
                    <div className="w-max min-w-full">
                      {focusedTableId && (
                        <button
                          className="w-max min-w-full px-3 py-2 text-left text-sm hover:bg-accent border-b"
                          onClick={clearFocus}
                        >
                          Clear Focus
                        </button>
                      )}
                      {OBJECT_TYPE_ORDER.map((type) => {
                        const filteredItems = filteredFocusRowsByType[type];
                        if (filteredItems.length === 0) return null;

                        const isExpanded = isObjectSectionExpanded(
                          expandedFocusSections[type],
                          focusSearch,
                          filteredItems.length
                        );

                        return (
                          <div
                            key={type}
                            className="w-max min-w-full border-b last:border-b-0"
                          >
                            <div
                              className="w-max min-w-full px-3 py-2 bg-muted/50 flex items-center gap-2 cursor-pointer"
                              role="button"
                              tabIndex={0}
                              onClick={() => toggleFocusSection(type)}
                              onKeyDown={(event) => {
                                if (shouldToggleSectionFromKey(event.key)) {
                                  event.preventDefault();
                                  toggleFocusSection(type);
                                }
                              }}
                            >
                              <button
                                type="button"
                                className="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-accent"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleFocusSection(type);
                                }}
                                aria-label={`Toggle ${OBJECT_TYPE_LABELS[type]} section`}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                              </button>
                              <div
                                className="text-xs font-medium text-muted-foreground cursor-pointer"
                                onClick={stopSectionHeaderToggle}
                                onKeyDown={stopSectionHeaderToggle}
                              >
                                <span style={{ color: OBJECT_COLORS[type] }}>
                                  {OBJECT_TYPE_LABELS[type]}
                                </span>
                              </div>
                            </div>
                            {isExpanded && (
                              <div className="w-max min-w-full py-1">
                                {filteredItems.map((item) => (
                                  <button
                                    key={item.id}
                                    data-item-id={item.id}
                                    className={`w-max min-w-full px-3 py-1.5 text-left text-sm hover:bg-accent ${
                                      focusedTableId === item.id ? "bg-accent" : ""
                                    }`}
                                    style={{ color: OBJECT_COLORS[type] }}
                                    onClick={() => setFocusedTable(item.id)}
                                  >
                                    {item.id}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {focusSearch.trim().length > 0 && !hasFocusSearchMatches && (
                        <div className="w-max min-w-full px-3 py-4 text-sm text-center text-muted-foreground">
                          No matches found
                        </div>
                      )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Objects button */}
              <Popover
                open={isObjectsOpen}
                onOpenChange={(open) => {
                  setIsObjectsOpen(open);
                  setObjectsSearch("");
                  setExpandedObjectSections(createDefaultExpandedObjectSections());
                }}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-none border-r-0"
                        style={
                          hasObjectFilters
                            ? { backgroundColor: "#22c55e" }
                            : undefined
                        }
                      >
                        <Box className="w-4 h-4" />
                      </Button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Objects</TooltipContent>
                </Tooltip>
                <PopoverContent className="w-72 p-0" align="end">
                  <div className="p-2 border-b">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Filter objects..."
                        value={objectsSearch}
                        onChange={(e) => setObjectsSearch(e.target.value)}
                        className="pl-8 h-8"
                      />
                    </div>
                  </div>
                  <div className="max-h-80 overflow-auto">
                    <div className="w-max min-w-full">
                      {hasObjectFilters && (
                        <button
                          className="w-max min-w-full px-3 py-2 text-left text-sm hover:bg-accent border-b"
                          onClick={resetObjectFilters}
                        >
                          All Objects
                        </button>
                      )}

                      {OBJECT_TYPE_ORDER.map((type) => {
                        const contextRows = panelRowsByType[type];
                        const visibleRows = filteredPanelRowsByType[type];
                        if (!shouldRenderObjectSection(visibleRows.length)) {
                          return null;
                        }
                        const typeEnabled = objectTypeFilter.has(type);
                        const { totalCount, selectedCount, sectionChecked } =
                          getSectionSelectionState(
                            contextRows,
                            excludedObjectIds,
                            typeEnabled
                          );
                        const isExpanded = isObjectSectionExpanded(
                          expandedObjectSections[type],
                          objectsSearch,
                          visibleRows.length
                        );

                        return (
                          <div key={type} className="w-max min-w-full border-b last:border-b-0">
                            <div
                              className="w-max min-w-full px-3 py-2 bg-muted/50 flex items-center gap-2 cursor-pointer"
                              role="button"
                              tabIndex={0}
                              onClick={() => toggleObjectSection(type)}
                              onKeyDown={(event) => {
                                if (event.currentTarget !== event.target) return;
                                if (shouldToggleSectionFromKey(event.key)) {
                                  event.preventDefault();
                                  toggleObjectSection(type);
                                }
                              }}
                            >
                              <button
                                type="button"
                                className="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-accent"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleObjectSection(type);
                                }}
                                onKeyDown={stopSectionHeaderToggle}
                                aria-label={`Toggle ${OBJECT_TYPE_LABELS[type]} section`}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                              </button>
                              <div
                                className="inline-flex items-center"
                                onClick={stopSectionHeaderToggle}
                                onKeyDown={stopSectionHeaderToggle}
                              >
                                <CheckboxUI
                                  checked={sectionChecked}
                                  aria-label={`Toggle ${OBJECT_TYPE_LABELS[type]}`}
                                  onCheckedChange={(checked) =>
                                    setSectionCheckedState(
                                      type,
                                      checked === true,
                                      contextRows
                                    )
                                  }
                                />
                              </div>
                              <span
                                className="text-xs font-medium text-muted-foreground"
                                style={{ color: OBJECT_COLORS[type] }}
                              >
                                {formatSectionCountLabel(
                                  OBJECT_TYPE_LABELS[type],
                                  selectedCount,
                                  totalCount
                                )}
                              </span>
                            </div>
                            {isExpanded && (
                              <div className="w-max min-w-full py-1">
                                {visibleRows.map((item) => {
                                  const isExcluded = excludedObjectIds.has(item.id);
                                  const checked = typeEnabled && !isExcluded;
                                  return (
                                    <div
                                      key={item.id}
                                      className={`w-max min-w-full flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent ${
                                        !typeEnabled ? "opacity-50" : ""
                                      }`}
                                      role="button"
                                      tabIndex={0}
                                      onClick={() =>
                                        handleRowCheckedChange(
                                          type,
                                          item.id,
                                          contextRows,
                                          !checked
                                        )
                                      }
                                      onKeyDown={(event) => {
                                        if (event.currentTarget !== event.target) return;
                                        if (shouldToggleSectionFromKey(event.key)) {
                                          event.preventDefault();
                                          handleRowCheckedChange(
                                            type,
                                            item.id,
                                            contextRows,
                                            !checked
                                          );
                                        }
                                      }}
                                    >
                                      <div
                                        className="inline-flex items-center"
                                        onClick={stopSectionHeaderToggle}
                                        onKeyDown={stopSectionHeaderToggle}
                                      >
                                        <CheckboxUI
                                          checked={checked}
                                          aria-label={`Toggle ${item.id}`}
                                          onCheckedChange={(nextChecked) =>
                                            handleRowCheckedChange(
                                              type,
                                              item.id,
                                              contextRows,
                                              nextChecked === true
                                            )
                                          }
                                        />
                                      </div>
                                      <span style={{ color: OBJECT_COLORS[type] }}>
                                        {item.id}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {objectsSearch.trim().length > 0 && !hasPanelSearchMatches && (
                        <div className="w-max min-w-full px-3 py-4 text-sm text-center text-muted-foreground">
                          No matches found
                        </div>
                      )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

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

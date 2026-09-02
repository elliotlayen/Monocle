import { useEffect, useMemo, useRef, useState } from "react";
import {
  useSchemaStore,
  type ObjectType,
  type EdgeType,
} from "@/features/schema-graph/store";
import { useShallow } from "zustand/shallow";
import { cn } from "@/lib/utils";
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
import { Separator } from "@/components/ui/separator";
import {
  Crosshair,
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
import { MonocleLogo } from "@/features/connection/components/monocle-logo";
import { DatabaseSelector } from "./database-selector";
import { FocusSelector } from "./focus-selector";
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
import {
  OBJECT_TYPE_LABELS,
  OBJECT_TYPE_ORDER,
} from "@/constants/object-type-meta";
import {
  type ExpandedObjectSections,
  createDefaultExpandedFocusSections,
  createDefaultExpandedObjectSections,
  filterRowsBySearch,
  formatSectionCountLabel,
  getSectionSelectionState,
  getTypeOffSelectionToggleIds,
  isObjectSectionExpanded,
  mergeRowsById,
  shouldRenderObjectSection,
  shouldToggleSectionFromKey,
  sortRowsById,
  stopSectionHeaderToggle,
} from "./toolbar-helpers";

const ALL_OBJECT_TYPES_FOR_PANEL = new Set<ObjectType>(OBJECT_TYPE_ORDER);

const EMPTY_OBJECT_BUCKETS: ObjectBuckets = {
  tables: [],
  views: [],
  triggers: [],
  storedProcedures: [],
  scalarFunctions: [],
};

const EMPTY_EXCLUDED_IDS = new Set<string>();

const FILTER_ACTIVE_CLASSES =
  "bg-accent-blue/15 text-accent-blue hover:bg-accent-blue/20 hover:text-accent-blue";

function TypeDot({ type }: { type: ObjectType }) {
  return (
    <span
      aria-hidden
      className="h-1.5 w-1.5 shrink-0 rounded-full"
      style={{ backgroundColor: OBJECT_COLORS[type] }}
    />
  );
}

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
    viewMode,
    focusRoots,
    objectTypeFilter,
    excludedObjectIds,
    edgeTypeFilter,
    canvasFilePath,
    canvasIsDirty,
    setFocusedTable,
    clearFocus,
    clearFocusRoots,
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
      viewMode: state.viewMode,
      focusRoots: state.focusRoots,
      objectTypeFilter: state.objectTypeFilter,
      excludedObjectIds: state.excludedObjectIds,
      edgeTypeFilter: state.edgeTypeFilter,
      canvasFilePath: state.canvasFilePath,
      canvasIsDirty: state.canvasIsDirty,
      setFocusedTable: state.focusObject,
      clearFocus: state.clearFocus,
      clearFocusRoots: state.clearFocusRoots,
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
      getTypeOffSelectionToggleIds(
        contextRows,
        excludedObjectIds,
        rowId
      ).forEach((id) => toggleObjectExclusion(id));
      return;
    }

    if (checked) {
      toggleObjectExclusion(rowId);
      return;
    }

    const selectedCount = contextRows.filter(
      (row) => !excludedObjectIds.has(row.id)
    ).length;
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

  // Browse mode focuses via roots, full view via the dim-focus id; every
  // focus indicator below reflects whichever is active.
  const isBrowseView = viewMode === "browse";
  const hasFocusSelection = isBrowseView
    ? focusRoots.size > 0
    : Boolean(focusedTableId);
  const isObjectFocused = (id: string) =>
    isBrowseView ? focusRoots.has(id) : focusedTableId === id;
  const focusScrollTargetId =
    focusedTableId ?? (isBrowseView ? ([...focusRoots][0] ?? null) : null);

  useEffect(() => {
    if (!isFocusOpen) {
      hasScrolledOnOpenRef.current = false;
      return;
    }

    if (hasScrolledOnOpenRef.current || !focusScrollTargetId) {
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
          (element) => element.dataset.itemId === focusScrollTargetId
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
  }, [focusScrollTargetId, isFocusOpen]);

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
  }, [schema, debouncedSearchFilter, schemaFilter, focusedTableId]);

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
    ? (canvasFilePath.split("/").pop()?.split("\\").pop() ?? "Untitled")
    : "Untitled";

  return (
    <TooltipProvider delayDuration={300}>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start px-3 pt-3">
        {/* Left: bare logo, plus a glass pill of canvas controls in canvas mode */}
        <div className="pointer-events-auto flex h-9 items-center gap-3">
          <MonocleLogo className="h-6 w-6" />
          {canvasMode && (
            <div className="panel-glass flex h-9 items-center gap-1 px-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={onOpen}>
                    <FolderOpen className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Open File</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={onSave}>
                    <Save className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Save</TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>

        {/* Center: focus + database selectors, or canvas filename */}
        {showDatabaseSelector && (
          <div className="pointer-events-auto absolute left-1/2 -translate-x-1/2">
            <div className="panel-glass flex h-9 items-center gap-1 px-1">
              <FocusSelector />
              <Separator orientation="vertical" className="h-4" />
              <DatabaseSelector />
            </div>
          </div>
        )}
        {canvasMode && (
          <div className="pointer-events-auto absolute left-1/2 -translate-x-1/2">
            <div className="panel-glass flex h-9 items-center gap-1.5 px-3 text-xs text-muted-foreground">
              <span>{canvasFileName}</span>
              {canvasIsDirty && (
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-blue" />
              )}
            </div>
          </div>
        )}

        <div className="flex-1" />

        {/* Right: filters, export, settings */}
        <div className="pointer-events-auto panel-glass flex h-9 items-center gap-1 px-1">
          {canvasMode && (
            <>
              <AddObjectMenu onImport={onImport} />
              <Separator orientation="vertical" className="h-4" />
            </>
          )}

          {hasSchema && (
            <>
              {/* Focus */}
              <Popover
                open={isFocusOpen}
                onOpenChange={(open) => {
                  setIsFocusOpen(open);
                  if (!open) {
                    setFocusSearch("");
                    setExpandedFocusSections(
                      createDefaultExpandedFocusSections()
                    );
                  }
                }}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          hasFocusSelection && FILTER_ACTIVE_CLASSES
                        )}
                      >
                        <Crosshair className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Focus</TooltipContent>
                </Tooltip>
                <PopoverContent className="w-72 p-0" align="end">
                  <div className="border-b p-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Focus on..."
                        value={focusSearch}
                        onChange={(e) => setFocusSearch(e.target.value)}
                        className="h-8 pl-7"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div
                    ref={scrollContainerRef}
                    className="max-h-80 overflow-auto"
                  >
                    <div className="w-max min-w-full">
                      {hasFocusSelection && (
                        <button
                          className="w-max min-w-full border-b px-3 py-2 text-left text-xs hover:bg-accent"
                          onClick={isBrowseView ? clearFocusRoots : clearFocus}
                        >
                          {isBrowseView ? "Clear Selection" : "Clear Focus"}
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
                              className="flex w-max min-w-full cursor-pointer items-center gap-2 bg-muted/50 px-3 py-1.5"
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
                                className="inline-flex h-5 w-5 items-center justify-center rounded-sm hover:bg-accent"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleFocusSection(type);
                                }}
                                aria-label={`Toggle ${OBJECT_TYPE_LABELS[type]} section`}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                              </button>
                              <div
                                className="flex cursor-pointer items-center gap-2"
                                onClick={stopSectionHeaderToggle}
                                onKeyDown={stopSectionHeaderToggle}
                              >
                                <TypeDot type={type} />
                                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
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
                                    className={cn(
                                      "flex w-max min-w-full items-center gap-2 px-3 py-1 text-left text-xs hover:bg-accent",
                                      isObjectFocused(item.id) &&
                                        "bg-accent-blue/15 text-accent-blue"
                                    )}
                                    onClick={() => setFocusedTable(item.id)}
                                  >
                                    <TypeDot type={type} />
                                    {item.id}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {focusSearch.trim().length > 0 &&
                        !hasFocusSearchMatches && (
                          <div className="w-max min-w-full px-3 py-4 text-center text-xs text-muted-foreground">
                            No matches found
                          </div>
                        )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Objects */}
              <Popover
                open={isObjectsOpen}
                onOpenChange={(open) => {
                  setIsObjectsOpen(open);
                  setObjectsSearch("");
                  setExpandedObjectSections(
                    createDefaultExpandedObjectSections()
                  );
                }}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          hasObjectFilters && FILTER_ACTIVE_CLASSES
                        )}
                      >
                        <Box className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Objects</TooltipContent>
                </Tooltip>
                <PopoverContent className="w-72 p-0" align="end">
                  <div className="border-b p-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Filter objects..."
                        value={objectsSearch}
                        onChange={(e) => setObjectsSearch(e.target.value)}
                        className="h-8 pl-7"
                      />
                    </div>
                  </div>
                  <div className="max-h-80 overflow-auto">
                    <div className="w-max min-w-full">
                      {hasObjectFilters && (
                        <button
                          className="w-max min-w-full border-b px-3 py-2 text-left text-xs hover:bg-accent"
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
                          <div
                            key={type}
                            className="w-max min-w-full border-b last:border-b-0"
                          >
                            <div
                              className="flex w-max min-w-full cursor-pointer items-center gap-2 bg-muted/50 px-3 py-1.5"
                              role="button"
                              tabIndex={0}
                              onClick={() => toggleObjectSection(type)}
                              onKeyDown={(event) => {
                                if (event.currentTarget !== event.target)
                                  return;
                                if (shouldToggleSectionFromKey(event.key)) {
                                  event.preventDefault();
                                  toggleObjectSection(type);
                                }
                              }}
                            >
                              <button
                                type="button"
                                className="inline-flex h-5 w-5 items-center justify-center rounded-sm hover:bg-accent"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleObjectSection(type);
                                }}
                                onKeyDown={stopSectionHeaderToggle}
                                aria-label={`Toggle ${OBJECT_TYPE_LABELS[type]} section`}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
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
                              <TypeDot type={type} />
                              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
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
                                  const isExcluded = excludedObjectIds.has(
                                    item.id
                                  );
                                  const checked = typeEnabled && !isExcluded;
                                  return (
                                    <div
                                      key={item.id}
                                      className={cn(
                                        "flex w-max min-w-full cursor-pointer items-center gap-2 px-3 py-1 text-xs hover:bg-accent",
                                        !typeEnabled && "opacity-50"
                                      )}
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
                                        if (
                                          event.currentTarget !== event.target
                                        )
                                          return;
                                        if (
                                          shouldToggleSectionFromKey(event.key)
                                        ) {
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
                                      <TypeDot type={type} />
                                      <span>{item.id}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {objectsSearch.trim().length > 0 &&
                        !hasPanelSearchMatches && (
                          <div className="w-max min-w-full px-3 py-4 text-center text-xs text-muted-foreground">
                            No matches found
                          </div>
                        )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Edges */}
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          !allEdgesSelected && FILTER_ACTIVE_CLASSES
                        )}
                      >
                        <Network className="h-4 w-4" />
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
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: EDGE_COLORS[type] }}
                        />
                        {EDGE_TYPE_LABELS[type]}
                      </span>
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <ExportButton />
              <Separator orientation="vertical" className="h-4" />
            </>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={onOpenSettings}>
                <Settings className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Settings</TooltipContent>
          </Tooltip>

          {canvasMode && onExitCanvas && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={onExitCanvas}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Leave Canvas</TooltipContent>
            </Tooltip>
          )}

          {!canvasMode && isConnected && onDisconnect && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={onDisconnect}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Disconnect</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

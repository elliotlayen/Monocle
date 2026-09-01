import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronsUpDown, PanelLeftClose, Search } from "lucide-react";
import { useShallow } from "zustand/shallow";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getSchemaIndex } from "@/lib/schema-index";
import { computeBrowseVisibleIds } from "../../utils/browse-visibility";
import { useSchemaStore, type ObjectType } from "../../store";
import { getFilteredObjectBuckets } from "../../utils/object-filtering";
import type { DetailSidebarData } from "../detail-content";
import {
  SIDEBAR_WIDTH,
  buildTree,
  countSchemaGroups,
  flattenTree,
  type SidebarItem,
  type SidebarRow,
} from "./sidebar-tree";
import { SidebarRowView } from "./sidebar-row";

export { SIDEBAR_WIDTH } from "./sidebar-tree";

const SEARCH_DEBOUNCE_MS = 150;
const FORCE_EXPAND_MIN_QUERY = 2;
const DEFAULT_EXPANDED_CATEGORIES = new Set<ObjectType>(["tables"]);

interface SchemaBrowserSidebarProps {
  onItemClick: (data: DetailSidebarData) => void;
}

function SchemaBrowserSidebarComponent({
  onItemClick,
}: SchemaBrowserSidebarProps) {
  const {
    schema,
    sidebarOpen,
    setSidebarOpen,
    graphSearchFilter,
    schemaFilter,
    objectTypeFilter,
    excludedObjectIds,
    focusedTableId,
    viewMode,
    focusRoots,
    expandedNodeIds,
  } = useSchemaStore(
    useShallow((state) => ({
      schema: state.schema,
      sidebarOpen: state.sidebarOpen,
      setSidebarOpen: state.setSidebarOpen,
      graphSearchFilter: state.debouncedSearchFilter,
      schemaFilter: state.schemaFilter,
      objectTypeFilter: state.objectTypeFilter,
      excludedObjectIds: state.excludedObjectIds,
      focusedTableId: state.focusedTableId,
      viewMode: state.viewMode,
      focusRoots: state.focusRoots,
      expandedNodeIds: state.expandedNodeIds,
    }))
  );

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<ObjectType>>(
    DEFAULT_EXPANDED_CATEGORIES
  );
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(
    new Set()
  );
  const [activeIndex, setActiveIndex] = useState(-1);
  const scrollParentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedQuery(query),
      SEARCH_DEBOUNCE_MS
    );
    return () => window.clearTimeout(timer);
  }, [query]);

  // Reset search and expansion when a different schema loads.
  useEffect(() => {
    setQuery("");
    setDebouncedQuery("");
    setExpandedCategories(new Set(DEFAULT_EXPANDED_CATEGORIES));
    setExpandedSchemas(new Set());
    setActiveIndex(-1);
  }, [schema]);

  const tree = useMemo(() => (schema ? buildTree(schema) : []), [schema]);

  // Sidebar search shares the schema index with toolbar search, so column
  // names match here too.
  const matchIds = useMemo(() => {
    const lowerQuery = debouncedQuery.trim().toLowerCase();
    if (!schema || !lowerQuery) return null;
    const index = getSchemaIndex(schema);
    const ids = new Set<string>();
    for (const searchMap of [
      index.tableSearch,
      index.viewSearch,
      index.triggerSearch,
      index.procedureSearch,
      index.functionSearch,
    ]) {
      for (const [id, text] of searchMap) {
        if (text.includes(lowerQuery)) ids.add(id);
      }
    }
    return ids;
  }, [schema, debouncedQuery]);

  // Objects currently visible in the graph; sidebar rows outside this set
  // render dimmed. Uses the same filtering implementation as the graph and
  // the status bar, so all three agree.
  const graphVisibleIds = useMemo(() => {
    if (!schema) return null;
    const schemaIndex = getSchemaIndex(schema);
    const browseVisibleIds = computeBrowseVisibleIds(
      viewMode,
      focusRoots,
      expandedNodeIds,
      schemaIndex
    );
    const schemaFilterActive = Boolean(schemaFilter) && schemaFilter !== "all";
    const filtersActive =
      browseVisibleIds !== null ||
      graphSearchFilter.trim() !== "" ||
      schemaFilterActive ||
      objectTypeFilter.size !== 5 ||
      excludedObjectIds.size > 0 ||
      focusedTableId !== null;
    if (!filtersActive) return null;
    const filtered = getFilteredObjectBuckets({
      schema,
      searchFilter: graphSearchFilter,
      schemaFilter,
      objectTypeFilter,
      excludedObjectIds,
      focusedTableId,
      schemaIndex,
    }).visibleNodeIds;
    if (!browseVisibleIds) return filtered;
    return new Set([...filtered].filter((id) => browseVisibleIds.has(id)));
  }, [
    schema,
    graphSearchFilter,
    schemaFilter,
    objectTypeFilter,
    excludedObjectIds,
    focusedTableId,
    viewMode,
    focusRoots,
    expandedNodeIds,
  ]);

  const forceExpand =
    debouncedQuery.trim().length >= FORCE_EXPAND_MIN_QUERY && matchIds !== null;

  const rows = useMemo(
    () =>
      flattenTree({
        tree,
        expandedCategories,
        expandedSchemas,
        matchIds,
        forceExpand,
        graphVisibleIds,
      }),
    [
      tree,
      expandedCategories,
      expandedSchemas,
      matchIds,
      forceExpand,
      graphVisibleIds,
    ]
  );

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: (index) => (rows[index]?.kind === "category" ? 32 : 28),
    overscan: 10,
    getItemKey: (index) => rows[index]?.key ?? index,
  });

  const toggleCategory = useCallback((type: ObjectType) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  const toggleSchema = useCallback((key: string) => {
    setExpandedSchemas((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const allExpanded =
    tree.length > 0 &&
    expandedCategories.size >= tree.length &&
    expandedSchemas.size >= countSchemaGroups(tree);

  const toggleExpandAll = useCallback(() => {
    if (allExpanded) {
      setExpandedCategories(new Set());
      setExpandedSchemas(new Set());
    } else {
      setExpandedCategories(new Set(tree.map((category) => category.type)));
      setExpandedSchemas(
        new Set(
          tree.flatMap((category) =>
            category.schemas.map((group) => group.key)
          )
        )
      );
    }
  }, [allExpanded, tree]);

  const handleItemClick = useCallback(
    (item: SidebarItem, _element: HTMLElement) => {
      onItemClick(item.data);
    },
    [onItemClick]
  );

  // The crosshair/double-click toggles: browse mode adds or removes the
  // object as a root, full view sets or clears the dim-focus highlight.
  const handleItemFocus = useCallback((itemId: string) => {
    const state = useSchemaStore.getState();
    if (state.viewMode === "browse" && state.mode !== "canvas") {
      state.toggleFocusRoot(itemId);
      return;
    }
    state.setFocusedTable(state.focusedTableId === itemId ? null : itemId);
  }, []);

  const activateRow = useCallback(
    (row: SidebarRow) => {
      if (row.kind === "category") {
        toggleCategory(row.categoryType);
        return;
      }
      if (row.kind === "schema") {
        toggleSchema(row.key.replace(/^schema-/, ""));
        return;
      }
      const element = scrollParentRef.current?.querySelector<HTMLElement>(
        `[data-row-key="${CSS.escape(row.key)}"]`
      );
      if (element) {
        handleItemClick(row.item, element);
      }
    },
    [toggleCategory, toggleSchema, handleItemClick]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (rows.length === 0) return;
      const clamp = (index: number) =>
        Math.max(0, Math.min(rows.length - 1, index));

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          const next = clamp(activeIndex + 1);
          setActiveIndex(next);
          rowVirtualizer.scrollToIndex(next);
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          const next = clamp(activeIndex - 1);
          setActiveIndex(next);
          rowVirtualizer.scrollToIndex(next);
          break;
        }
        case "ArrowRight": {
          e.preventDefault();
          const row = rows[activeIndex];
          if (!row) break;
          if (row.kind !== "item" && !row.expanded) {
            activateRow(row);
          } else if (activeIndex < rows.length - 1) {
            const next = clamp(activeIndex + 1);
            setActiveIndex(next);
            rowVirtualizer.scrollToIndex(next);
          }
          break;
        }
        case "ArrowLeft": {
          e.preventDefault();
          const row = rows[activeIndex];
          if (!row) break;
          if (row.kind !== "item" && row.expanded) {
            activateRow(row);
            break;
          }
          // Jump to the parent row.
          for (let i = activeIndex - 1; i >= 0; i -= 1) {
            if (rows[i].depth < row.depth) {
              setActiveIndex(i);
              rowVirtualizer.scrollToIndex(i);
              break;
            }
          }
          break;
        }
        case "Enter":
        case " ": {
          e.preventDefault();
          const row = rows[activeIndex];
          if (row) activateRow(row);
          break;
        }
      }
    },
    [rows, activeIndex, activateRow, rowVirtualizer]
  );

  return (
    <aside
      style={{ width: SIDEBAR_WIDTH }}
      className={cn(
        "panel-glass absolute left-3 top-14 bottom-11 z-20",
        "flex flex-col overflow-hidden",
        "transition-transform duration-[var(--duration-slow)] ease-[var(--ease-out)]",
        sidebarOpen ? "translate-x-0" : "-translate-x-[calc(100%+1.5rem)]"
      )}
    >
      {/* Header */}
      <div className="flex-shrink-0 border-b p-2.5">
        <div className="mb-2.5 flex items-center justify-between">
          <h2 className="pl-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Schema Browser
          </h2>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={toggleExpandAll}
              title={allExpanded ? "Collapse all" : "Expand all"}
            >
              <ChevronsUpDown className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setSidebarOpen(false)}
              title="Close sidebar"
            >
              <PanelLeftClose className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search objects..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 pl-8"
          />
        </div>
      </div>

      {/* Tree */}
      <div
        ref={scrollParentRef}
        role="tree"
        aria-label="Schema objects"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="flex-1 overflow-auto p-2 outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {schema
              ? "No objects found"
              : "Connect to a database to browse schema"}
          </p>
        ) : (
          <div
            style={{
              height: rowVirtualizer.getTotalSize(),
              width: "100%",
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              return (
                <div
                  key={virtualRow.key}
                  data-row-key={row.key}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: virtualRow.size,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <SidebarRowView
                    row={row}
                    isActive={virtualRow.index === activeIndex}
                    isFocusedObject={
                      row.kind === "item" &&
                      (row.item.id === focusedTableId ||
                        focusRoots.has(row.item.id))
                    }
                    onToggleCategory={toggleCategory}
                    onToggleSchema={toggleSchema}
                    onItemClick={handleItemClick}
                    onItemFocus={handleItemFocus}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}

export const SchemaBrowserSidebar = memo(SchemaBrowserSidebarComponent);

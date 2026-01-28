import { useState, useMemo, useCallback, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ChevronRight,
  ChevronDown,
  Table2,
  Eye,
  Zap,
  Settings2,
  FunctionSquare,
  Search,
  ChevronsUpDown,
  PanelLeftClose,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SchemaGraph } from "../types";
import type { DetailSidebarData } from "./detail-content";

type ObjectType = "tables" | "views" | "triggers" | "storedProcedures" | "scalarFunctions";

interface TreeItem {
  id: string;
  name: string;
  type: ObjectType;
  schema: string;
  data: DetailSidebarData;
}

interface TreeSchema {
  name: string;
  items: TreeItem[];
}

interface TreeCategory {
  type: ObjectType;
  label: string;
  icon: React.ReactNode;
  schemas: TreeSchema[];
  count: number;
}

type RowItem =
  | {
      type: "category";
      key: string;
      category: TreeCategory;
      depth: number;
    }
  | {
      type: "schema";
      key: string;
      category: TreeCategory;
      schema: TreeSchema;
      schemaKey: string;
      depth: number;
    }
  | {
      type: "item";
      key: string;
      item: TreeItem;
      depth: number;
    };

function buildTree(schema: SchemaGraph): TreeCategory[] {
  const categories: TreeCategory[] = [];

  // Tables
  if (schema.tables.length > 0) {
    const bySchema = new Map<string, TreeItem[]>();
    schema.tables.forEach((table) => {
      const items = bySchema.get(table.schema) ?? [];
      items.push({
        id: table.id,
        name: table.name,
        type: "tables",
        schema: table.schema,
        data: { type: "table", data: table },
      });
      bySchema.set(table.schema, items);
    });

    categories.push({
      type: "tables",
      label: "Tables",
      icon: <Table2 className="h-4 w-4" />,
      schemas: [...bySchema.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, items]) => ({ name, items: items.sort((a, b) => a.name.localeCompare(b.name)) })),
      count: schema.tables.length,
    });
  }

  // Views
  if ((schema.views ?? []).length > 0) {
    const bySchema = new Map<string, TreeItem[]>();
    (schema.views ?? []).forEach((view) => {
      const items = bySchema.get(view.schema) ?? [];
      items.push({
        id: view.id,
        name: view.name,
        type: "views",
        schema: view.schema,
        data: { type: "view", data: view },
      });
      bySchema.set(view.schema, items);
    });

    categories.push({
      type: "views",
      label: "Views",
      icon: <Eye className="h-4 w-4" />,
      schemas: [...bySchema.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, items]) => ({ name, items: items.sort((a, b) => a.name.localeCompare(b.name)) })),
      count: (schema.views ?? []).length,
    });
  }

  // Triggers
  if ((schema.triggers ?? []).length > 0) {
    const bySchema = new Map<string, TreeItem[]>();
    (schema.triggers ?? []).forEach((trigger) => {
      const items = bySchema.get(trigger.schema) ?? [];
      items.push({
        id: trigger.id,
        name: trigger.name,
        type: "triggers",
        schema: trigger.schema,
        data: { type: "trigger", data: trigger },
      });
      bySchema.set(trigger.schema, items);
    });

    categories.push({
      type: "triggers",
      label: "Triggers",
      icon: <Zap className="h-4 w-4" />,
      schemas: [...bySchema.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, items]) => ({ name, items: items.sort((a, b) => a.name.localeCompare(b.name)) })),
      count: (schema.triggers ?? []).length,
    });
  }

  // Stored Procedures
  if ((schema.storedProcedures ?? []).length > 0) {
    const bySchema = new Map<string, TreeItem[]>();
    (schema.storedProcedures ?? []).forEach((proc) => {
      const items = bySchema.get(proc.schema) ?? [];
      items.push({
        id: proc.id,
        name: proc.name,
        type: "storedProcedures",
        schema: proc.schema,
        data: { type: "storedProcedure", data: proc },
      });
      bySchema.set(proc.schema, items);
    });

    categories.push({
      type: "storedProcedures",
      label: "Stored Procedures",
      icon: <Settings2 className="h-4 w-4" />,
      schemas: [...bySchema.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, items]) => ({ name, items: items.sort((a, b) => a.name.localeCompare(b.name)) })),
      count: (schema.storedProcedures ?? []).length,
    });
  }

  // Scalar Functions
  if ((schema.scalarFunctions ?? []).length > 0) {
    const bySchema = new Map<string, TreeItem[]>();
    (schema.scalarFunctions ?? []).forEach((fn) => {
      const items = bySchema.get(fn.schema) ?? [];
      items.push({
        id: fn.id,
        name: fn.name,
        type: "scalarFunctions",
        schema: fn.schema,
        data: { type: "scalarFunction", data: fn },
      });
      bySchema.set(fn.schema, items);
    });

    categories.push({
      type: "scalarFunctions",
      label: "Scalar Functions",
      icon: <FunctionSquare className="h-4 w-4" />,
      schemas: [...bySchema.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, items]) => ({ name, items: items.sort((a, b) => a.name.localeCompare(b.name)) })),
      count: (schema.scalarFunctions ?? []).length,
    });
  }

  return categories;
}

function filterTree(tree: TreeCategory[], filter: string): TreeCategory[] {
  if (!filter.trim()) return tree;

  const lowerFilter = filter.toLowerCase();

  return tree
    .map((category) => {
      const filteredSchemas = category.schemas
        .map((schema) => ({
          ...schema,
          items: schema.items.filter((item) =>
            item.name.toLowerCase().includes(lowerFilter) ||
            item.schema.toLowerCase().includes(lowerFilter)
          ),
        }))
        .filter((schema) => schema.items.length > 0);

      return {
        ...category,
        schemas: filteredSchemas,
        count: filteredSchemas.reduce((sum, s) => sum + s.items.length, 0),
      };
    })
    .filter((category) => category.schemas.length > 0);
}

interface SchemaBrowserSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schema: SchemaGraph | null;
  onItemClick: (data: DetailSidebarData, rect: DOMRect) => void;
}

export function SchemaBrowserSidebar({
  open,
  onOpenChange,
  schema,
  onItemClick,
}: SchemaBrowserSidebarProps) {
  const [searchFilter, setSearchFilter] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<ObjectType>>(new Set(["tables"]));
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(new Set());

  const tree = useMemo(() => (schema ? buildTree(schema) : []), [schema]);
  const filteredTree = useMemo(() => filterTree(tree, searchFilter), [tree, searchFilter]);

  // Auto-expand all when searching
  const isSearching = searchFilter.trim().length > 0;
  const effectiveExpandedCategories = useMemo(() => {
    if (isSearching) {
      return new Set(filteredTree.map((c) => c.type));
    }
    return expandedCategories;
  }, [isSearching, filteredTree, expandedCategories]);
  const effectiveExpandedSchemas = useMemo(() => {
    if (isSearching) {
      return new Set(
        filteredTree.flatMap((c) => c.schemas.map((s) => `${c.type}-${s.name}`))
      );
    }
    return expandedSchemas;
  }, [isSearching, filteredTree, expandedSchemas]);

  const rowItems = useMemo<RowItem[]>(() => {
    const rows: RowItem[] = [];
    filteredTree.forEach((category) => {
      rows.push({
        type: "category",
        key: `category-${category.type}`,
        category,
        depth: 0,
      });

      if (!effectiveExpandedCategories.has(category.type)) return;

      category.schemas.forEach((schemaEntry) => {
        const schemaKey = `${category.type}-${schemaEntry.name}`;
        rows.push({
          type: "schema",
          key: `schema-${schemaKey}`,
          category,
          schema: schemaEntry,
          schemaKey,
          depth: 1,
        });

        if (!effectiveExpandedSchemas.has(schemaKey)) return;

        schemaEntry.items.forEach((item) => {
          rows.push({
            type: "item",
            key: `item-${item.id}`,
            item,
            depth: 2,
          });
        });
      });
    });

    return rows;
  }, [filteredTree, effectiveExpandedCategories, effectiveExpandedSchemas]);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: rowItems.length,
    getScrollElement: () =>
      scrollRef.current?.querySelector(
        "[data-radix-scroll-area-viewport]"
      ) as HTMLElement | null,
    estimateSize: (index) => {
      const row = rowItems[index];
      if (!row) return 28;
      if (row.type === "category") return 32;
      if (row.type === "schema") return 28;
      return 26;
    },
    overscan: 8,
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

  const expandAll = useCallback(() => {
    setExpandedCategories(new Set(tree.map((c) => c.type)));
    setExpandedSchemas(new Set(tree.flatMap((c) => c.schemas.map((s) => `${c.type}-${s.name}`))));
  }, [tree]);

  const collapseAll = useCallback(() => {
    setExpandedCategories(new Set());
    setExpandedSchemas(new Set());
  }, []);

  const handleItemClick = useCallback(
    (e: React.MouseEvent, data: DetailSidebarData) => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      onItemClick(data, rect);
    },
    [onItemClick]
  );

  return (
    <aside
      className={cn(
        "absolute left-0 top-0 bottom-0 w-[280px] bg-background border-r z-20",
        "flex flex-col overflow-hidden",
        "transition-transform duration-300 ease-in-out",
        open ? "translate-x-0" : "-translate-x-full"
      )}
    >
      {/* Header */}
      <div className="flex-shrink-0 border-b p-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Schema Browser</h2>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={expandedCategories.size > 0 ? collapseAll : expandAll}
              title={expandedCategories.size > 0 ? "Collapse all" : "Expand all"}
            >
              <ChevronsUpDown className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onOpenChange(false)}
              title="Close sidebar"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search objects..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* Tree */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-2">
          {rowItems.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {schema ? "No objects found" : "Connect to a database to browse schema"}
            </p>
          ) : (
            <div
              className="relative w-full"
              style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const row = rowItems[virtualRow.index];
                if (!row) return null;

                const baseStyle = {
                  position: "absolute" as const,
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                };

                const paddingLeft = 8 + row.depth * 16;

                if (row.type === "category") {
                  const isExpanded = effectiveExpandedCategories.has(row.category.type);
                  return (
                    <div key={row.key} style={baseStyle}>
                      <button
                        className="flex items-center gap-2 w-full pr-2 py-1.5 rounded hover:bg-muted text-left"
                        style={{ paddingLeft }}
                        onClick={() => toggleCategory(row.category.type)}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        )}
                        <span className="text-muted-foreground flex-shrink-0">
                          {row.category.icon}
                        </span>
                        <span className="text-sm font-medium flex-1 truncate">
                          {row.category.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {row.category.count}
                        </span>
                      </button>
                    </div>
                  );
                }

                if (row.type === "schema") {
                  const isExpanded = effectiveExpandedSchemas.has(row.schemaKey);
                  return (
                    <div key={row.key} style={baseStyle}>
                      <button
                        className="flex items-center gap-2 w-full pr-2 py-1 rounded hover:bg-muted text-left"
                        style={{ paddingLeft }}
                        onClick={() => toggleSchema(row.schemaKey)}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        )}
                        <span className="text-sm text-muted-foreground flex-1 truncate">
                          {row.schema.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {row.schema.items.length}
                        </span>
                      </button>
                    </div>
                  );
                }

                return (
                  <div key={row.key} style={baseStyle}>
                    <button
                      className="flex items-center gap-2 w-full pr-2 py-1 rounded hover:bg-muted text-left"
                      style={{ paddingLeft }}
                      onClick={(e) => handleItemClick(e, row.item.data)}
                    >
                      <span className="w-3.5" />
                      <span className="text-sm truncate">{row.item.name}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}

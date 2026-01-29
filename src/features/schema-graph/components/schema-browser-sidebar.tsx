import { useState, useMemo, useCallback } from "react";
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

type ObjectType =
  | "tables"
  | "views"
  | "triggers"
  | "storedProcedures"
  | "scalarFunctions";

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
        .map(([name, items]) => ({
          name,
          items: items.sort((a, b) => a.name.localeCompare(b.name)),
        })),
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
        .map(([name, items]) => ({
          name,
          items: items.sort((a, b) => a.name.localeCompare(b.name)),
        })),
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
        .map(([name, items]) => ({
          name,
          items: items.sort((a, b) => a.name.localeCompare(b.name)),
        })),
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
        .map(([name, items]) => ({
          name,
          items: items.sort((a, b) => a.name.localeCompare(b.name)),
        })),
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
        .map(([name, items]) => ({
          name,
          items: items.sort((a, b) => a.name.localeCompare(b.name)),
        })),
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
          items: schema.items.filter(
            (item) =>
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
  const [expandedCategories, setExpandedCategories] = useState<Set<ObjectType>>(
    new Set(["tables"])
  );
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(
    new Set()
  );

  const tree = useMemo(() => (schema ? buildTree(schema) : []), [schema]);
  const filteredTree = useMemo(
    () => filterTree(tree, searchFilter),
    [tree, searchFilter]
  );

  // Auto-expand all when searching
  const effectiveExpandedCategories = searchFilter.trim()
    ? new Set(filteredTree.map((c) => c.type))
    : expandedCategories;
  const effectiveExpandedSchemas = searchFilter.trim()
    ? new Set(
        filteredTree.flatMap((c) => c.schemas.map((s) => `${c.type}-${s.name}`))
      )
    : expandedSchemas;

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
    setExpandedSchemas(
      new Set(tree.flatMap((c) => c.schemas.map((s) => `${c.type}-${s.name}`)))
    );
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
              title={
                expandedCategories.size > 0 ? "Collapse all" : "Expand all"
              }
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
      <ScrollArea className="flex-1">
        <div className="p-2">
          {filteredTree.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {schema
                ? "No objects found"
                : "Connect to a database to browse schema"}
            </p>
          ) : (
            filteredTree.map((category) => (
              <div key={category.type} className="mb-1">
                {/* Category row */}
                <button
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-muted text-left"
                  onClick={() => toggleCategory(category.type)}
                >
                  {effectiveExpandedCategories.has(category.type) ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
                  <span className="text-muted-foreground flex-shrink-0">
                    {category.icon}
                  </span>
                  <span className="text-sm font-medium flex-1 truncate">
                    {category.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {category.count}
                  </span>
                </button>

                {/* Schemas */}
                {effectiveExpandedCategories.has(category.type) && (
                  <div className="ml-4">
                    {category.schemas.map((schema) => {
                      const schemaKey = `${category.type}-${schema.name}`;
                      return (
                        <div key={schemaKey}>
                          {/* Schema row */}
                          <button
                            className="flex items-center gap-2 w-full px-2 py-1 rounded hover:bg-muted text-left"
                            onClick={() => toggleSchema(schemaKey)}
                          >
                            {effectiveExpandedSchemas.has(schemaKey) ? (
                              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            )}
                            <span className="text-sm text-muted-foreground flex-1 truncate">
                              {schema.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {schema.items.length}
                            </span>
                          </button>

                          {/* Items */}
                          {effectiveExpandedSchemas.has(schemaKey) && (
                            <div className="ml-4">
                              {schema.items.map((item) => (
                                <button
                                  key={item.id}
                                  className="flex items-center gap-2 w-full px-2 py-1 rounded hover:bg-muted text-left"
                                  onClick={(e) => handleItemClick(e, item.data)}
                                >
                                  <span className="w-3.5" />
                                  <span className="text-sm truncate">
                                    {item.name}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}

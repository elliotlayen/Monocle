import type { SchemaGraph } from "../../types";
import type { ObjectType } from "../../store";
import type { DetailSidebarData } from "../detail-content";

export const SIDEBAR_WIDTH = 280;

export interface SidebarItem {
  id: string;
  name: string;
  schema: string;
  type: ObjectType;
  data: DetailSidebarData;
}

export interface SidebarSchemaGroup {
  /** Unique expansion key: `${categoryType}-${schemaName}` */
  key: string;
  name: string;
  items: SidebarItem[];
}

export interface SidebarCategory {
  type: ObjectType;
  label: string;
  schemas: SidebarSchemaGroup[];
  count: number;
}

interface CategoryDescriptor {
  type: ObjectType;
  label: string;
  getItems: (schema: SchemaGraph) => SidebarItem[];
}

const CATEGORY_DESCRIPTORS: CategoryDescriptor[] = [
  {
    type: "tables",
    label: "Tables",
    getItems: (schema) =>
      schema.tables.map((table) => ({
        id: table.id,
        name: table.name,
        schema: table.schema,
        type: "tables",
        data: { type: "table", data: table },
      })),
  },
  {
    type: "views",
    label: "Views",
    getItems: (schema) =>
      (schema.views ?? []).map((view) => ({
        id: view.id,
        name: view.name,
        schema: view.schema,
        type: "views",
        data: { type: "view", data: view },
      })),
  },
  {
    type: "triggers",
    label: "Triggers",
    getItems: (schema) =>
      (schema.triggers ?? []).map((trigger) => ({
        id: trigger.id,
        name: trigger.name,
        schema: trigger.schema,
        type: "triggers",
        data: { type: "trigger", data: trigger },
      })),
  },
  {
    type: "storedProcedures",
    label: "Stored Procedures",
    getItems: (schema) =>
      (schema.storedProcedures ?? []).map((procedure) => ({
        id: procedure.id,
        name: procedure.name,
        schema: procedure.schema,
        type: "storedProcedures",
        data: { type: "storedProcedure", data: procedure },
      })),
  },
  {
    type: "scalarFunctions",
    label: "Scalar Functions",
    getItems: (schema) =>
      (schema.scalarFunctions ?? []).map((fn) => ({
        id: fn.id,
        name: fn.name,
        schema: fn.schema,
        type: "scalarFunctions",
        data: { type: "scalarFunction", data: fn },
      })),
  },
];

export function buildTree(schema: SchemaGraph): SidebarCategory[] {
  const categories: SidebarCategory[] = [];

  for (const descriptor of CATEGORY_DESCRIPTORS) {
    const items = descriptor.getItems(schema);
    if (items.length === 0) continue;

    const bySchema = new Map<string, SidebarItem[]>();
    for (const item of items) {
      const group = bySchema.get(item.schema) ?? [];
      group.push(item);
      bySchema.set(item.schema, group);
    }

    categories.push({
      type: descriptor.type,
      label: descriptor.label,
      schemas: [...bySchema.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, groupItems]) => ({
          key: `${descriptor.type}-${name}`,
          name,
          items: groupItems.sort((a, b) => a.name.localeCompare(b.name)),
        })),
      count: items.length,
    });
  }

  return categories;
}

export type SidebarRow =
  | {
      kind: "category";
      key: string;
      depth: 0;
      categoryType: ObjectType;
      label: string;
      expanded: boolean;
      shown: number;
      total: number;
    }
  | {
      kind: "schema";
      key: string;
      depth: 1;
      categoryType: ObjectType;
      label: string;
      expanded: boolean;
      shown: number;
      total: number;
    }
  | {
      kind: "item";
      key: string;
      depth: 2;
      categoryType: ObjectType;
      item: SidebarItem;
      dimmed: boolean;
    };

export interface FlattenTreeInput {
  tree: SidebarCategory[];
  expandedCategories: Set<ObjectType>;
  expandedSchemas: Set<string>;
  /** Object IDs matching the sidebar search; null when no search is active. */
  matchIds: Set<string> | null;
  /** Expand every surviving group (search queries of length >= 2). */
  forceExpand: boolean;
  /**
   * Object IDs currently visible in the graph; null when no graph filters
   * are active. Non-visible items render dimmed, never hidden.
   */
  graphVisibleIds: Set<string> | null;
}

export function flattenTree({
  tree,
  expandedCategories,
  expandedSchemas,
  matchIds,
  forceExpand,
  graphVisibleIds,
}: FlattenTreeInput): SidebarRow[] {
  const rows: SidebarRow[] = [];

  for (const category of tree) {
    const schemaGroups = matchIds
      ? category.schemas
          .map((group) => ({
            ...group,
            items: group.items.filter((item) => matchIds.has(item.id)),
          }))
          .filter((group) => group.items.length > 0)
      : category.schemas;
    if (matchIds && schemaGroups.length === 0) continue;

    const total = schemaGroups.reduce(
      (sum, group) => sum + group.items.length,
      0
    );
    const shown = graphVisibleIds
      ? schemaGroups.reduce(
          (sum, group) =>
            sum +
            group.items.filter((item) => graphVisibleIds.has(item.id)).length,
          0
        )
      : total;

    const categoryExpanded =
      forceExpand || expandedCategories.has(category.type);
    rows.push({
      kind: "category",
      key: `category-${category.type}`,
      depth: 0,
      categoryType: category.type,
      label: category.label,
      expanded: categoryExpanded,
      shown,
      total,
    });
    if (!categoryExpanded) continue;

    for (const group of schemaGroups) {
      const groupShown = graphVisibleIds
        ? group.items.filter((item) => graphVisibleIds.has(item.id)).length
        : group.items.length;
      const groupExpanded = forceExpand || expandedSchemas.has(group.key);
      rows.push({
        kind: "schema",
        key: `schema-${group.key}`,
        depth: 1,
        categoryType: category.type,
        label: group.name,
        expanded: groupExpanded,
        shown: groupShown,
        total: group.items.length,
      });
      if (!groupExpanded) continue;

      for (const item of group.items) {
        rows.push({
          kind: "item",
          key: `item-${item.id}`,
          depth: 2,
          categoryType: category.type,
          item,
          dimmed: graphVisibleIds ? !graphVisibleIds.has(item.id) : false,
        });
      }
    }
  }

  return rows;
}

export function countSchemaGroups(tree: SidebarCategory[]): number {
  return tree.reduce((sum, category) => sum + category.schemas.length, 0);
}

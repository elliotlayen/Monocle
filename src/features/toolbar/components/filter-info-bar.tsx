import {
  useSchemaStore,
  type ObjectType,
  type EdgeType,
} from "@/features/schema-graph/store";
import { useShallow } from "zustand/shallow";
import { X } from "lucide-react";
import {
  EDGE_TYPE_LABELS,
  EDGE_COLORS,
  OBJECT_COLORS,
} from "@/constants/edge-colors";

const OBJECT_TYPE_LABELS: Record<ObjectType, string> = {
  tables: "Tables",
  views: "Views",
  triggers: "Triggers",
  storedProcedures: "Stored Procedures",
  scalarFunctions: "Scalar Functions",
};

// Order for consistent color display
const OBJECT_TYPE_ORDER: ObjectType[] = [
  "tables",
  "views",
  "triggers",
  "storedProcedures",
  "scalarFunctions",
];
const EDGE_TYPE_ORDER: EdgeType[] = [
  "relationships",
  "viewDependencies",
  "triggerDependencies",
  "triggerWrites",
  "procedureReads",
  "procedureWrites",
  "functionReads",
];

type BorderMode = "left-accent" | "full-border";

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return hex;

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function FilterInfoBar() {
  const {
    schema,
    focusedTableId,
    objectTypeFilter,
    edgeTypeFilter,
    clearFocus,
    selectAllObjectTypes,
    selectAllEdgeTypes,
  } = useSchemaStore(
    useShallow((state) => ({
      schema: state.schema,
      focusedTableId: state.focusedTableId,
      objectTypeFilter: state.objectTypeFilter,
      edgeTypeFilter: state.edgeTypeFilter,
      clearFocus: state.clearFocus,
      selectAllObjectTypes: state.selectAllObjectTypes,
      selectAllEdgeTypes: state.selectAllEdgeTypes,
    }))
  );

  const allObjectsSelected = objectTypeFilter.size === 5;
  const allEdgesSelected = edgeTypeFilter.size === EDGE_TYPE_ORDER.length;

  // Determine the type of the focused object
  const getFocusedObjectType = (): ObjectType | null => {
    if (!focusedTableId || !schema) return null;
    if (schema.tables.some((t) => t.id === focusedTableId)) return "tables";
    if (schema.views.some((v) => v.id === focusedTableId)) return "views";
    if (schema.triggers.some((t) => t.id === focusedTableId)) return "triggers";
    if (schema.storedProcedures.some((p) => p.id === focusedTableId))
      return "storedProcedures";
    if (schema.scalarFunctions.some((f) => f.id === focusedTableId))
      return "scalarFunctions";
    return null;
  };

  const getObjectsLabel = () => {
    if (allObjectsSelected) return null;
    if (objectTypeFilter.size > 1) return `${objectTypeFilter.size} types`;
    const type = Array.from(objectTypeFilter)[0];
    return OBJECT_TYPE_LABELS[type];
  };

  const getEdgesLabel = () => {
    if (allEdgesSelected) return null;
    if (edgeTypeFilter.size > 1) return `${edgeTypeFilter.size} types`;
    const type = Array.from(edgeTypeFilter)[0];
    return EDGE_TYPE_LABELS[type];
  };

  // Get colors for selected object types (in consistent order)
  const getObjectColors = (): string[] => {
    return OBJECT_TYPE_ORDER.filter((type) => objectTypeFilter.has(type)).map(
      (type) => OBJECT_COLORS[type]
    );
  };

  // Get colors for selected edge types (in consistent order)
  const getEdgeColors = (): string[] => {
    return EDGE_TYPE_ORDER.filter((type) => edgeTypeFilter.has(type)).map(
      (type) => EDGE_COLORS[type]
    );
  };

  const objectsLabel = getObjectsLabel();
  const edgesLabel = getEdgesLabel();
  const focusedType = getFocusedObjectType();

  const hasActiveFilters = focusedTableId || objectsLabel || edgesLabel;

  if (!hasActiveFilters) return null;

  return (
    <div className="absolute top-2 right-3 z-10 flex flex-col items-end gap-2">
      {focusedTableId && focusedType && (
        <FilterBox
          label="Focus"
          value={focusedTableId}
          colors={[OBJECT_COLORS[focusedType]]}
          borderMode="full-border"
          onClear={clearFocus}
        />
      )}
      {objectsLabel && (
        <FilterBox
          label="Objects"
          value={objectsLabel}
          colors={getObjectColors()}
          onClear={selectAllObjectTypes}
        />
      )}
      {edgesLabel && (
        <FilterBox
          label="Edges"
          value={edgesLabel}
          colors={getEdgeColors()}
          onClear={selectAllEdgeTypes}
        />
      )}
    </div>
  );
}

function FilterBox({
  label,
  value,
  colors,
  borderMode = "left-accent",
  onClear,
}: {
  label: string;
  value: string;
  colors: string[];
  borderMode?: BorderMode;
  onClear: () => void;
}) {
  // Full-border mode is used for focus to match notification chips.
  const borderStyle =
    borderMode === "full-border"
      ? { borderColor: hexToRgba(colors[0], 0.3) }
      : colors.length === 1
        ? { borderLeftWidth: 3, borderLeftColor: colors[0] }
        : {
            borderLeftWidth: 3,
            borderLeftColor: "transparent",
            backgroundImage: `linear-gradient(to bottom, ${colors.join(", ")})`,
            backgroundSize: "3px 100%",
            backgroundPosition: "left",
            backgroundRepeat: "no-repeat",
          };

  // Use first color for text when single, muted for multiple
  const textColor = colors.length === 1 ? colors[0] : undefined;

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-background border shadow-sm text-sm"
      style={borderStyle}
    >
      <span className="text-muted-foreground">{label}:</span>
      <span
        className="font-medium"
        style={textColor ? { color: textColor } : undefined}
      >
        {value}
      </span>
      <button onClick={onClear} className="ml-1 hover:bg-muted rounded p-0.5">
        <X className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
    </div>
  );
}

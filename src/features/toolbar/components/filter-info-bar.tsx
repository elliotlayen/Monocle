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
import {
  OBJECT_TYPE_LABELS,
  OBJECT_TYPE_ORDER,
} from "@/constants/object-type-meta";

const EDGE_TYPE_ORDER: EdgeType[] = [
  "relationships",
  "viewDependencies",
  "triggerReads",
  "triggerWrites",
  "procedureReads",
  "procedureWrites",
  "functionReads",
  "codeCalls",
];

type BorderMode = "left-accent" | "full-border";

// Colors arrive as CSS var references (see edge-colors.ts), so alpha is
// applied with color-mix rather than hex parsing.
function withAlpha(color: string, alphaPercent: number): string {
  return `color-mix(in srgb, ${color} ${alphaPercent}%, transparent)`;
}

export function FilterInfoBar() {
  const {
    schema,
    focusedTableId,
    viewMode,
    focusRoots,
    objectTypeFilter,
    excludedObjectIds,
    edgeTypeFilter,
    clearFocus,
    clearFocusRoots,
    resetObjectFilters,
    selectAllEdgeTypes,
  } = useSchemaStore(
    useShallow((state) => ({
      schema: state.schema,
      focusedTableId: state.focusedTableId,
      viewMode: state.viewMode,
      focusRoots: state.focusRoots,
      objectTypeFilter: state.objectTypeFilter,
      excludedObjectIds: state.excludedObjectIds,
      edgeTypeFilter: state.edgeTypeFilter,
      clearFocus: state.clearFocus,
      clearFocusRoots: state.clearFocusRoots,
      resetObjectFilters: state.resetObjectFilters,
      selectAllEdgeTypes: state.selectAllEdgeTypes,
    }))
  );

  const allObjectsSelected = objectTypeFilter.size === 5;
  const allEdgesSelected = edgeTypeFilter.size === EDGE_TYPE_ORDER.length;

  // Determine the type of an object by id
  const getObjectType = (id: string | null): ObjectType | null => {
    if (!id || !schema) return null;
    if (schema.tables.some((t) => t.id === id)) return "tables";
    if (schema.views.some((v) => v.id === id)) return "views";
    if (schema.triggers.some((t) => t.id === id)) return "triggers";
    if (schema.storedProcedures.some((p) => p.id === id))
      return "storedProcedures";
    if (schema.scalarFunctions.some((f) => f.id === id))
      return "scalarFunctions";
    return null;
  };

  const getObjectsLabel = () => {
    const hiddenCount = excludedObjectIds.size;
    const hasTypeFilter = !allObjectsSelected;
    if (!hasTypeFilter && hiddenCount === 0) return null;

    const typeLabel = (() => {
      if (!hasTypeFilter) return "";
      if (objectTypeFilter.size > 1 || objectTypeFilter.size === 0) {
        return `${objectTypeFilter.size} types`;
      }
      const type = Array.from(objectTypeFilter)[0];
      return OBJECT_TYPE_LABELS[type];
    })();

    const hiddenLabel = hiddenCount > 0 ? `${hiddenCount} hidden` : "";
    if (typeLabel && hiddenLabel) {
      return `${typeLabel}, ${hiddenLabel}`;
    }
    return typeLabel || hiddenLabel;
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
  const focusedType = getObjectType(focusedTableId);

  // Browse mode: the selection roots take the place of the dim-focus chip.
  const isBrowseView = viewMode === "browse";
  const rootList = isBrowseView ? [...focusRoots] : [];
  const browseValue =
    rootList.length === 1 ? rootList[0] : `${rootList.length} objects`;
  const browseRootTypes = [
    ...new Set(
      rootList
        .map((id) => getObjectType(id))
        .filter((type): type is ObjectType => type !== null)
    ),
  ];
  const browseColors =
    browseRootTypes.length > 0
      ? browseRootTypes.map((type) => OBJECT_COLORS[type])
      : [OBJECT_COLORS.tables];

  const hasActiveFilters =
    focusedTableId || rootList.length > 0 || objectsLabel || edgesLabel;

  if (!hasActiveFilters) return null;

  return (
    <div className="absolute top-16 right-3 z-20 flex flex-col items-end gap-2">
      {focusedTableId && focusedType && (
        <FilterBox
          label="Focus"
          value={focusedTableId}
          colors={[OBJECT_COLORS[focusedType]]}
          borderMode="full-border"
          onClear={clearFocus}
        />
      )}
      {rootList.length > 0 && (
        <FilterBox
          label="Focus"
          value={browseValue}
          colors={browseColors}
          borderMode="full-border"
          onClear={clearFocusRoots}
        />
      )}
      {objectsLabel && (
        <FilterBox
          label="Objects"
          value={objectsLabel}
          colors={getObjectColors()}
          onClear={resetObjectFilters}
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
      ? { borderColor: withAlpha(colors[0], 30) }
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
      className="panel-glass flex items-center gap-2 rounded-md px-3 py-1.5 text-xs"
      style={borderStyle}
    >
      <span className="text-muted-foreground">{label}:</span>
      <span
        className="font-medium"
        style={textColor ? { color: textColor } : undefined}
      >
        {value}
      </span>
      <button
        onClick={onClear}
        className="ml-1 rounded-sm p-0.5 transition-colors duration-[var(--duration-fast)] hover:bg-muted active:scale-[0.97]"
        aria-label={`Clear ${label.toLowerCase()} filter`}
      >
        <X className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    </div>
  );
}

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSchemaStore } from "@/features/schema-graph/store";
import { useShallow } from "zustand/shallow";
import { useToastStore } from "@/features/notifications/store";
import type { Column } from "@/features/schema-graph/types";
import type { EdgeType } from "@/features/schema-graph/store";
import { getAllowedEdgeKinds, getNodeKind } from "@/features/canvas/utils/edge-kinds";

interface EdgeEditState {
  id: string;
  edgeType: EdgeType;
  sourceId: string;
  targetId: string;
  sourceColumn?: string;
  targetColumn?: string;
}

interface CreateEdgeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialFrom?: string;
  initialTo?: string;
  initialFromColumn?: string;
  initialToColumn?: string;
  initialEdgeType?: EdgeType;
  editEdge?: EdgeEditState | null;
}

const EDGE_TYPE_LABELS: Record<EdgeType, string> = {
  relationships: "Relationship",
  triggerDependencies: "Trigger Dependency",
  triggerWrites: "Trigger Write",
  procedureReads: "Procedure Read",
  procedureWrites: "Procedure Write",
  viewDependencies: "View Dependency",
  functionReads: "Function Read",
};

function getColumnsForObject(
  schema: ReturnType<typeof useSchemaStore.getState>["schema"],
  objectId: string
): { name: string; dataType: string }[] {
  if (!schema) return [];
  const table = schema.tables.find((t) => t.id === objectId);
  if (table) return table.columns;
  const view = schema.views.find((v) => v.id === objectId);
  if (view) return view.columns;
  return [];
}

export function CreateEdgeDialog({
  open,
  onOpenChange,
  initialFrom,
  initialTo,
  initialFromColumn,
  initialToColumn,
  initialEdgeType,
  editEdge,
}: CreateEdgeDialogProps) {
  const {
    schema,
    addRelationship,
    updateRelationship,
    addProcedureReference,
    removeProcedureReference,
    addTriggerReference,
    removeTriggerReference,
    setTriggerParent,
    addFunctionReference,
    removeFunctionReference,
    updateView,
    setViewColumnSource,
    removeViewColumnSource,
  } = useSchemaStore(
    useShallow((state) => ({
      schema: state.schema,
      addRelationship: state.addRelationship,
      updateRelationship: state.updateRelationship,
      addProcedureReference: state.addProcedureReference,
      removeProcedureReference: state.removeProcedureReference,
      addTriggerReference: state.addTriggerReference,
      removeTriggerReference: state.removeTriggerReference,
      setTriggerParent: state.setTriggerParent,
      addFunctionReference: state.addFunctionReference,
      removeFunctionReference: state.removeFunctionReference,
      updateView: state.updateView,
      setViewColumnSource: state.setViewColumnSource,
      removeViewColumnSource: state.removeViewColumnSource,
    }))
  );
  const { addToast } = useToastStore();

  const [fromObject, setFromObject] = useState("");
  const [fromColumn, setFromColumn] = useState("");
  const [toObject, setToObject] = useState("");
  const [toColumn, setToColumn] = useState("");
  const [edgeType, setEdgeType] = useState<EdgeType | "">("");

  const isEdit = Boolean(editEdge);

  useEffect(() => {
    if (!open) return;

    if (editEdge) {
      setFromObject(editEdge.sourceId);
      setFromColumn(editEdge.sourceColumn ?? "");
      setToObject(editEdge.targetId);
      setToColumn(editEdge.targetColumn ?? "");
      setEdgeType(editEdge.edgeType);
      return;
    }

    setFromObject(initialFrom ?? "");
    setFromColumn(initialFromColumn ?? "");
    setToObject(initialTo ?? "");
    setToColumn(initialToColumn ?? "");
    setEdgeType(initialEdgeType ?? "");
  }, [
    open,
    editEdge,
    initialFrom,
    initialTo,
    initialFromColumn,
    initialToColumn,
    initialEdgeType,
  ]);

  const objectOptions: ComboboxOption[] = useMemo(() => {
    if (!schema) return [];
    const options: ComboboxOption[] = [];
    schema.tables.forEach((t) =>
      options.push({ value: t.id, label: t.name, description: `Table - ${t.schema}` })
    );
    schema.views.forEach((v) =>
      options.push({ value: v.id, label: v.name, description: `View - ${v.schema}` })
    );
    (schema.triggers || []).forEach((t) =>
      options.push({ value: t.id, label: t.name, description: `Trigger - ${t.schema}` })
    );
    (schema.storedProcedures || []).forEach((p) =>
      options.push({ value: p.id, label: p.name, description: `Procedure - ${p.schema}` })
    );
    (schema.scalarFunctions || []).forEach((f) =>
      options.push({ value: f.id, label: f.name, description: `Function - ${f.schema}` })
    );
    return options;
  }, [schema]);

  const allowedEdgeTypes = useMemo(() => {
    if (!schema || !fromObject || !toObject) return [];
    return getAllowedEdgeKinds(schema, fromObject, toObject);
  }, [schema, fromObject, toObject]);

  useEffect(() => {
    if (!open) return;
    if (edgeType && allowedEdgeTypes.includes(edgeType)) return;
    if (allowedEdgeTypes.length === 1) {
      setEdgeType(allowedEdgeTypes[0]);
    } else if (allowedEdgeTypes.length === 0) {
      setEdgeType("");
    }
  }, [open, edgeType, allowedEdgeTypes]);

  const fromColumns = useMemo(
    () => getColumnsForObject(schema, fromObject),
    [schema, fromObject]
  );

  const toColumns = useMemo(
    () => getColumnsForObject(schema, toObject),
    [schema, toObject]
  );

  const fromColumnOptions: ComboboxOption[] = useMemo(
    () => fromColumns.map((c) => ({ value: c.name, label: c.name, description: c.dataType })),
    [fromColumns]
  );

  const toColumnOptions: ComboboxOption[] = useMemo(
    () => toColumns.map((c) => ({ value: c.name, label: c.name, description: c.dataType })),
    [toColumns]
  );

  const fromHasColumns = fromColumns.length > 0;
  const toHasColumns = toColumns.length > 0;

  const isRelationship = edgeType === "relationships";
  const isViewDependency = edgeType === "viewDependencies";

  const requiresFromColumn = isRelationship || isViewDependency;
  const requiresToColumn = isRelationship;

  const isValid =
    Boolean(fromObject && toObject && edgeType) &&
    (!requiresFromColumn || !fromHasColumns || Boolean(fromColumn)) &&
    (!requiresToColumn || !toHasColumns || Boolean(toColumn));

  const findColumn = (
    objectId: string,
    columnName: string
  ): Column | undefined => {
    if (!schema || !columnName) return undefined;
    const table = schema.tables.find((t) => t.id === objectId);
    if (table) return table.columns.find((c) => c.name === columnName);
    const view = schema.views.find((v) => v.id === objectId);
    if (view) return view.columns.find((c) => c.name === columnName);
    return undefined;
  };

  const ensureViewColumn = (
    viewId: string,
    sourceObjectId: string,
    sourceColumnName: string,
    preferredName?: string
  ) => {
    if (!schema || !sourceColumnName) return undefined;
    const view = schema.views.find((v) => v.id === viewId);
    if (!view) return undefined;

    if (preferredName) {
      const existing = view.columns.find((c) => c.name === preferredName);
      if (existing) return existing.name;
    }

    const existing = view.columns.find((c) => c.name === sourceColumnName);
    if (existing && !preferredName) return existing.name;

    const sourceColumn = findColumn(sourceObjectId, sourceColumnName);
    if (!sourceColumn) return undefined;

    const usedNames = new Set(view.columns.map((c) => c.name));
    let candidate = preferredName ?? sourceColumnName;
    let suffix = 1;
    while (usedNames.has(candidate)) {
      candidate = `${preferredName ?? sourceColumnName}_${suffix}`;
      suffix += 1;
    }

    const nextColumns: Column[] = [
      ...view.columns,
      {
        name: candidate,
        dataType: sourceColumn.dataType,
        isNullable: sourceColumn.isNullable,
        isPrimaryKey: false,
        sourceColumns: [{ table: sourceObjectId, column: sourceColumn.name }],
        sourceTable: sourceObjectId,
        sourceColumn: sourceColumn.name,
      },
    ];

    updateView(viewId, {
      name: view.name,
      schema: view.schema,
      columns: nextColumns,
      definition: view.definition || undefined,
    });

    return candidate;
  };

  const handleFromObjectChange = (value: string) => {
    setFromObject(value);
    if (value !== fromObject) {
      const cols = getColumnsForObject(schema, value);
      if (!cols.some((c) => c.name === fromColumn)) {
        setFromColumn("");
      }
    }
  };

  const handleToObjectChange = (value: string) => {
    setToObject(value);
    if (value !== toObject) {
      const cols = getColumnsForObject(schema, value);
      if (!cols.some((c) => c.name === toColumn)) {
        setToColumn("");
      }
    }
  };

  const clearEditEdge = () => {
    if (!editEdge) return;
    switch (editEdge.edgeType) {
      case "relationships":
        break;
      case "procedureReads":
        removeProcedureReference(editEdge.targetId, editEdge.sourceId, "reads");
        break;
      case "procedureWrites":
        removeProcedureReference(editEdge.sourceId, editEdge.targetId, "writes");
        break;
      case "functionReads":
        removeFunctionReference(editEdge.targetId, editEdge.sourceId);
        break;
      case "triggerWrites":
        removeTriggerReference(editEdge.sourceId, editEdge.targetId, "writes");
        break;
      case "triggerDependencies": {
        const targetKind = schema ? getNodeKind(schema, editEdge.targetId) : "unknown";
        if (targetKind === "trigger") {
          break;
        }
        removeTriggerReference(editEdge.sourceId, editEdge.targetId, "reads");
        break;
      }
      case "viewDependencies":
        if (editEdge.targetColumn && editEdge.sourceColumn) {
          removeViewColumnSource(
            editEdge.targetId,
            editEdge.targetColumn,
            editEdge.sourceId,
            editEdge.sourceColumn
          );
        }
        break;
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!schema || !isValid || !edgeType) return;

    const targetKind = getNodeKind(schema, toObject);

    const resolvedFromColumn = fromColumn;
    let resolvedToColumn = toColumn;

    if (edgeType === "viewDependencies") {
      if (fromHasColumns && !resolvedFromColumn) {
        addToast({
          type: "error",
          title: "Missing source column",
          message: "Select a source column for the view dependency.",
          duration: 3000,
        });
        return;
      }

      if (targetKind !== "view") {
        addToast({
          type: "error",
          title: "Invalid target",
          message: "View dependencies must target a view.",
          duration: 3000,
        });
        return;
      }

      if (!resolvedToColumn && resolvedFromColumn) {
        const created = ensureViewColumn(
          toObject,
          fromObject,
          resolvedFromColumn,
          toColumn || undefined
        );
        if (created) {
          resolvedToColumn = created;
        }
      }
    }

    if (editEdge && edgeType === "relationships") {
      const result = updateRelationship(
        editEdge.id,
        fromObject,
        toObject,
        resolvedFromColumn || undefined,
        resolvedToColumn || undefined
      );
      if (!result) {
        addToast({
          type: "error",
          title: "Relationship already exists",
          message: "A relationship with these endpoints already exists.",
          duration: 3000,
        });
        return;
      }
      onOpenChange(false);
      return;
    }

    if (editEdge) {
      clearEditEdge();
    }

    let ok = true;

    switch (edgeType) {
      case "relationships": {
        const result = addRelationship(
          fromObject,
          toObject,
          resolvedFromColumn || undefined,
          resolvedToColumn || undefined
        );
        ok = Boolean(result);
        break;
      }
      case "procedureReads":
        ok = addProcedureReference(toObject, fromObject, "reads");
        break;
      case "procedureWrites":
        ok = addProcedureReference(fromObject, toObject, "writes");
        break;
      case "functionReads":
        ok = addFunctionReference(toObject, fromObject);
        break;
      case "triggerWrites":
        ok = addTriggerReference(fromObject, toObject, "writes");
        break;
      case "triggerDependencies":
        if (targetKind === "trigger") {
          ok = setTriggerParent(toObject, fromObject);
        } else {
          ok = addTriggerReference(fromObject, toObject, "reads");
        }
        break;
      case "viewDependencies":
        if (!resolvedFromColumn) {
          ok = false;
          break;
        }
        if (!resolvedToColumn) {
          ok = false;
          break;
        }
        ok = setViewColumnSource(toObject, resolvedToColumn, fromObject, resolvedFromColumn);
        break;
    }

    if (!ok) {
      addToast({
        type: "error",
        title: "Edge already exists",
        message: "This edge already exists or is invalid.",
        duration: 3000,
      });
      return;
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl overflow-visible p-0">
        <form onSubmit={handleSubmit} className="flex max-h-[85vh] flex-col">
          <div
            className="flex-1 overflow-y-auto p-6 space-y-4"
            data-combobox-scroll
          >
            <DialogHeader>
              <DialogTitle>{isEdit ? "Edit Edge" : "Add Edge"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="from-object">Source</Label>
                <Combobox
                  id="from-object"
                  options={objectOptions}
                  value={fromObject}
                  onValueChange={handleFromObjectChange}
                  placeholder="Select source..."
                />
              </div>
              {(isRelationship || isViewDependency) && fromHasColumns && (
                <div className="space-y-1">
                  <Label htmlFor="from-column">Source Column</Label>
                  <Combobox
                    id="from-column"
                    options={fromColumnOptions}
                    value={fromColumn}
                    onValueChange={setFromColumn}
                    placeholder="Select source column..."
                    disabled={!fromObject}
                  />
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="to-object">Target</Label>
                <Combobox
                  id="to-object"
                  options={objectOptions}
                  value={toObject}
                  onValueChange={handleToObjectChange}
                  placeholder="Select target..."
                />
              </div>
              {(isRelationship || isViewDependency) && toHasColumns && (
                <div className="space-y-1">
                  <Label htmlFor="to-column">
                    Target Column {isViewDependency && "(optional)"}
                  </Label>
                  <Combobox
                    id="to-column"
                    options={toColumnOptions}
                    value={toColumn}
                    onValueChange={setToColumn}
                    placeholder={
                      isViewDependency
                        ? "Select target column (optional)..."
                        : "Select target column..."
                    }
                    disabled={!toObject}
                  />
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="edge-type">Edge Type</Label>
              <Select
                value={edgeType}
                onValueChange={(value) => setEdgeType(value as EdgeType)}
                disabled={allowedEdgeTypes.length <= 1}
              >
                <SelectTrigger id="edge-type">
                  <SelectValue placeholder="Select edge type..." />
                </SelectTrigger>
                <SelectContent>
                  {allowedEdgeTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {EDGE_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="border-t bg-background px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid}>
              {isEdit ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

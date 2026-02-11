import { useState, useEffect, useMemo, useRef, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ColumnEditor } from "./column-editor";
import { SqlEditor } from "./sql-editor";
import { useSchemaStore } from "@/features/schema-graph/store";
import { useShallow } from "zustand/shallow";
import type { Column } from "@/features/schema-graph/types";
import type { CreateViewInput } from "../types";
import { useToastStore } from "@/features/notifications/store";
import { generateViewDefinition } from "@/features/canvas/utils/sql-definition";

interface CreateViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editId?: string | null;
  position?: { x: number; y: number };
}

export function CreateViewDialog({
  open,
  onOpenChange,
  editId,
  position,
}: CreateViewDialogProps) {
  const { schema, addView, updateView } = useSchemaStore(
    useShallow((state) => ({
      schema: state.schema,
      addView: state.addView,
      updateView: state.updateView,
    }))
  );
  const { addToast } = useToastStore();

  const [name, setName] = useState("");
  const [schemaName, setSchemaName] = useState("dbo");
  const [columns, setColumns] = useState<Column[]>([]);
  const [definition, setDefinition] = useState("");
  const [definitionMode, setDefinitionMode] = useState<"auto" | "manual">(
    "auto"
  );
  const nameInputRef = useRef<HTMLInputElement>(null);

  const isEdit = Boolean(editId);

  const buildDefinition = (
    nextColumns: Column[],
    nextName: string,
    nextSchema: string
  ) =>
    generateViewDefinition({
      name: nextName,
      schema: nextSchema,
      columns: nextColumns,
    });

  const autoDefinition = useMemo(
    () => buildDefinition(columns, name, schemaName),
    [columns, name, schemaName]
  );

  useEffect(() => {
    if (!open) return;

    if (editId && schema) {
      const view = schema.views.find((v) => v.id === editId);
      if (view) {
        setName(view.name);
        setSchemaName(view.schema);
        setColumns([...view.columns]);
        setDefinition(view.definition);
        const autoDefinition = buildDefinition(
          view.columns,
          view.name,
          view.schema
        );
        setDefinitionMode(
          view.definition.trim() === "" || view.definition === autoDefinition
            ? "auto"
            : "manual"
        );
        return;
      }
    }
    setName("");
    setSchemaName("dbo");
    setColumns([]);
    setDefinition("");
    setDefinitionMode("auto");
  }, [open, editId, schema]);

  const handleColumnsChange = (nextColumns: Column[]) => {
    setColumns(nextColumns);
    setDefinitionMode("auto");
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const resolvedDefinition =
      definitionMode === "auto" ? autoDefinition : definition;

    const input: CreateViewInput = {
      name: name.trim(),
      schema: schemaName.trim() || "dbo",
      columns: columns.filter((c) => c.name.trim()),
      definition: resolvedDefinition || undefined,
    };

    const result = isEdit && editId
      ? updateView(editId, input)
      : addView(input, position);

    if (!result) {
      addToast({
        type: "error",
        title: "View already exists",
        message: `${input.schema}.${input.name} already exists.`,
        duration: 3000,
      });
      return;
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-5xl overflow-visible p-0"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          nameInputRef.current?.focus();
        }}
      >
        <div
          className="max-h-[85vh] overflow-y-auto p-6 space-y-4"
          data-combobox-scroll
        >
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit View" : "Add View"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="view-schema">Schema</Label>
                    <Input
                      id="view-schema"
                      value={schemaName}
                      onChange={(e) => setSchemaName(e.target.value)}
                      placeholder="dbo"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="view-name">Name</Label>
                    <Input
                      id="view-name"
                      ref={nameInputRef}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="ViewName"
                      required
                    />
                  </div>
                </div>

                <ColumnEditor
                  columns={columns}
                  onChange={handleColumnsChange}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="view-definition">
                  SQL Definition (optional)
                </Label>
                <SqlEditor
                  id="view-definition"
                  value={definitionMode === "auto" ? autoDefinition : definition}
                  onChange={(value) => {
                    setDefinition(value);
                    setDefinitionMode("manual");
                  }}
                  placeholder="SELECT ..."
                  height="360px"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!name.trim()}>
                {isEdit ? "Save" : "Add View"}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

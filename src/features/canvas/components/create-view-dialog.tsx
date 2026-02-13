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
import {
  CANVAS_OBJECT_DIALOG_CONTENT_CLASS,
  CANVAS_OBJECT_DIALOG_FIXED_SECTION_CLASS,
  CANVAS_OBJECT_DIALOG_FORM_CLASS,
  CANVAS_OBJECT_DIALOG_LEFT_COLUMN_CLASS,
  CANVAS_OBJECT_DIALOG_SCROLL_SECTION_CLASS,
  CANVAS_OBJECT_DIALOG_SQL_EDITOR_FILL_HEIGHT,
  CANVAS_OBJECT_DIALOG_SQL_SECTION_CLASS,
  CANVAS_OBJECT_DIALOG_TWO_COLUMN_BODY_CLASS,
} from "./object-dialog-layout";
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
        className={CANVAS_OBJECT_DIALOG_CONTENT_CLASS}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          nameInputRef.current?.focus();
        }}
      >
        <form onSubmit={handleSubmit} className={CANVAS_OBJECT_DIALOG_FORM_CLASS}>
          <div className={CANVAS_OBJECT_DIALOG_TWO_COLUMN_BODY_CLASS}>
            <div className={CANVAS_OBJECT_DIALOG_LEFT_COLUMN_CLASS}>
              <div className={CANVAS_OBJECT_DIALOG_FIXED_SECTION_CLASS}>
                <DialogHeader>
                  <DialogTitle>{isEdit ? "Edit View" : "Add View"}</DialogTitle>
                </DialogHeader>
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
              </div>

              <div
                className={CANVAS_OBJECT_DIALOG_SCROLL_SECTION_CLASS}
                data-combobox-scroll
              >
                <ColumnEditor columns={columns} onChange={handleColumnsChange} />
              </div>
            </div>

            <div className={CANVAS_OBJECT_DIALOG_SQL_SECTION_CLASS}>
              <Label htmlFor="view-definition">SQL Definition (optional)</Label>
              <div className="min-h-0 flex-1">
                <SqlEditor
                  id="view-definition"
                  value={definitionMode === "auto" ? autoDefinition : definition}
                  onChange={(value) => {
                    setDefinition(value);
                    setDefinitionMode("manual");
                  }}
                  placeholder="SELECT ..."
                  height={CANVAS_OBJECT_DIALOG_SQL_EDITOR_FILL_HEIGHT}
                />
              </div>
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
            <Button type="submit" disabled={!name.trim()}>
              {isEdit ? "Save" : "Add View"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

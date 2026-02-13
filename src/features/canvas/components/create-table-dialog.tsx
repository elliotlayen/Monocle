import { useState, useEffect, useRef, type FormEvent } from "react";
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
import {
  CANVAS_OBJECT_DIALOG_BODY_CLASS,
  CANVAS_OBJECT_DIALOG_CONTENT_CLASS,
  CANVAS_OBJECT_DIALOG_FIXED_SECTION_CLASS,
  CANVAS_OBJECT_DIALOG_FORM_CLASS,
  CANVAS_OBJECT_DIALOG_SCROLL_SECTION_CLASS,
} from "./object-dialog-layout";
import { useSchemaStore } from "@/features/schema-graph/store";
import { useShallow } from "zustand/shallow";
import type { Column } from "@/features/schema-graph/types";
import type { CreateTableInput } from "../types";
import { useToastStore } from "@/features/notifications/store";

interface CreateTableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editId?: string | null;
  position?: { x: number; y: number };
}

export function CreateTableDialog({
  open,
  onOpenChange,
  editId,
  position,
}: CreateTableDialogProps) {
  const { schema, addTable, updateTable } = useSchemaStore(
    useShallow((state) => ({
      schema: state.schema,
      addTable: state.addTable,
      updateTable: state.updateTable,
    }))
  );
  const { addToast } = useToastStore();

  const [name, setName] = useState("");
  const [schemaName, setSchemaName] = useState("dbo");
  const [columns, setColumns] = useState<Column[]>([]);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const isEdit = Boolean(editId);

  useEffect(() => {
    if (!open) return;

    if (editId && schema) {
      const table = schema.tables.find((t) => t.id === editId);
      if (table) {
        setName(table.name);
        setSchemaName(table.schema);
        setColumns([...table.columns]);
        return;
      }
    }
    setName("");
    setSchemaName("dbo");
    setColumns([]);
  }, [open, editId, schema]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const input: CreateTableInput = {
      name: name.trim(),
      schema: schemaName.trim() || "dbo",
      columns: columns.filter((c) => c.name.trim()),
    };

    const result = isEdit && editId
      ? updateTable(editId, input)
      : addTable(input, position);

    if (!result) {
      addToast({
        type: "error",
        title: "Table already exists",
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
          <div className={CANVAS_OBJECT_DIALOG_BODY_CLASS}>
            <div className={CANVAS_OBJECT_DIALOG_FIXED_SECTION_CLASS}>
              <DialogHeader>
                <DialogTitle>{isEdit ? "Edit Table" : "Add Table"}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="table-schema">Schema</Label>
                  <Input
                    id="table-schema"
                    value={schemaName}
                    onChange={(e) => setSchemaName(e.target.value)}
                    placeholder="dbo"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="table-name">Name</Label>
                  <Input
                    id="table-name"
                    ref={nameInputRef}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="TableName"
                    required
                  />
                </div>
              </div>
            </div>

            <div
              className={CANVAS_OBJECT_DIALOG_SCROLL_SECTION_CLASS}
              data-combobox-scroll
            >
              <ColumnEditor columns={columns} onChange={setColumns} />
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
              {isEdit ? "Save" : "Add Table"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

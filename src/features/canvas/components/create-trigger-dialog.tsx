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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import type { CreateTriggerInput } from "../types";
import { useToastStore } from "@/features/notifications/store";

interface CreateTriggerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editId?: string | null;
  position?: { x: number; y: number };
}

export function CreateTriggerDialog({
  open,
  onOpenChange,
  editId,
  position,
}: CreateTriggerDialogProps) {
  const { schema, addTrigger, updateTrigger } = useSchemaStore(
    useShallow((state) => ({
      schema: state.schema,
      addTrigger: state.addTrigger,
      updateTrigger: state.updateTrigger,
    }))
  );
  const { addToast } = useToastStore();

  const [name, setName] = useState("");
  const [schemaName, setSchemaName] = useState("dbo");
  const [tableId, setTableId] = useState("");
  const [triggerType, setTriggerType] = useState("AFTER");
  const [firesOnInsert, setFiresOnInsert] = useState(false);
  const [firesOnUpdate, setFiresOnUpdate] = useState(false);
  const [firesOnDelete, setFiresOnDelete] = useState(false);
  const [definition, setDefinition] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  const isEdit = Boolean(editId);
  const tables = schema?.tables ?? [];

  useEffect(() => {
    if (!open) return;

    if (editId && schema) {
      const trigger = schema.triggers.find((t) => t.id === editId);
      if (trigger) {
        setName(trigger.name);
        setSchemaName(trigger.schema);
        setTableId(trigger.tableId);
        setTriggerType(trigger.triggerType);
        setFiresOnInsert(trigger.firesOnInsert);
        setFiresOnUpdate(trigger.firesOnUpdate);
        setFiresOnDelete(trigger.firesOnDelete);
        setDefinition(trigger.definition);
        return;
      }
    }
    setName("");
    setSchemaName("dbo");
    setTableId(tables.length > 0 ? tables[0].id : "");
    setTriggerType("AFTER");
    setFiresOnInsert(false);
    setFiresOnUpdate(false);
    setFiresOnDelete(false);
    setDefinition("");
  }, [open, editId, schema, tables]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !tableId) return;

    const input: CreateTriggerInput = {
      name: name.trim(),
      schema: schemaName.trim() || "dbo",
      tableId,
      triggerType,
      firesOnInsert,
      firesOnUpdate,
      firesOnDelete,
      definition: definition || undefined,
    };

    const result = isEdit && editId
      ? updateTrigger(editId, input)
      : addTrigger(input, position);

    if (!result) {
      addToast({
        type: "error",
        title: "Trigger already exists",
        message: `${input.schema}.${input.tableId}.${input.name} already exists.`,
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
                  <DialogTitle>{isEdit ? "Edit Trigger" : "Add Trigger"}</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="trigger-schema">Schema</Label>
                    <Input
                      id="trigger-schema"
                      value={schemaName}
                      onChange={(e) => setSchemaName(e.target.value)}
                      placeholder="dbo"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="trigger-name">Name</Label>
                    <Input
                      id="trigger-name"
                      ref={nameInputRef}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="TriggerName"
                      required
                    />
                  </div>
                </div>
              </div>

              <div
                className={CANVAS_OBJECT_DIALOG_SCROLL_SECTION_CLASS}
                data-combobox-scroll
              >
                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label>Parent Table</Label>
                    <Select value={tableId} onValueChange={setTableId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a table" />
                      </SelectTrigger>
                      <SelectContent>
                        {tables.map((table) => (
                          <SelectItem key={table.id} value={table.id}>
                            {table.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label>Trigger Type</Label>
                    <Select value={triggerType} onValueChange={setTriggerType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AFTER">AFTER</SelectItem>
                        <SelectItem value="INSTEAD OF">INSTEAD OF</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Fires On</Label>
                    <div className="flex gap-4">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="fires-insert"
                          checked={firesOnInsert}
                          onCheckedChange={(c) => setFiresOnInsert(c === true)}
                        />
                        <Label htmlFor="fires-insert" className="text-sm font-normal">
                          Insert
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="fires-update"
                          checked={firesOnUpdate}
                          onCheckedChange={(c) => setFiresOnUpdate(c === true)}
                        />
                        <Label htmlFor="fires-update" className="text-sm font-normal">
                          Update
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="fires-delete"
                          checked={firesOnDelete}
                          onCheckedChange={(c) => setFiresOnDelete(c === true)}
                        />
                        <Label htmlFor="fires-delete" className="text-sm font-normal">
                          Delete
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className={CANVAS_OBJECT_DIALOG_SQL_SECTION_CLASS}>
              <Label htmlFor="trigger-definition">SQL Definition (optional)</Label>
              <div className="min-h-0 flex-1">
                <SqlEditor
                  id="trigger-definition"
                  value={definition}
                  onChange={setDefinition}
                  placeholder="BEGIN\n  -- SQL\nEND"
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
            <Button type="submit" disabled={!name.trim() || !tableId}>
              {isEdit ? "Save" : "Add Trigger"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

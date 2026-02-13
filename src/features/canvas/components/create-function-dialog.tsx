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
import { Combobox } from "@/components/ui/combobox";
import { ParameterEditor } from "./parameter-editor";
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
import type { ProcedureParameter } from "@/features/schema-graph/types";
import type { CreateFunctionInput } from "../types";
import { useToastStore } from "@/features/notifications/store";
import { generateFunctionDefinition } from "@/features/canvas/utils/sql-definition";

const RETURN_TYPES = [
  "int",
  "bigint",
  "bit",
  "varchar(255)",
  "nvarchar(max)",
  "datetime",
  "decimal",
  "float",
  "uniqueidentifier",
  "xml",
];

interface CreateFunctionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editId?: string | null;
  position?: { x: number; y: number };
}

export function CreateFunctionDialog({
  open,
  onOpenChange,
  editId,
  position,
}: CreateFunctionDialogProps) {
  const { schema, addScalarFunction, updateScalarFunction } = useSchemaStore(
    useShallow((state) => ({
      schema: state.schema,
      addScalarFunction: state.addScalarFunction,
      updateScalarFunction: state.updateScalarFunction,
    }))
  );
  const { addToast } = useToastStore();

  const [name, setName] = useState("");
  const [schemaName, setSchemaName] = useState("dbo");
  const [returnType, setReturnType] = useState("int");
  const [parameters, setParameters] = useState<ProcedureParameter[]>([]);
  const [definition, setDefinition] = useState("");
  const [definitionMode, setDefinitionMode] = useState<"auto" | "manual">(
    "auto"
  );
  const nameInputRef = useRef<HTMLInputElement>(null);

  const isEdit = Boolean(editId);

  const buildDefinition = (
    nextParameters: ProcedureParameter[],
    nextName: string,
    nextSchema: string,
    nextReturnType: string
  ) =>
    generateFunctionDefinition({
      name: nextName,
      schema: nextSchema,
      parameters: nextParameters,
      returnType: nextReturnType,
    });

  const autoDefinition = useMemo(
    () => buildDefinition(parameters, name, schemaName, returnType),
    [parameters, name, schemaName, returnType]
  );

  useEffect(() => {
    if (!open) return;

    if (editId && schema) {
      const fn = schema.scalarFunctions.find((f) => f.id === editId);
      if (fn) {
        setName(fn.name);
        setSchemaName(fn.schema);
        setReturnType(fn.returnType);
        setParameters([...fn.parameters]);
        setDefinition(fn.definition);
        const autoDefinition = buildDefinition(
          fn.parameters,
          fn.name,
          fn.schema,
          fn.returnType
        );
        setDefinitionMode(
          fn.definition.trim() === "" || fn.definition === autoDefinition
            ? "auto"
            : "manual"
        );
        return;
      }
    }
    setName("");
    setSchemaName("dbo");
    setReturnType("int");
    setParameters([]);
    setDefinition("");
    setDefinitionMode("auto");
  }, [open, editId, schema]);

  const handleParametersChange = (nextParameters: ProcedureParameter[]) => {
    setParameters(nextParameters);
    setDefinitionMode("auto");
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const resolvedDefinition =
      definitionMode === "auto" ? autoDefinition : definition;

    const input: CreateFunctionInput = {
      name: name.trim(),
      schema: schemaName.trim() || "dbo",
      parameters: parameters.filter((p) => p.name.trim()),
      returnType,
      definition: resolvedDefinition || undefined,
    };

    const result = isEdit && editId
      ? updateScalarFunction(editId, input)
      : addScalarFunction(input, position);

    if (!result) {
      addToast({
        type: "error",
        title: "Function already exists",
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
                  <DialogTitle>
                    {isEdit ? "Edit Scalar Function" : "Add Scalar Function"}
                  </DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="func-schema">Schema</Label>
                    <Input
                      id="func-schema"
                      value={schemaName}
                      onChange={(e) => setSchemaName(e.target.value)}
                      placeholder="dbo"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="func-name">Name</Label>
                    <Input
                      id="func-name"
                      ref={nameInputRef}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="FunctionName"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>Return Type</Label>
                  <Combobox
                    options={RETURN_TYPES.map((t) => ({ value: t, label: t }))}
                    value={returnType}
                    onValueChange={(value) => {
                      setReturnType(value);
                      setDefinitionMode("auto");
                    }}
                    placeholder="Return type"
                  />
                </div>
              </div>

              <div
                className={CANVAS_OBJECT_DIALOG_SCROLL_SECTION_CLASS}
                data-combobox-scroll
              >
                <ParameterEditor
                  parameters={parameters}
                  onChange={handleParametersChange}
                />
              </div>
            </div>

            <div className={CANVAS_OBJECT_DIALOG_SQL_SECTION_CLASS}>
              <Label htmlFor="func-definition">SQL Definition (optional)</Label>
              <div className="min-h-0 flex-1">
                <SqlEditor
                  id="func-definition"
                  value={definitionMode === "auto" ? autoDefinition : definition}
                  onChange={(value) => {
                    setDefinition(value);
                    setDefinitionMode("manual");
                  }}
                  placeholder="RETURNS int\nBEGIN\n  RETURN NULL\nEND"
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
              {isEdit ? "Save" : "Add Function"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

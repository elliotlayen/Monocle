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
            <DialogTitle>
              {isEdit ? "Edit Scalar Function" : "Add Scalar Function"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
              <div className="space-y-4">
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

                <ParameterEditor
                  parameters={parameters}
                  onChange={handleParametersChange}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="func-definition">
                  SQL Definition (optional)
                </Label>
                <SqlEditor
                  id="func-definition"
                  value={definitionMode === "auto" ? autoDefinition : definition}
                  onChange={(value) => {
                    setDefinition(value);
                    setDefinitionMode("manual");
                  }}
                  placeholder="RETURNS int\nBEGIN\n  RETURN NULL\nEND"
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
                {isEdit ? "Save" : "Add Function"}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

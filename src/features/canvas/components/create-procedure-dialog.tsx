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
import { ParameterEditor } from "./parameter-editor";
import { SqlEditor } from "./sql-editor";
import { useSchemaStore } from "@/features/schema-graph/store";
import { useShallow } from "zustand/shallow";
import type { ProcedureParameter } from "@/features/schema-graph/types";
import type { CreateProcedureInput } from "../types";
import { useToastStore } from "@/features/notifications/store";
import { generateProcedureDefinition } from "@/features/canvas/utils/sql-definition";

interface CreateProcedureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editId?: string | null;
  position?: { x: number; y: number };
}

export function CreateProcedureDialog({
  open,
  onOpenChange,
  editId,
  position,
}: CreateProcedureDialogProps) {
  const { schema, addStoredProcedure, updateStoredProcedure } = useSchemaStore(
    useShallow((state) => ({
      schema: state.schema,
      addStoredProcedure: state.addStoredProcedure,
      updateStoredProcedure: state.updateStoredProcedure,
    }))
  );
  const { addToast } = useToastStore();

  const [name, setName] = useState("");
  const [schemaName, setSchemaName] = useState("dbo");
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
    nextSchema: string
  ) =>
    generateProcedureDefinition({
      name: nextName,
      schema: nextSchema,
      parameters: nextParameters,
    });

  const autoDefinition = useMemo(
    () => buildDefinition(parameters, name, schemaName),
    [parameters, name, schemaName]
  );

  useEffect(() => {
    if (!open) return;

    if (editId && schema) {
      const proc = schema.storedProcedures.find((p) => p.id === editId);
      if (proc) {
        setName(proc.name);
        setSchemaName(proc.schema);
        setParameters([...proc.parameters]);
        setDefinition(proc.definition);
        const autoDefinition = buildDefinition(
          proc.parameters,
          proc.name,
          proc.schema
        );
        setDefinitionMode(
          proc.definition.trim() === "" || proc.definition === autoDefinition
            ? "auto"
            : "manual"
        );
        return;
      }
    }
    setName("");
    setSchemaName("dbo");
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

    const input: CreateProcedureInput = {
      name: name.trim(),
      schema: schemaName.trim() || "dbo",
      parameters: parameters.filter((p) => p.name.trim()),
      definition: resolvedDefinition || undefined,
    };

    const result = isEdit && editId
      ? updateStoredProcedure(editId, input)
      : addStoredProcedure(input, position);

    if (!result) {
      addToast({
        type: "error",
        title: "Procedure already exists",
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
              {isEdit ? "Edit Stored Procedure" : "Add Stored Procedure"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="proc-schema">Schema</Label>
                    <Input
                      id="proc-schema"
                      value={schemaName}
                      onChange={(e) => setSchemaName(e.target.value)}
                      placeholder="dbo"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="proc-name">Name</Label>
                    <Input
                      id="proc-name"
                      ref={nameInputRef}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="ProcedureName"
                      required
                    />
                  </div>
                </div>

                <ParameterEditor
                  parameters={parameters}
                  onChange={handleParametersChange}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="proc-definition">
                  SQL Definition (optional)
                </Label>
                <SqlEditor
                  id="proc-definition"
                  value={definitionMode === "auto" ? autoDefinition : definition}
                  onChange={(value) => {
                    setDefinition(value);
                    setDefinitionMode("manual");
                  }}
                  placeholder="BEGIN\n  -- SQL\nEND"
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
                {isEdit ? "Save" : "Add Procedure"}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

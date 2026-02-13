import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "@/components/ui/combobox";
import { Trash2, Plus } from "lucide-react";
import type { ProcedureParameter } from "@/features/schema-graph/types";

const COMMON_DATA_TYPES = [
  "int",
  "bigint",
  "varchar(255)",
  "nvarchar(255)",
  "nvarchar(max)",
  "datetime",
  "bit",
  "decimal",
  "uniqueidentifier",
  "float",
  "xml",
  "varbinary(max)",
];

interface ParameterEditorProps {
  parameters: ProcedureParameter[];
  onChange: (parameters: ProcedureParameter[]) => void;
}

export function ParameterEditor({
  parameters,
  onChange,
}: ParameterEditorProps) {
  const prevCountRef = useRef(parameters.length);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prevCount = prevCountRef.current;
    prevCountRef.current = parameters.length;

    if (parameters.length <= prevCount) return;

    const rafId = requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({ block: "end" });
    });

    return () => cancelAnimationFrame(rafId);
  }, [parameters.length]);

  const addParameter = () => {
    onChange([
      ...parameters,
      { name: "", dataType: "", isOutput: false },
    ]);
  };

  const updateParameter = (
    index: number,
    updates: Partial<ProcedureParameter>
  ) => {
    const next = parameters.map((param, i) =>
      i === index ? { ...param, ...updates } : param
    );
    onChange(next);
  };

  const removeParameter = (index: number) => {
    onChange(parameters.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2 px-1">
      <div className="text-sm font-medium">Parameters</div>
      {parameters.length > 0 && (
        <div className="grid grid-cols-[1fr_140px_50px_32px] gap-1 text-xs text-muted-foreground mb-1">
          <span>Name</span>
          <span>Type</span>
          <span className="text-center">Output</span>
          <span />
        </div>
      )}
      {parameters.map((param, index) => (
        <div
          key={index}
          className="grid grid-cols-[1fr_140px_50px_32px] gap-1 items-center"
        >
          <Input
            value={param.name}
            onChange={(e) => updateParameter(index, { name: e.target.value })}
            placeholder="@param_name"
            className="h-8 text-sm"
          />
          <Combobox
            options={COMMON_DATA_TYPES.map((t) => ({ value: t, label: t }))}
            value={param.dataType}
            onValueChange={(value) =>
              updateParameter(index, { dataType: value })
            }
            placeholder="Type"
          />
          <div className="flex justify-center">
            <Checkbox
              checked={param.isOutput}
              onCheckedChange={(checked) =>
                updateParameter(index, { isOutput: checked === true })
              }
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => removeParameter(index)}
          >
            <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        onClick={addParameter}
      >
        <Plus className="w-3.5 h-3.5 mr-1" />
        Add Parameter
      </Button>
      <div ref={endRef} />
    </div>
  );
}

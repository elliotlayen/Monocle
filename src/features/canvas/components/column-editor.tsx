import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "@/components/ui/combobox";
import { Trash2, Plus } from "lucide-react";
import type { Column } from "@/features/schema-graph/types";

const COMMON_DATA_TYPES = [
  "int",
  "bigint",
  "smallint",
  "tinyint",
  "bit",
  "decimal",
  "float",
  "real",
  "varchar(255)",
  "varchar(max)",
  "nvarchar(255)",
  "nvarchar(max)",
  "char(10)",
  "text",
  "ntext",
  "datetime",
  "datetime2",
  "date",
  "time",
  "uniqueidentifier",
  "varbinary(max)",
  "money",
  "xml",
];

interface ColumnEditorProps {
  columns: Column[];
  onChange: (columns: Column[]) => void;
}

export function ColumnEditor({ columns, onChange }: ColumnEditorProps) {
  const addColumn = () => {
    onChange([
      ...columns,
      { name: "", dataType: "", isPrimaryKey: false, isNullable: true },
    ]);
  };

  const updateColumn = (index: number, updates: Partial<Column>) => {
    const next = columns.map((col, i) =>
      i === index ? { ...col, ...updates } : col
    );
    onChange(next);
  };

  const removeColumn = (index: number) => {
    onChange(columns.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Columns</div>
      {columns.length > 0 && (
        <div className="grid grid-cols-[1fr_140px_40px_40px_32px] gap-1 text-xs text-muted-foreground mb-1">
          <span>Name</span>
          <span>Type</span>
          <span className="text-center">PK</span>
          <span className="text-center">Null</span>
          <span />
        </div>
      )}
      {columns.map((column, index) => (
        <div
          key={index}
          className="grid grid-cols-[1fr_140px_40px_40px_32px] gap-1 items-center"
        >
          <Input
            value={column.name}
            onChange={(e) => updateColumn(index, { name: e.target.value })}
            placeholder="column_name"
            className="h-8 text-sm"
          />
          <Combobox
            options={COMMON_DATA_TYPES.map((t) => ({ value: t, label: t }))}
            value={column.dataType}
            onValueChange={(value) => updateColumn(index, { dataType: value })}
            placeholder="Type"
          />
          <div className="flex justify-center">
            <Checkbox
              checked={column.isPrimaryKey}
              onCheckedChange={(checked) =>
                updateColumn(index, { isPrimaryKey: checked === true })
              }
            />
          </div>
          <div className="flex justify-center">
            <Checkbox
              checked={column.isNullable}
              onCheckedChange={(checked) =>
                updateColumn(index, { isNullable: checked === true })
              }
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => removeColumn(index)}
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
        onClick={addColumn}
      >
        <Plus className="w-3.5 h-3.5 mr-1" />
        Add Column
      </Button>
    </div>
  );
}

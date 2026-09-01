import {
  TableNode,
  ViewNode,
  Trigger,
  StoredProcedure,
  ScalarFunction,
  Column,
  ProcedureParameter,
} from "../types";
import { cn } from "@/lib/utils";
import { OBJECT_COLORS } from "@/constants/edge-colors";
import type { ObjectType } from "../store";
import { SqlCodeBlock } from "./sql-code-block";

export type DetailSidebarData =
  | { type: "table"; data: TableNode }
  | { type: "view"; data: ViewNode }
  | { type: "trigger"; data: Trigger }
  | { type: "storedProcedure"; data: StoredProcedure }
  | { type: "scalarFunction"; data: ScalarFunction };

export const DETAIL_OBJECT_TYPE: Record<DetailSidebarData["type"], ObjectType> =
  {
    table: "tables",
    view: "views",
    trigger: "triggers",
    storedProcedure: "storedProcedures",
    scalarFunction: "scalarFunctions",
  };

/** Pin-dot badge tinted from the object color tokens. */
export function TypeBadge({
  objectType,
  label,
}: {
  objectType: ObjectType;
  label: string;
}) {
  const color = OBJECT_COLORS[objectType];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
      style={{
        color,
        backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
      }}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

function PkGlyph() {
  return (
    <span className="shrink-0 text-[8px] font-bold tracking-wide text-muted-foreground">
      PK
    </span>
  );
}

function NullableGlyph() {
  return (
    <span
      className="shrink-0 text-[8px] font-medium text-muted-foreground/70"
      title="Nullable"
    >
      N
    </span>
  );
}

export function getHeaderInfo(data: DetailSidebarData): {
  badge: React.ReactNode;
  schema: string;
  name: string;
  description: string;
} {
  switch (data.type) {
    case "table":
      return {
        badge: (
<TypeBadge objectType="tables" label="Table" />
        ),
        schema: data.data.schema,
        name: data.data.name,
        description: `${data.data.columns.length} column${data.data.columns.length !== 1 ? "s" : ""}`,
      };
    case "view":
      return {
        badge: (
<TypeBadge objectType="views" label="View" />
        ),
        schema: data.data.schema,
        name: data.data.name,
        description: `${data.data.columns.length} column${data.data.columns.length !== 1 ? "s" : ""}`,
      };
    case "trigger": {
      const trigger = data.data;
      return {
        badge: (
<TypeBadge objectType="triggers" label="Trigger" />
        ),
        schema: trigger.schema,
        name: trigger.name,
        description: `${trigger.triggerType} trigger on ${trigger.tableId}`,
      };
    }
    case "storedProcedure":
      return {
        badge: (
<TypeBadge objectType="storedProcedures" label="Procedure" />
        ),
        schema: data.data.schema,
        name: data.data.name,
        description: `${data.data.parameters.length} parameter${data.data.parameters.length !== 1 ? "s" : ""}`,
      };
    case "scalarFunction":
      return {
        badge: (
<TypeBadge objectType="scalarFunctions" label="Function" />
        ),
        schema: data.data.schema,
        name: data.data.name,
        description: `Returns ${data.data.returnType}${data.data.parameters.length > 0 ? ` with ${data.data.parameters.length} parameter${data.data.parameters.length !== 1 ? "s" : ""}` : ""}`,
      };
  }
}

export function TableDetail({ table }: { table: TableNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Columns</h4>
        <div className="border rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted sticky top-0">
              <tr>
                <th className="px-2.5 py-1.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Name
                </th>
                <th className="px-2.5 py-1.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Type
                </th>
              </tr>
            </thead>
            <tbody>
              {table.columns.map((col: Column, idx: number) => (
                <tr
                  key={col.name}
                  className={cn(
                    idx % 2 === 0 ? "bg-background" : "bg-muted/50"
                  )}
                >
                  <td className="px-2.5 py-1.5 text-foreground">
                    <span className="flex items-center gap-2">
                      {col.name}
                      {col.isPrimaryKey && <PkGlyph />}
                    </span>
                  </td>
                  <td className="px-2.5 py-1.5 text-muted-foreground">
                    <span className="flex items-center gap-2">
                      {col.dataType}
                      {col.isNullable && <NullableGlyph />}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function ViewDetail({ view }: { view: ViewNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Columns</h4>
        <div className="border rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted sticky top-0">
              <tr>
                <th className="px-2.5 py-1.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Name
                </th>
                <th className="px-2.5 py-1.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Type
                </th>
                <th className="px-2.5 py-1.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Source
                </th>
              </tr>
            </thead>
            <tbody>
              {view.columns.map((col: Column, idx: number) => {
                const sources =
                  col.sourceColumns && col.sourceColumns.length > 0
                    ? col.sourceColumns
                    : col.sourceTable && col.sourceColumn
                      ? [{ table: col.sourceTable, column: col.sourceColumn }]
                      : [];

                return (
                  <tr
                    key={col.name}
                    className={cn(
                      idx % 2 === 0 ? "bg-background" : "bg-muted/50"
                    )}
                  >
                    <td className="px-2.5 py-1.5 text-foreground">
                      {col.name}
                    </td>
                    <td className="px-2.5 py-1.5 text-muted-foreground">
                      <span className="flex items-center gap-2">
                        {col.dataType}
                        {col.isNullable && <NullableGlyph />}
                      </span>
                    </td>
                    <td className="px-2.5 py-1.5 text-muted-foreground">
                      {sources.length > 0 ? (
                        <div className="flex flex-col gap-1 text-[11px]">
                          {sources.map((source, sourceIdx) => (
                            <span
                              key={`${col.name}-${source.table}-${source.column}-${sourceIdx}`}
                            >
                              {source.table}.{source.column}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground/50">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Definition</h4>
        <SqlCodeBlock code={view.definition} maxHeight="300px" />
      </div>
    </div>
  );
}

export function TriggerDetail({ trigger }: { trigger: Trigger }) {
  const events = [
    trigger.firesOnInsert && "INSERT",
    trigger.firesOnUpdate && "UPDATE",
    trigger.firesOnDelete && "DELETE",
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {events.map((event, idx) => (
          <span
            key={idx}
            className="rounded-sm px-2 py-0.5 text-[10px] font-bold"
            style={{
              color: OBJECT_COLORS.triggers,
              backgroundColor: `color-mix(in srgb, ${OBJECT_COLORS.triggers} 12%, transparent)`,
            }}
          >
            {event}
          </span>
        ))}
        {trigger.isDisabled && (
          <span className="rounded-sm bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
            Disabled
          </span>
        )}
      </div>

      <div>
        <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Definition</h4>
        <SqlCodeBlock code={trigger.definition} maxHeight="300px" />
      </div>
    </div>
  );
}

export function StoredProcedureDetail({
  procedure,
}: {
  procedure: StoredProcedure;
}) {
  const inputParams = procedure.parameters.filter((p) => !p.isOutput);
  const outputParams = procedure.parameters.filter((p) => p.isOutput);

  return (
    <div className="space-y-4">
      {procedure.parameters.length > 0 && (
        <div>
          <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Parameters</h4>
          <div className="border rounded-lg overflow-hidden overflow-x-auto">
            <table className="w-full min-w-max text-xs">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="px-2.5 py-1.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Name
                  </th>
                  <th className="px-2.5 py-1.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Type
                  </th>
                  <th className="px-2.5 py-1.5 text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Direction
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...inputParams, ...outputParams].map(
                  (param: ProcedureParameter, idx: number) => (
                    <tr
                      key={param.name}
                      className={cn(
                        idx % 2 === 0 ? "bg-background" : "bg-muted/50"
                      )}
                    >
                      <td className="px-2.5 py-1.5 text-foreground">
                        {param.name}
                      </td>
                      <td className="px-2.5 py-1.5 text-muted-foreground">
                        {param.dataType}
                      </td>
                      <td className="px-2.5 py-1.5 text-center">
                        {param.isOutput ? (
                          <span
                            className="rounded-sm px-2 py-0.5 text-[10px] font-bold"
                            style={{
                              color: OBJECT_COLORS.storedProcedures,
                              backgroundColor: `color-mix(in srgb, ${OBJECT_COLORS.storedProcedures} 12%, transparent)`,
                            }}
                          >
                            OUTPUT
                          </span>
                        ) : (
                          <span className="text-muted-foreground">INPUT</span>
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Definition</h4>
        <SqlCodeBlock code={procedure.definition} maxHeight="300px" />
      </div>
    </div>
  );
}

export function ScalarFunctionDetail({ fn }: { fn: ScalarFunction }) {
  return (
    <div className="space-y-4">
      {fn.parameters.length > 0 && (
        <div>
          <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Parameters</h4>
          <div className="border rounded-lg overflow-hidden overflow-x-auto">
            <table className="w-full min-w-max text-xs">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="px-2.5 py-1.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Name
                  </th>
                  <th className="px-2.5 py-1.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Type
                  </th>
                </tr>
              </thead>
              <tbody>
                {fn.parameters.map((param: ProcedureParameter, idx: number) => (
                  <tr
                    key={param.name}
                    className={cn(
                      idx % 2 === 0 ? "bg-background" : "bg-muted/50"
                    )}
                  >
                    <td className="px-2.5 py-1.5 text-foreground">
                      {param.name}
                    </td>
                    <td className="px-2.5 py-1.5 text-muted-foreground">
                      {param.dataType}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Definition</h4>
        <SqlCodeBlock code={fn.definition} maxHeight="300px" />
      </div>
    </div>
  );
}

export function DetailContent({ data }: { data: DetailSidebarData }) {
  switch (data.type) {
    case "table":
      return <TableDetail table={data.data} />;
    case "view":
      return <ViewDetail view={data.data} />;
    case "trigger":
      return <TriggerDetail trigger={data.data} />;
    case "storedProcedure":
      return <StoredProcedureDetail procedure={data.data} />;
    case "scalarFunction":
      return <ScalarFunctionDetail fn={data.data} />;
  }
}

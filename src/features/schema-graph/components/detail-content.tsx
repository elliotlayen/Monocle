import { TbCircleDashedLetterN } from "react-icons/tb";
import { IoMdKey } from "react-icons/io";
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
import { SqlCodeBlock } from "./sql-code-block";

export type DetailSidebarData =
  | { type: "table"; data: TableNode }
  | { type: "view"; data: ViewNode }
  | { type: "trigger"; data: Trigger }
  | { type: "storedProcedure"; data: StoredProcedure }
  | { type: "scalarFunction"; data: ScalarFunction };

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
          <span className="bg-muted text-muted-foreground text-xs px-2 py-1 rounded">
            Table
          </span>
        ),
        schema: data.data.schema,
        name: data.data.name,
        description: `${data.data.columns.length} column${data.data.columns.length !== 1 ? "s" : ""}`,
      };
    case "view":
      return {
        badge: (
          <span className="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs px-2 py-1 rounded">
            View
          </span>
        ),
        schema: data.data.schema,
        name: data.data.name,
        description: `${data.data.columns.length} column${data.data.columns.length !== 1 ? "s" : ""}`,
      };
    case "trigger": {
      const trigger = data.data;
      return {
        badge: (
          <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs px-2 py-1 rounded">
            Trigger
          </span>
        ),
        schema: trigger.schema,
        name: trigger.name,
        description: `${trigger.triggerType} trigger on ${trigger.tableId}`,
      };
    }
    case "storedProcedure":
      return {
        badge: (
          <span className="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 text-xs px-2 py-1 rounded">
            Stored Procedure
          </span>
        ),
        schema: data.data.schema,
        name: data.data.name,
        description: `${data.data.parameters.length} parameter${data.data.parameters.length !== 1 ? "s" : ""}`,
      };
    case "scalarFunction":
      return {
        badge: (
          <span className="bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400 text-xs px-2 py-1 rounded">
            Scalar Function
          </span>
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
        <h4 className="text-sm font-medium mb-2">Columns</h4>
        <div className="border rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                  Name
                </th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                  Type
                </th>
              </tr>
            </thead>
            <tbody>
              {table.columns.map((col: Column, idx: number) => (
                <tr
                  key={col.name}
                  className={cn(idx % 2 === 0 ? "bg-background" : "bg-muted/50")}
                >
                  <td className="px-3 py-2 font-mono text-foreground">
                    <span className="flex items-center gap-2">
                      {col.name}
                      {col.isPrimaryKey && (
                        <IoMdKey className="text-slate-400 w-3.5 h-3.5 shrink-0 -ml-1" />
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    <span className="flex items-center gap-2">
                      {col.dataType}
                      {col.isNullable && (
                        <TbCircleDashedLetterN className="text-amber-500 w-3.5 h-3.5 shrink-0 -ml-1" />
                      )}
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
        <h4 className="text-sm font-medium mb-2">Columns</h4>
        <div className="border rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                  Name
                </th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                  Type
                </th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                  Source
                </th>
              </tr>
            </thead>
            <tbody>
              {view.columns.map((col: Column, idx: number) => (
                <tr
                  key={col.name}
                  className={cn(idx % 2 === 0 ? "bg-background" : "bg-muted/50")}
                >
                  <td className="px-3 py-2 font-mono text-foreground">
                    {col.name}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    <span className="flex items-center gap-2">
                      {col.dataType}
                      {col.isNullable && (
                        <TbCircleDashedLetterN className="text-amber-500 w-3.5 h-3.5 shrink-0 -ml-1" />
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {col.sourceTable && col.sourceColumn ? (
                      <span className="font-mono text-xs">
                        {col.sourceTable}.{col.sourceColumn}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium mb-2">Definition</h4>
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
            className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-xs px-2 py-1 rounded"
          >
            {event}
          </span>
        ))}
        {trigger.isDisabled && (
          <span className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs px-2 py-1 rounded">
            Disabled
          </span>
        )}
      </div>

      <div>
        <h4 className="text-sm font-medium mb-2">Definition</h4>
        <SqlCodeBlock code={trigger.definition} maxHeight="300px" />
      </div>
    </div>
  );
}

export function StoredProcedureDetail({ procedure }: { procedure: StoredProcedure }) {
  const inputParams = procedure.parameters.filter((p) => !p.isOutput);
  const outputParams = procedure.parameters.filter((p) => p.isOutput);

  return (
    <div className="space-y-4">
      {procedure.parameters.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Parameters</h4>
          <div className="border rounded-lg overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-max">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                    Name
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                    Type
                  </th>
                  <th className="text-center px-3 py-2 font-medium text-muted-foreground">
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
                      <td className="px-3 py-2 font-mono text-foreground">
                        {param.name}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {param.dataType}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {param.isOutput ? (
                          <span className="bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400 text-xs px-2 py-1 rounded">
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
        <h4 className="text-sm font-medium mb-2">Definition</h4>
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
          <h4 className="text-sm font-medium mb-2">Parameters</h4>
          <div className="border rounded-lg overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-max">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                    Name
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">
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
                    <td className="px-3 py-2 font-mono text-foreground">
                      {param.name}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
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
        <h4 className="text-sm font-medium mb-2">Definition</h4>
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

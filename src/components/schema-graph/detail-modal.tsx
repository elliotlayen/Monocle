import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  TableNode,
  ViewNode,
  Trigger,
  StoredProcedure,
  ScalarFunction,
  Column,
  ProcedureParameter,
} from "@/types/schema";
import { cn } from "@/lib/utils";
import { SqlCodeBlock } from "./sql-code-block";

export type DetailModalData =
  | { type: "table"; data: TableNode }
  | { type: "view"; data: ViewNode }
  | { type: "trigger"; data: Trigger }
  | { type: "storedProcedure"; data: StoredProcedure }
  | { type: "scalarFunction"; data: ScalarFunction };

interface DetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modalData: DetailModalData | null;
}

export function DetailModal({
  open,
  onOpenChange,
  modalData,
}: DetailModalProps) {
  if (!modalData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[700px] h-[550px] flex flex-col resize min-w-[400px] min-h-[300px] max-w-[90vw] max-h-[90vh]">
        {modalData.type === "table" && (
          <TableDetail table={modalData.data} />
        )}
        {modalData.type === "view" && <ViewDetail view={modalData.data} />}
        {modalData.type === "trigger" && (
          <TriggerDetail trigger={modalData.data} />
        )}
        {modalData.type === "storedProcedure" && (
          <StoredProcedureDetail procedure={modalData.data} />
        )}
        {modalData.type === "scalarFunction" && (
          <ScalarFunctionDetail fn={modalData.data} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function TableDetail({ table }: { table: TableNode }) {
  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <span className="bg-muted text-muted-foreground text-xs px-2 py-1 rounded">
            Table
          </span>
          <span className="text-xs text-muted-foreground">{table.schema}</span>
        </div>
        <DialogTitle className="text-xl">{table.name}</DialogTitle>
        <DialogDescription>
          {table.columns.length} column{table.columns.length !== 1 && "s"}
        </DialogDescription>
      </DialogHeader>

      <div className="mt-4 flex-1 flex flex-col min-h-0">
        <h4 className="text-sm font-medium mb-2">Columns</h4>
        <div className="border rounded-lg overflow-hidden flex-1 min-h-0">
          <ScrollArea className="h-full">
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                    Name
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                    Type
                  </th>
                  <th className="text-center px-3 py-2 font-medium text-muted-foreground">
                    PK
                  </th>
                  <th className="text-center px-3 py-2 font-medium text-muted-foreground">
                    Nullable
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
                      {col.name}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{col.dataType}</td>
                    <td className="px-3 py-2 text-center">
                      {col.isPrimaryKey && (
                        <span className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-xs px-1.5 py-0.5 rounded">
                          PK
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {col.isNullable ? (
                        <span className="text-muted-foreground">Yes</span>
                      ) : (
                        <span className="text-foreground font-medium">No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        </div>
      </div>
    </>
  );
}

function ViewDetail({ view }: { view: ViewNode }) {
  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <span className="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs px-2 py-1 rounded">
            View
          </span>
          <span className="text-xs text-muted-foreground">{view.schema}</span>
        </div>
        <DialogTitle className="text-xl">{view.name}</DialogTitle>
        <DialogDescription>
          {view.columns.length} column{view.columns.length !== 1 && "s"}
        </DialogDescription>
      </DialogHeader>

      <div className="mt-4 flex-1 flex flex-col min-h-0">
        <h4 className="text-sm font-medium mb-2">Columns</h4>
        <div className="border rounded-lg overflow-hidden flex-1 min-h-0">
          <ScrollArea className="h-full">
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
                  <th className="text-center px-3 py-2 font-medium text-muted-foreground">
                    Nullable
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
                    <td className="px-3 py-2 text-muted-foreground">{col.dataType}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {col.sourceTable && col.sourceColumn ? (
                        <span className="font-mono text-xs">
                          {col.sourceTable}.{col.sourceColumn}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {col.isNullable ? (
                        <span className="text-muted-foreground">Yes</span>
                      ) : (
                        <span className="text-foreground font-medium">No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        </div>
      </div>
    </>
  );
}

function TriggerDetail({ trigger }: { trigger: Trigger }) {
  const events = [
    trigger.firesOnInsert && "INSERT",
    trigger.firesOnUpdate && "UPDATE",
    trigger.firesOnDelete && "DELETE",
  ].filter(Boolean);

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs px-2 py-1 rounded">
            Trigger
          </span>
          <span className="text-xs text-muted-foreground">{trigger.schema}</span>
          {trigger.isDisabled && (
            <span className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs px-2 py-1 rounded">
              Disabled
            </span>
          )}
        </div>
        <DialogTitle className="text-xl">{trigger.name}</DialogTitle>
        <DialogDescription>
          {trigger.triggerType} trigger on {trigger.tableId}
        </DialogDescription>
      </DialogHeader>

      <div className="mt-4 flex-1 flex flex-col min-h-0 space-y-4">
        <div className="flex gap-4 shrink-0">
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase mb-1">
              Type
            </h4>
            <span className="text-sm">{trigger.triggerType}</span>
          </div>
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase mb-1">
              Events
            </h4>
            <div className="flex gap-1">
              {events.map((event, idx) => (
                <span
                  key={idx}
                  className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-xs px-2 py-1 rounded"
                >
                  {event}
                </span>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase mb-1">
              Table
            </h4>
            <span className="text-sm font-mono">{trigger.tableId}</span>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <h4 className="text-sm font-medium mb-2 shrink-0">Definition</h4>
          <div className="flex-1 min-h-0">
            <SqlCodeBlock code={trigger.definition} maxHeight="100%" />
          </div>
        </div>
      </div>
    </>
  );
}

function StoredProcedureDetail({ procedure }: { procedure: StoredProcedure }) {
  const inputParams = procedure.parameters.filter((p) => !p.isOutput);
  const outputParams = procedure.parameters.filter((p) => p.isOutput);

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <span className="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 text-xs px-2 py-1 rounded">
            Stored Procedure
          </span>
          <span className="text-xs text-muted-foreground">{procedure.schema}</span>
        </div>
        <DialogTitle className="text-xl">{procedure.name}</DialogTitle>
        <DialogDescription>
          {procedure.parameters.length} parameter
          {procedure.parameters.length !== 1 && "s"}
        </DialogDescription>
      </DialogHeader>

      <div className="mt-4 flex-1 flex flex-col min-h-0 space-y-4">
        {procedure.parameters.length > 0 && (
          <div className="shrink-0">
            <h4 className="text-sm font-medium mb-2">Parameters</h4>
            <div className="border rounded-lg overflow-hidden max-h-[120px]">
              <ScrollArea className="h-full max-h-[120px]">
                <table className="w-full text-sm">
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
              </ScrollArea>
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col min-h-0">
          <h4 className="text-sm font-medium mb-2 shrink-0">Definition</h4>
          <div className="flex-1 min-h-0">
            <SqlCodeBlock code={procedure.definition} maxHeight="100%" />
          </div>
        </div>
      </div>
    </>
  );
}

function ScalarFunctionDetail({ fn }: { fn: ScalarFunction }) {
  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <span className="bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400 text-xs px-2 py-1 rounded">
            Scalar Function
          </span>
          <span className="text-xs text-muted-foreground">{fn.schema}</span>
        </div>
        <DialogTitle className="text-xl">{fn.name}</DialogTitle>
        <DialogDescription>
          Returns {fn.returnType}
          {fn.parameters.length > 0 &&
            ` with ${fn.parameters.length} parameter${fn.parameters.length !== 1 ? "s" : ""}`}
        </DialogDescription>
      </DialogHeader>

      <div className="mt-4 flex-1 flex flex-col min-h-0 space-y-4">
        {fn.parameters.length > 0 && (
          <div className="shrink-0">
            <h4 className="text-sm font-medium mb-2">Parameters</h4>
            <div className="border rounded-lg overflow-hidden max-h-[120px]">
              <ScrollArea className="h-full max-h-[120px]">
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
              </ScrollArea>
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col min-h-0">
          <h4 className="text-sm font-medium mb-2 shrink-0">Definition</h4>
          <div className="flex-1 min-h-0">
            <SqlCodeBlock code={fn.definition} maxHeight="100%" />
          </div>
        </div>
      </div>
    </>
  );
}

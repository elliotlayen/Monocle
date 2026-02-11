import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSchemaStore } from "@/features/schema-graph/store";
import { useShallow } from "zustand/shallow";
import { CreateTableDialog } from "./create-table-dialog";
import { CreateViewDialog } from "./create-view-dialog";
import { CreateTriggerDialog } from "./create-trigger-dialog";
import { CreateProcedureDialog } from "./create-procedure-dialog";
import { CreateFunctionDialog } from "./create-function-dialog";

interface AddObjectMenuProps {
  onImport?: () => void;
}

export function AddObjectMenu({ onImport }: AddObjectMenuProps) {
  const { schema } = useSchemaStore(
    useShallow((state) => ({ schema: state.schema }))
  );

  const [tableDialogOpen, setTableDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [triggerDialogOpen, setTriggerDialogOpen] = useState(false);
  const [procedureDialogOpen, setProcedureDialogOpen] = useState(false);
  const [functionDialogOpen, setFunctionDialogOpen] = useState(false);

  const hasTables = (schema?.tables.length ?? 0) > 0;

  return (
    <>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Add Object</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => setTableDialogOpen(true)}>
            Add Table
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setViewDialogOpen(true)}>
            Add View
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => setTriggerDialogOpen(true)}
            disabled={!hasTables}
          >
            Add Trigger
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setProcedureDialogOpen(true)}>
            Add Stored Procedure
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setFunctionDialogOpen(true)}>
            Add Scalar Function
          </DropdownMenuItem>
          {onImport && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onImport}>
                Import from Database...
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateTableDialog
        open={tableDialogOpen}
        onOpenChange={setTableDialogOpen}
      />
      <CreateViewDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
      />
      <CreateTriggerDialog
        open={triggerDialogOpen}
        onOpenChange={setTriggerDialogOpen}
      />
      <CreateProcedureDialog
        open={procedureDialogOpen}
        onOpenChange={setProcedureDialogOpen}
      />
      <CreateFunctionDialog
        open={functionDialogOpen}
        onOpenChange={setFunctionDialogOpen}
      />
    </>
  );
}

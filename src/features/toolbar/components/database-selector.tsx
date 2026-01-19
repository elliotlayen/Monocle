import { useState } from "react";
import { useSchemaStore } from "@/features/schema-graph/store";
import { useShallow } from "zustand/shallow";
import { Check, ChevronsUpDown, Database, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToastStore } from "@/features/notifications/store";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function DatabaseSelector() {
  const {
    availableDatabases,
    selectedDatabase,
    isDatabasesLoading,
    isLoading,
    selectDatabase,
  } = useSchemaStore(
    useShallow((state) => ({
      availableDatabases: state.availableDatabases,
      selectedDatabase: state.selectedDatabase,
      isDatabasesLoading: state.isDatabasesLoading,
      isLoading: state.isLoading,
      selectDatabase: state.selectDatabase,
    }))
  );

  const { addToast } = useToastStore();

  const [open, setOpen] = useState(false);

  const handleSelect = async (database: string) => {
    if (database === selectedDatabase) {
      setOpen(false);
      return;
    }
    setOpen(false);
    const success = await selectDatabase(database);
    if (success) {
      addToast({
        type: "success",
        title: "Database loaded",
        message: `Switched to ${database}`,
        duration: 3000,
      });
    } else {
      const { error, clearError } = useSchemaStore.getState();
      addToast({
        type: "error",
        title: "Failed to load database",
        message: error ?? `Unable to load ${database}.`,
        duration: 4000,
      });
      clearError();
    }
  };

  const isSelecting = isDatabasesLoading || isLoading;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[448px] justify-between"
          size="sm"
          disabled={isSelecting}
        >
          {/* Left: Database icon */}
          {isSelecting ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          ) : (
            <Database className="h-4 w-4 shrink-0" />
          )}

          {/* Center: Database name */}
          <span className="truncate">
            {isSelecting
              ? "Loading..."
              : selectedDatabase ?? "Select database..."}
          </span>

          {/* Right: Chevron icon */}
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[448px] p-0">
        <Command>
          <CommandInput placeholder="Search database..." />
          <CommandList>
            <CommandEmpty>No database found.</CommandEmpty>
            <CommandGroup>
              {availableDatabases.map((database) => (
                <CommandItem
                  key={database}
                  value={database}
                  onSelect={() => handleSelect(database)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedDatabase === database ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {database}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

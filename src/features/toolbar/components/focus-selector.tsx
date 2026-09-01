import { useMemo, useState } from "react";
import { useShallow } from "zustand/shallow";
import { Check, ChevronsUpDown, Crosshair, Expand, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
import { useSchemaStore, type ObjectType } from "@/features/schema-graph/store";
import { OBJECT_COLORS } from "@/constants/edge-colors";

import { OBJECT_TYPE_SINGULAR_LABELS } from "@/constants/object-type-meta";

const MAX_RESULTS = 50;

interface ObjectEntry {
  id: string;
  name: string;
  schema: string;
  type: ObjectType;
  searchText: string;
}

/**
 * Toolbar dropdown showing what the canvas is focused on. In browse mode it
 * manages the focus roots; in full view it manages the dim-focus highlight.
 */
export function FocusSelector() {
  const {
    schema,
    viewMode,
    focusRoots,
    focusedTableId,
    focusObject,
    removeFocusRoot,
    clearFocusRoots,
    clearFocus,
    showFullGraph,
    enterBrowseMode,
  } = useSchemaStore(
    useShallow((state) => ({
      schema: state.schema,
      viewMode: state.viewMode,
      focusRoots: state.focusRoots,
      focusedTableId: state.focusedTableId,
      focusObject: state.focusObject,
      removeFocusRoot: state.removeFocusRoot,
      clearFocusRoots: state.clearFocusRoots,
      clearFocus: state.clearFocus,
      showFullGraph: state.showFullGraph,
      enterBrowseMode: state.enterBrowseMode,
    }))
  );

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const entries = useMemo<ObjectEntry[]>(() => {
    if (!schema) return [];
    const make = (
      objects: { id: string; name: string; schema: string }[],
      type: ObjectType
    ): ObjectEntry[] =>
      objects.map((object) => ({
        id: object.id,
        name: object.name,
        schema: object.schema,
        type,
        searchText: `${object.id} ${object.name}`.toLowerCase(),
      }));
    return [
      ...make(schema.tables, "tables"),
      ...make(schema.views ?? [], "views"),
      ...make(schema.triggers ?? [], "triggers"),
      ...make(schema.storedProcedures ?? [], "storedProcedures"),
      ...make(schema.scalarFunctions ?? [], "scalarFunctions"),
    ];
  }, [schema]);

  const entryById = useMemo(
    () => new Map(entries.map((entry) => [entry.id, entry])),
    [entries]
  );

  const results = useMemo(() => {
    const lowerQuery = query.trim().toLowerCase();
    const pool = lowerQuery
      ? entries.filter((entry) => entry.searchText.includes(lowerQuery))
      : entries;
    return pool.slice(0, MAX_RESULTS);
  }, [entries, query]);

  const isBrowse = viewMode === "browse";
  const rootList = useMemo(() => [...focusRoots], [focusRoots]);

  const triggerLabel = isBrowse
    ? focusRoots.size === 0
      ? "No selection"
      : focusRoots.size === 1
        ? (entryById.get(rootList[0])?.name ?? rootList[0])
        : `${focusRoots.size} objects`
    : focusedTableId
      ? `Focus: ${entryById.get(focusedTableId)?.name ?? focusedTableId}`
      : "Full graph";

  const isSelected = (id: string) =>
    isBrowse ? focusRoots.has(id) : focusedTableId === id;

  const handleSelect = (id: string) => {
    focusObject(id);
    if (!isBrowse) {
      setOpen(false);
    }
  };

  if (!schema) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[220px] justify-between"
          size="sm"
          title="Focused objects"
        >
          <Crosshair className="h-4 w-4 shrink-0" />
          <span className="truncate flex-1 text-left">{triggerLabel}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search objects..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {isBrowse && focusRoots.size > 0 && (
              <CommandGroup heading="Selected">
                {rootList.map((id) => {
                  const entry = entryById.get(id);
                  return (
                    <CommandItem
                      key={`root-${id}`}
                      value={`root-${id}`}
                      onSelect={() => removeFocusRoot(id)}
                    >
                      <span
                        className="mr-2 h-2 w-2 shrink-0 rounded-full"
                        style={{
                          backgroundColor: entry
                            ? OBJECT_COLORS[entry.type]
                            : undefined,
                        }}
                      />
                      <span className="truncate flex-1">
                        {entry?.name ?? id}
                      </span>
                      <X className="ml-2 h-3.5 w-3.5 shrink-0 opacity-60" />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
            <CommandEmpty>No objects found.</CommandEmpty>
            <CommandGroup heading={isBrowse ? "Add to selection" : "Focus"}>
              {results.map((entry) => (
                <CommandItem
                  key={entry.id}
                  value={entry.id}
                  onSelect={() => handleSelect(entry.id)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      isSelected(entry.id) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate flex-1">{entry.id}</span>
                  <span className="ml-2 shrink-0 text-[10px] text-muted-foreground">
                    {OBJECT_TYPE_SINGULAR_LABELS[entry.type]}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          <div className="flex items-center justify-between gap-2 border-t p-2">
            {isBrowse ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={focusRoots.size === 0}
                  onClick={() => clearFocusRoots()}
                >
                  Clear
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    showFullGraph();
                    setOpen(false);
                  }}
                >
                  <Expand className="mr-1 h-3.5 w-3.5" />
                  Show full graph
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={!focusedTableId}
                  onClick={() => clearFocus()}
                >
                  Clear focus
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    enterBrowseMode();
                  }}
                  title="Switch to browse mode: pick objects and explore outward"
                >
                  <Crosshair className="mr-1 h-3.5 w-3.5" />
                  Browse mode
                </Button>
              </>
            )}
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Search,
} from "lucide-react";
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
import { Checkbox as CheckboxUI } from "@/components/ui/checkbox";
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
import { useSchemaStore } from "@/features/schema-graph/store";
import { useShallow } from "zustand/shallow";
import { databaseService } from "@/features/connection/services/database-service";
import { schemaService } from "@/features/schema-graph/services/schema-service";
import { useToastStore } from "@/features/notifications/store";
import { cn } from "@/lib/utils";
import {
  loadConnectionSettings,
  saveConnectionSettings,
} from "@/features/connection/services/connection-settings";
import {
  ServerConnectionForm,
  type ServerConnectionFormValues,
} from "@/features/connection/components/server-connection-form";
import { OBJECT_COLORS } from "@/constants/edge-colors";
import type {
  SchemaGraph,
  ServerConnectionParams,
  ConnectionParams,
} from "@/features/schema-graph/types";
import {
  buildImportConnectionIdentity,
  getImportSessionStep,
  resolveSelectedDatabaseAfterConnect,
  shouldInvalidateImportSession,
  type ImportConnectionIdentity,
  type ImportDialogStep,
} from "./import-from-database-dialog-state";

type SectionKey =
  | "tables"
  | "views"
  | "triggers"
  | "storedProcedures"
  | "scalarFunctions";

const createDefaultExpandedSections = (): Record<SectionKey, boolean> => ({
  tables: true,
  views: true,
  triggers: true,
  storedProcedures: true,
  scalarFunctions: true,
});

const sortById = (a: { id: string }, b: { id: string }) =>
  a.id.localeCompare(b.id, undefined, { sensitivity: "base" });

const stopEventPropagation = (event: { stopPropagation: () => void }) => {
  event.stopPropagation();
};

export const getImportSectionCounts = (
  items: { id: string }[],
  selectedIds: Set<string>
) => ({
  totalCount: items.length,
  selectedCount: items.filter((item) => selectedIds.has(item.id)).length,
});

export const isImportSectionFullySelected = (
  visibleItems: { id: string }[],
  selectedIds: Set<string>
) => visibleItems.every((item) => selectedIds.has(item.id));

const getPickSectionData = (schema: SchemaGraph) => [
  { key: "tables" as const, label: "Tables", items: schema.tables },
  { key: "views" as const, label: "Views", items: schema.views || [] },
  { key: "triggers" as const, label: "Triggers", items: schema.triggers || [] },
  {
    key: "storedProcedures" as const,
    label: "Stored Procedures",
    items: schema.storedProcedures || [],
  },
  {
    key: "scalarFunctions" as const,
    label: "Scalar Functions",
    items: schema.scalarFunctions || [],
  },
];

interface ImportFromDatabaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportFromDatabaseDialog({
  open,
  onOpenChange,
}: ImportFromDatabaseDialogProps) {
  const { importObjects } = useSchemaStore(
    useShallow((state) => ({
      importObjects: state.importObjects,
    }))
  );
  const { addToast } = useToastStore();

  const [step, setStep] = useState<ImportDialogStep>("connect");
  const [initialSavedSettings] = useState(() => loadConnectionSettings());
  const [connectionValues, setConnectionValues] =
    useState<ServerConnectionFormValues>(() => ({
      server: initialSavedSettings?.server ?? "",
      authType: initialSavedSettings?.authType ?? "sqlServer",
      username:
        initialSavedSettings?.authType === "sqlServer"
          ? (initialSavedSettings.username ?? "")
          : "",
      password: "",
      trustServerCertificate: true,
    }));
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [databases, setDatabases] = useState<string[]>([]);
  const [selectedDb, setSelectedDb] = useState<string>("");
  const [databasePickerOpen, setDatabasePickerOpen] = useState(false);
  const [isLoadingSchema, setIsLoadingSchema] = useState(false);
  const [cachedConnectionIdentity, setCachedConnectionIdentity] =
    useState<ImportConnectionIdentity | null>(null);

  const [loadedSchema, setLoadedSchema] = useState<SchemaGraph | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterText, setFilterText] = useState("");
  const [expandedSections, setExpandedSections] = useState<
    Record<SectionKey, boolean>
  >(createDefaultExpandedSections);
  const wasOpenRef = useRef(open);

  const resetPickState = useCallback(() => {
    setError(null);
    setLoadedSchema(null);
    setSelectedIds(new Set());
    setFilterText("");
    setExpandedSections(createDefaultExpandedSections());
  }, []);

  useEffect(() => {
    if (!open || wasOpenRef.current) return;

    const hasCachedDatabases = databases.length > 0;
    setStep(getImportSessionStep(hasCachedDatabases));
    resetPickState();

    if (!hasCachedDatabases) {
      const saved = loadConnectionSettings();
      if (!saved) return;

      setConnectionValues((prev) => ({
        ...prev,
        server: saved.server,
        authType: saved.authType,
        username: saved.authType === "sqlServer" ? (saved.username ?? "") : "",
      }));
    }
  }, [open, databases.length, resetPickState]);

  useEffect(() => {
    wasOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    saveConnectionSettings({
      server: connectionValues.server,
      authType: connectionValues.authType,
      username: connectionValues.username,
    });
  }, [
    connectionValues.server,
    connectionValues.authType,
    connectionValues.username,
  ]);

  useEffect(() => {
    if (!cachedConnectionIdentity) return;

    const nextIdentity = buildImportConnectionIdentity({
      server: connectionValues.server,
      authType: connectionValues.authType,
      username: connectionValues.username,
      trustServerCertificate: connectionValues.trustServerCertificate,
    });

    if (!shouldInvalidateImportSession(cachedConnectionIdentity, nextIdentity)) {
      return;
    }

    setCachedConnectionIdentity(null);
    setDatabases([]);
    setSelectedDb("");
    setStep("connect");
    resetPickState();
  }, [
    cachedConnectionIdentity,
    connectionValues.server,
    connectionValues.authType,
    connectionValues.username,
    connectionValues.trustServerCertificate,
    resetPickState,
  ]);

  useEffect(() => {
    if (step !== "database") {
      setDatabasePickerOpen(false);
    }
  }, [step]);

  const resetForClose = useCallback(() => {
    setStep(getImportSessionStep(databases.length > 0));
    setDatabasePickerOpen(false);
    resetPickState();
  }, [databases.length, resetPickState]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) resetForClose();
      onOpenChange(open);
    },
    [onOpenChange, resetForClose]
  );

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const params: ServerConnectionParams = {
        server: connectionValues.server,
        authType: connectionValues.authType,
        trustServerCertificate: connectionValues.trustServerCertificate,
      };
      if (connectionValues.authType === "sqlServer") {
        params.username = connectionValues.username;
        params.password = connectionValues.password;
      }
      const dbs = await databaseService.listDatabases(params);
      setDatabases(dbs);
      setSelectedDb((prev) => resolveSelectedDatabaseAfterConnect(dbs, prev));
      setCachedConnectionIdentity(
        buildImportConnectionIdentity({
          server: connectionValues.server,
          authType: connectionValues.authType,
          username: connectionValues.username,
          trustServerCertificate: connectionValues.trustServerCertificate,
        })
      );
      setStep("database");
    } catch (err) {
      setError(String(err));
    } finally {
      setIsConnecting(false);
    }
  };

  const handleLoadSchema = async () => {
    if (!selectedDb) return;
    setIsLoadingSchema(true);
    setError(null);
    try {
      const params: ConnectionParams = {
        server: connectionValues.server,
        database: selectedDb,
        authType: connectionValues.authType,
        username:
          connectionValues.authType === "sqlServer"
            ? connectionValues.username
            : undefined,
        password:
          connectionValues.authType === "sqlServer"
            ? connectionValues.password
            : undefined,
        trustServerCertificate: connectionValues.trustServerCertificate,
      };
      const schema = await schemaService.loadSchema(params);
      setLoadedSchema(schema);
      setSelectedIds(new Set());
      setExpandedSections(createDefaultExpandedSections());
      setStep("pick");
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoadingSchema(false);
    }
  };

  const toggleId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = (ids: string[], selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => {
        if (selected) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  };

  const toggleSection = (key: SectionKey) => {
    setExpandedSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleImport = () => {
    if (!loadedSchema) return;

    const tables = loadedSchema.tables.filter((t) => selectedIds.has(t.id));
    const views = (loadedSchema.views || []).filter((v) =>
      selectedIds.has(v.id)
    );
    const triggers = (loadedSchema.triggers || []).filter((t) =>
      selectedIds.has(t.id)
    );
    const storedProcedures = (loadedSchema.storedProcedures || []).filter((p) =>
      selectedIds.has(p.id)
    );
    const scalarFunctions = (loadedSchema.scalarFunctions || []).filter((f) =>
      selectedIds.has(f.id)
    );

    // Include relationships where both endpoints are selected
    const selectedTableViewIds = new Set([
      ...tables.map((t) => t.id),
      ...views.map((v) => v.id),
    ]);
    const relationships = loadedSchema.relationships.filter(
      (r) => selectedTableViewIds.has(r.from) && selectedTableViewIds.has(r.to)
    );

    const count =
      tables.length +
      views.length +
      triggers.length +
      storedProcedures.length +
      scalarFunctions.length;

    importObjects({
      tables,
      views,
      triggers,
      storedProcedures,
      scalarFunctions,
      relationships,
    });

    addToast({
      type: "success",
      title: "Imported",
      message: `Imported ${count} object${count !== 1 ? "s" : ""}`,
      duration: 3000,
    });

    handleOpenChange(false);
  };

  const filterMatch = (id: string) =>
    !filterText || id.toLowerCase().includes(filterText.toLowerCase());

  const pickSections = loadedSchema ? getPickSectionData(loadedSchema) : [];
  const hasPickSearchMatches = pickSections.some(({ items }) =>
    items.some((item) => filterMatch(item.id))
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import from Database</DialogTitle>
        </DialogHeader>

        {step === "connect" && (
          <ServerConnectionForm
            values={connectionValues}
            onValuesChange={(patch) =>
              setConnectionValues((prev) => ({ ...prev, ...patch }))
            }
            onSubmit={handleConnect}
            isSubmitting={isConnecting}
            submitLabel="Connect"
            submitDisabled={!connectionValues.server}
            error={error}
            fieldIdPrefix="import"
            cancelAction={
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
            }
          />
        )}

        {step === "database" && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Database</Label>
              <Popover
                open={databasePickerOpen}
                onOpenChange={setDatabasePickerOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={databasePickerOpen}
                    className="w-full justify-between font-normal"
                  >
                    <span className="truncate">
                      {selectedDb || "Select a database"}
                    </span>
                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                  <Command>
                    <CommandInput placeholder="Search database..." />
                    <CommandList>
                      <CommandEmpty>No database found.</CommandEmpty>
                      <CommandGroup>
                        {databases.map((db) => (
                          <CommandItem
                            key={db}
                            value={db}
                            onSelect={() => {
                              setSelectedDb(db);
                              setDatabasePickerOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedDb === db ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {db}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-md text-sm text-destructive">
                {error}
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("connect")}
              >
                Back
              </Button>
              <Button
                onClick={handleLoadSchema}
                disabled={isLoadingSchema || !selectedDb}
              >
                {isLoadingSchema ? "Loading..." : "Load Schema"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "pick" && loadedSchema && (
          <div className="space-y-3">
            <div className="border rounded-md overflow-hidden">
              <div className="p-2 border-b">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Filter objects..."
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    className="pl-8 h-8"
                  />
                </div>
              </div>
              <div className="h-80 overflow-auto">
                <div className="w-max min-w-full">
                  {pickSections.map(({ key, label, items }) => {
                    const { totalCount, selectedCount } = getImportSectionCounts(
                      items,
                      selectedIds
                    );
                    const filtered = [...items]
                      .sort(sortById)
                      .filter((i) => filterMatch(i.id));
                    if (filtered.length === 0) return null;

                    const isExpanded =
                      filterText.trim().length > 0 || expandedSections[key];
                    const allSelected = isImportSectionFullySelected(
                      filtered,
                      selectedIds
                    );

                    return (
                      <div
                        key={label}
                        className="w-max min-w-full border-b last:border-b-0"
                      >
                        <div
                          className="w-max min-w-full px-3 py-2 bg-muted/50 flex items-center gap-2 cursor-pointer"
                          role="button"
                          tabIndex={0}
                          onClick={() => toggleSection(key)}
                          onKeyDown={(event) => {
                            if (event.currentTarget !== event.target) return;
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              toggleSection(key);
                            }
                          }}
                        >
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-accent"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleSection(key);
                            }}
                            onKeyDown={stopEventPropagation}
                            aria-label={`Toggle ${label}`}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                          <div
                            className="inline-flex items-center"
                            onClick={stopEventPropagation}
                            onKeyDown={stopEventPropagation}
                          >
                            <CheckboxUI
                              checked={allSelected}
                              onCheckedChange={(c) =>
                                toggleAll(
                                  filtered.map((i) => i.id),
                                  c === true
                                )
                              }
                            />
                          </div>
                          <span
                            className="text-xs font-medium"
                            style={{ color: OBJECT_COLORS[key] }}
                          >
                            {label} ({selectedCount}/{totalCount})
                          </span>
                        </div>
                        {isExpanded && (
                          <div className="w-max min-w-full py-1">
                            {filtered.map((item) => (
                              <label
                                key={item.id}
                                className="w-max min-w-full flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-accent"
                              >
                                <CheckboxUI
                                  checked={selectedIds.has(item.id)}
                                  onCheckedChange={() => toggleId(item.id)}
                                />
                                <span style={{ color: OBJECT_COLORS[key] }}>
                                  {item.id}
                                </span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {filterText.trim().length > 0 && !hasPickSearchMatches && (
                    <div className="w-max min-w-full px-3 py-4 text-sm text-center text-muted-foreground">
                      No matches found
                    </div>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("database")}
              >
                Back
              </Button>
              <Button
                onClick={handleImport}
                disabled={selectedIds.size === 0}
              >
                Import {selectedIds.size} Object
                {selectedIds.size !== 1 ? "s" : ""}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useState, useCallback } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSchemaStore } from "@/features/schema-graph/store";
import { useShallow } from "zustand/shallow";
import { databaseService } from "@/features/connection/services/database-service";
import { schemaService } from "@/features/schema-graph/services/schema-service";
import { useToastStore } from "@/features/notifications/store";
import type {
  SchemaGraph,
  AuthType,
  ServerConnectionParams,
  ConnectionParams,
} from "@/features/schema-graph/types";

type Step = "connect" | "database" | "pick";
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

  const [step, setStep] = useState<Step>("connect");
  const [server, setServer] = useState("");
  const [authType, setAuthType] = useState<AuthType>("sqlServer");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [trustCert, setTrustCert] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [databases, setDatabases] = useState<string[]>([]);
  const [selectedDb, setSelectedDb] = useState<string>("");
  const [isLoadingSchema, setIsLoadingSchema] = useState(false);

  const [loadedSchema, setLoadedSchema] = useState<SchemaGraph | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterText, setFilterText] = useState("");
  const [expandedSections, setExpandedSections] = useState<
    Record<SectionKey, boolean>
  >(createDefaultExpandedSections);

  const reset = useCallback(() => {
    setStep("connect");
    setError(null);
    setDatabases([]);
    setSelectedDb("");
    setLoadedSchema(null);
    setSelectedIds(new Set());
    setFilterText("");
    setExpandedSections(createDefaultExpandedSections());
  }, []);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) reset();
      onOpenChange(open);
    },
    [onOpenChange, reset]
  );

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const params: ServerConnectionParams = {
        server,
        authType,
        trustServerCertificate: trustCert,
      };
      if (authType === "sqlServer") {
        params.username = username;
        params.password = password;
      }
      const dbs = await databaseService.listDatabases(params);
      setDatabases(dbs);
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
        server,
        database: selectedDb,
        authType,
        username: authType === "sqlServer" ? username : undefined,
        password: authType === "sqlServer" ? password : undefined,
        trustServerCertificate: trustCert,
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

  const isWindowsAuth = authType === "windows";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import from Database</DialogTitle>
        </DialogHeader>

        {step === "connect" && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="import-server">Server</Label>
              <Input
                id="import-server"
                value={server}
                onChange={(e) => setServer(e.target.value)}
                placeholder="localhost"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label>Authentication</Label>
              <Select
                value={authType}
                onValueChange={(v: AuthType) => setAuthType(v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sqlServer">
                    SQL Server Authentication
                  </SelectItem>
                  <SelectItem value="windows">
                    Windows Authentication
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!isWindowsAuth && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="import-user">Username</Label>
                  <Input
                    id="import-user"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="sa"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="import-pass">Password</Label>
                  <Input
                    id="import-pass"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
            )}
            <div className="flex items-center space-x-2">
              <CheckboxUI
                id="import-trust"
                checked={trustCert}
                onCheckedChange={(c) => setTrustCert(c === true)}
              />
              <Label htmlFor="import-trust" className="text-sm font-normal">
                Trust Server Certificate
              </Label>
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
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConnect}
                disabled={isConnecting || !server}
              >
                {isConnecting ? "Connecting..." : "Connect"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "database" && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Database</Label>
              <Select value={selectedDb} onValueChange={setSelectedDb}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a database" />
                </SelectTrigger>
                <SelectContent side="bottom" avoidCollisions={false}>
                  {databases.map((db) => (
                    <SelectItem key={db} value={db}>
                      {db}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <Input
              placeholder="Filter objects..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {[
                {
                  key: "tables" as const,
                  label: "Tables",
                  items: loadedSchema.tables,
                },
                {
                  key: "views" as const,
                  label: "Views",
                  items: loadedSchema.views || [],
                },
                {
                  key: "triggers" as const,
                  label: "Triggers",
                  items: loadedSchema.triggers || [],
                },
                {
                  key: "storedProcedures" as const,
                  label: "Stored Procedures",
                  items: loadedSchema.storedProcedures || [],
                },
                {
                  key: "scalarFunctions" as const,
                  label: "Scalar Functions",
                  items: loadedSchema.scalarFunctions || [],
                },
              ].map(({ key, label, items }) => {
                const totalCount = items.length;
                const filtered = [...items]
                  .sort(sortById)
                  .filter((i) => filterMatch(i.id));
                if (filtered.length === 0) return null;

                const isExpanded =
                  filterText.trim().length > 0 || expandedSections[key];
                const allSelected = filtered.every((i) =>
                  selectedIds.has(i.id)
                );

                return (
                  <div key={label}>
                    <div className="flex items-center gap-2 mb-1">
                      <CheckboxUI
                        checked={allSelected}
                        onCheckedChange={(c) =>
                          toggleAll(
                            filtered.map((i) => i.id),
                            c === true
                          )
                        }
                      />
                      <span className="text-sm font-medium">
                        {label} ({filtered.length}/{totalCount})
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="ml-auto h-7 w-7"
                        onClick={() => toggleSection(key)}
                        aria-label={`Toggle ${label}`}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {isExpanded && (
                      <div className="pl-6 space-y-0.5">
                        {filtered.map((item) => (
                          <label
                            key={item.id}
                            className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted px-1 py-0.5 rounded"
                          >
                            <CheckboxUI
                              checked={selectedIds.has(item.id)}
                              onCheckedChange={() => toggleId(item.id)}
                            />
                            <span>{item.id}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
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

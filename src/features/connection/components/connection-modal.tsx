import { useState, useEffect, type FormEvent } from "react";
import { useSchemaStore } from "@/features/schema-graph/store";
import { useShallow } from "zustand/shallow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MockDataModal,
  type MockDataSize,
} from "@/components/mock-data-modal";
import type { ConnectionParams, AuthType } from "@/features/schema-graph/types";
import { connectionService, type ConnectionHistory } from "../services/connection-service";

const STORAGE_KEY = "monocle-connection-settings";

interface SavedSettings {
  server: string;
  database: string;
  authType: AuthType;
}

function loadSavedSettings(): SavedSettings | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

function saveSettings(settings: SavedSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors
  }
}

interface ConnectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recentConnections: ConnectionHistory[];
  onConnectionSuccess?: () => void;
}

export function ConnectionModal({
  open,
  onOpenChange,
  recentConnections,
  onConnectionSuccess,
}: ConnectionModalProps) {
  const { loadSchema, loadMockSchema, isLoading, error } = useSchemaStore(
    useShallow((state) => ({
      loadSchema: state.loadSchema,
      loadMockSchema: state.loadMockSchema,
      isLoading: state.isLoading,
      error: state.error,
    }))
  );

  const [formData, setFormData] = useState<ConnectionParams>(() => {
    const saved = loadSavedSettings();
    return {
      server: saved?.server ?? "",
      database: saved?.database ?? "",
      authType: saved?.authType ?? "sqlServer",
      username: "",
      password: "",
      trustServerCertificate: true,
    };
  });

  const [mockModalOpen, setMockModalOpen] = useState(false);

  // Save settings when they change
  useEffect(() => {
    saveSettings({
      server: formData.server,
      database: formData.database,
      authType: formData.authType,
    });
  }, [formData.server, formData.database, formData.authType]);

  const handleLoadMock = (size: MockDataSize) => {
    void loadMockSchema(size);
    setMockModalOpen(false);
    onOpenChange(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const params: ConnectionParams = {
      server: formData.server,
      database: formData.database,
      authType: formData.authType,
      trustServerCertificate: formData.trustServerCertificate,
    };

    if (formData.authType === "sqlServer") {
      params.username = formData.username;
      params.password = formData.password;
    }

    const connected = await loadSchema(params);

    if (connected) {
      connectionService
        .saveConnection({
          server: formData.server,
          database: formData.database,
          username: formData.username || "",
        })
        .then(() => {
          onConnectionSuccess?.();
        })
        .catch(() => {});

      onOpenChange(false);
    }
  };

  const handleSelectRecent = (connection: ConnectionHistory) => {
    setFormData((prev) => ({
      ...prev,
      server: connection.server,
      database: connection.database,
      username: connection.username,
    }));
  };

  const handleChange = (
    field: keyof ConnectionParams,
    value: string | boolean
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const isWindowsAuth = formData.authType === "windows";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect to Database</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            {recentConnections.length > 0 && (
              <div className="space-y-1">
                <Label htmlFor="recent">Recent Connections</Label>
                <Select
                  value=""
                  onValueChange={(value) => {
                    const idx = parseInt(value, 10);
                    if (!isNaN(idx) && recentConnections[idx]) {
                      handleSelectRecent(recentConnections[idx]);
                    }
                  }}
                >
                  <SelectTrigger id="recent">
                    <SelectValue placeholder="Select a recent connection" />
                  </SelectTrigger>
                  <SelectContent>
                    {recentConnections.map((conn, idx) => (
                      <SelectItem key={`${conn.server}-${conn.database}`} value={String(idx)}>
                        {conn.server} / {conn.database}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="server">Server</Label>
                <Input
                  id="server"
                  type="text"
                  value={formData.server}
                  onChange={(e) => handleChange("server", e.target.value)}
                  placeholder="localhost"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="database">Database</Label>
                <Input
                  id="database"
                  type="text"
                  value={formData.database}
                  onChange={(e) => handleChange("database", e.target.value)}
                  placeholder="Database name"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="authType">Authentication</Label>
              <Select
                value={formData.authType}
                onValueChange={(value: AuthType) =>
                  handleChange("authType", value)
                }
              >
                <SelectTrigger id="authType">
                  <SelectValue placeholder="Select authentication type" />
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
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    value={formData.username || ""}
                    onChange={(e) => handleChange("username", e.target.value)}
                    placeholder="sa"
                    required={!isWindowsAuth}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password || ""}
                    onChange={(e) => handleChange("password", e.target.value)}
                    required={!isWindowsAuth}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Checkbox
                id="trustCert"
                checked={formData.trustServerCertificate}
                onCheckedChange={(checked) =>
                  handleChange("trustServerCertificate", checked === true)
                }
              />
              <Label htmlFor="trustCert" className="text-sm font-normal">
                Trust Server Certificate
              </Label>
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-md text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={isLoading} className="flex-1">
                {isLoading ? "Connecting..." : "Connect"}
              </Button>
              {import.meta.env.DEV && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMockModalOpen(true)}
                  disabled={isLoading}
                >
                  Mock Data
                </Button>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {import.meta.env.DEV && (
        <MockDataModal
          open={mockModalOpen}
          onOpenChange={setMockModalOpen}
          onLoad={handleLoadMock}
          isLoading={isLoading}
        />
      )}
    </>
  );
}

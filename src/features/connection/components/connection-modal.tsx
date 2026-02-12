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
import { MockDataModal, type MockDataSize } from "@/components/mock-data-modal";
import type {
  ServerConnectionParams,
  AuthType,
} from "@/features/schema-graph/types";
import { useToastStore } from "@/features/notifications/store";
import {
  loadConnectionSettings,
  saveConnectionSettings,
} from "@/features/connection/services/connection-settings";

type FormData = ServerConnectionParams;

interface ConnectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectionModal({ open, onOpenChange }: ConnectionModalProps) {
  const {
    connectToServer,
    loadMockSchema,
    isLoading,
    isDatabasesLoading,
    error,
  } = useSchemaStore(
    useShallow((state) => ({
      connectToServer: state.connectToServer,
      loadMockSchema: state.loadMockSchema,
      isLoading: state.isLoading,
      isDatabasesLoading: state.isDatabasesLoading,
      error: state.error,
    }))
  );

  const { addToast } = useToastStore();

  const [formData, setFormData] = useState<FormData>(() => {
    const saved = loadConnectionSettings();
    return {
      server: saved?.server ?? "",
      authType: saved?.authType ?? "sqlServer",
      username: saved?.authType === "sqlServer" ? (saved?.username ?? "") : "",
      password: "",
      trustServerCertificate: true,
    };
  });

  const [mockModalOpen, setMockModalOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const saved = loadConnectionSettings();
    if (!saved) return;

    setFormData((prev) => ({
      ...prev,
      server: saved.server,
      authType: saved.authType,
      username: saved.authType === "sqlServer" ? (saved.username ?? "") : "",
    }));
  }, [open]);

  // Save settings when they change
  useEffect(() => {
    saveConnectionSettings({
      server: formData.server,
      authType: formData.authType,
      username: formData.username,
    });
  }, [formData.server, formData.authType, formData.username]);

  const handleLoadMock = (size: MockDataSize) => {
    void loadMockSchema(size);
    setMockModalOpen(false);
    onOpenChange(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const params: ServerConnectionParams = {
      server: formData.server,
      authType: formData.authType,
      trustServerCertificate: formData.trustServerCertificate,
    };

    if (formData.authType === "sqlServer") {
      params.username = formData.username;
      params.password = formData.password;
    }

    const connected = await connectToServer(params);

    if (connected) {
      addToast({
        type: "success",
        title: "Connected",
        message: `Connected to ${formData.server}`,
        duration: 3000,
      });

      onOpenChange(false);
    }
  };

  const handleChange = (
    field: keyof ServerConnectionParams,
    value: string | boolean
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const isWindowsAuth = formData.authType === "windows";

  const isConnecting = isLoading || isDatabasesLoading;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect to Server</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="server">Server</Label>
              <Input
                id="server"
                type="text"
                value={formData.server}
                onChange={(e) => handleChange("server", e.target.value)}
                placeholder="HOST\\INSTANCE"
                required
              />
              <p className="text-xs text-muted-foreground">
                Examples: HOST\INSTANCE, HOST,1433, localhost
              </p>
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
                    autoCapitalize="off"
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
              <Button type="submit" disabled={isConnecting} className="flex-1">
                {isConnecting ? "Connecting..." : "Connect"}
              </Button>
              {import.meta.env.DEV && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMockModalOpen(true)}
                  disabled={isConnecting}
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
          isLoading={isConnecting}
        />
      )}
    </>
  );
}

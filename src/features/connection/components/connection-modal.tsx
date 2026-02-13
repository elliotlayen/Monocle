import { useState, useEffect } from "react";
import { useSchemaStore } from "@/features/schema-graph/store";
import { useShallow } from "zustand/shallow";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MockDataModal, type MockDataSize } from "@/components/mock-data-modal";
import type { ServerConnectionParams } from "@/features/schema-graph/types";
import { useToastStore } from "@/features/notifications/store";
import {
  loadConnectionSettings,
  saveConnectionSettings,
} from "@/features/connection/services/connection-settings";
import {
  ServerConnectionForm,
  type ServerConnectionFormValues,
} from "@/features/connection/components/server-connection-form";

type FormData = ServerConnectionFormValues;

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

  const handleSubmit = async () => {
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

  const isConnecting = isLoading || isDatabasesLoading;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect to Server</DialogTitle>
          </DialogHeader>
          <ServerConnectionForm
            values={formData}
            onValuesChange={(patch) =>
              setFormData((prev) => ({ ...prev, ...patch }))
            }
            onSubmit={handleSubmit}
            isSubmitting={isConnecting}
            submitLabel="Connect"
            error={error}
            fieldIdPrefix="connect"
            extraActions={
              import.meta.env.DEV ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMockModalOpen(true)}
                  disabled={isConnecting}
                >
                  Mock Data
                </Button>
              ) : null
            }
          />
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

import { useEffect, useState, useCallback, useMemo } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { useSchemaStore } from "@/features/schema-graph/store";
import { useShallow } from "zustand/shallow";
import { HomeScreen } from "@/features/connection/components/home-screen";
import { Toolbar } from "@/features/toolbar/components/toolbar";
import { FilterInfoBar } from "@/features/toolbar/components/filter-info-bar";
import { StatusBar } from "@/components/status-bar";
import { SchemaGraphView } from "@/features/schema-graph/components";
import { UpdateChecker } from "@/components/update-checker";
import { ToastContainer } from "@/components/toast-container";
import { settingsService } from "@/features/settings/services/settings-service";
import { useMenuEvents } from "@/hooks/use-menu-events";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ConnectionModal } from "@/features/connection/components/connection-modal";
import { AboutDialog } from "@/components/about-dialog";
import { AppSettingsSheet } from "@/components/app-settings-sheet";

function App() {
  const {
    schema,
    isConnected,
    serverConnection,
    debouncedSearchFilter,
    schemaFilter,
    focusedTableId,
    objectTypeFilter,
    edgeTypeFilter,
    hydrateSettings,
    disconnect,
  } = useSchemaStore(
    useShallow((state) => ({
      schema: state.schema,
      isConnected: state.isConnected,
      serverConnection: state.serverConnection,
      debouncedSearchFilter: state.debouncedSearchFilter,
      schemaFilter: state.schemaFilter,
      focusedTableId: state.focusedTableId,
      objectTypeFilter: state.objectTypeFilter,
      edgeTypeFilter: state.edgeTypeFilter,
      hydrateSettings: state.hydrateSettings,
      disconnect: state.disconnect,
    }))
  );

  const [connectionModalOpen, setConnectionModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [checkUpdatesRequested, setCheckUpdatesRequested] = useState(false);

  const handleNewConnection = useCallback(() => {
    setConnectionModalOpen(true);
  }, []);

  const handleDisconnect = useCallback(() => {
    disconnect();
  }, [disconnect]);

  const handleSettings = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  const handleAbout = useCallback(() => {
    setAboutOpen(true);
  }, []);

  const handleDocumentation = useCallback(() => {
    openUrl("https://github.com/elliotlayen/Monocle").catch(console.error);
  }, []);

  const handleCheckUpdates = useCallback(() => {
    setCheckUpdatesRequested(true);
  }, []);

  const menuHandlers = useMemo(
    () => ({
      onNewConnection: handleNewConnection,
      onDisconnect: handleDisconnect,
      onSettings: handleSettings,
      onAbout: handleAbout,
      onDocumentation: handleDocumentation,
      onCheckUpdates: handleCheckUpdates,
    }),
    [
      handleNewConnection,
      handleDisconnect,
      handleSettings,
      handleAbout,
      handleDocumentation,
      handleCheckUpdates,
    ]
  );

  useMenuEvents(menuHandlers);

  useEffect(() => {
    let isMounted = true;
    settingsService
      .getSettings()
      .then((settings) => {
        if (!isMounted) return;
        hydrateSettings(settings);
      })
      .catch(() => {
        // Ignore settings load failures
      });
    return () => {
      isMounted = false;
    };
  }, [hydrateSettings]);

  const showHome = !schema && (!isConnected || !serverConnection);

  return (
    <>
      <ToastContainer />
      <UpdateChecker
        checkRequested={checkUpdatesRequested}
        onCheckComplete={() => setCheckUpdatesRequested(false)}
      />
      <ConnectionModal
        open={connectionModalOpen}
        onOpenChange={setConnectionModalOpen}
      />
      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
      <AppSettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
      {showHome ? (
        <HomeScreen
          onOpenConnectionModal={() => setConnectionModalOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenAbout={() => setAboutOpen(true)}
        />
      ) : (
        <ReactFlowProvider>
          <div className="flex flex-col h-screen">
            <Toolbar onOpenSettings={() => setSettingsOpen(true)} />
            <main className="relative flex-1 overflow-hidden">
              {schema ? (
                <>
                  <FilterInfoBar />
                  <SchemaGraphView
                    schema={schema}
                    searchFilter={debouncedSearchFilter}
                    schemaFilter={schemaFilter}
                    focusedTableId={focusedTableId}
                    objectTypeFilter={objectTypeFilter}
                    edgeTypeFilter={edgeTypeFilter}
                  />
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <p>Select a database from the toolbar to view its schema</p>
                </div>
              )}
            </main>
            <StatusBar />
          </div>
        </ReactFlowProvider>
      )}
    </>
  );
}

export default App;

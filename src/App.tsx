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
import { canvasFileService } from "@/features/canvas/services/canvas-file-service";
import { canvasMenuService } from "@/features/canvas/services/canvas-menu-service";
import { useToastStore } from "@/features/notifications/store";
import type { CanvasFile } from "@/features/canvas/types";
import {
  CanvasDirtyDialog,
  type CanvasDirtyAction,
} from "@/features/canvas/components/canvas-dirty-dialog";

function App() {
  const {
    schema,
    isConnected,
    serverConnection,
    mode,
    canvasFilePath,
    canvasIsDirty,
    nodePositions,
    searchFilter,
    debouncedSearchFilter,
    schemaFilter,
    focusedTableId,
    objectTypeFilter,
    excludedObjectIds,
    edgeTypeFilter,
    hydrateSettings,
    disconnect,
    enterCanvasMode,
    exitCanvasMode,
    setCanvasFilePath,
    setCanvasDirty,
    setSearchFilter,
    setDebouncedSearchFilter,
    clearFocus,
    resetObjectFilters,
    selectAllEdgeTypes,
  } = useSchemaStore(
    useShallow((state) => ({
      schema: state.schema,
      isConnected: state.isConnected,
      serverConnection: state.serverConnection,
      mode: state.mode,
      canvasFilePath: state.canvasFilePath,
      canvasIsDirty: state.canvasIsDirty,
      nodePositions: state.nodePositions,
      searchFilter: state.searchFilter,
      debouncedSearchFilter: state.debouncedSearchFilter,
      schemaFilter: state.schemaFilter,
      focusedTableId: state.focusedTableId,
      objectTypeFilter: state.objectTypeFilter,
      excludedObjectIds: state.excludedObjectIds,
      edgeTypeFilter: state.edgeTypeFilter,
      hydrateSettings: state.hydrateSettings,
      disconnect: state.disconnect,
      enterCanvasMode: state.enterCanvasMode,
      exitCanvasMode: state.exitCanvasMode,
      setCanvasFilePath: state.setCanvasFilePath,
      setCanvasDirty: state.setCanvasDirty,
      setSearchFilter: state.setSearchFilter,
      setDebouncedSearchFilter: state.setDebouncedSearchFilter,
      clearFocus: state.clearFocus,
      resetObjectFilters: state.resetObjectFilters,
      selectAllEdgeTypes: state.selectAllEdgeTypes,
    }))
  );

  const { addToast } = useToastStore();

  const [connectionModalOpen, setConnectionModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [checkUpdatesRequested, setCheckUpdatesRequested] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [canvasDirtyDialogOpen, setCanvasDirtyDialogOpen] = useState(false);
  const [pendingCanvasAction, setPendingCanvasAction] =
    useState<CanvasDirtyAction | null>(null);
  const [isCanvasDirtySaving, setIsCanvasDirtySaving] = useState(false);

  const isCanvasMode = mode === "canvas";
  const canvasFileName = useMemo(() => {
    return canvasFilePath
      ? canvasFilePath.split("/").pop()?.split("\\").pop() ?? "Untitled"
      : "Untitled";
  }, [canvasFilePath]);

  const performCanvasAction = useCallback(
    async (action: CanvasDirtyAction) => {
      switch (action) {
        case "exit":
          exitCanvasMode();
          return;
        case "open": {
          const result = await canvasFileService.openFile();
          if (result) {
            enterCanvasMode(
              result.data.schema,
              result.data.nodePositions,
              result.path
            );
          }
          return;
        }
        case "enter":
          enterCanvasMode();
      }
    },
    [enterCanvasMode, exitCanvasMode]
  );

  const requestCanvasAction = useCallback(
    (action: CanvasDirtyAction) => {
      if (canvasIsDirty && isCanvasMode) {
        setPendingCanvasAction(action);
        setCanvasDirtyDialogOpen(true);
        return;
      }
      void performCanvasAction(action);
    },
    [canvasIsDirty, isCanvasMode, performCanvasAction]
  );

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

  const handleEnterCanvasMode = useCallback(() => {
    if (isCanvasMode) return;
    requestCanvasAction("enter");
  }, [isCanvasMode, requestCanvasAction]);

  const handleExitCanvasMode = useCallback(() => {
    requestCanvasAction("exit");
  }, [requestCanvasAction]);

  const handleCanvasSave = useCallback(async () => {
    if (!schema) return false;

    const data: CanvasFile = {
      metadata: {
        version: "1.0",
        createdAt: canvasFilePath
          ? new Date().toISOString()
          : new Date().toISOString(),
        lastModifiedAt: new Date().toISOString(),
      },
      schema,
      nodePositions,
    };

    const path = await canvasFileService.saveFile(
      data,
      canvasFilePath ?? undefined
    );
    if (!path) return false;

    setCanvasFilePath(path);
    setCanvasDirty(false);
    addToast({
      type: "success",
      title: "Saved",
      message: `Saved to ${path.split("/").pop()?.split("\\").pop()}`,
      duration: 2000,
    });
    return true;
  }, [
    schema,
    canvasFilePath,
    nodePositions,
    setCanvasFilePath,
    setCanvasDirty,
    addToast,
  ]);

  const handleCanvasOpen = useCallback(() => {
    requestCanvasAction("open");
  }, [requestCanvasAction]);

  const handleImport = useCallback(() => {
    setImportDialogOpen(true);
  }, []);

  const handleResetFilters = useCallback(() => {
    clearFocus();
    resetObjectFilters();
    selectAllEdgeTypes();
    setSearchFilter("");
    setDebouncedSearchFilter("");
  }, [
    clearFocus,
    resetObjectFilters,
    selectAllEdgeTypes,
    setSearchFilter,
    setDebouncedSearchFilter,
  ]);

  const handleClearFocus = useCallback(() => {
    clearFocus();
  }, [clearFocus]);

  const handleCanvasDirtyDialogOpenChange = useCallback((open: boolean) => {
    setCanvasDirtyDialogOpen(open);
    if (!open) {
      setPendingCanvasAction(null);
      setIsCanvasDirtySaving(false);
    }
  }, []);

  const handleCanvasDirtySaveAndContinue = useCallback(async () => {
    if (!pendingCanvasAction) return;
    setIsCanvasDirtySaving(true);
    const saved = await handleCanvasSave();
    setIsCanvasDirtySaving(false);
    if (!saved) return;
    setCanvasDirtyDialogOpen(false);
    const action = pendingCanvasAction;
    setPendingCanvasAction(null);
    void performCanvasAction(action);
  }, [handleCanvasSave, pendingCanvasAction, performCanvasAction]);

  const handleCanvasDirtyDiscardAndContinue = useCallback(() => {
    if (!pendingCanvasAction) return;
    setCanvasDirtyDialogOpen(false);
    const action = pendingCanvasAction;
    setPendingCanvasAction(null);
    void performCanvasAction(action);
  }, [pendingCanvasAction, performCanvasAction]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "k") {
        e.preventDefault();
        if (!isCanvasMode) {
          handleEnterCanvasMode();
        }
      }
      if (mod && e.key === "s" && isCanvasMode) {
        e.preventDefault();
        void handleCanvasSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isCanvasMode, handleEnterCanvasMode, handleCanvasSave]);

  const menuHandlers = useMemo(
    () => ({
      onNewConnection: handleNewConnection,
      onDisconnect: handleDisconnect,
      onSettings: handleSettings,
      onAbout: handleAbout,
      onDocumentation: handleDocumentation,
      onCheckUpdates: handleCheckUpdates,
      onEnterCanvas: handleEnterCanvasMode,
      onCanvasOpen: handleCanvasOpen,
      onCanvasSave: () => {
        void handleCanvasSave();
      },
      onExitCanvas: handleExitCanvasMode,
      onCanvasImport: handleImport,
      onResetFilters: handleResetFilters,
      onClearFocus: handleClearFocus,
    }),
    [
      handleNewConnection,
      handleDisconnect,
      handleSettings,
      handleAbout,
      handleDocumentation,
      handleCheckUpdates,
      handleEnterCanvasMode,
      handleCanvasOpen,
      handleCanvasSave,
      handleExitCanvasMode,
      handleImport,
      handleResetFilters,
      handleClearFocus,
    ]
  );

  useMenuEvents(menuHandlers);

  const hasFocus = focusedTableId !== null;
  const hasActiveFilters =
    hasFocus ||
    searchFilter.trim() !== "" ||
    objectTypeFilter.size !== 5 ||
    excludedObjectIds.size > 0 ||
    edgeTypeFilter.size !== 7;

  useEffect(() => {
    canvasMenuService
      .setMenuUiState({
        isCanvasMode,
        hasFocus,
        hasActiveFilters,
      })
      .catch((error) => {
        console.error("Failed to sync canvas menu state:", error);
      });
  }, [isCanvasMode, hasFocus, hasActiveFilters]);

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

  const showHome =
    !schema && mode !== "canvas" && (!isConnected || !serverConnection);

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
      {pendingCanvasAction && (
        <CanvasDirtyDialog
          open={canvasDirtyDialogOpen}
          action={pendingCanvasAction}
          fileName={canvasFileName}
          isSaving={isCanvasDirtySaving}
          onOpenChange={handleCanvasDirtyDialogOpenChange}
          onSaveAndContinue={handleCanvasDirtySaveAndContinue}
          onDiscardAndContinue={handleCanvasDirtyDiscardAndContinue}
        />
      )}
      {showHome ? (
        <HomeScreen
          onOpenConnectionModal={() => setConnectionModalOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenAbout={() => setAboutOpen(true)}
          onEnterCanvasMode={handleEnterCanvasMode}
        />
      ) : (
        <ReactFlowProvider>
          <div className="flex flex-col h-screen">
            <Toolbar
              onOpenSettings={() => setSettingsOpen(true)}
              onDisconnect={handleDisconnect}
              canvasMode={isCanvasMode}
              onSave={handleCanvasSave}
              onOpen={handleCanvasOpen}
              onExitCanvas={handleExitCanvasMode}
              onImport={handleImport}
            />
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
                    excludedObjectIds={excludedObjectIds}
                    edgeTypeFilter={edgeTypeFilter}
                    canvasMode={isCanvasMode}
                    importDialogOpen={importDialogOpen}
                    onImportDialogOpenChange={setImportDialogOpen}
                  />
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <p>Select a database from the toolbar.</p>
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

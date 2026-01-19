import { useEffect } from "react";
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
    }))
  );

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
      <UpdateChecker />
      {showHome ? (
        <HomeScreen />
      ) : (
        <ReactFlowProvider>
          <div className="flex flex-col h-screen">
            <Toolbar />
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

import { useEffect } from "react";
import { useSchemaStore } from "@/features/schema-graph/store";
import { useShallow } from "zustand/shallow";
import { HomeScreen } from "@/features/connection/components/home-screen";
import { Toolbar } from "@/features/toolbar/components/toolbar";
import { FilterInfoBar } from "@/features/toolbar/components/filter-info-bar";
import { StatusBar } from "@/components/status-bar";
import { SchemaGraphView } from "@/features/schema-graph/components";
import { UpdateChecker } from "@/components/update-checker";
import { settingsService } from "@/features/settings/services/settings-service";

function App() {
  const {
    schema,
    isConnected,
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

  if (!isConnected || !schema) {
    return (
      <>
        <UpdateChecker />
        <HomeScreen />
      </>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <UpdateChecker />
      <Toolbar />
      <main className="relative flex-1 overflow-hidden">
        <FilterInfoBar />
        <SchemaGraphView
          schema={schema}
          searchFilter={debouncedSearchFilter}
          schemaFilter={schemaFilter}
          focusedTableId={focusedTableId}
          objectTypeFilter={objectTypeFilter}
          edgeTypeFilter={edgeTypeFilter}
        />
      </main>
      <StatusBar />
    </div>
  );
}

export default App;

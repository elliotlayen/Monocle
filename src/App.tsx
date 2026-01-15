import { useSchemaStore } from "@/stores/schemaStore";
import { useShallow } from "zustand/shallow";
import { ConnectionForm } from "@/components/connection-form";
import { Toolbar } from "@/components/toolbar";
import { StatusBar } from "@/components/status-bar";
import { SchemaGraphView } from "@/components/schema-graph";
import { UpdateChecker } from "@/components/update-checker";

function App() {
  const {
    schema,
    isConnected,
    debouncedSearchFilter,
    schemaFilter,
    focusedTableId,
    objectTypeFilter,
    edgeTypeFilter,
  } = useSchemaStore(
    useShallow((state) => ({
      schema: state.schema,
      isConnected: state.isConnected,
      debouncedSearchFilter: state.debouncedSearchFilter,
      schemaFilter: state.schemaFilter,
      focusedTableId: state.focusedTableId,
      objectTypeFilter: state.objectTypeFilter,
      edgeTypeFilter: state.edgeTypeFilter,
    }))
  );

  if (!isConnected || !schema) {
    return (
      <>
        <UpdateChecker />
        <ConnectionForm />
      </>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <UpdateChecker />
      <Toolbar />
      <main className="flex-1 overflow-hidden">
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

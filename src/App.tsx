import { useSchemaStore } from "@/stores/schemaStore";
import { ConnectionForm } from "@/components/connection-form";
import { Toolbar } from "@/components/toolbar";
import { SchemaGraphView } from "@/components/schema-graph";

function App() {
  const {
    schema,
    isConnected,
    debouncedSearchFilter,
    schemaFilter,
    focusedTableId,
    objectTypeFilter,
    edgeTypeFilter,
  } = useSchemaStore();

  if (!isConnected || !schema) {
    return <ConnectionForm />;
  }

  return (
    <div className="flex flex-col h-screen">
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
    </div>
  );
}

export default App;

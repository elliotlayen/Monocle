import { useSchemaStore } from "@/stores/schemaStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X, Database } from "lucide-react";

export function Toolbar() {
  const {
    schema,
    searchFilter,
    schemaFilter,
    focusedTableId,
    availableSchemas,
    setSearchFilter,
    setSchemaFilter,
    setFocusedTable,
    clearFocus,
    disconnect,
  } = useSchemaStore();

  if (!schema) return null;

  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-white border-b border-slate-200 shadow-sm">
      {/* App title */}
      <div className="flex items-center gap-2 mr-2">
        <Database className="w-5 h-5 text-blue-600" />
        <span className="font-semibold text-slate-800">Schema Visualizer</span>
      </div>

      <div className="w-px h-6 bg-slate-200" />

      {/* Search */}
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          type="text"
          placeholder="Search tables..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          className="pl-9 h-9"
        />
        {searchFilter && (
          <button
            onClick={() => setSearchFilter("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded"
          >
            <X className="w-3 h-3 text-slate-400" />
          </button>
        )}
      </div>

      {/* Schema filter */}
      <Select value={schemaFilter} onValueChange={setSchemaFilter}>
        <SelectTrigger className="w-[140px] h-9">
          <SelectValue placeholder="All Schemas" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Schemas</SelectItem>
          {availableSchemas.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Focus mode */}
      <Select
        value={focusedTableId || "none"}
        onValueChange={(v) => setFocusedTable(v === "none" ? null : v)}
      >
        <SelectTrigger className="w-[180px] h-9">
          <SelectValue placeholder="Focus: None" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Focus: None</SelectItem>
          {schema.tables.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.id}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {focusedTableId && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFocus}
          className="h-9 px-2"
        >
          <X className="w-4 h-4 mr-1" />
          Clear
        </Button>
      )}

      <div className="flex-1" />

      {/* Stats */}
      <div className="text-sm text-slate-500">
        {schema.tables.length} tables &middot; {schema.relationships.length}{" "}
        relationships
      </div>

      {/* Disconnect */}
      <Button variant="outline" size="sm" onClick={disconnect} className="h-9">
        Disconnect
      </Button>
    </div>
  );
}

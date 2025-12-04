import { useState, useRef, useEffect } from "react";
import { useSchemaStore, ObjectType } from "@/stores/schemaStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X, Database, ChevronDown } from "lucide-react";

const OBJECT_TYPE_LABELS: Record<ObjectType, string> = {
  tables: "Tables",
  views: "Views",
  triggers: "Triggers",
  storedProcedures: "Stored Procedures",
};

export function Toolbar() {
  const {
    schema,
    searchFilter,
    schemaFilter,
    focusedTableId,
    objectTypeFilter,
    availableSchemas,
    setSearchFilter,
    setSchemaFilter,
    setFocusedTable,
    clearFocus,
    toggleObjectType,
    disconnect,
  } = useSchemaStore();

  const [objectTypeOpen, setObjectTypeOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setObjectTypeOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!schema) return null;

  const selectedCount = objectTypeFilter.size;
  const allSelected = selectedCount === 4;

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

      {/* Object type filter */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setObjectTypeOpen(!objectTypeOpen)}
          className="flex items-center gap-2 h-9 px-3 text-sm border border-slate-200 rounded-md bg-white hover:bg-slate-50"
        >
          <span>
            {allSelected ? "All Types" : `${selectedCount} Type${selectedCount !== 1 ? "s" : ""}`}
          </span>
          <ChevronDown className="w-4 h-4 text-slate-500" />
        </button>
        {objectTypeOpen && (
          <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-slate-200 rounded-md shadow-lg z-50">
            <div className="p-2 space-y-2">
              {(Object.keys(OBJECT_TYPE_LABELS) as ObjectType[]).map((type) => (
                <label
                  key={type}
                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer"
                >
                  <Checkbox
                    checked={objectTypeFilter.has(type)}
                    onCheckedChange={() => toggleObjectType(type)}
                  />
                  <span className="text-sm">{OBJECT_TYPE_LABELS[type]}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

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
        {schema.tables.length} tables &middot; {schema.views?.length || 0} views
        &middot; {schema.relationships.length} relationships
      </div>

      {/* Disconnect */}
      <Button variant="outline" size="sm" onClick={disconnect} className="h-9">
        Disconnect
      </Button>
    </div>
  );
}

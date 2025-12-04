import { useSchemaStore, ObjectType } from "@/stores/schemaStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Search, X, Database, ChevronDown, Table2, Eye, GitBranch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SettingsSheet } from "@/components/settings-sheet";

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
    selectAllObjectTypes,
    disconnect,
  } = useSchemaStore();

  if (!schema) return null;

  const selectedCount = objectTypeFilter.size;
  const allSelected = selectedCount === 4;

  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-background border-b border-border shadow-sm">
      {/* App title */}
      <div className="flex items-center gap-2 mr-2">
        <Database className="w-5 h-5 text-blue-600" />
        <div className="flex flex-col">
          <span className="font-semibold text-foreground leading-tight">Relova</span>
          <span className="text-[10px] text-muted-foreground leading-tight">By Elliot Layen</span>
        </div>
      </div>

      <div className="w-px h-6 bg-border" />

      {/* Search */}
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
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
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
          >
            <X className="w-3 h-3 text-muted-foreground" />
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 h-9 px-3 text-sm border border-input rounded-md bg-background hover:bg-accent">
            <span>
              {allSelected ? "All Types" : `${selectedCount} Type${selectedCount !== 1 ? "s" : ""}`}
            </span>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-48">
          {!allSelected && (
            <>
              <DropdownMenuItem onSelect={selectAllObjectTypes}>
                All Types
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          {(Object.keys(OBJECT_TYPE_LABELS) as ObjectType[]).map((type) => (
            <DropdownMenuCheckboxItem
              key={type}
              checked={objectTypeFilter.has(type)}
              onCheckedChange={() => toggleObjectType(type)}
            >
              {OBJECT_TYPE_LABELS[type]}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

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
      <TooltipProvider>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="slate" className="gap-1 cursor-default">
                <Table2 className="w-3 h-3" />
                {schema.tables.length}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>{schema.tables.length} Tables</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="emerald" className="gap-1 cursor-default">
                <Eye className="w-3 h-3" />
                {schema.views?.length || 0}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>{schema.views?.length || 0} Views</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="blue" className="gap-1 cursor-default">
                <GitBranch className="w-3 h-3" />
                {schema.relationships.length}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>{schema.relationships.length} Relationships</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      {/* Settings */}
      <SettingsSheet />

      {/* Disconnect */}
      <Button variant="outline" size="sm" onClick={disconnect} className="h-9">
        Disconnect
      </Button>
    </div>
  );
}

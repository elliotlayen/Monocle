import { ChevronDown, FileType } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  FILE_TYPE_OPTIONS,
  coversAllTypes,
  fileTypeSummary,
  patternToTypeIds,
  typeIdsToPattern,
} from "../utils/file-types";

interface FileTypePickerProps {
  /** The glob pattern the picker edits (e.g. "*.xml,*.json"). */
  value: string;
  onChange: (pattern: string) => void;
  ariaLabel: string;
  className?: string;
}

/**
 * Checkbox dropdown over the supported file types; composes the glob
 * pattern the store and backend keep working with. "All types" mirrors the
 * type checkboxes: it checks (and greys out) when every type is checked,
 * and checking it checks every type. A legacy hand-typed pattern shows as
 * a custom entry until a type is picked.
 */
export function FileTypePicker({
  value,
  onChange,
  ariaLabel,
  className,
}: FileTypePickerProps) {
  const ids = patternToTypeIds(value);
  const isCustom = ids === null;
  const allChecked = !isCustom && coversAllTypes(ids);
  // "All types" is the neutral default; anything narrower reads as an
  // active filter, mirroring the "Choose folders" and date controls.
  const isNarrowed = isCustom || !allChecked;

  const toggleType = (id: string) => {
    if (isCustom) {
      onChange(typeIdsToPattern([id]));
      return;
    }
    const current = ids ?? [];
    const next = current.includes(id)
      ? current.filter((i) => i !== id)
      : [...current, id];
    // Unchecking the last type would silently mean "nothing"; ignore it.
    if (next.length === 0) return;
    onChange(typeIdsToPattern(next));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className={cn(
            "inline-flex h-[26px] w-32 items-center gap-1.5 rounded-md border px-2 text-[11px] transition-[transform,background-color,border-color,color] duration-[var(--duration-fast)] ease-[var(--ease-out)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring active:scale-[0.97]",
            isNarrowed
              ? "border-accent-blue/40 bg-accent-blue/10 text-foreground"
              : "border-border bg-muted text-muted-foreground hover:text-foreground",
            className
          )}
        >
          <FileType className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-left">
            {fileTypeSummary(value)}
          </span>
          <ChevronDown className="h-3 w-3 flex-shrink-0 opacity-50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        {isCustom && (
          <>
            <DropdownMenuLabel className="text-[10.5px] font-normal text-muted-foreground">
              Custom: {value}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        {FILE_TYPE_OPTIONS.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.id}
            checked={!isCustom && (ids?.includes(option.id) ?? false)}
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={() => toggleType(option.id)}
          >
            {option.label}
            <span className="ml-auto text-[10px] text-muted-foreground">
              {option.pattern}
            </span>
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={allChecked}
          disabled={allChecked}
          onSelect={(e) => e.preventDefault()}
          onCheckedChange={() => onChange("*")}
        >
          All types
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

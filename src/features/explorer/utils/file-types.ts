/**
 * File-type choices behind the search and scan pattern pickers. The store
 * and backend keep working on glob pattern strings (comma-separated, any
 * match wins); these helpers translate between that and checked type ids.
 */

export interface FileTypeOption {
  id: string;
  label: string;
  pattern: string;
}

export const ALL_FILES_ID = "all";

export const FILE_TYPE_OPTIONS: FileTypeOption[] = [
  { id: "xml", label: "XML", pattern: "*.xml" },
  { id: "json", label: "JSON", pattern: "*.json" },
  { id: "csv", label: "CSV", pattern: "*.csv" },
  { id: "txt", label: "Text", pattern: "*.txt" },
  { id: "log", label: "Log", pattern: "*.log" },
  { id: "edi", label: "EDI", pattern: "*.edi" },
];

/**
 * Parse a stored pattern into checked type ids. Returns null for patterns
 * the picker does not compose (a legacy hand-typed glob), so callers can
 * fall back to showing the raw pattern.
 */
export function patternToTypeIds(pattern: string): string[] | null {
  const trimmed = pattern.trim();
  if (!trimmed || trimmed === "*" || trimmed === "*.*") return [ALL_FILES_ID];
  const ids: string[] = [];
  for (const part of trimmed.split(",")) {
    const p = part.trim();
    if (!p) continue;
    const option = FILE_TYPE_OPTIONS.find((o) => o.pattern === p);
    if (!option) return null;
    if (!ids.includes(option.id)) ids.push(option.id);
  }
  return ids.length > 0 ? ids : null;
}

/** Compose the glob pattern for a set of checked type ids. */
export function typeIdsToPattern(ids: string[]): string {
  if (ids.length === 0 || ids.includes(ALL_FILES_ID)) return "*";
  return FILE_TYPE_OPTIONS.filter((o) => ids.includes(o.id))
    .map((o) => o.pattern)
    .join(",");
}

/** Short trigger label for a pattern ("XML", "XML, JSON", "XML +2", ...). */
export function fileTypeSummary(pattern: string): string {
  const ids = patternToTypeIds(pattern);
  if (!ids) return pattern;
  if (ids.includes(ALL_FILES_ID)) return "All files";
  const labels = FILE_TYPE_OPTIONS.filter((o) => ids.includes(o.id)).map(
    (o) => o.label
  );
  if (labels.length <= 2) return labels.join(", ");
  return `${labels[0]} +${labels.length - 1}`;
}

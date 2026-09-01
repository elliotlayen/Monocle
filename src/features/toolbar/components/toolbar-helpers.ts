import { type ObjectType } from "@/features/schema-graph/store";

export type ExpandedObjectSections = Record<ObjectType, boolean>;

export const createDefaultExpandedObjectSections =
  (): ExpandedObjectSections => ({
    tables: false,
    views: false,
    triggers: false,
    storedProcedures: false,
    scalarFunctions: false,
  });

export const createDefaultExpandedFocusSections =
  (): ExpandedObjectSections => ({
    tables: true,
    views: true,
    triggers: true,
    storedProcedures: true,
    scalarFunctions: true,
  });

export const isObjectSectionExpanded = (
  sectionExpanded: boolean,
  searchText: string,
  matchCount: number
) => (searchText.trim().length > 0 ? matchCount > 0 : sectionExpanded);

export const shouldRenderObjectSection = (visibleCount: number) =>
  visibleCount > 0;

export const filterRowsBySearch = <T extends { id: string }>(
  rows: T[],
  searchText: string
) => {
  const lowerSearch = searchText.trim().toLowerCase();
  if (!lowerSearch) return rows;
  return rows.filter((row) => row.id.toLowerCase().includes(lowerSearch));
};

export const sortRowsById = <T extends { id: string }>(rows: T[]) =>
  [...rows].sort((a, b) =>
    a.id.localeCompare(b.id, undefined, { sensitivity: "base" })
  );

export const mergeRowsById = <T extends { id: string }>(
  rows: T[],
  extraRows: T[]
) => {
  const merged = new Map<string, T>();
  rows.forEach((row) => merged.set(row.id, row));
  extraRows.forEach((row) => merged.set(row.id, row));
  return [...merged.values()];
};

export const stopSectionHeaderToggle = (event: {
  stopPropagation: () => void;
}) => {
  event.stopPropagation();
};

export const getTypeOffSelectionToggleIds = (
  contextRows: { id: string }[],
  excludedObjectIds: Set<string>,
  selectedRowId: string
) => {
  const idsToToggle: string[] = [];
  contextRows.forEach((row) => {
    const shouldBeExcluded = row.id !== selectedRowId;
    const isExcluded = excludedObjectIds.has(row.id);
    if (shouldBeExcluded !== isExcluded) {
      idsToToggle.push(row.id);
    }
  });
  return idsToToggle;
};

export const getSectionSelectionState = (
  contextRows: { id: string }[],
  excludedObjectIds: Set<string>,
  typeEnabled: boolean
) => {
  const totalCount = contextRows.length;
  const selectedCount = typeEnabled
    ? contextRows.filter((row) => !excludedObjectIds.has(row.id)).length
    : 0;
  const sectionChecked = typeEnabled && selectedCount > 0;
  return { totalCount, selectedCount, sectionChecked };
};

export const formatSectionCountLabel = (
  label: string,
  selectedCount: number,
  totalCount: number
) => `${label} (${selectedCount}/${totalCount})`;

export const shouldToggleSectionFromKey = (key: string) =>
  key === "Enter" || key === " ";

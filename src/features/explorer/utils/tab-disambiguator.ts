export function disambiguateTabNames(
  tabs: { filePath: string }[]
): Map<string, string> {
  const nameMap = new Map<string, string>();
  const nameCounts = new Map<string, number>();

  // Count filename occurrences
  for (const tab of tabs) {
    const base = tab.filePath.split(/[/\\]/).pop() ?? "";
    nameCounts.set(base, (nameCounts.get(base) ?? 0) + 1);
  }

  // Build display names
  for (const tab of tabs) {
    const parts = tab.filePath.split(/[/\\]/);
    const base = parts.pop() ?? "";
    if ((nameCounts.get(base) ?? 0) > 1 && parts.length > 0) {
      const parent = parts[parts.length - 1];
      nameMap.set(tab.filePath, `${base} - ${parent}`);
    } else {
      nameMap.set(tab.filePath, base);
    }
  }

  return nameMap;
}

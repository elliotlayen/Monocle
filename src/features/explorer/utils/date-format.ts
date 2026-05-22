export function formatDateFolder(rawName: string): {
  raw: string;
  formatted: string | null;
} {
  if (!/^\d{8}$/.test(rawName)) {
    return { raw: rawName, formatted: null };
  }

  const year = parseInt(rawName.slice(0, 4), 10);
  const month = parseInt(rawName.slice(4, 6), 10);
  const day = parseInt(rawName.slice(6, 8), 10);

  // Validate month range
  if (month < 1 || month > 12) {
    return { raw: rawName, formatted: null };
  }

  // Validate day range
  if (day < 1 || day > 31) {
    return { raw: rawName, formatted: null };
  }

  // Create date and validate it represents a real date
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return { raw: rawName, formatted: null };
  }

  const formatted = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return { raw: rawName, formatted };
}

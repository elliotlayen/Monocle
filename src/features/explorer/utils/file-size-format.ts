export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  if (i === 0) return `${bytes} B`;

  const value = bytes / Math.pow(k, i);
  return `${value % 1 === 0 ? value : value.toFixed(1)} ${units[i]}`;
}

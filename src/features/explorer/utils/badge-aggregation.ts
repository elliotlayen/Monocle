import type {
  ScanFileResult,
  ValidationProblem,
  ValidationStatus,
} from "../types";

/**
 * Compute aggregate badge status for all folder paths from scan results.
 *
 * Iterates all scanned files, extracts every parent directory from each
 * file's path up to and including the scanRoot, and returns a Map where
 * each folder path maps to the worst severity found among its descendants.
 *
 * Severity priority: error > warning > clean
 */
export function computeAggregateBadges(
  files: ScanFileResult[],
  scanRoot: string
): Map<string, ValidationStatus> {
  const folderMap = new Map<string, ValidationStatus>();

  // Normalize scanRoot: strip trailing separators
  const normalizedRoot = scanRoot.replace(/[/\\]+$/, "");

  for (const file of files) {
    const fileStatus: ValidationStatus = file.status as ValidationStatus;

    // Extract parent directories from file path up to scanRoot
    // Normalize path separators to forward slash for consistent splitting
    const normalizedFilePath = file.filePath.replace(/\\/g, "/");
    const normalizedRootForward = normalizedRoot.replace(/\\/g, "/");

    // Get the directory part of the file path
    const lastSlash = normalizedFilePath.lastIndexOf("/");
    if (lastSlash < 0) continue;

    let currentDir = normalizedFilePath.substring(0, lastSlash);

    // Walk up from the file's parent directory to scanRoot
    while (
      currentDir.length >= normalizedRootForward.length &&
      currentDir.startsWith(normalizedRootForward)
    ) {
      // Convert back to original separator style for the map key
      // Use the original path segment to preserve platform separators
      const originalDir = currentDir.replace(/\//g, scanRoot.includes("\\") ? "\\" : "/");

      const existing = folderMap.get(originalDir);
      if (existing !== "error") {
        if (fileStatus === "error") {
          folderMap.set(originalDir, "error");
        } else if (fileStatus === "warning" && existing !== "warning") {
          folderMap.set(originalDir, "warning");
        } else if (!existing) {
          folderMap.set(originalDir, "clean");
        }
      }

      // Move up one directory
      const parentSlash = currentDir.lastIndexOf("/");
      if (parentSlash < 0) break;
      currentDir = currentDir.substring(0, parentSlash);
    }
  }

  return folderMap;
}

/**
 * Compute aggregate badge for a single folder by inspecting the validation cache.
 *
 * Iterates cache entries whose key starts with folderPath, returns worst severity.
 */
export function computeAggregateBadge(
  folderPath: string,
  validationCache: Map<string, { problems: ValidationProblem[] }>
): ValidationStatus | undefined {
  let worst: ValidationStatus | undefined;

  const normalizedFolder = folderPath.replace(/\\/g, "/");

  for (const [filePath, entry] of validationCache) {
    const normalizedFile = filePath.replace(/\\/g, "/");
    if (!normalizedFile.startsWith(normalizedFolder + "/") && normalizedFile !== normalizedFolder) {
      continue;
    }

    const hasError = entry.problems.some((p) => p.severity === "error");
    const hasWarning = entry.problems.some((p) => p.severity === "warning");

    if (hasError) return "error"; // Worst possible, short-circuit
    if (hasWarning) worst = "warning";
    if (!worst) worst = "clean";
  }

  return worst;
}

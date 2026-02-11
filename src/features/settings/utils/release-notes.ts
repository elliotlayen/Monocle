export const MONOCLE_RELEASES_API_URL =
  "https://api.github.com/repos/elliotlayen/Monocle/releases";

export const MONOCLE_RELEASES_PAGE_URL =
  "https://github.com/elliotlayen/Monocle/releases";

export function getReleaseTagCandidates(version: string | null): string[] {
  if (!version) {
    return [];
  }

  return [`v${version}`, version];
}

export function formatReleaseDate(publishedAt: string | null): string | null {
  if (!publishedAt) {
    return null;
  }

  const parsedDate = new Date(publishedAt);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function normalizeReleaseBody(body: string | null): string {
  return body?.trim() ?? "";
}

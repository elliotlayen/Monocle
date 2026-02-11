import { useCallback, useEffect, useState } from "react";
import {
  getReleaseTagCandidates,
  MONOCLE_RELEASES_API_URL,
  normalizeReleaseBody,
} from "@/features/settings/utils/release-notes";

type ReleaseSource = "installed" | "latest";

interface GitHubReleaseResponse {
  tag_name?: string;
  name?: string | null;
  body?: string | null;
  html_url?: string;
  published_at?: string | null;
}

export interface ReleaseNotes {
  tagName: string;
  name: string | null;
  body: string;
  htmlUrl: string;
  publishedAt: string | null;
  source: ReleaseSource;
}

interface UseReleaseNotesResult {
  isLoading: boolean;
  error: string | null;
  data: ReleaseNotes | null;
  retry: () => void;
}

function getReleaseRequestHeaders(): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
  };
}

async function fetchReleaseByTag(tag: string): Promise<GitHubReleaseResponse | null> {
  const response = await fetch(
    `${MONOCLE_RELEASES_API_URL}/tags/${encodeURIComponent(tag)}`,
    {
      headers: getReleaseRequestHeaders(),
    }
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch release tag ${tag} (${response.status})`);
  }

  return (await response.json()) as GitHubReleaseResponse;
}

async function fetchLatestRelease(): Promise<GitHubReleaseResponse | null> {
  const response = await fetch(`${MONOCLE_RELEASES_API_URL}/latest`, {
    headers: getReleaseRequestHeaders(),
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch latest release (${response.status})`);
  }

  return (await response.json()) as GitHubReleaseResponse;
}

function mapRelease(
  release: GitHubReleaseResponse,
  source: ReleaseSource
): ReleaseNotes {
  return {
    tagName: release.tag_name ?? "unknown",
    name: release.name ?? null,
    body: normalizeReleaseBody(release.body ?? null),
    htmlUrl: release.html_url ?? "",
    publishedAt: release.published_at ?? null,
    source,
  };
}

export function useReleaseNotes(version: string | null): UseReleaseNotesResult {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ReleaseNotes | null>(null);
  const [reloadCounter, setReloadCounter] = useState(0);

  const retry = useCallback(() => {
    setReloadCounter((count) => count + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadReleaseNotes = async () => {
      setIsLoading(true);
      setError(null);

      try {
        let release: GitHubReleaseResponse | null = null;
        let source: ReleaseSource = "latest";

        for (const tag of getReleaseTagCandidates(version)) {
          release = await fetchReleaseByTag(tag);
          if (release) {
            source = "installed";
            break;
          }
        }

        if (!release) {
          release = await fetchLatestRelease();
          source = "latest";
        }

        if (!release) {
          throw new Error("No release data is available.");
        }

        if (!cancelled) {
          setData(mapRelease(release, source));
        }
      } catch (loadError) {
        if (!cancelled) {
          setData(null);
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load release notes."
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadReleaseNotes();

    return () => {
      cancelled = true;
    };
  }, [version, reloadCounter]);

  return {
    isLoading,
    error,
    data,
    retry,
  };
}

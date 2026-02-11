import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppVersion } from "@/hooks/useAppVersion";
import { useReleaseNotes } from "@/features/settings/hooks/use-release-notes";
import {
  formatReleaseDate,
  MONOCLE_RELEASES_PAGE_URL,
} from "@/features/settings/utils/release-notes";

export function AboutSettingsSection() {
  const version = useAppVersion();
  const { isLoading, error, data, retry } = useReleaseNotes(version);

  const publishedAt = formatReleaseDate(data?.publishedAt ?? null);
  const releaseUrl = data?.htmlUrl || MONOCLE_RELEASES_PAGE_URL;

  return (
    <div className="space-y-6 px-1">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">About</h3>
        <p className="text-xs text-muted-foreground">
          App details and release notes for this version.
        </p>
      </div>

      <div className="rounded-lg border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p
              className="font-semibold text-sm"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Monocle
            </p>
            <p className="text-xs text-muted-foreground">By Elliot Layen</p>
          </div>
          {version && (
            <span className="rounded-md border px-2 py-1 text-xs text-muted-foreground">
              v{version}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1">
            <p className="text-sm font-medium">
              Release Notes
              {data?.source === "latest" && (
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  (latest fallback)
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {data?.tagName
                ? `${data.tagName}${publishedAt ? ` · ${publishedAt}` : ""}`
                : version
                  ? `Version ${version}`
                  : "Current version"}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              openUrl(releaseUrl).catch(console.error);
            }}
          >
            View On GitHub
          </Button>
        </div>

        {isLoading && (
          <div className="space-y-2 rounded-md border p-4">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-10/12" />
          </div>
        )}

        {!isLoading && error && (
          <div className="rounded-md border p-4 space-y-3">
            <p className="text-sm text-destructive">
              Could not load release notes.
            </p>
            <p className="text-xs text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={retry}>
              Retry
            </Button>
          </div>
        )}

        {!isLoading && !error && data && (
          <div className="max-h-[360px] overflow-y-auto rounded-md border bg-muted/20 p-4">
            {data.body ? (
              <div className="space-y-3 text-sm leading-6 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_p]:text-sm [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-muted [&_pre]:p-3 [&_ul]:list-disc">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    a: ({ href, ...props }) => (
                      <a
                        {...props}
                        href={href}
                        onClick={(event) => {
                          event.preventDefault();
                          if (!href) {
                            return;
                          }
                          openUrl(href).catch(console.error);
                        }}
                      />
                    ),
                  }}
                >
                  {data.body}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No release notes were provided for this release.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

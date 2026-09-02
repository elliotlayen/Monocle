import { useMemo, useRef } from "react";
import { useShallow } from "zustand/shallow";
import { useVirtualizer } from "@tanstack/react-virtual";
import { FileCode, FileText, Folder, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useExplorerStore } from "../store";
import { loadedFilenameMatches } from "../store/selectors";
import type { FilenameResultFile } from "../types";

function RowIcon({ result }: { result: FilenameResultFile }) {
  if (result.isDir)
    return (
      <Folder className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
    );
  if (result.name.toLowerCase().endsWith(".xml"))
    return <FileCode className="h-3.5 w-3.5 flex-shrink-0" />;
  return (
    <FileText className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
  );
}

function highlightSubstring(
  name: string,
  query: string,
  caseSensitive: boolean
): React.ReactNode {
  const q = query.trim();
  if (!q) return name;
  const haystack = caseSensitive ? name : name.toLowerCase();
  const needle = caseSensitive ? q : q.toLowerCase();
  const idx = haystack.indexOf(needle);
  if (idx < 0) return name;
  return (
    <>
      {name.slice(0, idx)}
      <span className="rounded-sm bg-accent-blue/25 text-foreground">
        {name.slice(idx, idx + q.length)}
      </span>
      {name.slice(idx + q.length)}
    </>
  );
}

/** Live flat list of filename matches: instant loaded hits + streamed disk hits. */
export function FilenameResults() {
  const {
    filenameQuery,
    filenameStatus,
    filenameResults,
    filenameSummary,
    scopePaths,
    searchRegex,
    searchCaseSensitive,
    loadedFileIndex,
    treeNodes,
    folderSources,
    searchSourceId,
    selectedPath,
  } = useExplorerStore(
    useShallow((state) => ({
      filenameQuery: state.filenameQuery,
      filenameStatus: state.filenameStatus,
      filenameResults: state.filenameResults,
      filenameSummary: state.filenameSummary,
      scopePaths: state.scopePaths,
      searchRegex: state.searchRegex,
      searchCaseSensitive: state.searchCaseSensitive,
      loadedFileIndex: state.loadedFileIndex,
      treeNodes: state.treeNodes,
      folderSources: state.folderSources,
      searchSourceId: state.searchSourceId,
      selectedPath: state.selectedPath,
    }))
  );

  const activeSource =
    folderSources.find((s) => s.id === searchSourceId) ?? folderSources[0];

  const rows = useMemo(() => {
    const options = { regex: searchRegex, caseSensitive: searchCaseSensitive };
    const loaded = loadedFilenameMatches({
      loadedFileIndex,
      treeNodes,
      scopePaths,
      query: filenameQuery,
      options,
    });
    const seen = new Set(loaded.map((m) => m.path));
    const streamed = filenameResults.filter((r) => !seen.has(r.path));
    return [...loaded, ...streamed];
  }, [
    searchRegex,
    searchCaseSensitive,
    loadedFileIndex,
    treeNodes,
    scopePaths,
    filenameQuery,
    filenameResults,
  ]);

  const scrollParentRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => 28,
    overscan: 10,
    getItemKey: (index) => rows[index]?.path ?? index,
  });

  const relativeDetail = (parentFolder: string) => {
    if (!activeSource) return parentFolder;
    if (parentFolder === activeSource.path) return activeSource.label;
    if (
      parentFolder.startsWith(activeSource.path + "/") ||
      parentFolder.startsWith(activeSource.path + "\\")
    ) {
      return parentFolder
        .slice(activeSource.path.length + 1)
        .replace(/\\/g, "/");
    }
    return parentFolder;
  };

  const handleClick = (result: FilenameResultFile) => {
    const store = useExplorerStore.getState();
    store.setSelectedPath(result.path);
    if (result.isDir) {
      store.setResultsPanelMode("browse");
      void store.revealPath(result.path);
    } else {
      void store.openFile(result.path);
    }
  };

  if (!filenameQuery.trim()) {
    return (
      <div className="flex flex-1 items-center justify-center px-6">
        <p className="text-center text-sm text-muted-foreground">
          Type in the filename field to find files by name, or press Enter in
          the content field to search inside files.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-shrink-0 border-b px-3 py-1.5 text-[11px] text-muted-foreground">
        {filenameStatus === "searching" ? (
          <span className="inline-flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            {rows.length} so far, searching on disk...
          </span>
        ) : (
          <span>
            <b className="font-semibold text-foreground">{rows.length}</b>{" "}
            {rows.length === 1 ? "name matches" : "names match"}
            {filenameSummary?.truncated
              ? " (first 500 on disk; refine your query)"
              : ""}
          </span>
        )}
      </div>
      {rows.length === 0 && filenameStatus !== "searching" ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          No file names match &quot;{filenameQuery}&quot;
        </div>
      ) : (
        <div ref={scrollParentRef} className="min-h-0 flex-1 overflow-auto">
          <div
            className="relative my-1"
            style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const result = rows[virtualRow.index];
              if (!result) return null;
              return (
                <div
                  key={virtualRow.key}
                  ref={rowVirtualizer.measureElement}
                  data-index={virtualRow.index}
                  className="absolute left-0 top-0 w-full"
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                >
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-1 text-left transition-colors duration-[var(--duration-fast)] hover:bg-muted",
                      selectedPath === result.path && "bg-accent"
                    )}
                    onClick={() => handleClick(result)}
                    title={result.path}
                  >
                    <RowIcon result={result} />
                    <span className="truncate text-sm">
                      {searchRegex
                        ? result.name
                        : highlightSubstring(
                            result.name,
                            filenameQuery,
                            searchCaseSensitive
                          )}
                    </span>
                    <span className="ml-auto truncate pl-3 text-[10px] text-muted-foreground">
                      {relativeDetail(result.parentFolder)}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

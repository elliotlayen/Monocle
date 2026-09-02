import { useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/shallow";
import { FileCode, FileText, Folder, History } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useExplorerStore } from "../store";
import type { FolderSource } from "../types";

const MAX_FILE_RESULTS = 50;
const MAX_RECENT_SHOWN = 10;

interface QuickOpenEntry {
  key: string;
  path: string;
  name: string;
  detail: string;
  isDir: boolean;
  icon: "file-xml" | "file" | "folder" | "recent";
}

function relativeDetail(sources: FolderSource[], path: string): string {
  const source = sources.find(
    (s) =>
      path === s.path ||
      path.startsWith(s.path + "/") ||
      path.startsWith(s.path + "\\")
  );
  if (!source) return path;
  if (path === source.path) return source.label;
  const rel = path.slice(source.path.length + 1);
  const parent = rel.split(/[/\\]/).slice(0, -1).join("/");
  return parent ? `${source.label} / ${parent}` : source.label;
}

function EntryIcon({ entry }: { entry: QuickOpenEntry }) {
  if (entry.icon === "folder")
    return <Folder className="h-4 w-4 text-muted-foreground" />;
  if (entry.icon === "recent")
    return <History className="h-4 w-4 text-muted-foreground" />;
  if (entry.icon === "file-xml") return <FileCode className="h-4 w-4" />;
  return <FileText className="h-4 w-4 text-muted-foreground" />;
}

function fileIcon(name: string): "file-xml" | "file" {
  return name.toLowerCase().endsWith(".xml") ? "file-xml" : "file";
}

/**
 * Cmd+P quick-open over open tabs, recent files, favorites, and every
 * file the tree has loaded so far.
 */
export function QuickOpen() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const { tabs, recentFilePaths, folderSources, treeNodes, loadedFileIndex } =
    useExplorerStore(
      useShallow((state) => ({
        tabs: state.tabs,
        recentFilePaths: state.recentFilePaths,
        folderSources: state.folderSources,
        treeNodes: state.treeNodes,
        loadedFileIndex: state.loadedFileIndex,
      }))
    );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (document.activeElement?.closest(".monaco-editor")) return;
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setQuery("");
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (name: string) => !q || name.toLowerCase().includes(q);
    const seen = new Set<string>();

    const openTabs: QuickOpenEntry[] = [];
    for (const tab of tabs) {
      if (tab.isScanResult) continue;
      const name = tab.filePath.split(/[/\\]/).pop() ?? tab.filePath;
      if (!matches(name)) continue;
      seen.add(tab.filePath);
      openTabs.push({
        key: `tab:${tab.filePath}`,
        path: tab.filePath,
        name,
        detail: relativeDetail(folderSources, tab.filePath),
        isDir: false,
        icon: fileIcon(name),
      });
    }

    const recent: QuickOpenEntry[] = [];
    for (const path of recentFilePaths) {
      if (recent.length >= MAX_RECENT_SHOWN) break;
      if (seen.has(path)) continue;
      const name = path.split(/[/\\]/).pop() ?? path;
      if (!matches(name)) continue;
      seen.add(path);
      recent.push({
        key: `recent:${path}`,
        path,
        name,
        detail: relativeDetail(folderSources, path),
        isDir: false,
        icon: "recent",
      });
    }

    const favorites: QuickOpenEntry[] = [];
    for (const source of folderSources) {
      for (const favPath of source.favorites) {
        const name = favPath.split(/[/\\]/).pop() ?? favPath;
        if (!matches(name)) continue;
        favorites.push({
          key: `fav:${favPath}`,
          path: favPath,
          name,
          detail: relativeDetail(folderSources, favPath),
          isDir: true,
          icon: "folder",
        });
      }
    }

    const files: QuickOpenEntry[] = [];
    if (q) {
      const scored: Array<{ entry: QuickOpenEntry; score: number }> = [];
      for (const [id, lowerName] of loadedFileIndex) {
        if (!lowerName.includes(q)) continue;
        if (seen.has(id)) continue;
        const node = treeNodes.get(id);
        if (!node || node.isDir) continue;
        scored.push({
          entry: {
            key: `file:${id}`,
            path: node.path,
            name: node.name,
            detail: relativeDetail(folderSources, node.path),
            isDir: false,
            icon: fileIcon(node.name),
          },
          score: lowerName.startsWith(q) ? 2 : 1,
        });
      }
      scored.sort(
        (a, b) =>
          b.score - a.score || a.entry.name.localeCompare(b.entry.name)
      );
      for (const { entry } of scored.slice(0, MAX_FILE_RESULTS)) {
        files.push(entry);
      }
    }

    return { openTabs, recent, favorites, files };
  }, [query, tabs, recentFilePaths, folderSources, treeNodes, loadedFileIndex]);

  const handleSelect = (entry: QuickOpenEntry) => {
    setOpen(false);
    const store = useExplorerStore.getState();
    if (entry.isDir) {
      store.setActiveView("explorer");
      store.revealPath(entry.path);
    } else {
      store.setSelectedPath(entry.path);
      store.openFile(entry.path);
    }
  };

  const isEmpty =
    groups.openTabs.length === 0 &&
    groups.recent.length === 0 &&
    groups.favorites.length === 0 &&
    groups.files.length === 0;

  const renderGroup = (heading: string, entries: QuickOpenEntry[]) =>
    entries.length > 0 && (
      <CommandGroup heading={heading}>
        {entries.map((entry) => (
          <CommandItem
            key={entry.key}
            value={entry.key}
            onSelect={() => handleSelect(entry)}
          >
            <EntryIcon entry={entry} />
            <span className="truncate">{entry.name}</span>
            <span className="ml-auto truncate pl-4 text-xs text-muted-foreground">
              {entry.detail}
            </span>
          </CommandItem>
        ))}
      </CommandGroup>
    );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-lg top-[30%] translate-y-0">
        <DialogTitle className="sr-only">Go to file</DialogTitle>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Go to file..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {isEmpty && <CommandEmpty>No loaded files match.</CommandEmpty>}
            {renderGroup("Open tabs", groups.openTabs)}
            {renderGroup("Recent", groups.recent)}
            {renderGroup("Favorites", groups.favorites)}
            {renderGroup("Files", groups.files)}
          </CommandList>
          <div className="border-t px-3 py-1.5 text-xs text-muted-foreground">
            Searches files loaded in the tree. Use Search (Cmd+Shift+F) for
            everything on disk.
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

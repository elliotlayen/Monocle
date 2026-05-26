import { useShallow } from "zustand/shallow";
import { AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useExplorerStore } from "../store";
import { FileContentHeader } from "./file-content-header";
import { XmlSourceView } from "./xml-source-view";
import { XmlTreeView } from "./xml-tree-view";

export function FileContentArea() {
  const { tabs, activeTabId, setScrollPosition } = useExplorerStore(
    useShallow((state) => ({
      tabs: state.tabs,
      activeTabId: state.activeTabId,
      setScrollPosition: state.setScrollPosition,
    }))
  );

  const activeTab = tabs.find((t) => t.id === activeTabId);
  if (!activeTab) return null;

  const handleSourceScrollChange = (position: number) => {
    setScrollPosition(activeTab.id, "source", position);
  };

  const handleTreeScrollChange = (position: number) => {
    setScrollPosition(activeTab.id, "tree", position);
  };

  const showParseErrorBanner = activeTab.isXml && activeTab.parseError;
  const showTreeView =
    activeTab.viewMode === "tree" &&
    activeTab.isXml &&
    !activeTab.parseError;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <FileContentHeader tab={activeTab} />
      {showParseErrorBanner && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500 flex-shrink-0" />
          <span className="text-sm text-amber-800 dark:text-amber-200">
            Unable to parse XML tree -- showing source view
          </span>
        </div>
      )}
      {activeTab.isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col gap-2 w-2/3 max-w-md">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      ) : showTreeView ? (
        <XmlTreeView
          content={activeTab.content}
          scrollPosition={activeTab.scrollPosition.tree}
          onScrollChange={handleTreeScrollChange}
        />
      ) : (
        <XmlSourceView
          content={activeTab.content}
          isXml={activeTab.isXml}
          tabId={activeTab.id}
          scrollPosition={activeTab.scrollPosition.source}
          onScrollChange={handleSourceScrollChange}
        />
      )}
    </div>
  );
}

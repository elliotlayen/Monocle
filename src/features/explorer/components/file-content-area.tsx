import { useShallow } from "zustand/shallow";
import { Skeleton } from "@/components/ui/skeleton";
import { useExplorerStore } from "../store";
import { FileContentHeader } from "./file-content-header";
import { XmlSourceView } from "./xml-source-view";

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

  const handleScrollChange = (position: number) => {
    setScrollPosition(activeTab.id, activeTab.viewMode, position);
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <FileContentHeader tab={activeTab} />
      {activeTab.isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col gap-2 w-2/3 max-w-md">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      ) : activeTab.viewMode === "source" ? (
        <XmlSourceView
          content={activeTab.content}
          isXml={activeTab.isXml}
          tabId={activeTab.id}
          scrollPosition={activeTab.scrollPosition.source}
          onScrollChange={handleScrollChange}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          Tree view coming soon
        </div>
      )}
    </div>
  );
}

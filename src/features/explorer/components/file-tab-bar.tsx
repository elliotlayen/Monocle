import { useShallow } from "zustand/shallow";
import { useExplorerStore } from "../store";
import { FileTab } from "./file-tab";

export function FileTabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab, closeOtherTabs, closeAllTabs } =
    useExplorerStore(
      useShallow((state) => ({
        tabs: state.tabs,
        activeTabId: state.activeTabId,
        setActiveTab: state.setActiveTab,
        closeTab: state.closeTab,
        closeOtherTabs: state.closeOtherTabs,
        closeAllTabs: state.closeAllTabs,
      }))
    );

  return (
    <div
      className="flex h-8 items-center overflow-x-auto overflow-y-hidden border-b bg-muted/40"
      style={{ scrollbarWidth: "none" }}
      aria-label={`${tabs.length} files open${tabs.length > 0 ? `, viewing ${tabs.find((t) => t.id === activeTabId)?.fileName ?? ""}` : ""}`}
    >
      <style>{`.file-tab-bar::-webkit-scrollbar { display: none; }`}</style>
      <div className="file-tab-bar flex items-center h-full overflow-x-auto overflow-y-hidden" style={{ scrollbarWidth: "none" }}>
        {tabs.map((tab) => (
          <FileTab
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            onActivate={() => setActiveTab(tab.id)}
            onClose={() => closeTab(tab.id)}
            onCloseOthers={() => closeOtherTabs(tab.id)}
            onCloseAll={closeAllTabs}
          />
        ))}
      </div>
    </div>
  );
}

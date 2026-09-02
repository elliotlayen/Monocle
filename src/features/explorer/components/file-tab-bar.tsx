import { useCallback, useRef } from "react";
import { useShallow } from "zustand/shallow";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ChevronDown, FileCode, FileSearch, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useExplorerStore } from "../store";
import { FileTab } from "./file-tab";
import type { FileTab as FileTabType } from "../types";

function TabListIcon({ tab }: { tab: FileTabType }) {
  if (tab.isScanResult)
    return <FileSearch className="h-3.5 w-3.5 flex-shrink-0" />;
  if (tab.isXml) return <FileCode className="h-3.5 w-3.5 flex-shrink-0" />;
  return <FileText className="h-3.5 w-3.5 flex-shrink-0" />;
}

export function FileTabBar() {
  const {
    tabs,
    activeTabId,
    setActiveTab,
    closeTab,
    closeOtherTabs,
    closeAllTabs,
    moveTab,
    getValidationStatus,
  } = useExplorerStore(
    useShallow((state) => ({
      tabs: state.tabs,
      activeTabId: state.activeTabId,
      setActiveTab: state.setActiveTab,
      closeTab: state.closeTab,
      closeOtherTabs: state.closeOtherTabs,
      closeAllTabs: state.closeAllTabs,
      moveTab: state.moveTab,
      getValidationStatus: state.getValidationStatus,
    }))
  );
  // Re-render tab list dots when validation results change
  useExplorerStore((state) => state.validationCache);

  const scrollRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        moveTab(String(active.id), String(over.id));
      }
    },
    [moveTab]
  );

  // Vertical wheel input scrolls the strip horizontally
  const handleWheel = useCallback((e: React.WheelEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      el.scrollLeft += e.deltaY;
    }
  }, []);

  return (
    <div
      className="flex h-8 items-center border-b bg-muted/40"
      aria-label={`${tabs.length} files open${tabs.length > 0 ? `, viewing ${tabs.find((t) => t.id === activeTabId)?.fileName ?? ""}` : ""}`}
    >
      <style>{`.file-tab-bar::-webkit-scrollbar { display: none; }`}</style>
      <div
        ref={scrollRef}
        className="file-tab-bar flex h-full min-w-0 flex-1 items-center overflow-x-auto overflow-y-hidden"
        style={{ scrollbarWidth: "none" }}
        onWheel={handleWheel}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={tabs.map((t) => t.id)}
            strategy={horizontalListSortingStrategy}
          >
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
          </SortableContext>
        </DndContext>
      </div>

      {/* All-tabs overflow menu */}
      {tabs.length > 1 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 flex-shrink-0 mx-0.5 text-muted-foreground"
              aria-label="List open tabs"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="max-h-80 w-64 overflow-y-auto"
          >
            {tabs.map((tab) => {
              const status = tab.isScanResult
                ? undefined
                : getValidationStatus(tab.filePath);
              return (
                <DropdownMenuItem
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={tab.id === activeTabId ? "bg-accent" : undefined}
                >
                  <TabListIcon tab={tab} />
                  <span className="truncate">{tab.fileName}</span>
                  {status === "error" && (
                    <span className="ml-auto h-2 w-2 flex-shrink-0 rounded-full bg-destructive" />
                  )}
                  {status === "warning" && (
                    <span className="ml-auto h-2 w-2 flex-shrink-0 rounded-full bg-warning" />
                  )}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

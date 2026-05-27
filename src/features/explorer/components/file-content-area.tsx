import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/shallow";
import { AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useExplorerStore } from "../store";
import { FileContentHeader } from "./file-content-header";
import { XmlSourceView, type XmlSourceViewHandle } from "./xml-source-view";
import { XmlTreeView, type XmlTreeViewHandle } from "./xml-tree-view";
import { ProblemsPanel } from "./problems-panel";
import { ValidationStatusBar } from "./validation-status-bar";
import { ScanResultsTab } from "./scan-results-tab";

export function FileContentArea() {
  const treeViewRef = useRef<XmlTreeViewHandle>(null);
  const sourceViewRef = useRef<XmlSourceViewHandle>(null);
  const contentAreaRef = useRef<HTMLDivElement>(null);

  const {
    tabs,
    activeTabId,
    setScrollPosition,
    setTreeExpandedIds,
    setMonacoViewState,
    problemsPanelOpen,
    problemsPanelHeight,
    pendingJump,
    toggleProblemsPanel,
    setProblemsPanelHeight,
    jumpToProblem,
    clearPendingJump,
  } = useExplorerStore(
    useShallow((state) => ({
      tabs: state.tabs,
      activeTabId: state.activeTabId,
      setScrollPosition: state.setScrollPosition,
      setTreeExpandedIds: state.setTreeExpandedIds,
      setMonacoViewState: state.setMonacoViewState,
      problemsPanelOpen: state.problemsPanelOpen,
      problemsPanelHeight: state.problemsPanelHeight,
      pendingJump: state.pendingJump,
      toggleProblemsPanel: state.toggleProblemsPanel,
      setProblemsPanelHeight: state.setProblemsPanelHeight,
      jumpToProblem: state.jumpToProblem,
      clearPendingJump: state.clearPendingJump,
    }))
  );

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const treeExpandedIds = useMemo(
    () => new Set(activeTab?.treeExpandedIds ?? []),
    [activeTab?.treeExpandedIds]
  );

  const handleTreeExpandedIdsChange = useCallback(
    (ids: Set<string>) => {
      if (activeTab) setTreeExpandedIds(activeTab.id, Array.from(ids));
    },
    [activeTab?.id, setTreeExpandedIds]
  );

  const handleViewStateChange = useCallback(
    (state: unknown | null) => {
      if (activeTab) setMonacoViewState(activeTab.id, state);
    },
    [activeTab?.id, setMonacoViewState]
  );

  const handleProblemClick = useCallback(
    (line: number, column: number) => {
      if (activeTabId) jumpToProblem(activeTabId, line, column);
    },
    [activeTabId, jumpToProblem]
  );

  const [isDragging, setIsDragging] = useState(false);
  const [dragHeight, setDragHeight] = useState(problemsPanelHeight);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  useEffect(() => {
    if (!isDragging) {
      setDragHeight(problemsPanelHeight);
    }
  }, [problemsPanelHeight, isDragging]);

  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startYRef.current = e.clientY;
    startHeightRef.current = dragHeight;
    setIsDragging(true);
  }, [dragHeight]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = startYRef.current - e.clientY;
      const maxHeight = contentAreaRef.current
        ? contentAreaRef.current.clientHeight * 0.5
        : 400;
      const newHeight = Math.max(
        100,
        Math.min(maxHeight, startHeightRef.current + delta)
      );
      setDragHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setDragHeight((currentHeight) => {
        setProblemsPanelHeight(currentHeight);
        return currentHeight;
      });
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, setProblemsPanelHeight]);

  if (!activeTab) return null;

  // Render scan results tab for the synthetic scan:results tab
  if (activeTab.id === "scan:results") {
    return <ScanResultsTab />;
  }

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

  const errorCount = activeTab.problems.filter(
    (p) => p.severity === "error"
  ).length;
  const warningCount = activeTab.problems.filter(
    (p) => p.severity === "warning"
  ).length;

  const hasProblems = activeTab.problems.length > 0;

  return (
    <div ref={contentAreaRef} className="flex flex-col flex-1 overflow-hidden">
      <FileContentHeader
        tab={activeTab}
        onExpandAll={showTreeView ? () => treeViewRef.current?.expandAll() : () => sourceViewRef.current?.unfoldAll()}
        onCollapseAll={showTreeView ? () => treeViewRef.current?.collapseAll() : () => sourceViewRef.current?.foldAll()}
      />
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
          ref={treeViewRef}
          content={activeTab.content}
          scrollPosition={activeTab.scrollPosition.tree}
          onScrollChange={handleTreeScrollChange}
          expandedIds={treeExpandedIds}
          onExpandedIdsChange={handleTreeExpandedIdsChange}
        />
      ) : (
        <XmlSourceView
          ref={sourceViewRef}
          content={activeTab.content}
          isXml={activeTab.isXml}
          tabId={activeTab.id}
          scrollPosition={activeTab.scrollPosition.source}
          onScrollChange={handleSourceScrollChange}
          savedViewState={activeTab.monacoViewState}
          onViewStateChange={handleViewStateChange}
          problems={activeTab.problems}
          pendingJump={pendingJump}
          onJumpHandled={clearPendingJump}
        />
      )}
      {problemsPanelOpen && (
        <>
          <div
            className="h-1 cursor-row-resize hover:bg-muted flex-shrink-0"
            onMouseDown={startDrag}
          />
          <div
            style={{ height: dragHeight }}
            className="flex-shrink-0 overflow-hidden"
          >
            <ProblemsPanel
              problems={activeTab.problems}
              isOpen={problemsPanelOpen}
              onToggle={toggleProblemsPanel}
              onProblemClick={handleProblemClick}
            />
          </div>
        </>
      )}
      {!problemsPanelOpen && hasProblems && (
        <div className="flex-shrink-0">
          <ProblemsPanel
            problems={activeTab.problems}
            isOpen={false}
            onToggle={toggleProblemsPanel}
            onProblemClick={handleProblemClick}
          />
        </div>
      )}
      <ValidationStatusBar
        errorCount={errorCount}
        warningCount={warningCount}
        encoding={activeTab.encoding || "UTF-8"}
        onClick={toggleProblemsPanel}
      />
    </div>
  );
}

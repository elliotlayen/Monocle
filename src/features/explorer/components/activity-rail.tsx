import { useShallow } from "zustand/shallow";
import {
  FolderTree,
  Search,
  ScanSearch,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useExplorerStore } from "../store";
import type { ExplorerView } from "../store/ui-slice";

interface ActivityRailProps {
  onOpenSettings: () => void;
}

const VIEWS: Array<{
  id: ExplorerView;
  label: string;
  shortcut: string;
  icon: typeof FolderTree;
}> = [
  { id: "explorer", label: "Explorer", shortcut: "Cmd+Shift+E", icon: FolderTree },
  { id: "search", label: "Search", shortcut: "Cmd+Shift+F", icon: Search },
  { id: "scan", label: "Scan", shortcut: "Cmd+Shift+S", icon: ScanSearch },
];

export function ActivityRail({ onOpenSettings }: ActivityRailProps) {
  const { activeView, setActiveView, sidebarOpen, setSidebarOpen } =
    useExplorerStore(
      useShallow((state) => ({
        activeView: state.activeView,
        setActiveView: state.setActiveView,
        sidebarOpen: state.sidebarOpen,
        setSidebarOpen: state.setSidebarOpen,
      }))
    );

  return (
    <div className="panel-glass absolute bottom-3 left-3 top-14 z-20 flex w-11 flex-col items-center gap-1 py-2">
      <TooltipProvider>
        {VIEWS.map(({ id, label, shortcut, icon: Icon }) => {
          const isActive = activeView === id && sidebarOpen;
          return (
            <Tooltip key={id}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-pressed={isActive}
                  className={cn(
                    "relative h-9 w-9",
                    isActive
                      ? "bg-accent-blue/15 text-accent-blue hover:bg-accent-blue/20 hover:text-accent-blue"
                      : "text-muted-foreground"
                  )}
                  onClick={() => {
                    if (activeView === id && sidebarOpen) {
                      setSidebarOpen(false);
                    } else {
                      setActiveView(id);
                    }
                  }}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-accent-blue" />
                  )}
                  <Icon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {label} ({shortcut})
              </TooltipContent>
            </Tooltip>
          );
        })}

        <div className="flex-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeftOpen className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {sidebarOpen ? "Hide sidebar (Cmd+B)" : "Show sidebar (Cmd+B)"}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground"
              onClick={onOpenSettings}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Settings</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

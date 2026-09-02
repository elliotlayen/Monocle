import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LogOut, Settings } from "lucide-react";
import { MonocleLogo } from "@/features/connection/components/monocle-logo";

interface ExplorerNavBarProps {
  onHome: () => void;
  onOpenSettings: () => void;
}

export function ExplorerNavBar({ onHome, onOpenSettings }: ExplorerNavBarProps) {
  return (
    // Floats over the explorer panels like the graph toolbar: bare logo on
    // the left, a glass action group on the right.
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start px-3 pt-3">
      <div className="pointer-events-auto flex h-9 items-center">
        <MonocleLogo className="h-6 w-6" />
      </div>
      <div className="flex-1" />
      <div className="pointer-events-auto panel-glass flex h-9 items-center gap-1 px-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={onOpenSettings}>
                <Settings className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Settings</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={onHome}
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Leave Explorer</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}

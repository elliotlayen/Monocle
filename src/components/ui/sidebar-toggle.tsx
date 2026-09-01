import { PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SidebarToggleProps {
  onClick: () => void;
  visible: boolean;
}

export function SidebarToggle({ onClick, visible }: SidebarToggleProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        "panel-glass absolute top-14 left-3 z-10",
        "transition-opacity duration-[var(--duration-base)] ease-[var(--ease-out)]",
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
      onClick={onClick}
    >
      <PanelLeft className="h-4 w-4" />
      <span className="sr-only">Open sidebar</span>
    </Button>
  );
}

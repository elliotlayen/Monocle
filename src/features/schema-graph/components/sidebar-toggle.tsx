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
      variant="outline"
      size="icon"
      className={cn(
        "absolute top-4 left-4 z-10 h-9 w-9 bg-background shadow-sm",
        "transition-opacity duration-200",
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
      onClick={onClick}
    >
      <PanelLeft className="h-4 w-4" />
      <span className="sr-only">Open details panel</span>
    </Button>
  );
}

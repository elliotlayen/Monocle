import { Server, Settings, Info, PenTool } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MonocleLogo } from "./monocle-logo";


interface HomeScreenProps {
  onOpenConnectionModal?: () => void;
  onOpenSettings?: () => void;
  onOpenAbout?: () => void;
  onEnterCanvasMode?: () => void;
}

export function HomeScreen({
  onOpenConnectionModal,
  onOpenSettings,
  onOpenAbout,
  onEnterCanvasMode,
}: HomeScreenProps) {

  const isMac =
    typeof navigator !== "undefined" &&
    navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  const modKey = isMac ? "Cmd" : "Ctrl";

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-muted p-8">
      {/* Hero - Logo and Title */}
      <div className="flex items-center mb-12">
        <MonocleLogo className="w-16 h-16" />
        <h1
          className="text-5xl font-bold"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          Monocle
        </h1>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-2 w-80">
        <Button
          variant="outline"
          className="w-full h-12 justify-between px-4"
          onClick={onOpenConnectionModal}
        >
          <span className="flex items-center gap-3">
            <Server className="w-5 h-5" />
            Connect to Server
          </span>
          <kbd className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
            {modKey}+N
          </kbd>
        </Button>

        <Button
          variant="outline"
          className="w-full h-12 justify-between px-4"
          onClick={onEnterCanvasMode}
        >
          <span className="flex items-center gap-3">
            <PenTool className="w-5 h-5" />
            Canvas Mode
          </span>
          <kbd className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
            {modKey}+K
          </kbd>
        </Button>

        <Button
          variant="outline"
          className="w-full h-12 justify-between px-4"
          onClick={onOpenSettings}
        >
          <span className="flex items-center gap-3">
            <Settings className="w-5 h-5" />
            Settings
          </span>
          <kbd className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
            {modKey}+,
          </kbd>
        </Button>

        <Button
          variant="outline"
          className="w-full h-12 justify-start px-4"
          onClick={onOpenAbout}
        >
          <span className="flex items-center gap-3">
            <Info className="w-5 h-5" />
            About
          </span>
        </Button>
      </div>
    </div>
  );
}

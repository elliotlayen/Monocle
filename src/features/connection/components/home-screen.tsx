import { useState, useEffect, useCallback } from "react";
import { Server, Settings, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MonocleLogo } from "./monocle-logo";
import { ConnectionModal } from "./connection-modal";
import { useTheme } from "@/providers/theme-provider";
import { useAppVersion } from "@/hooks/useAppVersion";

export function HomeScreen() {
  const [connectionModalOpen, setConnectionModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const version = useAppVersion();

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
    const modifier = isMac ? e.metaKey : e.ctrlKey;

    if (modifier && e.key === "n") {
      e.preventDefault();
      setConnectionModalOpen(true);
    } else if (modifier && e.key === ",") {
      e.preventDefault();
      setSettingsOpen(true);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const isMac =
    typeof navigator !== "undefined" &&
    navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  const modKey = isMac ? "⌘" : "Ctrl+";

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
          onClick={() => setConnectionModalOpen(true)}
        >
          <span className="flex items-center gap-3">
            <Server className="w-5 h-5" />
            Connect to Server
          </span>
          <kbd className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
            {modKey}N
          </kbd>
        </Button>

        <Button
          variant="outline"
          className="w-full h-12 justify-between px-4"
          onClick={() => setSettingsOpen(true)}
        >
          <span className="flex items-center gap-3">
            <Settings className="w-5 h-5" />
            Settings
          </span>
          <kbd className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
            {modKey},
          </kbd>
        </Button>

        <Button
          variant="outline"
          className="w-full h-12 justify-start px-4"
          onClick={() => setAboutOpen(true)}
        >
          <span className="flex items-center gap-3">
            <Info className="w-5 h-5" />
            About
          </span>
        </Button>
      </div>

      {/* Connection Modal */}
      <ConnectionModal
        open={connectionModalOpen}
        onOpenChange={setConnectionModalOpen}
      />

      {/* Settings Sheet */}
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Settings</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Theme</label>
              <Select value={theme} onValueChange={setTheme}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select theme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose your preferred color scheme
              </p>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* About Dialog */}
      <Dialog open={aboutOpen} onOpenChange={setAboutOpen}>
        <DialogContent className="sm:max-w-sm bg-muted">
          <DialogHeader>
            <DialogTitle className="sr-only">About Monocle</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center py-4">
            <MonocleLogo className="w-20 h-20 mb-4" />
            <h2
              className="text-2xl font-bold mb-1"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Monocle
            </h2>
            {version && (
              <p className="text-sm text-muted-foreground mb-4">
                Version {version}
              </p>
            )}
            <p className="text-sm text-muted-foreground">By Elliot Layen</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

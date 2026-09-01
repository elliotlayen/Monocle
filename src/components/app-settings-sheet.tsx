import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FolderSync, Info, Network, Palette, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { GraphSettingsSection } from "@/features/settings/components/sections/graph-settings-section";
import { AppearanceSettingsSection } from "@/features/settings/components/sections/appearance-settings-section";
import { FolderSourcesSection } from "@/features/settings/components/sections/folder-sources-section";
import { ExplorerSettingsSection } from "@/features/settings/components/sections/explorer-settings-section";
import { AboutSettingsSection } from "@/features/settings/components/sections/about-settings-section";

interface AppSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SettingsSectionId = "graph" | "appearance" | "sources" | "explorer" | "about";

const SETTINGS_SECTIONS: Array<{
  id: SettingsSectionId;
  label: string;
  icon: typeof Network;
}> = [
  { id: "graph", label: "Graph", icon: Network },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "sources", label: "Sources", icon: FolderSync },
  { id: "explorer", label: "Explorer", icon: Search },
  { id: "about", label: "About", icon: Info },
];

export function AppSettingsSheet({ open, onOpenChange }: AppSettingsSheetProps) {
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("graph");

  useEffect(() => {
    if (open) {
      setActiveSection("graph");
    }
  }, [open]);

  const renderActiveSection = () => {
    switch (activeSection) {
      case "graph":
        return <GraphSettingsSection />;
      case "appearance":
        return <AppearanceSettingsSection />;
      case "sources":
        return <FolderSourcesSection />;
      case "explorer":
        return <ExplorerSettingsSection />;
      case "about":
        return <AboutSettingsSection />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:h-[min(90vh,42rem)] sm:max-w-3xl">
        <DialogHeader className="h-16 justify-center px-6">
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 border-t">
          <div className="flex h-full min-h-0">
            <nav className="flex w-48 shrink-0 flex-col gap-0.5 overflow-y-auto border-r p-2">
              {SETTINGS_SECTIONS.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                return (
                  <Button
                    key={section.id}
                    variant="ghost"
                    className={cn(
                      "justify-start gap-2",
                      isActive &&
                        "bg-accent-blue/12 text-accent-blue hover:bg-accent-blue/18 hover:text-accent-blue"
                    )}
                    onClick={() => setActiveSection(section.id)}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{section.label}</span>
                  </Button>
                );
              })}
            </nav>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-3 sm:px-6 sm:pt-4">
              {renderActiveSection()}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

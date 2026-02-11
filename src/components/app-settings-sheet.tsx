import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Info, Network, Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import { GraphSettingsSection } from "@/features/settings/components/sections/graph-settings-section";
import { AppearanceSettingsSection } from "@/features/settings/components/sections/appearance-settings-section";
import { AboutSettingsSection } from "@/features/settings/components/sections/about-settings-section";

interface AppSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SettingsSectionId = "graph" | "appearance" | "about";

const SETTINGS_SECTIONS: Array<{
  id: SettingsSectionId;
  label: string;
  icon: typeof Network;
}> = [
  { id: "graph", label: "Graph", icon: Network },
  { id: "appearance", label: "Appearance", icon: Palette },
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
          <div className="border-b px-3 pb-3 sm:hidden">
            <div className="grid grid-cols-3 gap-2">
              {SETTINGS_SECTIONS.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                return (
                  <Button
                    key={section.id}
                    variant={isActive ? "secondary" : "ghost"}
                    size="sm"
                    className={cn("w-full justify-center gap-2")}
                    onClick={() => setActiveSection(section.id)}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-xs">{section.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="flex h-full min-h-0">
            <nav className="hidden w-52 shrink-0 flex-col gap-1 overflow-y-auto border-r p-2 sm:flex">
              {SETTINGS_SECTIONS.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                return (
                  <Button
                    key={section.id}
                    variant={isActive ? "secondary" : "ghost"}
                    className="justify-start gap-2"
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

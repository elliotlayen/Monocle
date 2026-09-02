import { useEffect, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  FolderSync,
  Info,
  Network,
  Palette,
  PenTool,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useSchemaStore,
  type SchemaStore,
} from "@/features/schema-graph/store";
import { GraphSettingsSection } from "@/features/settings/components/sections/graph-settings-section";
import { CanvasDisplaySettingsSection } from "@/features/settings/components/sections/canvas-display-settings-section";
import { AppearanceSettingsSection } from "@/features/settings/components/sections/appearance-settings-section";
import { FolderSourcesSection } from "@/features/settings/components/sections/folder-sources-section";
import { AboutSettingsSection } from "@/features/settings/components/sections/about-settings-section";

interface AppSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export type SettingsSectionId =
  | "schema-graph"
  | "canvas-display"
  | "explorer-sources"
  | "general-appearance"
  | "general-about";

interface SettingsSection {
  id: SettingsSectionId;
  label: string;
  icon: LucideIcon;
  render: () => ReactNode;
}

interface SettingsGroup {
  id: string;
  title: string;
  sections: SettingsSection[];
}

// Nav is grouped by feature so each mode's settings sit together.
const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    id: "schema",
    title: "Schema Browser",
    sections: [
      {
        id: "schema-graph",
        label: "Graph",
        icon: Network,
        render: () => <GraphSettingsSection />,
      },
    ],
  },
  {
    id: "canvas",
    title: "Canvas Mode",
    sections: [
      {
        id: "canvas-display",
        label: "Display",
        icon: PenTool,
        render: () => <CanvasDisplaySettingsSection />,
      },
    ],
  },
  {
    id: "explorer",
    title: "Integration Explorer",
    sections: [
      {
        id: "explorer-sources",
        label: "Sources",
        icon: FolderSync,
        render: () => <FolderSourcesSection />,
      },
    ],
  },
  {
    id: "general",
    title: "General",
    sections: [
      {
        id: "general-appearance",
        label: "Appearance",
        icon: Palette,
        render: () => <AppearanceSettingsSection />,
      },
      {
        id: "general-about",
        label: "About",
        icon: Info,
        render: () => <AboutSettingsSection />,
      },
    ],
  },
];

const ALL_SECTIONS = SETTINGS_GROUPS.flatMap((group) => group.sections);

// Opening settings lands on the group for whatever the user is doing.
const DEFAULT_SECTION_BY_MODE: Record<SchemaStore["mode"], SettingsSectionId> =
  {
    connected: "schema-graph",
    canvas: "canvas-display",
    explorer: "explorer-sources",
  };

export function AppSettingsSheet({
  open,
  onOpenChange,
}: AppSettingsSheetProps) {
  const mode = useSchemaStore((state) => state.mode);
  const [activeSection, setActiveSection] =
    useState<SettingsSectionId>("schema-graph");

  useEffect(() => {
    if (open) {
      setActiveSection(DEFAULT_SECTION_BY_MODE[mode]);
    }
  }, [open, mode]);

  const active = ALL_SECTIONS.find((section) => section.id === activeSection);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:h-[min(90vh,42rem)] sm:max-w-3xl">
        <DialogHeader className="h-16 justify-center px-6">
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 border-t">
          <div className="flex h-full min-h-0">
            <nav className="flex w-48 shrink-0 flex-col overflow-y-auto border-r p-2">
              {SETTINGS_GROUPS.map((group, groupIndex) => (
                <div key={group.id} className="flex flex-col gap-0.5">
                  <div
                    className={cn(
                      "px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground",
                      groupIndex === 0 ? "pt-1" : "pt-3"
                    )}
                  >
                    {group.title}
                  </div>
                  {group.sections.map((section) => {
                    const Icon = section.icon;
                    const isActive = activeSection === section.id;
                    return (
                      <Button
                        key={section.id}
                        variant="ghost"
                        aria-current={isActive ? "page" : undefined}
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
                </div>
              ))}
            </nav>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-3 sm:px-6 sm:pt-4">
              {active?.render()}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

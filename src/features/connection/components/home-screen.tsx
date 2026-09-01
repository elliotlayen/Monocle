import { Server, Settings, Info, PenTool, FolderSync } from "lucide-react";
import { MonocleLogo } from "./monocle-logo";

interface HomeScreenProps {
  onOpenConnectionModal?: () => void;
  onOpenSettings?: () => void;
  onOpenAbout?: () => void;
  onEnterCanvasMode?: () => void;
  onEnterExplorer?: () => void;
}

interface HomeAction {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick?: () => void;
}

function HomeActionRow({
  action,
  delayMs,
}: {
  action: HomeAction;
  delayMs: number;
}) {
  return (
    <button
      className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-xs transition-[background-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-backwards hover:bg-accent active:scale-[0.99]"
      style={{ animationDelay: `${delayMs}ms` }}
      onClick={action.onClick}
    >
      <span className="text-muted-foreground">{action.icon}</span>
      <span className="flex-1 font-medium">{action.label}</span>
      {action.shortcut && (
        <kbd className="rounded-sm border px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {action.shortcut}
        </kbd>
      )}
    </button>
  );
}

export function HomeScreen({
  onOpenConnectionModal,
  onOpenSettings,
  onOpenAbout,
  onEnterCanvasMode,
  onEnterExplorer,
}: HomeScreenProps) {
  const isMac =
    typeof navigator !== "undefined" &&
    navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  const modKey = isMac ? "Cmd" : "Ctrl";

  const actions: HomeAction[] = [
    {
      icon: <Server className="h-4 w-4" />,
      label: "Schema Browser",
      shortcut: `${modKey}+N`,
      onClick: onOpenConnectionModal,
    },
    {
      icon: <PenTool className="h-4 w-4" />,
      label: "Canvas Mode",
      shortcut: `${modKey}+K`,
      onClick: onEnterCanvasMode,
    },
    {
      icon: <FolderSync className="h-4 w-4" />,
      label: "Integration Explorer",
      shortcut: `${modKey}+E`,
      onClick: onEnterExplorer,
    },
    {
      icon: <Settings className="h-4 w-4" />,
      label: "Settings",
      shortcut: `${modKey}+,`,
      onClick: onOpenSettings,
    },
    {
      icon: <Info className="h-4 w-4" />,
      label: "About",
      onClick: onOpenAbout,
    },
  ];

  return (
    <div className="dot-grid flex h-screen flex-col items-center justify-center bg-background p-8">
      <div className="panel-glass w-96 animate-in fade-in-0 zoom-in-95 duration-[var(--duration-slow)] ease-[var(--ease-out)]">
        {/* Hero - Logo and wordmark */}
        <div className="flex items-center gap-3 border-b px-5 py-5">
          <MonocleLogo className="h-9 w-9" />
          <div>
            <h1 className="text-lg font-bold leading-tight tracking-wide">
              Monocle
            </h1>
            <p className="text-[11px] text-muted-foreground">
              SQL Server schema visualizer
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-0.5 p-2">
          {actions.map((action, index) => (
            <HomeActionRow
              key={action.label}
              action={action}
              delayMs={60 + index * 40}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

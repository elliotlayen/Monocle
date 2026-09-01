import { toast as sonnerToast } from "sonner";
import {
  CheckCircle,
  XCircle,
  Info,
  AlertTriangle,
  Download,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface Toast {
  id: string;
  type: "info" | "success" | "error" | "warning" | "update";
  title: string;
  message?: string;
  duration?: number; // ms, 0 = persistent
  progress?: { current: number; total: number };
  actions?: { label: string; onClick: () => void }[];
}

const iconMap = {
  info: Info,
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  update: Download,
};

const iconColorMap = {
  info: "text-muted-foreground",
  success: "text-object-views",
  error: "text-destructive",
  warning: "text-object-triggers",
  update: "text-accent-blue",
};

function getDefaultDuration(type: Toast["type"]): number {
  switch (type) {
    case "success":
      return 3000;
    case "info":
      return 2000;
    case "error":
    case "warning":
    case "update":
      return 0; // Persistent by default
  }
}

/** Headless Sonner content rendered in the Instrument style. */
function MonocleToast({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  const Icon = iconMap[toast.type];
  const hasProgress = Boolean(toast.progress && toast.progress.total > 0);
  const progressPercent = hasProgress
    ? Math.round((toast.progress!.current / toast.progress!.total) * 100)
    : 0;

  return (
    <div className="panel-glass w-[340px] p-3.5">
      <div className="flex gap-3">
        <Icon
          className={cn("mt-0.5 h-4 w-4 shrink-0", iconColorMap[toast.type])}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-medium leading-tight">{toast.title}</p>
            <button
              onClick={onDismiss}
              aria-label={`Dismiss ${toast.title}`}
              className="-mr-1 -mt-1 shrink-0 p-1 text-muted-foreground transition-colors duration-[var(--duration-fast)] hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {toast.message && (
            <p className="mt-1 text-xs text-muted-foreground">
              {toast.message}
            </p>
          )}
          {hasProgress && (
            <div className="mt-3 space-y-1">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                {/* Width via transform so rapid progress ticks stay cheap and interruptible. */}
                <div
                  className="h-full w-full origin-left rounded-full bg-accent-blue transition-transform duration-[var(--duration-slow)] ease-[var(--ease-out)]"
                  style={{ transform: `scaleX(${progressPercent / 100})` }}
                />
              </div>
              <p className="text-[10px] tabular-nums text-muted-foreground">
                {progressPercent}%
              </p>
            </div>
          )}
          {toast.actions && toast.actions.length > 0 && (
            <div className="mt-3 flex gap-2">
              {toast.actions.map((action, index) => (
                <Button
                  key={index}
                  variant={
                    index === toast.actions!.length - 1 ? "default" : "outline"
                  }
                  size="sm"
                  onClick={action.onClick}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Sonner is the renderer; this module keeps the app's toast API. Toast data
// is tracked per id so updateToast can merge partial updates (progress ticks)
// into a re-issued toast.custom with the same id.
const activeToasts = new Map<string, Toast>();
let toastIdCounter = 0;

function render(data: Toast) {
  const duration = data.duration ?? getDefaultDuration(data.type);
  sonnerToast.custom(
    () => (
      <MonocleToast toast={data} onDismiss={() => removeToastById(data.id)} />
    ),
    {
      id: data.id,
      duration: duration <= 0 ? Infinity : duration,
      onDismiss: () => activeToasts.delete(data.id),
      onAutoClose: () => activeToasts.delete(data.id),
    }
  );
}

function addToastData(toast: Omit<Toast, "id">): string {
  const id = `toast-${++toastIdCounter}`;
  const data: Toast = { ...toast, id };
  activeToasts.set(id, data);
  render(data);
  return id;
}

function updateToastById(id: string, updates: Partial<Omit<Toast, "id">>) {
  const existing = activeToasts.get(id);
  if (!existing) return;
  const data: Toast = { ...existing, ...updates, id };
  activeToasts.set(id, data);
  render(data);
}

function removeToastById(id: string) {
  activeToasts.delete(id);
  sonnerToast.dismiss(id);
}

function clearAllToasts() {
  activeToasts.clear();
  sonnerToast.dismiss();
}

const toastApi = {
  addToast: addToastData,
  updateToast: updateToastById,
  removeToast: removeToastById,
  clearAll: clearAllToasts,
};

/**
 * Same call surface as the previous zustand store; state now lives in
 * Sonner, so this returns stable functions.
 */
export function useToastStore() {
  return toastApi;
}

useToastStore.getState = () => toastApi;

// Helper function to show a toast outside of React components
export function showToast(toast: Omit<Toast, "id">): string {
  return addToastData(toast);
}

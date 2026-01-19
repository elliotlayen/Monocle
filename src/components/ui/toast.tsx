import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  CheckCircle,
  XCircle,
  Info,
  AlertTriangle,
  Download,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import type { Toast as ToastType } from "@/features/notifications/store";

const toastVariants = cva(
  "relative w-full max-w-[360px] rounded-lg border bg-card p-4 shadow-lg transition-all",
  {
    variants: {
      type: {
        info: "border-border",
        success: "border-green-500/30",
        error: "border-destructive/30",
        warning: "border-yellow-500/30",
        update: "border-blue-500/30",
      },
    },
    defaultVariants: {
      type: "info",
    },
  }
);

const iconMap = {
  info: Info,
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  update: Download,
};

const iconColorMap = {
  info: "text-muted-foreground",
  success: "text-green-500",
  error: "text-destructive",
  warning: "text-yellow-500",
  update: "text-blue-500",
};

interface ToastProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof toastVariants> {
  toast: ToastType;
  onDismiss: () => void;
}

const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  ({ className, toast, onDismiss, ...props }, ref) => {
    const Icon = iconMap[toast.type];
    const iconColor = iconColorMap[toast.type];
    const hasProgress =
      toast.progress && toast.progress.total > 0;
    const progressPercent = hasProgress
      ? Math.round((toast.progress!.current / toast.progress!.total) * 100)
      : 0;

    return (
      <div
        ref={ref}
        className={cn(toastVariants({ type: toast.type }), className)}
        {...props}
      >
        <div className="flex gap-3">
          <Icon className={cn("h-5 w-5 shrink-0 mt-0.5", iconColor)} />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium leading-tight">{toast.title}</p>
              {(toast.duration === undefined || toast.duration > 0) && (
                <button
                  onClick={onDismiss}
                  aria-label={`Dismiss ${toast.title}`}
                  className="shrink-0 text-muted-foreground hover:text-foreground transition-colors -mt-1 -mr-1 p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {toast.message && (
              <p className="text-sm text-muted-foreground mt-1">
                {toast.message}
              </p>
            )}
            {hasProgress && (
              <div className="mt-3 space-y-1">
                <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${progressPercent}%`,
                      background: "linear-gradient(90deg, #4fb8ff, #3be082)",
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {progressPercent}%
                </p>
              </div>
            )}
            {toast.actions && toast.actions.length > 0 && (
              <div className="flex gap-2 mt-3">
                {toast.actions.map((action, index) => (
                  <Button
                    key={index}
                    variant={index === toast.actions!.length - 1 ? "default" : "outline"}
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
);

Toast.displayName = "Toast";

export { Toast, toastVariants };

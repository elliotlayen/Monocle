import { useState, useEffect, useRef, useCallback } from "react";
import { useToastStore } from "@/features/notifications/store";
import { useShallow } from "zustand/shallow";
import { Toast } from "@/components/ui/toast";

const MAX_VISIBLE_TOASTS = 3;
const ANIMATION_DURATION = 400;

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore(
    useShallow((state) => ({
      toasts: state.toasts,
      removeToast: state.removeToast,
    }))
  );

  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );
  const exitTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set());

  const handleDismiss = useCallback(
    (id: string) => {
      if (exitTimersRef.current.has(id)) return;
      // Clear auto-dismiss timer if exists
      const timer = timersRef.current.get(id);
      if (timer) {
        clearTimeout(timer);
        timersRef.current.delete(id);
      }

      // Start exit animation
      setExitingIds((prev) => new Set(prev).add(id));

      // Remove after animation completes
      const exitTimer = setTimeout(() => {
        setExitingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        removeToast(id);
        exitTimersRef.current.delete(id);
      }, ANIMATION_DURATION);
      exitTimersRef.current.set(id, exitTimer);
    },
    [removeToast]
  );

  useEffect(() => {
    toasts.forEach((toast) => {
      const duration = toast.duration ?? getDefaultDuration(toast.type);
      // Skip if timer already set or if duration is 0 (persistent)
      if (timersRef.current.has(toast.id)) return;
      if (duration <= 0) return;
      if (exitingIds.has(toast.id)) return; // Skip if already exiting

      const timer = setTimeout(() => {
        timersRef.current.delete(toast.id);
        handleDismiss(toast.id); // Use handleDismiss for animation
      }, duration);

      timersRef.current.set(toast.id, timer);
    });

    // Cleanup timers for removed toasts
    const currentIds = new Set(toasts.map((t) => t.id));
    timersRef.current.forEach((timer, id) => {
      if (!currentIds.has(id)) {
        clearTimeout(timer);
        timersRef.current.delete(id);
      }
    });
  }, [toasts, handleDismiss, exitingIds]);

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
      exitTimersRef.current.forEach((timer) => clearTimeout(timer));
      exitTimersRef.current.clear();
    };
  }, []);

  // Take only the most recent toasts (newest at bottom)
  const visibleToasts = toasts.slice(-MAX_VISIBLE_TOASTS);

  if (visibleToasts.length === 0) return null;

  return (
    <div
      className="fixed top-16 left-5 z-50 flex flex-col gap-2"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {visibleToasts.map((toast) => (
        <Toast
          key={toast.id}
          toast={toast}
          onDismiss={() => handleDismiss(toast.id)}
          className={
            exitingIds.has(toast.id)
              ? "animate-out fade-out slide-out-to-left-full duration-[400ms]"
              : "animate-in fade-in slide-in-from-left-full duration-[400ms]"
          }
        />
      ))}
    </div>
  );
}

function getDefaultDuration(
  type: "info" | "success" | "error" | "warning" | "update"
): number {
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

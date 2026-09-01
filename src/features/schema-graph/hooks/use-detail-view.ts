import { useState, useCallback, useEffect, useRef } from "react";
import type { DetailSidebarData } from "../components/detail-content";

export interface DetailViewState {
  open: boolean;
  data: DetailSidebarData | null;
}

export function useDetailView() {
  const [state, setState] = useState<DetailViewState>({
    open: false,
    data: null,
  });

  const openDetail = useCallback((data: DetailSidebarData) => {
    setState({ open: true, data });
  }, []);

  const closeDetail = useCallback(() => {
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  return {
    open: state.open,
    data: state.data,
    openDetail,
    closeDetail,
  };
}

const EXIT_DURATION_MS = 120;

/**
 * Mount/visibility pair for CSS-transition entrances and exits. `mounted`
 * keeps the element in the DOM through the exit transition; `shown` flips a
 * frame after mount so the entrance transition runs (interruptible, unlike
 * keyframes).
 */
export function useTransitionPresence(open: boolean) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      let inner = 0;
      const raf = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setShown(true));
      });
      return () => {
        cancelAnimationFrame(raf);
        cancelAnimationFrame(inner);
      };
    }
    setShown(false);
    const timer = window.setTimeout(() => setMounted(false), EXIT_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [open]);

  return { mounted, shown };
}

/** Escape and outside-click dismissal shared by the detail views. */
export function useDetailDismiss(
  open: boolean,
  ref: React.RefObject<HTMLElement | null>,
  onClose: () => void
) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    const handleMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onCloseRef.current();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    // Delay so the click that opened the view does not immediately close it.
    const timeoutId = window.setTimeout(() => {
      document.addEventListener("mousedown", handleMouseDown);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [open, ref]);
}

import { useState, useCallback } from "react";
import type { DetailSidebarData } from "../components/detail-content";

export interface PopoverState {
  open: boolean;
  data: DetailSidebarData | null;
  anchorRect: DOMRect | null;
}

export function useDetailPopover() {
  const [state, setState] = useState<PopoverState>({
    open: false,
    data: null,
    anchorRect: null,
  });

  const openPopover = useCallback((data: DetailSidebarData, anchorRect: DOMRect) => {
    setState({
      open: true,
      data,
      anchorRect,
    });
  }, []);

  const closePopover = useCallback(() => {
    setState({
      open: false,
      data: null,
      anchorRect: null,
    });
  }, []);

  return {
    open: state.open,
    data: state.data,
    anchorRect: state.anchorRect,
    openPopover,
    closePopover,
  };
}

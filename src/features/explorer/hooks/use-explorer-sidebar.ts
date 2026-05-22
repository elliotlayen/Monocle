import { useState, useEffect, useCallback, useRef } from "react";

interface UseExplorerSidebarResult {
  width: number;
  isDragging: boolean;
  startDrag: (e: React.MouseEvent) => void;
}

export function useExplorerSidebar(
  initialWidth: number,
  onWidthCommit: (width: number) => void
): UseExplorerSidebarResult {
  const [width, setWidth] = useState(initialWidth);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  // Sync with external width changes when not dragging
  useEffect(() => {
    if (!isDragging) {
      setWidth(initialWidth);
    }
  }, [initialWidth, isDragging]);

  const widthRef = useRef(width);
  widthRef.current = width;

  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startXRef.current = e.clientX;
    startWidthRef.current = widthRef.current;
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startXRef.current;
      const newWidth = Math.max(200, Math.min(480, startWidthRef.current + delta));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      // Commit final width on mouseup only (not during drag)
      setWidth((currentWidth) => {
        onWidthCommit(currentWidth);
        return currentWidth;
      });
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, onWidthCommit]);

  return { width, isDragging, startDrag };
}

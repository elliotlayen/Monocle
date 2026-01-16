import { toPng } from "html-to-image";
import { getNodesBounds, getViewportForBounds } from "@xyflow/react";
import type { Node } from "@xyflow/react";

export interface PngExportOptions {
  backgroundColor?: string;
  padding?: number;
}

export async function exportToPng(
  nodes: Node[],
  options: PngExportOptions = {}
): Promise<Uint8Array> {
  const { backgroundColor = "#09090b", padding = 50 } = options;

  const viewportElement = document.querySelector(
    ".react-flow__viewport"
  ) as HTMLElement;
  if (!viewportElement) {
    throw new Error("React Flow viewport not found");
  }

  const visibleNodes = nodes.filter((n) => !n.hidden);
  if (visibleNodes.length === 0) {
    throw new Error("No visible nodes to export");
  }

  const bounds = getNodesBounds(visibleNodes);
  const imageWidth = bounds.width + padding * 2;
  const imageHeight = bounds.height + padding * 2;

  const viewport = getViewportForBounds(
    bounds,
    imageWidth,
    imageHeight,
    0.5,
    2,
    padding
  );

  const dataUrl = await toPng(viewportElement, {
    backgroundColor,
    width: imageWidth,
    height: imageHeight,
    style: {
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    },
  });

  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const arrayBuffer = await blob.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

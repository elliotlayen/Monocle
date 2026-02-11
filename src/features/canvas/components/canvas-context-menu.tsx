import { useEffect, useRef, useState } from "react";
import type { Node } from "@xyflow/react";
import type { SchemaGraph } from "@/features/schema-graph/types";
import { CreateTableDialog } from "./create-table-dialog";
import { CreateViewDialog } from "./create-view-dialog";
import { CreateTriggerDialog } from "./create-trigger-dialog";
import { CreateProcedureDialog } from "./create-procedure-dialog";
import { CreateFunctionDialog } from "./create-function-dialog";
import { CreateEdgeDialog } from "./create-edge-dialog";

interface CanvasContextMenuProps {
  screenPosition: { x: number; y: number };
  flowPosition: { x: number; y: number };
  onClose: () => void;
  nodes: Node[];
  schema: SchemaGraph;
  onEdit: (type: string, id: string) => void;
  onDelete: (nodeType: string, id: string) => void;
}

export function CanvasContextMenu({
  screenPosition,
  flowPosition,
  onClose,
  nodes,
  schema,
  onEdit,
  onDelete,
}: CanvasContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [dialogType, setDialogType] = useState<string | null>(null);

  const DEFAULT_NODE_WIDTH = 300;
  const DEFAULT_NODE_HEIGHT = 250;

  const parseSize = (value?: number | string) => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
  };

  // Find if a node is at the click position (using flow coordinates)
  const clickedNode = nodes.find((node) => {
    if (node.hidden) return false;
    const width =
      node.measured?.width ??
      node.width ??
      node.initialWidth ??
      parseSize(node.style?.width) ??
      DEFAULT_NODE_WIDTH;
    const height =
      node.measured?.height ??
      node.height ??
      node.initialHeight ??
      parseSize(node.style?.height) ??
      DEFAULT_NODE_HEIGHT;
    const [originX, originY] = node.origin ?? [0, 0];
    const nx = node.position.x - width * originX;
    const ny = node.position.y - height * originY;
    return (
      flowPosition.x >= nx &&
      flowPosition.x <= nx + width &&
      flowPosition.y >= ny &&
      flowPosition.y <= ny + height
    );
  });

  useEffect(() => {
    if (dialogType) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", handleClick, true);
    window.addEventListener("keydown", handleEsc);
    return () => {
      window.removeEventListener("mousedown", handleClick, true);
      window.removeEventListener("keydown", handleEsc);
    };
  }, [onClose, dialogType]);

  // Adjust menu position to stay within viewport
  useEffect(() => {
    if (!menuRef.current) return;
    const el = menuRef.current;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = screenPosition.x;
    let top = screenPosition.y;

    if (left + rect.width > vw) {
      left = vw - rect.width - 8;
    }
    if (top + rect.height > vh) {
      top = vh - rect.height - 8;
    }

    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [screenPosition]);

  const hasTables = schema.tables.length > 0;
  const totalObjects =
    schema.tables.length +
    schema.views.length +
    (schema.triggers?.length ?? 0) +
    (schema.storedProcedures?.length ?? 0) +
    (schema.scalarFunctions?.length ?? 0);

  const handleItemClick = (action: string) => {
    if (clickedNode) {
      const typeMap: Record<string, string> = {
        tableNode: "table",
        viewNode: "view",
        triggerNode: "trigger",
        storedProcedureNode: "storedProcedure",
        scalarFunctionNode: "scalarFunction",
      };
      if (action === "edit") {
        onEdit(typeMap[clickedNode.type ?? ""] ?? "", clickedNode.id);
        onClose();
      } else if (action === "delete") {
        onDelete(clickedNode.type ?? "", clickedNode.id);
        onClose();
      }
    } else {
      setDialogType(action);
    }
  };

  if (dialogType) {
    return (
      <>
        <CreateTableDialog
          open={dialogType === "table"}
          onOpenChange={(open) => {
            if (!open) {
              setDialogType(null);
              onClose();
            }
          }}
          position={flowPosition}
        />
        <CreateViewDialog
          open={dialogType === "view"}
          onOpenChange={(open) => {
            if (!open) {
              setDialogType(null);
              onClose();
            }
          }}
          position={flowPosition}
        />
        <CreateTriggerDialog
          open={dialogType === "trigger"}
          onOpenChange={(open) => {
            if (!open) {
              setDialogType(null);
              onClose();
            }
          }}
          position={flowPosition}
        />
        <CreateProcedureDialog
          open={dialogType === "procedure"}
          onOpenChange={(open) => {
            if (!open) {
              setDialogType(null);
              onClose();
            }
          }}
          position={flowPosition}
        />
        <CreateFunctionDialog
          open={dialogType === "function"}
          onOpenChange={(open) => {
            if (!open) {
              setDialogType(null);
              onClose();
            }
          }}
          position={flowPosition}
        />
        <CreateEdgeDialog
          open={dialogType === "edge"}
          onOpenChange={(open) => {
            if (!open) {
              setDialogType(null);
              onClose();
            }
          }}
        />
      </>
    );
  }

  return (
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        left: screenPosition.x,
        top: screenPosition.y,
        zIndex: 100,
      }}
      className="min-w-[160px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
    >
      {clickedNode ? (
        <>
          <button
            className="w-full px-2 py-1.5 text-sm text-left rounded-sm hover:bg-accent"
            onClick={() => handleItemClick("edit")}
          >
            Edit
          </button>
          <button
            className="w-full px-2 py-1.5 text-sm text-left rounded-sm hover:bg-accent text-destructive"
            onClick={() => handleItemClick("delete")}
          >
            Delete
          </button>
        </>
      ) : (
        <>
          <button
            className="w-full px-2 py-1.5 text-sm text-left rounded-sm hover:bg-accent"
            onClick={() => handleItemClick("table")}
          >
            Add Table
          </button>
          <button
            className="w-full px-2 py-1.5 text-sm text-left rounded-sm hover:bg-accent"
            onClick={() => handleItemClick("view")}
          >
            Add View
          </button>
          <button
            className="w-full px-2 py-1.5 text-sm text-left rounded-sm hover:bg-accent disabled:opacity-50"
            onClick={() => handleItemClick("trigger")}
            disabled={!hasTables}
          >
            Add Trigger
          </button>
          <button
            className="w-full px-2 py-1.5 text-sm text-left rounded-sm hover:bg-accent"
            onClick={() => handleItemClick("procedure")}
          >
            Add Stored Procedure
          </button>
          <button
            className="w-full px-2 py-1.5 text-sm text-left rounded-sm hover:bg-accent"
            onClick={() => handleItemClick("function")}
          >
            Add Scalar Function
          </button>
          <div className="my-1 h-px bg-border" />
          <button
            className="w-full px-2 py-1.5 text-sm text-left rounded-sm hover:bg-accent disabled:opacity-50"
            onClick={() => handleItemClick("edge")}
            disabled={totalObjects < 2}
          >
            Add Edge
          </button>
        </>
      )}
    </div>
  );
}

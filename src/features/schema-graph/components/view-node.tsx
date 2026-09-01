import { memo } from "react";
import { type NodeProps } from "@xyflow/react";
import { ViewNode as ViewNodeType } from "../types";
import {
  TableViewNodeBody,
  type TableViewNodeCommonData,
  type TableViewNodeVariant,
} from "./table-view-node-shared";

interface ViewNodeData extends TableViewNodeCommonData {
  view: ViewNodeType;
}

const VIEW_VARIANT: TableViewNodeVariant = {
  kindLabel: "View",
  objectType: "views",
  showPrimaryKeys: false,
};

function ViewNodeComponent({ data }: NodeProps) {
  const nodeData = data as unknown as ViewNodeData;
  return (
    <TableViewNodeBody
      nodeId={nodeData.view.id}
      name={nodeData.view.name}
      columns={nodeData.view.columns}
      data={nodeData}
      variant={VIEW_VARIANT}
    />
  );
}

// Memoize for performance
export const ViewNode = memo(ViewNodeComponent);

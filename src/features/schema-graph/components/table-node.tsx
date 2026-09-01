import { memo } from "react";
import { type NodeProps } from "@xyflow/react";
import { TableNode as TableNodeType } from "../types";
import {
  TableViewNodeBody,
  type TableViewNodeCommonData,
  type TableViewNodeVariant,
} from "./table-view-node-shared";

interface TableNodeData extends TableViewNodeCommonData {
  table: TableNodeType;
}

const TABLE_VARIANT: TableViewNodeVariant = {
  kindLabel: "Table",
  objectType: "tables",
  showPrimaryKeys: true,
};

function TableNodeComponent({ data }: NodeProps) {
  const nodeData = data as unknown as TableNodeData;
  return (
    <TableViewNodeBody
      nodeId={nodeData.table.id}
      name={nodeData.table.name}
      columns={nodeData.table.columns}
      data={nodeData}
      variant={TABLE_VARIANT}
    />
  );
}

// Memoize for performance
export const TableNode = memo(TableNodeComponent);

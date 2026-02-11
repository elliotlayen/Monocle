import { SchemaGraph as SchemaGraphType } from "../types";

export const TABLE_VIEW_MIN_WIDTH = 240;
export const TRIGGER_MIN_WIDTH = 180;
export const ROUTINE_MIN_WIDTH = 200;

const FONT_HEADER = "600 14px ui-sans-serif, system-ui, sans-serif";
const FONT_BODY = "12px ui-sans-serif, system-ui, sans-serif";
const FONT_META = "10px ui-sans-serif, system-ui, sans-serif";
const FONT_CODE = "12px ui-monospace, SFMono-Regular, Menlo, monospace";

const measureCache = new Map<string, number>();
let canvasContext: CanvasRenderingContext2D | null | undefined;

function getCanvasContext(): CanvasRenderingContext2D | null {
  if (canvasContext !== undefined) {
    return canvasContext;
  }
  if (typeof document === "undefined") {
    canvasContext = null;
    return null;
  }
  const canvas = document.createElement("canvas");
  canvasContext = canvas.getContext("2d");
  return canvasContext;
}

function fallbackMeasureText(text: string, size = 12): number {
  let width = 0;
  for (const char of text) {
    if (char === " ") {
      width += size * 0.36;
    } else if ("il.:;,'|".includes(char)) {
      width += size * 0.34;
    } else if ("MW@#%&".includes(char)) {
      width += size * 0.9;
    } else {
      width += size * 0.62;
    }
  }
  return width;
}

function measureText(text: string, font: string, fallbackSize = 12): number {
  const key = `${font}::${text}`;
  const cached = measureCache.get(key);
  if (cached !== undefined) return cached;

  const ctx = getCanvasContext();
  let width = 0;
  if (ctx) {
    ctx.font = font;
    width = ctx.measureText(text).width;
  } else {
    width = fallbackMeasureText(text, fallbackSize);
  }

  measureCache.set(key, width);
  return width;
}

function tableWidth(table: SchemaGraphType["tables"][number]): number {
  const headerWidth = measureText(table.name, FONT_HEADER, 14) + 110;
  const columnWidths = table.columns.map((column) => {
    const nameWidth = measureText(column.name, FONT_BODY, 12);
    const typeWidth = measureText(column.dataType, FONT_META, 10);
    const iconWidth =
      (column.isPrimaryKey ? 16 : 0) +
      (column.isNullable ? 16 : 0) +
      18;
    return nameWidth + typeWidth + iconWidth + 120;
  });
  const widestColumn = columnWidths.length > 0 ? Math.max(...columnWidths) : 0;
  return Math.max(TABLE_VIEW_MIN_WIDTH, headerWidth, widestColumn);
}

function viewWidth(view: SchemaGraphType["views"][number]): number {
  const headerWidth = measureText(view.name, FONT_HEADER, 14) + 110;
  const columnWidths = view.columns.map((column) => {
    const nameWidth = measureText(column.name, FONT_BODY, 12);
    const typeWidth = measureText(column.dataType, FONT_META, 10);
    const nullableWidth = column.isNullable ? 16 : 0;
    return nameWidth + typeWidth + nullableWidth + 120;
  });
  const widestColumn = columnWidths.length > 0 ? Math.max(...columnWidths) : 0;
  return Math.max(TABLE_VIEW_MIN_WIDTH, headerWidth, widestColumn);
}

function triggerWidth(trigger: SchemaGraphType["triggers"][number]): number {
  const eventText = [
    trigger.firesOnInsert && "I",
    trigger.firesOnUpdate && "U",
    trigger.firesOnDelete && "D",
  ]
    .filter(Boolean)
    .join(" ");
  const widest = Math.max(
    measureText(trigger.name, FONT_HEADER, 14),
    measureText(trigger.triggerType, FONT_BODY, 12),
    measureText(eventText, FONT_BODY, 12)
  );
  return Math.max(TRIGGER_MIN_WIDTH, widest + 120);
}

function procedureWidth(
  procedure: SchemaGraphType["storedProcedures"][number]
): number {
  const paramWidths = procedure.parameters.map((param) =>
    measureText(`${param.name} ${param.dataType}`, FONT_BODY, 12)
  );
  const widestParam = paramWidths.length > 0 ? Math.max(...paramWidths) : 0;
  const widest = Math.max(
    measureText(procedure.name, FONT_HEADER, 14),
    widestParam
  );
  return Math.max(ROUTINE_MIN_WIDTH, widest + 130);
}

function functionWidth(fn: SchemaGraphType["scalarFunctions"][number]): number {
  const paramWidths = fn.parameters.map((param) =>
    measureText(`${param.name} ${param.dataType}`, FONT_BODY, 12)
  );
  const widestParam = paramWidths.length > 0 ? Math.max(...paramWidths) : 0;
  const widest = Math.max(
    measureText(fn.name, FONT_HEADER, 14),
    measureText(fn.returnType, FONT_CODE, 12),
    widestParam
  );
  return Math.max(ROUTINE_MIN_WIDTH, widest + 130);
}

export function buildNodeWidthMap(schema: SchemaGraphType): Map<string, number> {
  const widths = new Map<string, number>();

  schema.tables.forEach((table) => {
    widths.set(table.id, tableWidth(table));
  });

  (schema.views || []).forEach((view) => {
    widths.set(view.id, viewWidth(view));
  });

  (schema.triggers || []).forEach((trigger) => {
    widths.set(trigger.id, triggerWidth(trigger));
  });

  (schema.storedProcedures || []).forEach((procedure) => {
    widths.set(procedure.id, procedureWidth(procedure));
  });

  (schema.scalarFunctions || []).forEach((fn) => {
    widths.set(fn.id, functionWidth(fn));
  });

  return widths;
}

export function getNodeWidth(
  nodeWidths: Map<string, number>,
  nodeId: string,
  fallback = TABLE_VIEW_MIN_WIDTH
): number {
  return nodeWidths.get(nodeId) ?? fallback;
}

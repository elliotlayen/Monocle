export const TABLE_VIEW_HEADER_HEIGHT = 52;
export const TABLE_VIEW_ROW_HEIGHT = 28;

export function getTableViewNodeHeight(columnCount: number): number {
  return TABLE_VIEW_HEADER_HEIGHT + columnCount * TABLE_VIEW_ROW_HEIGHT;
}

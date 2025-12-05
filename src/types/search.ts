export type SearchResultType = 'table' | 'view' | 'column' | 'trigger' | 'procedure';

export interface BaseSearchResult {
  id: string;
  type: SearchResultType;
  label: string;
  sublabel?: string;
}

export interface TableSearchResult extends BaseSearchResult {
  type: 'table';
  tableId: string;
  schema: string;
}

export interface ViewSearchResult extends BaseSearchResult {
  type: 'view';
  viewId: string;
  schema: string;
}

export interface ColumnSearchResult extends BaseSearchResult {
  type: 'column';
  columnName: string;
  parentId: string;
  parentType: 'table' | 'view';
  schema: string;
  dataType: string;
}

export interface TriggerSearchResult extends BaseSearchResult {
  type: 'trigger';
  triggerId: string;
  tableId: string;
  schema: string;
}

export interface ProcedureSearchResult extends BaseSearchResult {
  type: 'procedure';
  procedureId: string;
  schema: string;
}

export type SearchResult =
  | TableSearchResult
  | ViewSearchResult
  | ColumnSearchResult
  | TriggerSearchResult
  | ProcedureSearchResult;

export interface GroupedSearchResults {
  tables: TableSearchResult[];
  views: ViewSearchResult[];
  columns: ColumnSearchResult[];
  triggers: TriggerSearchResult[];
  procedures: ProcedureSearchResult[];
  totalCount: number;
}

import type { SchemaGraph } from '@/types/schema';
import type {
  GroupedSearchResults,
  TableSearchResult,
  ViewSearchResult,
  ColumnSearchResult,
  TriggerSearchResult,
  ProcedureSearchResult,
  FunctionSearchResult,
} from '@/types/search';

const MAX_RESULTS_PER_CATEGORY = 10;

type MatchScore = 0 | 50 | 75 | 100;

function getMatchScore(text: string, query: string): MatchScore {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  if (lowerText === lowerQuery) return 100;
  if (lowerText.startsWith(lowerQuery)) return 75;
  if (lowerText.includes(lowerQuery)) return 50;
  return 0;
}

function sortByScore<T extends { score: number }>(items: T[]): T[] {
  return items.sort((a, b) => b.score - a.score);
}

export function searchSchema(
  schema: SchemaGraph,
  query: string,
  maxPerCategory: number = MAX_RESULTS_PER_CATEGORY
): GroupedSearchResults {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return {
      tables: [],
      views: [],
      columns: [],
      triggers: [],
      procedures: [],
      functions: [],
      totalCount: 0,
    };
  }

  // Search tables
  const tableResults: (TableSearchResult & { score: number })[] = [];
  for (const table of schema.tables) {
    const nameScore = getMatchScore(table.name, trimmedQuery);
    const schemaScore = getMatchScore(table.schema, trimmedQuery);
    const idScore = getMatchScore(table.id, trimmedQuery);
    const score = Math.max(nameScore, schemaScore, idScore);

    if (score > 0) {
      tableResults.push({
        id: `table-${table.id}`,
        type: 'table',
        tableId: table.id,
        schema: table.schema,
        label: table.name,
        sublabel: table.schema,
        score,
      });
    }
  }

  // Search views
  const viewResults: (ViewSearchResult & { score: number })[] = [];
  for (const view of schema.views || []) {
    const nameScore = getMatchScore(view.name, trimmedQuery);
    const schemaScore = getMatchScore(view.schema, trimmedQuery);
    const idScore = getMatchScore(view.id, trimmedQuery);
    const score = Math.max(nameScore, schemaScore, idScore);

    if (score > 0) {
      viewResults.push({
        id: `view-${view.id}`,
        type: 'view',
        viewId: view.id,
        schema: view.schema,
        label: view.name,
        sublabel: view.schema,
        score,
      });
    }
  }

  // Search columns in tables and views
  const columnResults: (ColumnSearchResult & { score: number })[] = [];

  for (const table of schema.tables) {
    for (const column of table.columns) {
      const score = getMatchScore(column.name, trimmedQuery);
      if (score > 0) {
        columnResults.push({
          id: `column-${table.id}-${column.name}`,
          type: 'column',
          columnName: column.name,
          parentId: table.id,
          parentType: 'table',
          schema: table.schema,
          dataType: column.dataType,
          label: column.name,
          sublabel: `${table.schema}.${table.name} (${column.dataType})`,
          score,
        });
      }
    }
  }

  for (const view of schema.views || []) {
    for (const column of view.columns) {
      const score = getMatchScore(column.name, trimmedQuery);
      if (score > 0) {
        columnResults.push({
          id: `column-${view.id}-${column.name}`,
          type: 'column',
          columnName: column.name,
          parentId: view.id,
          parentType: 'view',
          schema: view.schema,
          dataType: column.dataType,
          label: column.name,
          sublabel: `${view.schema}.${view.name} (${column.dataType})`,
          score,
        });
      }
    }
  }

  // Search triggers
  const triggerResults: (TriggerSearchResult & { score: number })[] = [];
  for (const trigger of schema.triggers || []) {
    const nameScore = getMatchScore(trigger.name, trimmedQuery);
    const schemaScore = getMatchScore(trigger.schema, trimmedQuery);
    const score = Math.max(nameScore, schemaScore);

    if (score > 0) {
      triggerResults.push({
        id: `trigger-${trigger.id}`,
        type: 'trigger',
        triggerId: trigger.id,
        tableId: trigger.tableId,
        schema: trigger.schema,
        label: trigger.name,
        sublabel: `on ${trigger.tableId}`,
        score,
      });
    }
  }

  // Search stored procedures
  const procedureResults: (ProcedureSearchResult & { score: number })[] = [];
  for (const procedure of schema.storedProcedures || []) {
    const nameScore = getMatchScore(procedure.name, trimmedQuery);
    const schemaScore = getMatchScore(procedure.schema, trimmedQuery);
    const score = Math.max(nameScore, schemaScore);

    if (score > 0) {
      procedureResults.push({
        id: `procedure-${procedure.id}`,
        type: 'procedure',
        procedureId: procedure.id,
        schema: procedure.schema,
        label: procedure.name,
        sublabel: procedure.schema,
        score,
      });
    }
  }

  // Search scalar functions
  const functionResults: (FunctionSearchResult & { score: number })[] = [];
  for (const fn of schema.scalarFunctions || []) {
    const nameScore = getMatchScore(fn.name, trimmedQuery);
    const schemaScore = getMatchScore(fn.schema, trimmedQuery);
    const score = Math.max(nameScore, schemaScore);

    if (score > 0) {
      functionResults.push({
        id: `function-${fn.id}`,
        type: 'function',
        functionId: fn.id,
        schema: fn.schema,
        label: fn.name,
        sublabel: `${fn.schema} -> ${fn.returnType}`,
        score,
      });
    }
  }

  // Sort and limit results
  const tables = sortByScore(tableResults)
    .slice(0, maxPerCategory)
    .map(({ score, ...rest }) => rest);
  const views = sortByScore(viewResults)
    .slice(0, maxPerCategory)
    .map(({ score, ...rest }) => rest);
  const columns = sortByScore(columnResults)
    .slice(0, maxPerCategory)
    .map(({ score, ...rest }) => rest);
  const triggers = sortByScore(triggerResults)
    .slice(0, maxPerCategory)
    .map(({ score, ...rest }) => rest);
  const procedures = sortByScore(procedureResults)
    .slice(0, maxPerCategory)
    .map(({ score, ...rest }) => rest);
  const functions = sortByScore(functionResults)
    .slice(0, maxPerCategory)
    .map(({ score, ...rest }) => rest);

  return {
    tables,
    views,
    columns,
    triggers,
    procedures,
    functions,
    totalCount:
      tables.length +
      views.length +
      columns.length +
      triggers.length +
      procedures.length +
      functions.length,
  };
}

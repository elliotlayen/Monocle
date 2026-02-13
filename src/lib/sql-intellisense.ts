import type { Monaco } from "@monaco-editor/react";
import type { editor, languages, Position } from "monaco-editor";
import { useSchemaStore } from "@/features/schema-graph/store";
import type { SchemaGraph } from "@/features/schema-graph/types";

type SqlObjectKind = "table" | "view" | "storedProcedure" | "scalarFunction";

interface SqlObjectEntry {
  kind: SqlObjectKind;
  id: string;
  schema: string;
  name: string;
  columns: string[];
}

interface SqlColumnEntry {
  name: string;
  source: SqlObjectEntry;
}

interface SqlSnippet {
  label: string;
  description: string;
  insertText: string;
}

export interface SqlCompletionContext {
  afterObjectClause: boolean;
  afterExecClause: boolean;
  aliasContext: string | null;
  parameterPrefix: boolean;
}

export interface SqlCompletionSources {
  context: SqlCompletionContext;
  objects: SqlObjectEntry[];
  columns: SqlColumnEntry[];
  parameters: string[];
  keywords: string[];
  snippets: SqlSnippet[];
}

export type SqlSuggestionCategory =
  | "object"
  | "execObject"
  | "column"
  | "parameter"
  | "keyword"
  | "snippet";

const IDENTIFIER_SAFE_RE = /^[A-Za-z_][A-Za-z0-9_#$]*$/;
const PARAMETER_RE = /@@?[A-Za-z_][A-Za-z0-9_#$]*/g;
const KEYWORDS = [
  "SELECT",
  "FROM",
  "WHERE",
  "JOIN",
  "INNER",
  "LEFT",
  "RIGHT",
  "FULL",
  "OUTER",
  "CROSS",
  "ON",
  "GROUP",
  "BY",
  "HAVING",
  "ORDER",
  "UNION",
  "ALL",
  "DISTINCT",
  "AS",
  "TOP",
  "PERCENT",
  "INSERT",
  "INTO",
  "VALUES",
  "UPDATE",
  "SET",
  "DELETE",
  "MERGE",
  "OUTPUT",
  "CREATE",
  "ALTER",
  "DROP",
  "TABLE",
  "VIEW",
  "PROCEDURE",
  "FUNCTION",
  "TRIGGER",
  "EXEC",
  "EXECUTE",
  "BEGIN",
  "END",
  "DECLARE",
  "RETURN",
  "RETURNS",
  "IF",
  "ELSE",
  "CASE",
  "WHEN",
  "THEN",
  "AND",
  "OR",
  "NOT",
  "NULL",
  "IS",
  "IN",
  "EXISTS",
  "LIKE",
  "BETWEEN",
  "WITH",
  "OVER",
  "PARTITION",
];

const SNIPPETS: SqlSnippet[] = [
  {
    label: "SELECT ... FROM",
    description: "Basic select query",
    insertText: "SELECT ${1:*}\nFROM ${2:table}\nWHERE ${3:condition};",
  },
  {
    label: "INSERT INTO",
    description: "Insert statement",
    insertText:
      "INSERT INTO ${1:table} (${2:column1, column2})\nVALUES (${3:value1, value2});",
  },
  {
    label: "UPDATE ... SET",
    description: "Update statement",
    insertText:
      "UPDATE ${1:table}\nSET ${2:column} = ${3:value}\nWHERE ${4:condition};",
  },
  {
    label: "DELETE FROM",
    description: "Delete statement",
    insertText: "DELETE FROM ${1:table}\nWHERE ${2:condition};",
  },
  {
    label: "CREATE VIEW",
    description: "Create view template",
    insertText:
      "CREATE VIEW ${1:view_name}\nAS\nSELECT ${2:*}\nFROM ${3:table};",
  },
  {
    label: "CREATE PROCEDURE",
    description: "Create stored procedure template",
    insertText:
      "CREATE PROCEDURE ${1:procedure_name}\nAS\nBEGIN\n  ${2:-- SQL}\nEND;",
  },
  {
    label: "CREATE FUNCTION",
    description: "Create scalar function template",
    insertText:
      "CREATE FUNCTION ${1:function_name}(${2:@param INT})\nRETURNS ${3:INT}\nAS\nBEGIN\n  RETURN ${4:0};\nEND;",
  },
  {
    label: "CREATE TRIGGER",
    description: "Create trigger template",
    insertText:
      "CREATE TRIGGER ${1:trigger_name}\nON ${2:table}\nAFTER ${3:INSERT, UPDATE}\nAS\nBEGIN\n  ${4:-- SQL}\nEND;",
  },
];

let providerRegistered = false;

export const quoteIdentifierIfNeeded = (value: string) =>
  IDENTIFIER_SAFE_RE.test(value)
    ? value
    : `[${value.replace(/\]/g, "]]")}]`;

export const normalizeIdentifier = (value: string) =>
  value
    .replace(/\[/g, "")
    .replace(/\]/g, "")
    .replace(/\s*\.\s*/g, ".")
    .trim()
    .toLowerCase();

export const isAfterObjectClause = (textBeforeCursor: string) =>
  /\b(?:from|join|update|into)\s+([^\n;]*)$/i.test(textBeforeCursor);

export const isAfterExecClause = (textBeforeCursor: string) =>
  /\b(?:exec|execute)\s+([^\n;]*)$/i.test(textBeforeCursor);

export const getAliasContext = (linePrefix: string) => {
  const match = linePrefix.match(
    /(?:\[([^\]]+)\]|([A-Za-z_][A-Za-z0-9_#$]*))\s*\.\s*$/
  );
  const alias = match?.[1] ?? match?.[2];
  return alias ? normalizeIdentifier(alias) : null;
};

export const buildAliasMap = (textBeforeCursor: string) => {
  const aliasMap = new Map<string, string>();
  const aliasRegex =
    /\b(?:from|join|update|into)\s+((?:\[[^\]]+\]|[A-Za-z_][A-Za-z0-9_#$]*)(?:\s*\.\s*(?:\[[^\]]+\]|[A-Za-z_][A-Za-z0-9_#$]*))?)\s+(?:as\s+)?([A-Za-z_][A-Za-z0-9_#$]*)/gi;

  let match = aliasRegex.exec(textBeforeCursor);
  while (match) {
    aliasMap.set(normalizeIdentifier(match[2]), normalizeIdentifier(match[1]));
    match = aliasRegex.exec(textBeforeCursor);
  }

  return aliasMap;
};

export const getSortPrefix = (
  category: SqlSuggestionCategory,
  context: SqlCompletionContext
) => {
  switch (category) {
    case "object":
      return context.afterObjectClause ? "00" : "30";
    case "execObject":
      return context.afterExecClause ? "01" : "31";
    case "column":
      return context.aliasContext ? "02" : "35";
    case "parameter":
      return context.parameterPrefix ? "03" : "32";
    case "keyword":
      return "40";
    case "snippet":
      return "50";
  }
};

const buildSchemaObjects = (schema: SchemaGraph | null): SqlObjectEntry[] => {
  if (!schema) return [];

  const tableEntries: SqlObjectEntry[] = schema.tables.map((table) => ({
    kind: "table",
    id: table.id,
    schema: table.schema,
    name: table.name,
    columns: table.columns.map((column) => column.name),
  }));

  const viewEntries: SqlObjectEntry[] = schema.views.map((view) => ({
    kind: "view",
    id: view.id,
    schema: view.schema,
    name: view.name,
    columns: view.columns.map((column) => column.name),
  }));

  const procedureEntries: SqlObjectEntry[] = schema.storedProcedures.map((proc) => ({
    kind: "storedProcedure",
    id: proc.id,
    schema: proc.schema,
    name: proc.name,
    columns: [],
  }));

  const functionEntries: SqlObjectEntry[] = schema.scalarFunctions.map((fn) => ({
    kind: "scalarFunction",
    id: fn.id,
    schema: fn.schema,
    name: fn.name,
    columns: [],
  }));

  return [...tableEntries, ...viewEntries, ...procedureEntries, ...functionEntries];
};

const buildObjectLookup = (objects: SqlObjectEntry[]) => {
  const lookup = new Map<string, SqlObjectEntry>();

  const addLookup = (key: string, object: SqlObjectEntry) => {
    const normalizedKey = normalizeIdentifier(key);
    if (normalizedKey) {
      lookup.set(normalizedKey, object);
    }
  };

  objects.forEach((object) => {
    addLookup(object.id, object);
    addLookup(`${object.schema}.${object.name}`, object);
    addLookup(object.name, object);
  });

  return lookup;
};

const resolveObjectReference = (
  reference: string,
  lookup: Map<string, SqlObjectEntry>
) => {
  const normalizedReference = normalizeIdentifier(reference);
  if (!normalizedReference) return null;

  const direct = lookup.get(normalizedReference);
  if (direct) return direct;

  const shortName = normalizedReference.split(".").pop();
  if (!shortName) return null;

  return lookup.get(shortName) ?? null;
};

const buildColumnEntries = (objects: SqlObjectEntry[]) =>
  objects.flatMap((object) =>
    object.columns.map((columnName) => ({ name: columnName, source: object }))
  );

const extractParameters = (textBeforeCursor: string) => {
  const matches = textBeforeCursor.match(PARAMETER_RE) ?? [];
  const seen = new Set<string>();
  const parameters: string[] = [];

  matches.forEach((match) => {
    const key = match.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    parameters.push(match);
  });

  return parameters;
};

export const getSqlCompletionSources = (
  schema: SchemaGraph | null,
  textBeforeCursor: string,
  linePrefix: string
): SqlCompletionSources => {
  const objects = buildSchemaObjects(schema);
  const objectLookup = buildObjectLookup(objects);
  const aliasMap = buildAliasMap(textBeforeCursor);
  const aliasContext = getAliasContext(linePrefix);

  const aliasedObject =
    aliasContext && aliasMap.has(aliasContext)
      ? resolveObjectReference(aliasMap.get(aliasContext) ?? "", objectLookup)
      : null;

  const columns = aliasedObject
    ? buildColumnEntries([aliasedObject])
    : buildColumnEntries(objects.filter((object) => object.columns.length > 0));

  return {
    context: {
      afterObjectClause: isAfterObjectClause(textBeforeCursor),
      afterExecClause: isAfterExecClause(textBeforeCursor),
      aliasContext,
      parameterPrefix: /@@?[A-Za-z0-9_#$]*$/.test(linePrefix),
    },
    objects,
    columns,
    parameters: extractParameters(textBeforeCursor),
    keywords: KEYWORDS,
    snippets: SNIPPETS,
  };
};

const getReplaceRange = (
  monaco: Monaco,
  model: editor.ITextModel,
  position: Position
) => {
  const lineContent = model.getLineContent(position.lineNumber);
  const linePrefix = lineContent.slice(0, position.column - 1);
  const parameterMatch = linePrefix.match(/@@?[A-Za-z0-9_#$]*$/);

  if (parameterMatch) {
    const startColumn = position.column - parameterMatch[0].length;
    return new monaco.Range(
      position.lineNumber,
      Math.max(1, startColumn),
      position.lineNumber,
      position.column
    );
  }

  const word = model.getWordUntilPosition(position);
  return new monaco.Range(
    position.lineNumber,
    word.startColumn,
    position.lineNumber,
    word.endColumn
  );
};

export const registerSqlCompletionProvider = (monaco: Monaco) => {
  if (providerRegistered) return;

  monaco.languages.registerCompletionItemProvider("sql", {
    triggerCharacters: [".", "@"],
    provideCompletionItems: (model, position) => {
      const textBeforeCursor = model.getValueInRange({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      const linePrefix = model
        .getLineContent(position.lineNumber)
        .slice(0, position.column - 1);
      const sources = getSqlCompletionSources(
        useSchemaStore.getState().schema,
        textBeforeCursor,
        linePrefix
      );
      const range = getReplaceRange(monaco, model, position);

      const suggestions: languages.CompletionItem[] = [];
      const seen = new Set<string>();

      const pushSuggestion = (
        category: SqlSuggestionCategory,
        item: Omit<languages.CompletionItem, "range" | "sortText">,
        dedupeKey: string
      ) => {
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);
        suggestions.push({
          ...item,
          range,
          sortText: `${getSortPrefix(category, sources.context)}_${dedupeKey}`,
        });
      };

      sources.objects.forEach((object) => {
        const isExecutable =
          object.kind === "storedProcedure" || object.kind === "scalarFunction";
        const category: SqlSuggestionCategory = isExecutable
          ? "execObject"
          : "object";
        const objectTypeLabel =
          object.kind === "table"
            ? "table"
            : object.kind === "view"
              ? "view"
              : object.kind === "storedProcedure"
                ? "procedure"
                : "function";
        const insertText = quoteIdentifierIfNeeded(object.name);

        pushSuggestion(
          category,
          {
            label: object.name,
            kind: isExecutable
              ? monaco.languages.CompletionItemKind.Function
              : monaco.languages.CompletionItemKind.Class,
            insertText,
            filterText: `${object.name} ${object.schema}.${object.name}`,
            detail: `${objectTypeLabel} ${object.schema}.${object.name}`,
          },
          `${category}_${object.schema}.${object.name}`
        );
      });

      sources.columns.forEach((column) => {
        pushSuggestion(
          "column",
          {
            label: column.name,
            kind: monaco.languages.CompletionItemKind.Field,
            insertText: quoteIdentifierIfNeeded(column.name),
            filterText: `${column.name} ${column.source.name} ${column.source.schema}.${column.source.name}`,
            detail: `column ${column.source.schema}.${column.source.name}`,
          },
          `column_${column.source.id}.${column.name.toLowerCase()}`
        );
      });

      sources.parameters.forEach((parameter) => {
        pushSuggestion(
          "parameter",
          {
            label: parameter,
            kind: monaco.languages.CompletionItemKind.Variable,
            insertText: parameter,
            detail: "parameter",
          },
          `parameter_${parameter.toLowerCase()}`
        );
      });

      sources.keywords.forEach((keyword) => {
        pushSuggestion(
          "keyword",
          {
            label: keyword,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: keyword,
          },
          `keyword_${keyword.toLowerCase()}`
        );
      });

      sources.snippets.forEach((snippet) => {
        pushSuggestion(
          "snippet",
          {
            label: snippet.label,
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: snippet.insertText,
            insertTextRules:
              monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: snippet.description,
          },
          `snippet_${snippet.label.toLowerCase()}`
        );
      });

      return { suggestions };
    },
  });

  providerRegistered = true;
};

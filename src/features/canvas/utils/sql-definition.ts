import type {
  Column,
  ColumnSource,
  ProcedureParameter,
  SchemaGraph,
} from "@/features/schema-graph/types";
import { getSchemaIndex } from "@/lib/schema-index";

type Token = { value: string; type: "word" | "symbol" };

const RESERVED_KEYWORDS = new Set([
  "select",
  "from",
  "where",
  "join",
  "inner",
  "left",
  "right",
  "full",
  "cross",
  "outer",
  "on",
  "group",
  "by",
  "having",
  "order",
  "union",
  "all",
  "distinct",
  "as",
  "into",
  "update",
  "insert",
  "delete",
  "merge",
  "values",
  "set",
  "case",
  "when",
  "then",
  "else",
  "end",
  "and",
  "or",
  "not",
  "null",
  "is",
  "in",
  "exists",
  "top",
  "percent",
  "with",
  "over",
  "partition",
  "apply",
  "using",
  "create",
  "alter",
  "view",
  "procedure",
  "function",
  "trigger",
  "returns",
  "return",
  "begin",
  "declare",
  "if",
  "while",
  "loop",
  "cursor",
  "open",
  "fetch",
  "close",
  "deallocate",
]);

const DEFAULT_VIEW_COLUMN_TYPE = "unknown";
const DEFAULT_PARAMETER_TYPE = "int";

const formatIdentifierPart = (value: string) =>
  `[${value.replace(/]/g, "]]")}]`;

const formatQualifiedName = (value: string) =>
  value
    .split(".")
    .map((part) => formatIdentifierPart(part))
    .join(".");

const ensureParameterName = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "@param";
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
};

const isKeyword = (value: string) => RESERVED_KEYWORDS.has(value.toLowerCase());

const isIdentifierToken = (token: Token) => {
  if (token.type !== "word") return false;
  if (token.value.startsWith("[") || token.value.startsWith('"')) return true;
  return !isKeyword(token.value);
};

const normalizeIdentifier = (raw: string) => {
  let value = raw.trim();
  if (!value) return value;

  if (value.startsWith("[") && value.endsWith("]")) {
    value = value.slice(1, -1).replace(/]]/g, "]");
  } else if (value.startsWith('"') && value.endsWith('"')) {
    value = value.slice(1, -1).replace(/""/g, '"');
  }

  return value.trim();
};

const normalizeQualifiedName = (parts: string[]) =>
  parts
    .map(normalizeIdentifier)
    .filter(Boolean)
    .join(".");

const stripSqlLiteralsAndComments = (sql: string) => {
  let output = "";
  let index = 0;

  while (index < sql.length) {
    const char = sql[index];
    const next = sql[index + 1];

    if (char === "-" && next === "-") {
      output += "  ";
      index += 2;
      while (index < sql.length && sql[index] !== "\n") {
        output += " ";
        index += 1;
      }
      continue;
    }

    if (char === "/" && next === "*") {
      output += "  ";
      index += 2;
      while (index < sql.length && !(sql[index] === "*" && sql[index + 1] === "/")) {
        output += " ";
        index += 1;
      }
      if (index < sql.length) {
        output += "  ";
        index += 2;
      }
      continue;
    }

    if (char === "'") {
      output += " ";
      index += 1;
      while (index < sql.length) {
        if (sql[index] === "'" && sql[index + 1] === "'") {
          output += "  ";
          index += 2;
          continue;
        }
        if (sql[index] === "'") {
          output += " ";
          index += 1;
          break;
        }
        output += " ";
        index += 1;
      }
      continue;
    }

    output += char;
    index += 1;
  }

  return output;
};

const tokenize = (sql: string): Token[] => {
  const tokens: Token[] = [];
  let index = 0;

  const isIdentifierStart = (char: string) => /[A-Za-z0-9_@#$]/.test(char);
  const isIdentifierChar = (char: string) => /[A-Za-z0-9_@#$]/.test(char);

  while (index < sql.length) {
    const char = sql[index];

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if (char === "[") {
      let value = "[";
      index += 1;
      while (index < sql.length) {
        const current = sql[index];
        value += current;
        index += 1;
        if (current === "]") {
          if (sql[index] === "]") {
            value += sql[index];
            index += 1;
            continue;
          }
          break;
        }
      }
      tokens.push({ value, type: "word" });
      continue;
    }

    if (char === '"') {
      let value = '"';
      index += 1;
      while (index < sql.length) {
        const current = sql[index];
        value += current;
        index += 1;
        if (current === '"') {
          if (sql[index] === '"') {
            value += sql[index];
            index += 1;
            continue;
          }
          break;
        }
      }
      tokens.push({ value, type: "word" });
      continue;
    }

    if (isIdentifierStart(char)) {
      let value = char;
      index += 1;
      while (index < sql.length && isIdentifierChar(sql[index])) {
        value += sql[index];
        index += 1;
      }
      tokens.push({ value, type: "word" });
      continue;
    }

    if ("(),.*".includes(char)) {
      tokens.push({ value: char, type: "symbol" });
      index += 1;
      continue;
    }

    if (char === ".") {
      tokens.push({ value: char, type: "symbol" });
      index += 1;
      continue;
    }

    index += 1;
  }

  return tokens;
};

const tokensToSql = (tokens: Token[]) => {
  let result = "";
  for (const token of tokens) {
    if (token.type === "symbol") {
      if (token.value === ".") {
        result = result.trimEnd();
        result += ".";
        continue;
      }
      if (token.value === "(") {
        result = result.trimEnd();
        result += "(";
        continue;
      }
      if (token.value === ")") {
        result = result.trimEnd();
        result += ")";
        continue;
      }
      result += token.value;
      continue;
    }

    if (!result || result.endsWith("(") || result.endsWith(".")) {
      result += token.value;
    } else {
      result += ` ${token.value}`;
    }
  }
  return result.trim();
};

const resolveTableName = (
  qualifiedName: string,
  nameToId: Map<string, string>,
  defaultSchema?: string
) => {
  const normalized = normalizeIdentifier(qualifiedName);
  if (!normalized) return "";
  const key = normalized.toLowerCase();
  const existing = nameToId.get(key);
  if (existing) return existing;
  if (!normalized.includes(".") && defaultSchema) {
    return `${defaultSchema}.${normalized}`;
  }
  return normalized;
};

const resolveTableNameFromParts = (
  parts: string[],
  nameToId: Map<string, string>,
  defaultSchema?: string
) => {
  const qualified = normalizeQualifiedName(parts);
  if (!qualified) return "";
  const key = qualified.toLowerCase();
  const existing = nameToId.get(key);
  if (existing) return existing;
  if (!qualified.includes(".") && defaultSchema) {
    return `${defaultSchema}.${qualified}`;
  }
  return qualified;
};

const resolveTableFromCandidate = (
  candidate: string,
  aliasMap: Map<string, string>,
  nameToId: Map<string, string>,
  defaultSchema?: string
) => {
  const normalized = normalizeIdentifier(candidate);
  if (!normalized) return "";
  const aliasKey = normalized.toLowerCase();
  const aliasMatch = aliasMap.get(aliasKey);
  if (aliasMatch) return aliasMatch;
  const shortName = normalized.split(".").pop();
  if (shortName) {
    const shortMatch = aliasMap.get(shortName.toLowerCase());
    if (shortMatch) return shortMatch;
  }
  return resolveTableName(normalized, nameToId, defaultSchema);
};

const parseTableRef = (
  tokens: Token[],
  startIndex: number,
  nameToId: Map<string, string>,
  defaultSchema?: string
) => {
  let index = startIndex;
  const startToken = tokens[index];
  if (!startToken) return null;
  if (startToken.type === "symbol" && startToken.value === "(") return null;
  if (startToken.type !== "word") return null;
  if (startToken.value.toLowerCase() === "select") return null;

  const parts: string[] = [startToken.value];
  index += 1;
  while (
    tokens[index]?.type === "symbol" &&
    tokens[index]?.value === "." &&
    tokens[index + 1]?.type === "word"
  ) {
    parts.push(tokens[index + 1].value);
    index += 2;
  }

  const name = resolveTableNameFromParts(parts, nameToId, defaultSchema);
  if (!name) return null;

  let alias: string | undefined;
  const nextToken = tokens[index];
  if (nextToken?.type === "word" && nextToken.value.toLowerCase() === "as") {
    const aliasToken = tokens[index + 1];
    if (aliasToken && isIdentifierToken(aliasToken)) {
      alias = aliasToken.value;
      index += 2;
    } else {
      index += 1;
    }
  } else if (nextToken && isIdentifierToken(nextToken)) {
    alias = nextToken.value;
    index += 1;
  }

  return { name, alias, nextIndex: index };
};

const parseTableList = (
  tokens: Token[],
  startIndex: number,
  nameToId: Map<string, string>,
  defaultSchema?: string
) => {
  const results: { name: string; alias?: string; nextIndex: number }[] = [];
  let index = startIndex;

  while (index < tokens.length) {
    const parsed = parseTableRef(tokens, index, nameToId, defaultSchema);
    if (!parsed) break;
    results.push(parsed);
    index = parsed.nextIndex;
    const nextToken = tokens[index];
    if (nextToken?.type === "symbol" && nextToken.value === ",") {
      index += 1;
      continue;
    }
    break;
  }

  return { results, nextIndex: index };
};

const parseTableReferences = (
  tokens: Token[],
  nameToId: Map<string, string>,
  defaultSchema?: string
) => {
  const readTables: string[] = [];
  const writeTables: string[] = [];
  const aliasMap = new Map<string, string>();

  const addTable = (list: string[], name: string, alias?: string) => {
    if (!name) return;
    list.push(name);
    aliasMap.set(name.toLowerCase(), name);
    const shortName = name.split(".").pop();
    if (shortName) {
      aliasMap.set(shortName.toLowerCase(), name);
    }
    if (alias) {
      aliasMap.set(normalizeIdentifier(alias).toLowerCase(), name);
    }
  };

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type !== "word") continue;
    const value = token.value.toLowerCase();

    if (value === "from") {
      const parsedList = parseTableList(tokens, index + 1, nameToId, defaultSchema);
      parsedList.results.forEach((parsed) => {
        addTable(readTables, parsed.name, parsed.alias);
      });
      index = parsedList.nextIndex - 1;
      continue;
    }

    if (value === "join" || value === "using" || value === "apply") {
      const parsed = parseTableRef(tokens, index + 1, nameToId, defaultSchema);
      if (parsed) {
        addTable(readTables, parsed.name, parsed.alias);
        index = parsed.nextIndex - 1;
      }
      continue;
    }

    if (value === "insert") {
      const next = tokens[index + 1];
      if (next?.type === "word" && next.value.toLowerCase() === "into") {
        const parsed = parseTableRef(tokens, index + 2, nameToId, defaultSchema);
        if (parsed) {
          addTable(writeTables, parsed.name, parsed.alias);
          index = parsed.nextIndex - 1;
        }
      }
      continue;
    }

    if (value === "delete") {
      const next = tokens[index + 1];
      if (next?.type === "word" && next.value.toLowerCase() === "from") {
        const parsed = parseTableRef(tokens, index + 2, nameToId, defaultSchema);
        if (parsed) {
          addTable(writeTables, parsed.name, parsed.alias);
          index = parsed.nextIndex - 1;
        }
      }
      continue;
    }

    if (value === "merge") {
      const next = tokens[index + 1];
      if (next?.type === "word" && next.value.toLowerCase() === "into") {
        const parsed = parseTableRef(tokens, index + 2, nameToId, defaultSchema);
        if (parsed) {
          addTable(writeTables, parsed.name, parsed.alias);
          index = parsed.nextIndex - 1;
        }
      }
      continue;
    }

    if (value === "update") {
      const parsed = parseTableRef(tokens, index + 1, nameToId, defaultSchema);
      if (parsed) {
        addTable(writeTables, parsed.name, parsed.alias);
        index = parsed.nextIndex - 1;
      }
    }
  }

  return { readTables, writeTables, aliasMap };
};

const skipQualifiedName = (tokens: Token[], startIndex: number) => {
  let index = startIndex;
  if (tokens[index]?.type !== "word") return index;
  index += 1;
  while (
    tokens[index]?.type === "symbol" &&
    tokens[index]?.value === "." &&
    tokens[index + 1]?.type === "word"
  ) {
    index += 2;
  }
  return index;
};

const parseViewColumnList = (tokens: Token[]) => {
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type !== "word" || token.value.toLowerCase() !== "view") {
      continue;
    }

    const previousWords = tokens
      .slice(Math.max(0, index - 3), index)
      .filter((t) => t.type === "word")
      .map((t) => t.value.toLowerCase());
    const isViewDefinition = previousWords.includes("create") || previousWords.includes("alter");
    if (!isViewDefinition) continue;

    let cursor = skipQualifiedName(tokens, index + 1);
    if (tokens[cursor]?.type !== "symbol" || tokens[cursor]?.value !== "(") {
      continue;
    }

    const columns: string[] = [];
    let depth = 0;
    cursor += 1;
    for (; cursor < tokens.length; cursor += 1) {
      const current = tokens[cursor];
      if (current.type === "symbol") {
        if (current.value === "(") {
          depth += 1;
        } else if (current.value === ")") {
          if (depth === 0) break;
          depth -= 1;
        }
        continue;
      }
      if (depth === 0 && current.type === "word") {
        const columnName = normalizeIdentifier(current.value);
        if (columnName) columns.push(columnName);
      }
    }

    return columns;
  }

  return [];
};

const skipSelectModifiers = (tokens: Token[], startIndex: number) => {
  let index = startIndex;
  const distinctToken = tokens[index];
  if (distinctToken?.type === "word") {
    const value = distinctToken.value.toLowerCase();
    if (value === "distinct" || value === "all") {
      index += 1;
    }
  }

  if (tokens[index]?.type === "word" && tokens[index]?.value.toLowerCase() === "top") {
    index += 1;
    if (tokens[index]?.type === "symbol" && tokens[index]?.value === "(") {
      let depth = 0;
      for (; index < tokens.length; index += 1) {
        const token = tokens[index];
        if (token.type === "symbol" && token.value === "(") depth += 1;
        if (token.type === "symbol" && token.value === ")") {
          depth -= 1;
          if (depth === 0) {
            index += 1;
            break;
          }
        }
      }
    } else if (tokens[index]?.type === "word") {
      index += 1;
    }

    if (tokens[index]?.type === "word" && tokens[index]?.value.toLowerCase() === "percent") {
      index += 1;
    }
  }

  return index;
};

const parseSelectItems = (tokens: Token[]) => {
  let depth = 0;
  let selectIndex = -1;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type === "symbol") {
      if (token.value === "(") depth += 1;
      if (token.value === ")") depth = Math.max(0, depth - 1);
    }

    if (depth === 0 && token.type === "word" && token.value.toLowerCase() === "select") {
      selectIndex = index;
      break;
    }
  }

  if (selectIndex === -1) return [];

  let index = skipSelectModifiers(tokens, selectIndex + 1);
  const items: Token[][] = [];
  let current: Token[] = [];
  depth = 0;

  for (; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type === "symbol") {
      if (token.value === "(") depth += 1;
      if (token.value === ")") depth = Math.max(0, depth - 1);
    }

    if (depth === 0 && token.type === "word" && token.value.toLowerCase() === "from") {
      break;
    }

    if (depth === 0 && token.type === "symbol" && token.value === ",") {
      if (current.length > 0) items.push(current);
      current = [];
      continue;
    }

    current.push(token);
  }

  if (current.length > 0) items.push(current);
  return items;
};

const splitParameterChunks = (tokens: Token[]) => {
  const chunks: Token[][] = [];
  let current: Token[] = [];
  let depth = 0;

  for (const token of tokens) {
    if (token.type === "symbol") {
      if (token.value === "(") depth += 1;
      if (token.value === ")") depth = Math.max(0, depth - 1);
    }

    if (depth === 0 && token.type === "symbol" && token.value === ",") {
      if (current.length > 0) chunks.push(current);
      current = [];
      continue;
    }

    current.push(token);
  }

  if (current.length > 0) chunks.push(current);
  return chunks;
};

const parseParameterChunk = (tokens: Token[]) => {
  const nameIndex = tokens.findIndex(
    (token) => token.type === "word" && token.value.startsWith("@")
  );
  if (nameIndex === -1) return null;

  const name = ensureParameterName(tokens[nameIndex].value);
  const typeTokens: Token[] = [];
  let isOutput = false;

  for (let index = nameIndex + 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type === "symbol" && token.value === "=") break;
    if (token.type === "word") {
      const value = token.value.toLowerCase();
      if (value === "output" || value === "out") {
        isOutput = true;
        continue;
      }
      if (value === "readonly") {
        continue;
      }
    }
    typeTokens.push(token);
  }

  const dataType = tokensToSql(typeTokens);

  return { name, dataType, isOutput } satisfies ProcedureParameter;
};

const splitAlias = (tokens: Token[]) => {
  let depth = 0;
  let asIndex = -1;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type === "symbol") {
      if (token.value === "(") depth += 1;
      if (token.value === ")") depth = Math.max(0, depth - 1);
    }
    if (depth === 0 && token.type === "word" && token.value.toLowerCase() === "as") {
      asIndex = index;
    }
  }

  if (asIndex !== -1) {
    const aliasToken = tokens[asIndex + 1];
    if (aliasToken && aliasToken.type === "word") {
      return {
        exprTokens: tokens.slice(0, asIndex),
        alias: normalizeIdentifier(aliasToken.value),
      };
    }
  }

  const lastToken = tokens[tokens.length - 1];
  const secondLast = tokens[tokens.length - 2];
  if (
    tokens.length > 1 &&
    lastToken?.type === "word" &&
    isIdentifierToken(lastToken) &&
    !(secondLast?.type === "symbol" && secondLast.value === ".")
  ) {
    return {
      exprTokens: tokens.slice(0, -1),
      alias: normalizeIdentifier(lastToken.value),
    };
  }

  return { exprTokens: tokens };
};

const extractIdentifierChains = (tokens: Token[]) => {
  const chains: { parts: string[]; endIndex: number }[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type !== "word") continue;

    const parts = [token.value];
    let cursor = index;

    while (
      tokens[cursor + 1]?.type === "symbol" &&
      tokens[cursor + 1]?.value === "." &&
      tokens[cursor + 2]?.type === "word"
    ) {
      parts.push(tokens[cursor + 2].value);
      cursor += 2;
    }

    chains.push({ parts, endIndex: cursor });
    index = cursor;
  }

  return chains;
};

const uniqueByKey = <T,>(items: T[], keyFn: (item: T) => string) => {
  const seen = new Set<string>();
  const next: T[] = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(item);
  }
  return next;
};

const isWildcardTokenList = (tokens: Token[]) => {
  if (tokens.length === 1 && tokens[0].type === "symbol" && tokens[0].value === "*") {
    return { tableName: undefined };
  }
  if (
    tokens.length === 3 &&
    tokens[0].type === "word" &&
    tokens[1].type === "symbol" &&
    tokens[1].value === "." &&
    tokens[2].type === "symbol" &&
    tokens[2].value === "*"
  ) {
    return { tableName: tokens[0].value };
  }
  return null;
};

const getColumnsForObject = (schema: SchemaGraph, tableId: string) => {
  const table = schema.tables.find((t) => t.id === tableId);
  if (table) return table.columns;
  const view = schema.views.find((v) => v.id === tableId);
  return view ? view.columns : [];
};

const buildViewColumn = (
  name: string,
  sources: ColumnSource[],
  schema: SchemaGraph,
  nameToId: Map<string, string>
) => {
  let dataType = DEFAULT_VIEW_COLUMN_TYPE;
  let isNullable = true;

  const normalizedSources = sources.map((source) => {
    const tableKey = source.table.toLowerCase();
    const normalizedTable = source.table.replace(/[[\]]/g, "");
    const tableId =
      nameToId.get(tableKey) ?? nameToId.get(normalizedTable.toLowerCase());
    const resolvedTable = tableId ?? source.table;
    const sourceColumns = tableId
      ? getColumnsForObject(schema, tableId)
      : [];
    const resolvedColumn =
      sourceColumns.find(
        (col) => col.name.toLowerCase() === source.column.toLowerCase()
      )?.name ?? source.column;

    return { table: resolvedTable, column: resolvedColumn };
  });

  if (normalizedSources.length > 0) {
    const primary = normalizedSources[0];
    const tableId = nameToId.get(primary.table.toLowerCase());
    if (tableId) {
      const sourceColumn = getColumnsForObject(schema, tableId).find(
        (col) => col.name.toLowerCase() === primary.column.toLowerCase()
      );
      if (sourceColumn) {
        dataType = sourceColumn.dataType;
        isNullable = sourceColumn.isNullable;
      }
    }
  }

  const column: Column = {
    name,
    dataType,
    isNullable,
    isPrimaryKey: false,
  };

  if (normalizedSources.length > 0) {
    column.sourceColumns = normalizedSources;
    column.sourceTable = normalizedSources[0].table;
    column.sourceColumn = normalizedSources[0].column;
  }

  return column;
};

const buildParameterList = (
  parameters: ProcedureParameter[],
  indent = "  "
) => {
  if (parameters.length === 0) return "";
  return parameters
    .map((param) => {
      const name = ensureParameterName(param.name);
      const dataType = param.dataType?.trim();
      const output = param.isOutput ? " OUTPUT" : "";
      if (!dataType) {
        return `${indent}${name}${output}`;
      }
      return `${indent}${name} ${dataType}${output}`;
    })
    .join(",\n");
};

const ensureUniqueName = (name: string, used: Set<string>) => {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  let suffix = 2;
  let candidate = `${name}_${suffix}`;
  while (used.has(candidate)) {
    suffix += 1;
    candidate = `${name}_${suffix}`;
  }
  used.add(candidate);
  return candidate;
};

const buildSourcesForTokens = (
  tokens: Token[],
  aliasMap: Map<string, string>,
  defaultTable: string | undefined,
  nameToId: Map<string, string>,
  defaultSchema?: string
) => {
  const chains = extractIdentifierChains(tokens);
  const sources: ColumnSource[] = [];

  for (const chain of chains) {
    const nextToken = tokens[chain.endIndex + 1];
    if (nextToken?.type === "symbol" && nextToken.value === "(") {
      continue;
    }

    const normalizedParts = chain.parts.map(normalizeIdentifier).filter(Boolean);
    if (normalizedParts.length === 0) continue;

    if (normalizedParts.length === 1) {
      const column = normalizedParts[0];
      if (isKeyword(column)) continue;
      if (!defaultTable) continue;
      sources.push({ table: defaultTable, column });
      continue;
    }

    const column = normalizedParts[normalizedParts.length - 1];
    const tableCandidate = normalizedParts.slice(0, -1).join(".");
    const resolvedTable = resolveTableFromCandidate(
      tableCandidate,
      aliasMap,
      nameToId,
      defaultSchema
    );
    if (!resolvedTable) continue;
    sources.push({ table: resolvedTable, column });
  }

  return uniqueByKey(sources, (source) => `${source.table}::${source.column}`);
};

const buildViewColumnsFromSelect = (
  selectItems: Token[][],
  schema: SchemaGraph,
  aliasMap: Map<string, string>,
  readTables: string[],
  nameToId: Map<string, string>,
  defaultSchema?: string
) => {
  const columns: Column[] = [];
  const usedNames = new Set<string>();
  const resolvedTables = readTables.map((tableName) => ({
    name: tableName,
    id: nameToId.get(tableName.toLowerCase()),
  }));
  const defaultTable = resolvedTables.length === 1 ? resolvedTables[0].name : undefined;

  const addColumn = (column: Column) => {
    column.name = ensureUniqueName(column.name, usedNames);
    columns.push(column);
  };

  for (let index = 0; index < selectItems.length; index += 1) {
    const { exprTokens, alias } = splitAlias(selectItems[index]);
    const wildcard = isWildcardTokenList(exprTokens);

    if (wildcard) {
      if (wildcard.tableName) {
        const resolved = resolveTableFromCandidate(
          wildcard.tableName,
          aliasMap,
          nameToId,
          defaultSchema
        );
        const tableId = resolved ? nameToId.get(resolved.toLowerCase()) : undefined;
        if (resolved && tableId) {
          const sourceColumns = getColumnsForObject(schema, tableId);
          sourceColumns.forEach((col) => {
            addColumn(
              buildViewColumn(
                col.name,
                [{ table: resolved, column: col.name }],
                schema,
                nameToId
              )
            );
          });
        }
      } else {
        resolvedTables.forEach((table) => {
          if (!table.id) return;
          const sourceColumns = getColumnsForObject(schema, table.id);
          sourceColumns.forEach((col) => {
            addColumn(
              buildViewColumn(
                col.name,
                [{ table: table.name, column: col.name }],
                schema,
                nameToId
              )
            );
          });
        });
      }
      continue;
    }

    const sources = buildSourcesForTokens(
      exprTokens,
      aliasMap,
      defaultTable,
      nameToId,
      defaultSchema
    );
    const baseName =
      alias || sources[0]?.column || `expr_${index + 1}`;
    addColumn(buildViewColumn(baseName, sources, schema, nameToId));
  }

  return columns;
};

const uniqueNames = (items: string[]) => {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(item);
  }
  return next;
};

const isPseudoTable = (tableName: string) => {
  const shortName = tableName.split(".").pop()?.toLowerCase();
  return shortName === "inserted" || shortName === "deleted";
};

export const parseViewDefinition = (
  definition: string,
  schema: SchemaGraph,
  options?: {
    fallbackColumns?: Column[];
    defaultSchema?: string;
  }
) => {
  const fallbackColumns = options?.fallbackColumns ?? [];
  if (!definition.trim()) {
    return { columns: fallbackColumns, referencedTables: [] };
  }

  const cleaned = stripSqlLiteralsAndComments(definition);
  const tokens = tokenize(cleaned);
  const nameToId = getSchemaIndex(schema).nameToId;
  const { readTables, aliasMap } = parseTableReferences(
    tokens,
    nameToId,
    options?.defaultSchema
  );

  const selectItems = parseSelectItems(tokens);
  const selectColumns = buildViewColumnsFromSelect(
    selectItems,
    schema,
    aliasMap,
    readTables,
    nameToId,
    options?.defaultSchema
  );
  const viewColumnList = parseViewColumnList(tokens);

  let columns: Column[] = [];
  if (viewColumnList.length > 0) {
    const usedNames = new Set<string>();
    columns = viewColumnList.map((columnName, index) => {
      const normalizedName = ensureUniqueName(columnName, usedNames);
      const sources = selectColumns[index]?.sourceColumns ?? [];
      return buildViewColumn(normalizedName, sources, schema, nameToId);
    });
  } else if (selectColumns.length > 0) {
    columns = selectColumns;
  } else {
    columns = fallbackColumns;
  }

  const referencedTables = uniqueNames(readTables);
  const resolveReferenceId = (reference: string) => {
    const key = reference.toLowerCase();
    const normalizedReference = reference.replace(/[[\]]/g, "");
    return (
      nameToId.get(key) ??
      nameToId.get(normalizedReference.toLowerCase()) ??
      reference
    );
  };

  const referenceIds = referencedTables.map(resolveReferenceId);
  if (referenceIds.length > 0) {
    columns = columns.map((column) => {
      if (column.sourceColumns && column.sourceColumns.length > 0) {
        return column;
      }
      if (column.sourceTable || column.sourceColumn) {
        return column;
      }

      const matches: { tableId: string; column: string }[] = [];
      for (const tableId of referenceIds) {
        const sourceColumns = getColumnsForObject(schema, tableId);
        const match = sourceColumns.find(
          (source) => source.name.toLowerCase() === column.name.toLowerCase()
        );
        if (match) {
          matches.push({ tableId, column: match.name });
        }
      }

      if (matches.length !== 1) return column;

      return {
        ...column,
        sourceColumns: [
          { table: matches[0].tableId, column: matches[0].column },
        ],
        sourceTable: matches[0].tableId,
        sourceColumn: matches[0].column,
      };
    });
  }

  return {
    columns,
    referencedTables,
  };
};

export const parseRoutineParameters = (definition: string) => {
  if (!definition.trim()) {
    return { parameters: [], hasSignature: false };
  }

  const cleaned = stripSqlLiteralsAndComments(definition);
  const tokens = tokenize(cleaned);

  let routineIndex = -1;
  let routineKind: "function" | "procedure" | null = null;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type !== "word") continue;
    const value = token.value.toLowerCase();
    if (value === "function") {
      routineIndex = index;
      routineKind = "function";
      break;
    }
    if (value === "procedure" || value === "proc") {
      routineIndex = index;
      routineKind = "procedure";
      break;
    }
  }

  if (routineIndex === -1 || !routineKind) {
    const paramsTokens: Token[] = [];
    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index];
      if (token.type === "word") {
        const value = token.value.toLowerCase();
        if (value === "begin" || value === "as" || value === "returns") {
          break;
        }
      }
      paramsTokens.push(token);
    }

    if (!paramsTokens.some((token) => token.type === "word" && token.value.startsWith("@"))) {
      return { parameters: [], hasSignature: false };
    }

    const parameters = splitParameterChunks(paramsTokens)
      .map(parseParameterChunk)
      .filter((param): param is ProcedureParameter => Boolean(param));

    return { parameters, hasSignature: true };
  }

  if (routineKind === "function") {
    let index = skipQualifiedName(tokens, routineIndex + 1);
    while (
      tokens[index]?.type === "word" &&
      tokens[index]?.value.toLowerCase() === "as"
    ) {
      index += 1;
    }
    if (tokens[index]?.type !== "symbol" || tokens[index]?.value !== "(") {
      return { parameters: [], hasSignature: false };
    }

    const paramsTokens: Token[] = [];
    let depth = 0;
    for (index += 1; index < tokens.length; index += 1) {
      const token = tokens[index];
      if (token.type === "symbol" && token.value === "(") depth += 1;
      if (token.type === "symbol" && token.value === ")") {
        if (depth === 0) break;
        depth -= 1;
      }
      paramsTokens.push(token);
    }

    if (!paramsTokens.some((token) => token.type === "word" && token.value.startsWith("@"))) {
      return { parameters: [], hasSignature: false };
    }

    const parameters = splitParameterChunks(paramsTokens)
      .map(parseParameterChunk)
      .filter((param): param is ProcedureParameter => Boolean(param));

    return { parameters, hasSignature: true };
  }

  let index = skipQualifiedName(tokens, routineIndex + 1);
  const paramsTokens: Token[] = [];
  for (; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type === "word") {
      const value = token.value.toLowerCase();
      if (value === "as" || value === "begin") break;
    }
    paramsTokens.push(token);
  }

  if (!paramsTokens.some((token) => token.type === "word" && token.value.startsWith("@"))) {
    return { parameters: [], hasSignature: false };
  }

  const parameters = splitParameterChunks(paramsTokens)
    .map(parseParameterChunk)
    .filter((param): param is ProcedureParameter => Boolean(param));

  return { parameters, hasSignature: true };
};

export const parseFunctionReturnType = (definition: string) => {
  if (!definition.trim()) return undefined;

  const cleaned = stripSqlLiteralsAndComments(definition);
  const tokens = tokenize(cleaned);

  const returnsIndex = tokens.findIndex(
    (token) => token.type === "word" && token.value.toLowerCase() === "returns"
  );
  if (returnsIndex === -1) return undefined;

  const typeTokens: Token[] = [];
  for (let index = returnsIndex + 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type === "word") {
      const value = token.value.toLowerCase();
      if (value === "as" || value === "begin") break;
    }
    if (token.type === "symbol" && token.value === ";") break;
    typeTokens.push(token);
  }

  const result = tokensToSql(typeTokens);
  return result || undefined;
};

export const parseRoutineDefinition = (
  definition: string,
  schema: SchemaGraph,
  options?: { defaultSchema?: string }
) => {
  if (!definition.trim()) {
    return { referencedTables: [], affectedTables: [] };
  }

  const cleaned = stripSqlLiteralsAndComments(definition);
  const tokens = tokenize(cleaned);
  const nameToId = getSchemaIndex(schema).nameToId;
  const { readTables, writeTables, aliasMap } = parseTableReferences(
    tokens,
    nameToId,
    options?.defaultSchema
  );

  const resolveAlias = (tableName: string) =>
    aliasMap.get(tableName.toLowerCase()) ?? tableName;

  return {
    referencedTables: uniqueNames(
      readTables
        .map(resolveAlias)
        .filter((table) => !isPseudoTable(table))
    ),
    affectedTables: uniqueNames(
      writeTables
        .map(resolveAlias)
        .filter((table) => !isPseudoTable(table))
    ),
  };
};

export const generateViewDefinition = (options: {
  schema: string;
  name: string;
  columns: Column[];
}) => {
  const columns = options.columns;

  if (columns.length === 0) {
    return "";
  }

  const sourceTables = new Set<string>();
  columns.forEach((column) => {
    const primarySource = column.sourceColumns?.[0] ?? null;
    if (primarySource?.table) {
      sourceTables.add(primarySource.table);
    } else if (column.sourceTable) {
      sourceTables.add(column.sourceTable);
    }
  });

  const hasSingleSource = sourceTables.size === 1;
  const fromTable = hasSingleSource ? Array.from(sourceTables)[0] : null;

  const columnLines = columns.map((column) => {
    const source = column.sourceColumns?.[0];
    if (source) {
      const qualified =
        !hasSingleSource && source.table
          ? `${formatQualifiedName(source.table)}.${formatIdentifierPart(source.column)}`
          : formatIdentifierPart(source.column);
      if (column.name.toLowerCase() !== source.column.toLowerCase()) {
        return `${qualified} AS ${formatIdentifierPart(column.name)}`;
      }
      return qualified;
    }

    if (column.sourceTable && column.sourceColumn) {
      const qualified =
        !hasSingleSource
          ? `${formatQualifiedName(column.sourceTable)}.${formatIdentifierPart(
              column.sourceColumn
            )}`
          : formatIdentifierPart(column.sourceColumn);
      if (column.name.toLowerCase() !== column.sourceColumn.toLowerCase()) {
        return `${qualified} AS ${formatIdentifierPart(column.name)}`;
      }
      return qualified;
    }

    return formatIdentifierPart(column.name);
  });

  const fromClause = fromTable
    ? `\nFROM ${formatQualifiedName(fromTable)}`
    : "";

  return `SELECT\n  ${columnLines.join(",\n  ")}${fromClause}`;
};

export const generateProcedureDefinition = (options: {
  schema: string;
  name: string;
  parameters: ProcedureParameter[];
}) => {
  const paramBlock = buildParameterList(options.parameters);
  const paramSection = paramBlock ? `${paramBlock}\n\n` : "";

  return `${paramSection}BEGIN\n  -- TODO: implement\nEND`;
};

export const generateFunctionDefinition = (options: {
  schema: string;
  name: string;
  parameters: ProcedureParameter[];
  returnType: string;
}) => {
  const paramBlock = buildParameterList(options.parameters, "  ");
  const params = paramBlock ? `(\n${paramBlock}\n)` : "()";
  const returnType = options.returnType.trim() || DEFAULT_PARAMETER_TYPE;

  return `${params}\nRETURNS ${returnType}\nBEGIN\n  RETURN NULL\nEND`;
};

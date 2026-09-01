import type * as MonacoApi from "monaco-editor/esm/vs/editor/editor.api";

// Monaco cannot consume CSS var() values, so these hexes mirror the
// Instrument tokens in src/index.css (accent blue, object greens/ambers,
// cool-tinted neutrals). Keep the two in sync when the palette changes.
const DARK = {
  background: "#17191e",
  foreground: "#dfe2e7",
  lineHighlight: "#1e2127",
  selection: "#24344f",
  comment: "#565b64",
  keyword: "#4d8dff",
  string: "#4fb98c",
  number: "#d9a04c",
  operator: "#8b909a",
  type: "#56b6c2",
};

const LIGHT = {
  background: "#ffffff",
  foreground: "#24272e",
  lineHighlight: "#f2f4f7",
  selection: "#cddcf9",
  comment: "#7a7f88",
  keyword: "#3563d8",
  string: "#2a8a63",
  number: "#a06616",
  operator: "#5c5f68",
  type: "#177d92",
};

function rules(p: typeof DARK): MonacoApi.editor.ITokenThemeRule[] {
  return [
    { token: "comment", foreground: p.comment.slice(1), fontStyle: "italic" },
    { token: "keyword", foreground: p.keyword.slice(1) },
    { token: "operator", foreground: p.operator.slice(1) },
    { token: "delimiter", foreground: p.operator.slice(1) },
    { token: "string", foreground: p.string.slice(1) },
    { token: "number", foreground: p.number.slice(1) },
    { token: "predefined", foreground: p.type.slice(1) },
    { token: "type", foreground: p.type.slice(1) },
    { token: "identifier", foreground: p.foreground.slice(1) },
    { token: "tag", foreground: p.keyword.slice(1) },
    { token: "attribute.name", foreground: p.type.slice(1) },
    { token: "attribute.value", foreground: p.string.slice(1) },
  ];
}

function colors(p: typeof DARK): MonacoApi.editor.IColors {
  return {
    "editor.background": p.background,
    "editor.foreground": p.foreground,
    "editor.lineHighlightBackground": p.lineHighlight,
    "editor.selectionBackground": p.selection,
    "editorLineNumber.foreground": p.comment,
    "editorLineNumber.activeForeground": p.operator,
    "editorCursor.foreground": p.keyword,
    "editorWidget.background": p.background,
    "editorWidget.border": p.lineHighlight,
    "editorSuggestWidget.selectedBackground": p.selection,
  };
}

let themesDefined = false;

export function defineMonocleThemes(monaco: typeof MonacoApi) {
  if (themesDefined) return;
  themesDefined = true;
  monaco.editor.defineTheme("monocle-dark", {
    base: "vs-dark",
    inherit: true,
    rules: rules(DARK),
    colors: colors(DARK),
  });
  monaco.editor.defineTheme("monocle-light", {
    base: "vs",
    inherit: true,
    rules: rules(LIGHT),
    colors: colors(LIGHT),
  });
}

export function monocleMonacoTheme(resolvedTheme: "dark" | "light"): string {
  return resolvedTheme === "dark" ? "monocle-dark" : "monocle-light";
}

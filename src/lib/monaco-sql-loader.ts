import { loader } from "@monaco-editor/react";
import { registerSqlCompletionProvider } from "@/lib/sql-intellisense";
import { defineMonocleThemes } from "@/lib/monaco-themes";

let monacoSqlLoadPromise: Promise<void> | null = null;

export const ensureMonacoSqlLoaded = () => {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (monacoSqlLoadPromise) {
    return monacoSqlLoadPromise;
  }

  monacoSqlLoadPromise = Promise.all([
    import("monaco-editor/esm/vs/editor/editor.api"),
    import("monaco-editor/esm/vs/basic-languages/sql/sql.contribution.js"),
  ]).then(([localMonaco]) => {
    loader.config({ monaco: localMonaco });
    defineMonocleThemes(localMonaco);
    registerSqlCompletionProvider(localMonaco);
  });

  return monacoSqlLoadPromise;
};

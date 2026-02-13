import { loader } from "@monaco-editor/react";
import { registerSqlCompletionProvider } from "@/lib/sql-intellisense";

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
    registerSqlCompletionProvider(localMonaco);
  });

  return monacoSqlLoadPromise;
};

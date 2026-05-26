import { loader } from "@monaco-editor/react";

let monacoXmlLoadPromise: Promise<void> | null = null;

export const ensureMonacoXmlLoaded = () => {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (monacoXmlLoadPromise) {
    return monacoXmlLoadPromise;
  }

  monacoXmlLoadPromise = Promise.all([
    import("monaco-editor/esm/vs/editor/editor.api"),
    import("monaco-editor/esm/vs/basic-languages/xml/xml.contribution.js"),
  ]).then(([localMonaco]) => {
    loader.config({ monaco: localMonaco });
  });

  return monacoXmlLoadPromise;
};

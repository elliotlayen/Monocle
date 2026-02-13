import { useEffect, useMemo, useState } from "react";
import Editor from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useResolvedTheme } from "@/hooks/use-resolved-theme";
import { ensureMonacoSqlLoaded } from "@/lib/monaco-sql-loader";

interface SqlCodeBlockProps {
  code: string;
  maxHeight?: string;
}

const LINE_HEIGHT = 20;
const VERTICAL_PADDING = 24;

export function SqlCodeBlock({ code, maxHeight = "300px" }: SqlCodeBlockProps) {
  const [isMonacoReady, setIsMonacoReady] = useState(false);
  const resolvedTheme = useResolvedTheme();
  const monacoTheme = resolvedTheme === "dark" ? "vs-dark" : "vs";

  useEffect(() => {
    let isCancelled = false;

    ensureMonacoSqlLoaded()
      .then(() => {
        if (!isCancelled) setIsMonacoReady(true);
      })
      .catch(() => {
        if (!isCancelled) setIsMonacoReady(true);
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  const options = useMemo<editor.IStandaloneEditorConstructionOptions>(
    () => ({
      readOnly: true,
      domReadOnly: true,
      minimap: { enabled: false },
      lineNumbers: "on",
      lineNumbersMinChars: 3,
      folding: false,
      glyphMargin: false,
      scrollBeyondLastLine: false,
      wordWrap: "on",
      automaticLayout: true,
      fontSize: 12,
      lineHeight: LINE_HEIGHT,
      fontFamily:
        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace",
      overviewRulerLanes: 0,
      renderLineHighlight: "none",
      contextmenu: false,
      padding: { top: 12, bottom: 12 },
      ariaLabel: "SQL Definition",
      scrollbar: {
        alwaysConsumeMouseWheel: false,
      },
    }),
    []
  );

  const editorHeight = useMemo(() => {
    const lineCount = Math.max(1, code.split(/\r\n|\r|\n/).length);
    const contentHeight = lineCount * LINE_HEIGHT + VERTICAL_PADDING;
    return `min(${contentHeight}px, ${maxHeight})`;
  }, [code, maxHeight]);

  if (!code) {
    return (
      <div className="bg-muted text-muted-foreground p-4 rounded-lg text-xs font-mono italic">
        Definition not available
      </div>
    );
  }

  return (
    <div className="rounded-lg overflow-hidden" style={{ height: editorHeight, maxHeight }}>
      {isMonacoReady ? (
        <Editor
          language="sql"
          value={code}
          theme={monacoTheme}
          options={options}
          width="100%"
          height="100%"
        />
      ) : (
        <pre className="h-full m-0 p-3 overflow-auto bg-muted text-foreground text-xs font-mono leading-5">
          {code}
        </pre>
      )}
    </div>
  );
}

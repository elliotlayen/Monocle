import { useEffect, useMemo, useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useResolvedTheme } from "@/hooks/use-resolved-theme";
import { ensureMonacoXmlLoaded } from "@/lib/monaco-xml-loader";

interface XmlSourceViewProps {
  content: string;
  isXml: boolean;
  tabId: string;
  scrollPosition: number;
  onScrollChange: (position: number) => void;
}

export function XmlSourceView({
  content,
  isXml,
  tabId,
  scrollPosition,
  onScrollChange,
}: XmlSourceViewProps) {
  const [isMonacoReady, setIsMonacoReady] = useState(false);
  const resolvedTheme = useResolvedTheme();
  const monacoTheme = resolvedTheme === "dark" ? "vs-dark" : "vs";
  const scrollPositionRef = useRef(scrollPosition);

  useEffect(() => {
    scrollPositionRef.current = scrollPosition;
  }, [scrollPosition]);

  useEffect(() => {
    let isCancelled = false;

    ensureMonacoXmlLoaded()
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
      folding: true,
      glyphMargin: false,
      scrollBeyondLastLine: false,
      wordWrap: "on",
      automaticLayout: true,
      fontSize: 13,
      lineHeight: 20,
      fontFamily:
        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace",
      overviewRulerLanes: 0,
      renderLineHighlight: "line",
      contextmenu: false,
      padding: { top: 8, bottom: 8 },
      scrollbar: {
        alwaysConsumeMouseWheel: false,
      },
      ariaLabel: "File source view",
    }),
    []
  );

  const handleEditorMount: OnMount = (editorInstance) => {
    editorInstance.setScrollTop(scrollPositionRef.current);

    editorInstance.onDidScrollChange((e) => {
      onScrollChange(e.scrollTop);
    });
  };

  return (
    <div className="flex-1 overflow-hidden">
      {isMonacoReady ? (
        <Editor
          key={tabId}
          language={isXml ? "xml" : "plaintext"}
          value={content}
          theme={monacoTheme}
          options={options}
          width="100%"
          height="100%"
          onMount={handleEditorMount}
        />
      ) : (
        <pre className="h-full m-0 p-3 overflow-auto bg-background text-foreground text-[13px] font-mono leading-5">
          {content}
        </pre>
      )}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle, useCallback } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useResolvedTheme } from "@/hooks/use-resolved-theme";
import { ensureMonacoXmlLoaded } from "@/lib/monaco-xml-loader";
import { useValidationDecorations } from "../hooks/use-validation-decorations";
import { useSearchHighlight } from "../hooks/use-search-highlight";
import type { ValidationProblem } from "../types";

interface XmlSourceViewProps {
  content: string;
  isXml: boolean;
  tabId: string;
  scrollPosition: number;
  onScrollChange: (position: number) => void;
  savedViewState: unknown | null;
  onViewStateChange: (state: unknown | null) => void;
  problems?: ValidationProblem[];
  searchHighlightTerms?: string[] | null;
  pendingJump?: { tabId: string; line: number; column: number } | null;
  onJumpHandled?: () => void;
}

export interface XmlSourceViewHandle {
  foldAll: () => void;
  unfoldAll: () => void;
}

export const XmlSourceView = forwardRef<XmlSourceViewHandle, XmlSourceViewProps>(function XmlSourceView({
  content,
  isXml,
  tabId,
  scrollPosition,
  onScrollChange,
  savedViewState,
  onViewStateChange,
  problems,
  searchHighlightTerms,
  pendingJump,
  onJumpHandled,
}, ref) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [editorMounted, setEditorMounted] = useState<editor.IStandaloneCodeEditor | null>(null);
  const [isMonacoReady, setIsMonacoReady] = useState(false);
  const resolvedTheme = useResolvedTheme();

  const onViewStateChangeRef = useRef(onViewStateChange);
  onViewStateChangeRef.current = onViewStateChange;
  const savedViewStateRef = useRef(savedViewState);
  savedViewStateRef.current = savedViewState;

  useImperativeHandle(ref, () => ({
    foldAll() {
      editorRef.current?.getAction("editor.foldAll")?.run();
    },
    unfoldAll() {
      editorRef.current?.getAction("editor.unfoldAll")?.run();
    },
  }));

  useEffect(() => {
    return () => {
      if (editorRef.current) {
        onViewStateChangeRef.current(editorRef.current.saveViewState());
      }
    };
  }, []);

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

  // Apply Monaco decorations for validation problems
  useValidationDecorations(editorMounted, problems ?? []);

  // Apply Monaco decorations for search term highlighting
  useSearchHighlight(editorMounted, searchHighlightTerms ?? null);

  // Handle pending jump from problems panel click
  const onJumpHandledRef = useRef(onJumpHandled);
  onJumpHandledRef.current = onJumpHandled;

  const stableOnJumpHandled = useCallback(() => {
    onJumpHandledRef.current?.();
  }, []);

  useEffect(() => {
    if (pendingJump && pendingJump.tabId === tabId && editorMounted) {
      editorMounted.setPosition({
        lineNumber: pendingJump.line,
        column: pendingJump.column,
      });
      editorMounted.revealLineInCenterIfOutsideViewport(pendingJump.line);
      editorMounted.focus();
      stableOnJumpHandled();
    }
  }, [pendingJump, tabId, editorMounted, stableOnJumpHandled]);

  const options = useMemo<editor.IStandaloneEditorConstructionOptions>(
    () => ({
      readOnly: true,
      domReadOnly: true,
      minimap: { enabled: false },
      lineNumbers: "on",
      lineNumbersMinChars: 3,
      folding: true,
      glyphMargin: true,
      scrollBeyondLastLine: false,
      wordWrap: "on",
      automaticLayout: true,
      fontSize: 13,
      lineHeight: 20,
      fontFamily:
        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace",
      overviewRulerLanes: 2,
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
    editorRef.current = editorInstance;
    setEditorMounted(editorInstance);

    if (savedViewStateRef.current) {
      editorInstance.restoreViewState(savedViewStateRef.current as editor.ICodeEditorViewState);
    } else {
      editorInstance.setScrollTop(scrollPositionRef.current);
    }

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
});

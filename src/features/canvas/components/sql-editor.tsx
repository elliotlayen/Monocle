import { useEffect, useMemo, useState } from "react";
import Editor, { type OnChange } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useResolvedTheme } from "@/hooks/use-resolved-theme";
import { ensureMonacoSqlLoaded } from "@/lib/monaco-sql-loader";
import { cn } from "@/lib/utils";

interface SqlEditorProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  height?: string;
  className?: string;
}

export function SqlEditor({
  id,
  value,
  onChange,
  placeholder,
  height = "160px",
  className,
}: SqlEditorProps) {
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
      minimap: { enabled: false },
      lineNumbers: "on",
      lineNumbersMinChars: 3,
      quickSuggestions: { other: true, comments: false, strings: false },
      suggestOnTriggerCharacters: true,
      wordBasedSuggestions: "off",
      parameterHints: { enabled: true },
      folding: false,
      glyphMargin: false,
      scrollBeyondLastLine: true,
      wordWrap: "on",
      automaticLayout: true,
      fontSize: 12,
      lineHeight: 20,
      fontFamily:
        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace",
      overviewRulerLanes: 0,
      renderLineHighlight: "none",
      contextmenu: false,
      padding: { top: 12, bottom: 12 },
      tabSize: 2,
      insertSpaces: true,
      ariaLabel: id ?? "SQL Editor",
      scrollbar: {
        alwaysConsumeMouseWheel: false,
      },
      fixedOverflowWidgets: false,
    }),
    [id]
  );

  const handleChange = useMemo<OnChange>(
    () => (nextValue) => {
      onChange(nextValue ?? "");
    },
    [onChange]
  );

  if (!isMonacoReady) {
    return (
      <div
        className={cn(
          "relative rounded-md border border-input bg-background overflow-hidden",
          className
        )}
        style={{ height }}
      >
        <textarea
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          spellCheck={false}
          className="absolute inset-0 w-full h-full resize-none bg-transparent text-foreground caret-foreground p-3 text-xs font-mono leading-5 focus:outline-none"
        />
        {!value && placeholder && (
          <div className="absolute inset-0 z-10 p-3 text-xs font-mono text-muted-foreground pointer-events-none">
            {placeholder}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative rounded-md border border-input bg-background overflow-hidden",
        className
      )}
      style={{ height }}
    >
      <Editor
        path={id ? `sql://${id}` : undefined}
        language="sql"
        value={value}
        onChange={handleChange}
        theme={monacoTheme}
        options={options}
        width="100%"
        height="100%"
      />

      {!value && placeholder && (
        <div className="absolute inset-0 z-10 pl-12 pr-3 py-3 text-xs font-mono text-muted-foreground pointer-events-none">
          {placeholder}
        </div>
      )}
    </div>
  );
}

import { useRef } from "react";
import { Highlight, themes } from "prism-react-renderer";
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
  const highlightRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleScroll = () => {
    if (!highlightRef.current || !textareaRef.current) return;
    highlightRef.current.scrollTop = textareaRef.current.scrollTop;
    highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
  };

  return (
    <div
      className={cn(
        "relative rounded-md border border-input bg-background overflow-hidden",
        className
      )}
      style={{ height }}
    >
      <Highlight theme={themes.nightOwl} code={value || " "} language="sql">
        {({ style, tokens, getLineProps, getTokenProps }) => (
          <div
            ref={highlightRef}
            className="absolute inset-0 overflow-auto pointer-events-none"
            style={style}
          >
            <pre className="m-0 p-3 text-xs font-mono leading-5">
              {tokens.map((line, i) => (
                <div key={i} {...getLineProps({ line })} className="whitespace-pre">
                  {line.map((token, key) => (
                    <span key={key} {...getTokenProps({ token })} />
                  ))}
                </div>
              ))}
            </pre>
          </div>
        )}
      </Highlight>

      {!value && placeholder && (
        <div className="absolute inset-0 p-3 text-xs font-mono text-muted-foreground pointer-events-none">
          {placeholder}
        </div>
      )}

      <textarea
        ref={textareaRef}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={handleScroll}
        spellCheck={false}
        className="absolute inset-0 w-full h-full resize-none bg-transparent text-transparent caret-foreground p-3 text-xs font-mono leading-5 focus:outline-none"
      />
    </div>
  );
}

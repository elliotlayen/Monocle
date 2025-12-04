import { Highlight, themes } from "prism-react-renderer";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface SqlCodeBlockProps {
  code: string;
  maxHeight?: string;
}

export function SqlCodeBlock({ code, maxHeight = "300px" }: SqlCodeBlockProps) {
  if (!code) {
    return (
      <div className="bg-slate-900 text-slate-400 p-4 rounded-lg text-xs font-mono italic">
        Definition not available
      </div>
    );
  }

  return (
    <Highlight theme={themes.nightOwl} code={code} language="sql">
      {({ style, tokens, getLineProps, getTokenProps }) => (
        <ScrollArea
          className="rounded-lg h-full"
          style={{ ...style, maxHeight: maxHeight === "100%" ? undefined : maxHeight }}
        >
          <div className="p-4">
            <code className="text-xs">
              {tokens.map((line, i) => (
                <div key={i} {...getLineProps({ line })} className="whitespace-pre">
                  <span className="inline-block w-8 text-slate-500 select-none text-right mr-4">
                    {i + 1}
                  </span>
                  {line.map((token, key) => (
                    <span key={key} {...getTokenProps({ token })} />
                  ))}
                </div>
              ))}
            </code>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}
    </Highlight>
  );
}

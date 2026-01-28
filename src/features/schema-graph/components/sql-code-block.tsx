import { Highlight, themes } from "prism-react-renderer";

interface SqlCodeBlockProps {
  code: string;
  maxHeight?: string;
}

export function SqlCodeBlock({ code, maxHeight = "300px" }: SqlCodeBlockProps) {
  if (!code) {
    return (
      <div className="bg-muted text-muted-foreground p-4 rounded-lg text-xs font-mono italic">
        Definition not available
      </div>
    );
  }

  return (
    <Highlight theme={themes.nightOwl} code={code} language="sql">
      {({ style, tokens, getLineProps, getTokenProps }) => (
        <div
          className="rounded-lg overflow-auto"
          style={{ ...style, maxHeight }}
        >
          <div className="p-4 w-max min-w-full">
            <code className="text-xs">
              {tokens.map((line, i) => (
                <div
                  key={i}
                  {...getLineProps({ line })}
                  className="whitespace-pre px-2 -mx-2 hover:bg-white/10 transition-colors"
                >
                  <span className="inline-block w-8 text-slate-400 select-none text-right mr-4">
                    {i + 1}
                  </span>
                  {line.map((token, key) => (
                    <span key={key} {...getTokenProps({ token })} />
                  ))}
                </div>
              ))}
            </code>
          </div>
        </div>
      )}
    </Highlight>
  );
}

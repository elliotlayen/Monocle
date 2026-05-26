import { useEffect, useRef } from "react";
import type { editor, IRange } from "monaco-editor";
import type { ValidationProblem } from "../types";

const STYLE_ID = "validation-decoration-styles";

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    /* Gutter markers */
    .validation-glyph-error {
      display: flex !important;
      align-items: center;
      justify-content: center;
    }
    .validation-glyph-error::before {
      content: "";
      display: inline-block;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: oklch(0.577 0.245 27.325);
    }
    .dark .validation-glyph-error::before {
      background: oklch(0.704 0.191 22.216);
    }

    .validation-glyph-warning {
      display: flex !important;
      align-items: center;
      justify-content: center;
    }
    .validation-glyph-warning::before {
      content: "";
      display: inline-block;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: oklch(0.75 0.15 85);
    }
    .dark .validation-glyph-warning::before {
      background: oklch(0.80 0.12 85);
    }

    /* Inline highlights */
    .validation-inline-error {
      background: oklch(0.577 0.245 27.325 / 0.12);
      border-bottom: 2px solid oklch(0.577 0.245 27.325);
    }
    .dark .validation-inline-error {
      background: oklch(0.704 0.191 22.216 / 0.15);
      border-bottom: 2px solid oklch(0.704 0.191 22.216);
    }

    .validation-inline-warning {
      background: oklch(0.75 0.15 85 / 0.12);
      border-bottom: 2px solid oklch(0.75 0.15 85);
    }
    .dark .validation-inline-warning {
      background: oklch(0.80 0.12 85 / 0.15);
      border-bottom: 2px solid oklch(0.80 0.12 85);
    }
  `;
  document.head.appendChild(style);
}

/**
 * Applies Monaco editor decorations for validation problems.
 * Creates gutter markers, inline highlights, overview ruler markers,
 * and hover messages from the validation problem array.
 */
export function useValidationDecorations(
  editorInstance: editor.IStandaloneCodeEditor | null,
  problems: ValidationProblem[]
): void {
  const collectionRef = useRef<editor.IEditorDecorationsCollection | null>(
    null
  );

  // Ensure CSS styles are injected on first mount
  useEffect(() => {
    ensureStyles();
  }, []);

  useEffect(() => {
    if (!editorInstance) return;

    // Clear previous decorations
    if (collectionRef.current) {
      collectionRef.current.clear();
      collectionRef.current = null;
    }

    if (problems.length === 0) return;

    // Determine highest severity per line for glyph deduplication
    const lineSeverityMap = new Map<number, "error" | "warning">();
    for (const p of problems) {
      const existing = lineSeverityMap.get(p.line);
      if (!existing || (existing === "warning" && p.severity === "error")) {
        lineSeverityMap.set(p.line, p.severity);
      }
    }

    // Track which lines have already had a glyph decoration assigned
    const linesWithGlyph = new Set<number>();

    const decorations: editor.IModelDeltaDecoration[] = problems.map((p) => {
      const isError = p.severity === "error";
      const lineSeverity = lineSeverityMap.get(p.line);

      // Only assign glyph to highest-severity decoration per line
      let glyphMarginClassName: string | undefined;
      if (!linesWithGlyph.has(p.line)) {
        if (lineSeverity === "error" && isError) {
          glyphMarginClassName = "validation-glyph-error";
          linesWithGlyph.add(p.line);
        } else if (lineSeverity === "warning" && !isError) {
          glyphMarginClassName = "validation-glyph-warning";
          linesWithGlyph.add(p.line);
        }
        // If line severity is error but this is a warning, skip glyph for this decoration
      }

      const range: IRange = {
        startLineNumber: p.line,
        startColumn: p.column,
        endLineNumber: p.line,
        endColumn: p.endColumn,
      };

      return {
        range,
        options: {
          glyphMarginClassName,
          className: isError
            ? "validation-inline-error"
            : "validation-inline-warning",
          overviewRuler: {
            color: isError
              ? "oklch(0.577 0.245 27.325)"
              : "oklch(0.75 0.15 85)",
            position: 4, // OverviewRulerLane.Right
          },
          hoverMessage: { value: p.message },
          glyphMarginHoverMessage: glyphMarginClassName
            ? { value: p.message }
            : undefined,
        },
      };
    });

    collectionRef.current =
      editorInstance.createDecorationsCollection(decorations);

    return () => {
      if (collectionRef.current) {
        collectionRef.current.clear();
        collectionRef.current = null;
      }
    };
  }, [editorInstance, problems]);
}

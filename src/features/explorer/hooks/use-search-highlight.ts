import { useEffect, useRef } from "react";
import type { editor } from "monaco-editor";

const STYLE_ID = "search-highlight-decoration-styles";

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .search-match-highlight {
      background: oklch(0.82 0.12 85 / 0.25);
    }
    .dark .search-match-highlight {
      background: oklch(0.80 0.12 85 / 0.20);
    }

    .search-match-highlight-current {
      background: oklch(0.82 0.12 85 / 0.50);
    }
    .dark .search-match-highlight-current {
      background: oklch(0.80 0.12 85 / 0.40);
    }
  `;
  document.head.appendChild(style);
}

/**
 * Applies Monaco editor decorations for search term highlighting.
 * Highlights all occurrences of each search term and scrolls to the first match.
 */
export function useSearchHighlight(
  editorInstance: editor.IStandaloneCodeEditor | null,
  searchTerms: string[] | null
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

    if (!searchTerms || searchTerms.length === 0) return;

    const model = editorInstance.getModel();
    if (!model) return;

    // Find all matches for all terms, track the first match for scroll targeting
    let firstMatch: editor.FindMatch | null = null;
    const allMatches: { match: editor.FindMatch; isFirst: boolean }[] = [];

    for (const term of searchTerms) {
      if (!term) continue;
      // findMatches(searchString, searchOnlyEditableRange, isRegex, matchCase, wordSeparators, captureMatches)
      const matches = model.findMatches(term, false, false, false, null, false);
      for (const match of matches) {
        if (!firstMatch) {
          firstMatch = match;
          allMatches.push({ match, isFirst: true });
        } else {
          allMatches.push({ match, isFirst: false });
        }
      }
    }

    if (allMatches.length === 0) return;

    const decorations: editor.IModelDeltaDecoration[] = allMatches.map(
      ({ match, isFirst }) => ({
        range: match.range,
        options: {
          className: isFirst
            ? "search-match-highlight-current"
            : "search-match-highlight",
          overviewRuler: {
            color: "oklch(0.82 0.12 85)",
            position: 2, // OverviewRulerLane.Center
          },
        },
      })
    );

    collectionRef.current =
      editorInstance.createDecorationsCollection(decorations);

    // Scroll to first match
    if (firstMatch) {
      editorInstance.revealRangeInCenterIfOutsideViewport(firstMatch.range);
    }

    return () => {
      if (collectionRef.current) {
        collectionRef.current.clear();
        collectionRef.current = null;
      }
    };
  }, [editorInstance, searchTerms]);
}

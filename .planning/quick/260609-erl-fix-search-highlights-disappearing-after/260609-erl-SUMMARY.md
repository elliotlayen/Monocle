---
status: complete
commit: cdc5126
date: 2026-06-09
---

# Quick Task 260609-erl: Fix search highlights disappearing after Format XML toggle

## What was done

Added `content` as a dependency to the `useSearchHighlight` hook so Monaco editor decorations are re-applied when the editor content changes (e.g., when toggling Format XML).

## Root cause

`useSearchHighlight` had dependencies `[editorInstance, searchTerms]`. When Format XML toggled, the editor content changed but neither dependency did, so the effect didn't re-run and decorations were lost.

## Changes

| File | Change |
|------|--------|
| `src/features/explorer/hooks/use-search-highlight.ts` | Added `content: string` parameter, added to effect dependency array |
| `src/features/explorer/components/xml-source-view.tsx` | Passed `content` to `useSearchHighlight` call |

## Verification

- `npm run lint` -- passed
- `npm run build` -- passed (type check + production build)

---
phase: 03-xml-file-viewing
plan: 02
subsystem: explorer-xml-tree-view
tags: [xml-parser, dom-parser, tree-view, collapsible-tree, parse-error]
dependency_graph:
  requires: [03-01]
  provides: [xml-tree-view, xml-parser, parse-error-detection]
  affects: [file-content-area, explorer-store]
tech_stack:
  added: [jsdom]
  patterns: [tdd-red-green, dom-parser-error-detection, usememo-parsing, recursive-tree-rendering]
key_files:
  created:
    - src/features/explorer/utils/xml-parser.ts
    - src/features/explorer/utils/xml-parser.test.ts
    - src/features/explorer/components/xml-tree-view.tsx
    - src/features/explorer/components/xml-tree-node.tsx
  modified:
    - src/features/explorer/store.ts
    - src/features/explorer/store.test.ts
    - src/features/explorer/components/file-content-area.tsx
    - package.json
    - package-lock.json
decisions:
  - "TDD approach: RED tests first, then GREEN implementation"
  - "jsdom added as dev dependency for DOMParser-dependent tests (vitest default is node environment)"
  - "Tree node rendering uses recursive component pattern matching folder-tree-node indentation"
  - "XML semantic colors use Tailwind arbitrary oklch values with dark mode variants"
metrics:
  duration: 4m
  completed: "2026-05-26T15:51:42Z"
---

# Phase 03 Plan 02: XML Tree View Summary

Collapsible XML tree view with DOMParser-based parsing, five node type renderers, and parse error handling

## Commits

| Task | Name | Commit | Type |
|------|------|--------|------|
| 1 (RED) | Failing tests for XML parser and store parseError | e6e7fd1 | test |
| 1 (GREEN) | XML parser utility and store parseError detection | 9ee63e8 | feat |
| 2 | XML tree view and tree node components | 4a3d020 | feat |

## What Was Built

**XML Parser Utility (xml-parser.ts):**
- `parseXml(content)` returns `ParseResult` with `document` or `error`
- Empty/whitespace content check before DOMParser
- `parsererror` element detection (DOMParser does not throw on malformed XML)
- Exports `ParseResult` interface and `parseXml` function

**Store Integration (store.ts):**
- `openFile` now calls `parseXml` for XML files after content loads
- Sets `parseError: true` and forces `viewMode: "source"` on parse failure
- Non-XML files skip parsing entirely

**XmlTreeView (xml-tree-view.tsx):**
- Parses content via `useMemo` (lazy parsing, only when tree view rendered -- mitigates T-03-05)
- Manages expand/collapse state with `useState<Set<string>>`
- Tree starts fully collapsed (empty Set, only root visible per D-08)
- Scroll position persistence via ScrollArea ref
- Path-based node keys for stable identity (e.g., "0", "0.0", "0.1")

**XmlTreeNode (xml-tree-node.tsx):**
- Element (nodeType 1): ChevronRight/Down, FileCode icon, tagName, up to 5 inline attributes with +N more overflow
- Text (nodeType 3): Type icon, truncated text content
- CDATA (nodeType 4): Braces icon, warm-toned CDATA display
- Processing Instruction (nodeType 7): Hash icon, `<?target data?>` format
- Comment (nodeType 8): MessageSquare icon, italic muted `<!-- content -->` format
- 16px indentation per depth level (matches folder tree)
- Whitespace-only text nodes filtered out

**FileContentArea (file-content-area.tsx):**
- Replaced "Tree view coming soon" placeholder with XmlTreeView
- Conditional render: tree view when `viewMode === "tree" && isXml && !parseError`
- Amber parse error banner with AlertTriangle icon when `parseError && isXml`
- Separate scroll handlers for source and tree views

## Tests

- 12 new tests: 9 xml-parser tests + 3 store parseError tests
- Full suite: 176 tests passing (all 25 test files)
- npm run build: passes
- npm run lint: passes (no errors)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added jsdom dev dependency for DOMParser tests**
- **Found during:** Task 1 GREEN phase
- **Issue:** vitest environment is `node` (no DOM APIs). DOMParser undefined in tests.
- **Fix:** Added `jsdom` as devDependency, used `// @vitest-environment jsdom` pragma in xml-parser.test.ts and store.test.ts
- **Files modified:** package.json, package-lock.json, xml-parser.test.ts, store.test.ts
- **Commit:** 9ee63e8

## TDD Gate Compliance

- RED gate commit exists: e6e7fd1 (test)
- GREEN gate commit exists: 9ee63e8 (feat)
- No REFACTOR gate needed (code was clean after GREEN)

## Known Stubs

None -- all planned functionality is fully wired. The Plan 01 stubs (file-content-area tree placeholder and file-content-header action buttons) are resolved:
- Tree placeholder replaced with XmlTreeView (this plan)
- Action button no-ops remain for Plan 03

## Self-Check: PASSED

- All 7 key files: FOUND
- All 3 commits: FOUND (e6e7fd1, 9ee63e8, 4a3d020)
- Build: PASSED
- Tests: 176/176 PASSED
- Lint: PASSED

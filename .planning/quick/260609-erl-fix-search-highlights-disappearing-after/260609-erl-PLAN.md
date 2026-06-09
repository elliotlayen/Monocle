---
phase: quick-fix
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/features/explorer/hooks/use-search-highlight.ts
  - src/features/explorer/components/xml-source-view.tsx
autonomous: true
requirements: []
status: completed
commit: cdc5126

must_haves:
  truths:
    - "Search highlights persist after toggling Format XML on/off"
    - "Search highlights still apply on initial editor load"
    - "Search highlights still update when search terms change"
  artifacts:
    - path: "src/features/explorer/hooks/use-search-highlight.ts"
      provides: "useSearchHighlight hook with content dependency"
    - path: "src/features/explorer/components/xml-source-view.tsx"
      provides: "xml-source-view passing content to useSearchHighlight"
  key_links:
    - from: "src/features/explorer/components/xml-source-view.tsx"
      to: "src/features/explorer/hooks/use-search-highlight.ts"
      via: "useSearchHighlight(editorInstance, searchTerms, content)"
      pattern: "useSearchHighlight.*content"
---

<objective>
Fix search highlights disappearing after Format XML toggle in the explorer.

Purpose: When a user toggled "Format XML" in the explorer source view, search term
highlights (Monaco editor decorations) disappeared. The root cause was that
useSearchHighlight only depended on editorInstance and searchTerms -- when XML
formatting changed the editor content, neither dependency changed, so the effect
did not re-run and decorations were lost.

Output: Two-file fix adding content as a dependency to the highlight effect.
</objective>

<execution_context>
Retroactive tracking -- this work was completed in commit cdc5126.
</execution_context>

<context>
@src/features/explorer/hooks/use-search-highlight.ts
@src/features/explorer/components/xml-source-view.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add content dependency to useSearchHighlight effect</name>
  <files>src/features/explorer/hooks/use-search-highlight.ts, src/features/explorer/components/xml-source-view.tsx</files>
  <action>
  1. In use-search-highlight.ts, add content: string as the third parameter to the
     useSearchHighlight hook signature.
  2. Add content to the useEffect dependency array so it becomes
     [editorInstance, searchTerms, content]. This ensures decorations are re-applied
     whenever the editor content changes (e.g., Format XML toggle).
  3. In xml-source-view.tsx, update the useSearchHighlight call site to pass the
     current content value as the third argument.
  </action>
  <verify>
    <automated>npm run build</automated>
  </verify>
  <done>Search highlights persist after toggling Format XML. The useSearchHighlight
  effect re-runs when content changes, re-applying decorations to the new editor
  content.</done>
</task>

</tasks>

<verification>
npm run build passes with no type errors.
Manual: open a file with search terms, toggle Format XML, confirm highlights remain.
</verification>

<success_criteria>
- useSearchHighlight depends on content, editorInstance, and searchTerms
- Toggling Format XML does not cause search highlights to disappear
- No regressions in highlight behavior on initial load or search term changes
</success_criteria>

<output>
Retroactive tracking artifact. Work completed in commit cdc5126.
</output>

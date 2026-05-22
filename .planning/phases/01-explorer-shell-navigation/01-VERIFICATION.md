---
phase: 01-explorer-shell-navigation
verified: 2026-05-22T13:35:00Z
status: gaps_found
score: 2/4 success criteria verified
overrides_applied: 0
gaps:
  - truth: "A top navigation bar appears consistent with schema/canvas modes, allowing switching between all modes"
    status: failed
    reason: "ExplorerNavBar renders a Home button and Settings button only. There is no way to switch directly to schema graph or canvas mode from within Explorer — only returning to the home screen is possible. The ROADMAP SC-2 says 'allowing switching between all modes' but the implementation provides no schema/canvas mode switcher."
    artifacts:
      - path: "src/features/explorer/components/explorer-nav-bar.tsx"
        issue: "Only Home and Settings buttons. No mode-switcher tabs or buttons for schema/canvas modes."
    missing:
      - "Nav bar needs controls to switch between schema, canvas, and explorer modes directly, OR the ROADMAP success criterion must be revised to reflect the D-01 decision (separate nav bars, home-screen-centric mode switching)"

  - truth: "The explorer layout shows a sidebar area (empty) and a content area (empty placeholder)"
    status: failed
    reason: "ExplorerShell renders only ExplorerNavBar + a full-width main area with ExplorerEmptyState. There is no sidebar area column. The PLAN's D-06 decision explicitly deferred the sidebar to Phase 2, but the ROADMAP SC-3 requires it in Phase 1 as an empty placeholder area."
    artifacts:
      - path: "src/features/explorer/components/explorer-shell.tsx"
        issue: "flex flex-col h-screen with nav bar and full-width main — no sidebar column structure"
    missing:
      - "A sidebar placeholder area (even empty/zero-width) must be present in the layout to satisfy the ROADMAP SC-3, OR the ROADMAP success criterion must be revised to match D-06 (sidebar deferred to Phase 2)"

  - truth: "User can return to the home screen or switch to other modes without losing app state"
    status: failed
    reason: "exitExplorerMode unconditionally sets mode to 'connected' regardless of the mode active before Explorer was entered (CR-01 from code review). If a user was in canvas mode before entering Explorer, exiting Explorer corrupts the UI state: isCanvasMode becomes false, canvas toolbar controls disappear, and any unsaved canvas edits are silently abandoned. No previousMode tracking exists in the store."
    artifacts:
      - path: "src/features/schema-graph/store.ts"
        issue: "exitExplorerMode: () => set({ mode: 'connected' }) — hardcodes return mode, no previousMode tracking"
      - path: "src/features/explorer/store-integration.test.ts"
        issue: "Tests only cover connected->explorer->connected transitions. No canvas->explorer->exit regression test."
    missing:
      - "Add previousMode field to SchemaStore to record the mode before Explorer was entered"
      - "Update enterExplorerMode to save previousMode before switching"
      - "Update exitExplorerMode to restore previousMode (falling back to 'connected')"
      - "Add a test for canvas->explorer->exit that asserts canvas mode is restored"
---

# Phase 01: Explorer Shell & Navigation Verification Report

**Phase Goal:** Users can enter Integration Explorer from the home screen and see the layout shell that will host all explorer functionality
**Verified:** 2026-05-22T13:35:00Z
**Status:** gaps_found
**Re-verification:** No -- initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can click "Integration Explorer" on the home screen and enter a new full-screen mode | VERIFIED | `home-screen.tsx` has FolderSync button calling `onEnterExplorer`; `App.tsx` has `handleEnterExplorer` -> `enterExplorerMode()`; `ExplorerShell` renders when `isExplorerMode === true` |
| 2 | A top navigation bar appears consistent with schema/canvas modes, allowing switching between all modes | FAILED | Nav bar exists and is visually consistent, but it only has Home + Settings buttons. No switching to schema or canvas mode directly. ROADMAP SC-2 requires "switching between all modes" — not implemented. |
| 3 | The explorer layout shows a sidebar area (empty) and a content area (empty placeholder) | FAILED | No sidebar area exists. ExplorerShell is `flex flex-col h-screen` with a single full-width `<main>`. This was a deliberate PLAN decision (D-06) but contradicts the ROADMAP success criterion. |
| 4 | User can return to the home screen or switch to other modes without losing app state | FAILED | Returning to home screen works. State preservation has a confirmed bug (CR-01): `exitExplorerMode` always sets `mode: "connected"`, so if a user was in canvas mode before entering Explorer, exiting Explorer corrupts the canvas UI state. No `previousMode` tracking implemented. |

**Score:** 2/4 success criteria verified

---

### Plan Must-Have Truths (from 01-01-PLAN.md frontmatter)

These are the PLAN's truths. They are narrower than the ROADMAP SCs. Noted for context.

| # | Plan Truth | Status | Evidence |
|---|-----------|--------|----------|
| 1 | User can click Integration Explorer on the home screen and enter a new full-screen mode | VERIFIED | Button in `home-screen.tsx` line 73; `isExplorerMode` branch in `App.tsx` line 412 |
| 2 | A top navigation bar appears with Monocle branding, Home button, and Settings button | VERIFIED | `explorer-nav-bar.tsx` renders all three as specified |
| 3 | The explorer layout shows a centered empty state with getting-started content and Open Settings CTA | VERIFIED | `explorer-empty-state.tsx` has FolderSync icon, heading, description, and "Open Settings" Button |
| 4 | User can return to the home screen by clicking the Home button in the nav bar | VERIFIED | `ExplorerNavBar` `onHome` prop wired to `handleExitExplorer` -> `exitExplorerMode()` -> `mode: "connected"` -> `showHome` evaluates true -> HomeScreen renders |
| 5 | Pressing Cmd+E from the home screen enters Explorer mode | VERIFIED | `App.tsx` keyboard handler at line 292-296: `if (mod && e.key === "e") { if (showHome) { handleEnterExplorer(); } }` |
| 6 | Entering and exiting Explorer does not affect Schema Graph state | PARTIAL | Unit tests verify schema, isConnected, connectionInfo, serverConnection are preserved. However, if entered FROM canvas mode, exiting restores `mode: "connected"` not `mode: "canvas"`, breaking canvas UI. The state bug (CR-01) partially invalidates this truth. |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/features/explorer/components/explorer-shell.tsx` | Full-screen layout container with nav bar and content area, exports ExplorerShell | VERIFIED | Exists, substantive (18 lines), wired — imported and rendered in `App.tsx` |
| `src/features/explorer/components/explorer-nav-bar.tsx` | Horizontal nav bar with branding, Home and Settings buttons, exports ExplorerNavBar | VERIFIED | Exists, substantive (57 lines), wired — imported by `explorer-shell.tsx` |
| `src/features/explorer/components/explorer-empty-state.tsx` | Centered getting-started content with FolderSync icon and Open Settings CTA, exports ExplorerEmptyState | VERIFIED | Exists, substantive (25 lines), wired — rendered by `explorer-shell.tsx` |
| `src/features/explorer/store-integration.test.ts` | Unit tests for explorer mode state transitions, min 40 lines | VERIFIED | 101 lines, 4 passing tests (confirmed with `vitest run`) |
| `src/features/schema-graph/store.ts` | Extended mode union type with explorer, plus enter/exit actions | VERIFIED | Line 64: `"connected" \| "canvas" \| "explorer"`; `enterExplorerMode` at line 1081, `exitExplorerMode` at line 1082 |
| `src/features/connection/components/home-screen.tsx` | Integration Explorer button with FolderSync icon and Cmd+E shortcut, contains "FolderSync" | VERIFIED | FolderSync imported at line 1, button at lines 70-82, `onEnterExplorer` prop at line 11 |
| `src/App.tsx` | Explorer mode conditional rendering, Cmd+E keyboard shortcut, showHome exclusion, contains "isExplorerMode" | VERIFIED | `isExplorerMode` at line 102; `mode !== "explorer"` in `showHome` at line 280; `ExplorerShell` branch at line 412; Cmd+E at line 292 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/App.tsx` | `src/features/schema-graph/store.ts` | `useSchemaStore` selector for `enterExplorerMode`/`exitExplorerMode` | WIRED | Lines 48-49 in `useShallow` selector; lines 179-184 in callbacks |
| `src/App.tsx` | `src/features/explorer/components/explorer-shell.tsx` | Conditional render when `isExplorerMode` is true | WIRED | `App.tsx` lines 412-416: `isExplorerMode ? <ExplorerShell ...>` |
| `src/features/connection/components/home-screen.tsx` | `src/App.tsx` | `onEnterExplorer` callback prop | WIRED | `App.tsx` line 410 passes `onEnterExplorer={handleEnterExplorer}` to `HomeScreen` |

---

### Data-Flow Trace (Level 4)

Phase 1 delivers only static UI with no data fetching. All components are presentational with no async data sources. Level 4 trace is not applicable.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 4 explorer store tests pass | `vitest run src/features/explorer/store-integration.test.ts` | 4 passed, exit 0 | PASS |
| TypeScript build clean | `npm run build` | Built in 5.32s, no type errors | PASS |
| Lint clean | `npm run lint` | No output (clean) | PASS |

---

### Probe Execution

No probe scripts declared or present for this phase.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| BRWS-09 | 01-01-PLAN.md | Integration Explorer is accessible from the home screen as a new button and has a top navigation bar consistent with other modes | PARTIAL | The home screen button exists and works. Nav bar exists and is visually consistent. However, the ROADMAP SC-2 says the nav bar must allow "switching between all modes" — the nav bar only allows going Home, not switching to schema/canvas modes directly. |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/features/explorer/components/explorer-empty-state.tsx` | 14-17 | Description text references "XML integration files" -- wrong product domain per WR-04 (code review) | Warning | Confusing to users when this screen appears, as Monocle is a SQL Server visualizer. Copy should be revised. |
| `src/features/connection/components/home-screen.tsx` | 22-24 | `navigator.platform` deprecated per WR-02 (code review) | Warning | Pre-existing issue (not introduced by this phase exclusively); may produce inconsistent platform detection in future browser versions |
| `src/features/schema-graph/store.ts` | 1082 | `exitExplorerMode: () => set({ mode: "connected" })` -- hardcoded return mode with no previous-mode tracking | Blocker | Entering Explorer from canvas mode and then exiting corrupts canvas UI state (CR-01) |

---

### Human Verification Required

The following checks cannot be verified programmatically and require manual testing.

#### 1. Visual appearance of Explorer Shell

**Test:** Run `npm run tauri dev` (or `npm run dev`). On the home screen, click "Integration Explorer".
**Expected:** A full-screen layout with a nav bar showing "Monocle" (JetBrains Mono), a Home button, and a Settings gear button on the right. Below: centered FolderSync icon, "Integration Explorer" heading, description paragraph, and "Open Settings" button.
**Why human:** Visual typography, icon rendering, and layout proportions cannot be verified by grep.

#### 2. Settings sheet opens from both nav bar and empty state CTA

**Test:** From Explorer mode, click the Settings gear in the nav bar, then close it. Then click "Open Settings" in the empty state.
**Expected:** The existing AppSettingsSheet opens in both cases.
**Why human:** Requires running application to verify event propagation.

#### 3. Theme consistency (light/dark mode)

**Test:** Open Settings, toggle between light and dark themes. Verify Explorer mode nav bar and empty state match the app's existing visual style in both themes.
**Expected:** Explorer components use the same shadcn/ui color tokens and appear consistent with Schema Graph toolbar appearance.
**Why human:** Visual rendering cannot be verified programmatically.

#### 4. Navigator.platform deprecation impact (WR-02)

**Test:** On Windows, verify that the "Ctrl+E" badge appears correctly on the Integration Explorer button (not "Cmd+E").
**Expected:** The modKey detection correctly identifies Windows and displays "Ctrl".
**Why human:** Requires a Windows environment; the deprecated `navigator.platform` API may return unexpected values.

---

## Gaps Summary

Three gaps block full ROADMAP success criteria achievement:

**Gap 1 (SC-2): Nav bar mode switching.** The ROADMAP SC-2 states the nav bar must allow "switching between all modes." The implementation only allows returning Home. This conflicts with the PLAN's D-01 decision that "users switch modes from the home screen" (not directly between modes). Either the implementation must add direct mode-switching controls to the nav bar, or the ROADMAP SC-2 must be revised to reflect D-01's design decision.

**Gap 2 (SC-3): Missing sidebar area.** The ROADMAP SC-3 requires "a sidebar area (empty) and a content area." The plan's D-06 decision explicitly deferred the sidebar to Phase 2. The ExplorerShell has no sidebar column structure — just a full-width content area. Either a placeholder sidebar area must be added to satisfy the ROADMAP contract, or the ROADMAP SC-3 must be revised.

**Gap 3 (SC-4 / CR-01): State corruption on exit from canvas.** `exitExplorerMode` always restores `mode: "connected"` with no memory of the prior mode. If a user enters Explorer from canvas mode (which the Cmd+E handler guards with `showHome` — meaning this path is currently blocked via keyboard but theoretically possible through other flows), exiting Explorer corrupts the canvas UI state. More critically, the ROADMAP SC-4 says modes can be switched without losing app state, and CR-01 demonstrates that is not true for canvas->explorer->exit transitions. The fix requires `previousMode` tracking in the store and an updated test.

**Note on Gap 1 and Gap 2:** These are conflicts between the PLAN's explicit design decisions (D-01, D-06 in `01-CONTEXT.md`) and the ROADMAP success criteria. The PLAN was written after the CONTEXT was gathered and represents deliberate scoping decisions made by the developer. The ROADMAP SCs may need to be revised to match the actual design intent rather than the implementation needing to grow to match the ROADMAP. This requires developer judgment.

---

_Verified: 2026-05-22T13:35:00Z_
_Verifier: Claude (gsd-verifier)_

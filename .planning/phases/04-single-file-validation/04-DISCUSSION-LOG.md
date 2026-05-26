# Phase 4: Single-File Validation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-05-26
**Phase:** 4-Single-File Validation
**Areas discussed:** Problems panel layout, Encoding handling, Validation result persistence, Severity model

---

## Problems Panel Layout

### Where should the problems panel live?

| Option | Description | Selected |
|--------|-------------|----------|
| Bottom split panel | VS Code-style horizontally split content area with problems below source/tree view. Drag handle, collapsible. | ✓ |
| Sidebar tab | Problems as a new tab in the left sidebar alongside folder tree. | |
| Inline banner only | Dismissible banner at top of content with count, expandable list. | |

**User's choice:** Bottom split panel
**Notes:** Matches the VS Code pattern most developers recognize.

### Should the panel auto-show when a file has issues?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-show on issues | Panel opens automatically when issues found, hidden when clean. User can collapse manually. | ✓ |
| Always hidden until toggled | Panel starts collapsed, status bar shows count. | |

**User's choice:** Auto-show on issues

### Active tab only or all open tabs?

| Option | Description | Selected |
|--------|-------------|----------|
| Active tab only | Panel shows problems for currently visible file only. | ✓ |
| All open tabs | Panel shows problems from all open files grouped by filename. | |

**User's choice:** Active tab only

### Status bar at bottom?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, minimal status bar | Thin bar showing error/warning counts and encoding. Clickable to toggle panel. | ✓ |
| No status bar | Panel header itself shows count when collapsed. | |

**User's choice:** Yes, minimal status bar

---

## Encoding Handling

### Where should validation run?

| Option | Description | Selected |
|--------|-------------|----------|
| Rust backend | Validation runs alongside file reading. read_file_cmd extended to return problems. | ✓ |
| Frontend (JavaScript) | File content scanned in JS after receiving from Rust. | |
| Split: encoding in Rust, XML checks in frontend | Each layer checks what it's best at. | |

**User's choice:** Rust backend

### What happens with non-UTF8 files?

| Option | Description | Selected |
|--------|-------------|----------|
| Best-effort display | Raw bytes, detect encoding, transcode with lossy replacement. File always viewable. | ✓ |
| Error + hex fallback | Error banner and hex view for undetectable encodings. | |

**User's choice:** Best-effort display

### Should encoding be displayed?

| Option | Description | Selected |
|--------|-------------|----------|
| Show in status bar | Status bar always shows detected encoding. Non-UTF8 flagged as warning. | ✓ |
| Only show when problematic | Encoding only mentioned when not UTF-8. | |

**User's choice:** Show in status bar

---

## Validation Result Persistence

### Should results persist after closing a tab?

| Option | Description | Selected |
|--------|-------------|----------|
| Session-only, badge persists | Results in memory for session. Badge stays after tab close. Cleared on restart. | ✓ |
| Tab-lifetime only | Badges disappear when tab is closed. | |
| Persistent across restarts | Store results in cache file. | |

**User's choice:** Session-only, badge persists

### Clean file indicator?

| Option | Description | Selected |
|--------|-------------|----------|
| No indicator for clean files | Only files with issues get badges. | ✓ |
| Green checkmark for clean | Subtle green checkmark on validated clean files. | |

**User's choice:** No indicator for clean files

### Parent folder badges?

| Option | Description | Selected |
|--------|-------------|----------|
| No, files only | Only file nodes show badges. Folders badge-free in Phase 4. | ✓ |
| Yes, bubble up badges | Parent folders show aggregate badges. | |

**User's choice:** No, files only

---

## Severity Model

### Severity levels?

| Option | Description | Selected |
|--------|-------------|----------|
| Two levels: Error + Warning | Errors break XML processing. Warnings are suspicious but not fatal. | ✓ |
| Three levels: Error + Warning + Info | Adds Info for purely informational observations. | |

**User's choice:** Two levels: Error + Warning

### Check XML well-formedness?

| Option | Description | Selected |
|--------|-------------|----------|
| Character-level only | Focus on requirements: illegal chars, encoding, control chars. DOMParser covers structural. | ✓ |
| Include well-formedness | Also check mismatched tags, unclosed elements, duplicate attributes. | |

**User's choice:** Character-level only

### Badge severity display?

| Option | Description | Selected |
|--------|-------------|----------|
| Red dot for errors, yellow for warnings-only | Color indicates worst severity. No count. | ✓ |
| Red dot with count | Red badge with total issue count. No severity distinction. | |

**User's choice:** Red dot for errors, yellow dot for warnings-only

### Inline highlighting in source view?

| Option | Description | Selected |
|--------|-------------|----------|
| Gutter icon + inline background | Red/yellow gutter icons, inline background/underline on bad characters. | ✓ |
| Gutter icon only | Gutter markers only, no inline character highlighting. | |

**User's choice:** Gutter icon + inline background

### Click-to-jump auto-switch view?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, auto-switch to source | Clicking problem switches to source view and jumps to line. | ✓ |
| No, only jump if in source | Only jump if already in source view. | |

**User's choice:** Yes, auto-switch to source

---

## Claude's Discretion

None -- user made all decisions directly.

## Deferred Ideas

None -- discussion stayed within phase scope.

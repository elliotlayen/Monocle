---
phase: 1
slug: explorer-shell-navigation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-22
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^2.1.2 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test -- --run` |
| **Full suite command** | `npm run test -- --run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run`
- **After every plan wave:** Run `npm run test -- --run && npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | BRWS-09 | -- | N/A | unit | `npx vitest run src/features/explorer/store-integration.test.ts` | No -- W0 | pending |
| 01-01-02 | 01 | 1 | BRWS-09 | -- | N/A | unit | `npx vitest run src/features/explorer/store-integration.test.ts` | No -- W0 | pending |
| 01-01-03 | 01 | 1 | BRWS-09 | -- | N/A | manual | Visual check | N/A | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `src/features/explorer/store-integration.test.ts` -- store mode transitions (enter/exit explorer, state preservation, showHome logic)
- [ ] Tests import `useSchemaStore` directly, following `src/features/schema-graph/store.test.ts` pattern

*Existing vitest infrastructure covers framework setup. No new test dependencies needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Home screen renders explorer button with FolderSync icon | BRWS-09 | No DOM test framework (vitest runs in node env) | 1. Open app 2. Verify "Integration Explorer" button between Canvas Mode and Settings 3. Verify FolderSync icon and Cmd+E shortcut badge |
| Keyboard shortcut Cmd+E enters explorer | BRWS-09 | Requires browser event simulation | 1. From home screen, press Cmd+E 2. Verify Explorer shell renders |
| Explorer nav bar matches design contract | BRWS-09 | Visual verification | 1. Enter Explorer mode 2. Verify nav bar: "Monocle" left, Home + Settings buttons right 3. Verify tooltips on buttons |
| Empty state content and CTA | BRWS-09 | Visual verification | 1. Enter Explorer mode 2. Verify centered content: FolderSync icon, heading, description, "Open Settings" button 3. Click "Open Settings" -- settings sheet opens |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

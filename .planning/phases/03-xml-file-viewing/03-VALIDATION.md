---
phase: 3
slug: xml-file-viewing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-26
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | BRWS-04 | — | N/A | unit | `npm run test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | BRWS-05 | — | N/A | unit | `npm run test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | BRWS-06 | — | N/A | unit | `npm run test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | BRWS-07 | — | N/A | unit | `npm run test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test stubs for BRWS-04, BRWS-05, BRWS-06, BRWS-07

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| XML tree view renders collapsible elements | BRWS-04 | Visual rendering | Open XML file, verify tree structure |
| Tab management (open, close, switch) | BRWS-06 | Interactive UI | Open multiple files, verify tab behavior |
| File actions (copy path, open external) | BRWS-07 | OS integration | Test each action, verify clipboard/OS behavior |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

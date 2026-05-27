# Requirements: Monocle Integration Explorer

**Defined:** 2026-05-22
**Core Value:** Instantly find the right integration file and know if it has problems -- replacing minutes of manual folder clicking with seconds of targeted search and automatic validation.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Browsing

- [ ] **BRWS-01**: User can configure multiple root folder sources (add, remove, edit paths) with settings persisted across sessions
- [ ] **BRWS-02**: User can navigate a tree sidebar organized as Root > Client (3-letter code) > Date > Files with lazy-loading on expand
- [ ] **BRWS-03**: Date folders display both raw format and human-readable date (e.g., "20251223 (Dec 23, 2025)")
- [ ] **BRWS-04**: User can view an XML file in a collapsible tree view showing elements, attributes, namespaces, comments, and processing instructions
- [ ] **BRWS-05**: User can view an XML file as syntax-highlighted raw source and toggle between tree and source views
- [ ] **BRWS-06**: User can open multiple XML files in tabs, each maintaining its own view state
- [ ] **BRWS-07**: User can copy a file's full path, open it in an external editor, copy raw content, or export/save a copy
- [ ] **BRWS-08**: User can filter the client list by typing and pin favorite clients to the top of the tree
- [x] **BRWS-09**: Integration Explorer is accessible from the home screen as a new button and has a top navigation bar consistent with other modes

### Validation

- [ ] **VALD-01**: App detects XML-invalid characters (unescaped entities, control characters, null bytes) and encoding issues (non-UTF8, BOM problems) in opened files
- [ ] **VALD-02**: Files with detected issues show a red badge/icon in the folder tree
- [ ] **VALD-03**: A problems panel lists all detected issues with line number, column, description, and severity, with click-to-jump to the location in source view
- [ ] **VALD-04**: Source view highlights bad characters inline with gutter markers on affected lines
- [x] **VALD-05**: User can run a bulk validation scan on an entire folder/client with progress streaming and cancellation
- [x] **VALD-06**: User can export scan reports in CSV, PDF, JSON, and clipboard text formats

### Search

- [ ] **SRCH-01**: User can filter files by filename pattern within the current view
- [ ] **SRCH-02**: User can search for specific values inside XML file content across multiple files
- [ ] **SRCH-03**: User can choose search scope: current folder, current client (all dates), or all sources

### Analysis

- [ ] **ANLS-01**: User can compare any two files with side-by-side and inline diff modes, togglable
- [ ] **ANLS-02**: User can view a client dashboard showing file counts by date, error rates, and last activity
- [ ] **ANLS-03**: User can view an error heatmap showing issue density across clients and dates
- [ ] **ANLS-04**: User can view a timeline of file volume over time at day/week/month granularity
- [ ] **ANLS-05**: App flags files with anomalous sizes (unusually large or small compared to peers)

### Monitoring

- [ ] **MNTR-01**: App monitors configured folders for new files with desktop notifications, in-app badges, and auto-validation, each independently togglable in settings
- [ ] **MNTR-02**: User can bookmark specific files or folders with optional notes for later revisiting
- [ ] **MNTR-03**: User can run XPath queries against the current file or across multiple files

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

(None -- all identified features included in v1)

## Out of Scope

| Feature | Reason |
|---------|--------|
| XML editing / fixing | Read-only tool; identifies issues, does not modify source files |
| Schema (XSD/DTD) validation | Schemas not available; focus on well-formedness and character-level issues |
| XSLT transformation | Developer feature, not target audience |
| Database integration | Explorer and Schema Graph are independent modes |
| Full-text indexing | Lazy-loading approach fits VPN-accessed network shares better |
| Real-time file tailing | Batch integration files, not log streams; polling covers "new files" use case |
| Multi-user / shared bookmarks | Desktop tool; per-user bookmarks stored locally |
| Automated remediation / file repair | Users identify issues and report; do not modify production files |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BRWS-01 | Phase 2 | Pending |
| BRWS-02 | Phase 2 | Pending |
| BRWS-03 | Phase 2 | Pending |
| BRWS-04 | Phase 3 | Pending |
| BRWS-05 | Phase 3 | Pending |
| BRWS-06 | Phase 3 | Pending |
| BRWS-07 | Phase 3 | Pending |
| BRWS-08 | Phase 2 | Pending |
| BRWS-09 | Phase 1 | Complete |
| VALD-01 | Phase 4 | Pending |
| VALD-02 | Phase 4 | Pending |
| VALD-03 | Phase 4 | Pending |
| VALD-04 | Phase 4 | Pending |
| VALD-05 | Phase 5 | Complete |
| VALD-06 | Phase 5 | Complete |
| SRCH-01 | Phase 6 | Pending |
| SRCH-02 | Phase 6 | Pending |
| SRCH-03 | Phase 6 | Pending |
| ANLS-01 | Phase 7 | Pending |
| ANLS-02 | Phase 8 | Pending |
| ANLS-03 | Phase 8 | Pending |
| ANLS-04 | Phase 8 | Pending |
| ANLS-05 | Phase 8 | Pending |
| MNTR-01 | Phase 9 | Pending |
| MNTR-02 | Phase 10 | Pending |
| MNTR-03 | Phase 10 | Pending |

**Coverage:**

- v1 requirements: 26 total
- Mapped to phases: 26
- Unmapped: 0

---
*Requirements defined: 2026-05-22*
*Last updated: 2026-05-22 after roadmap creation*

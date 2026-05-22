# Domain Pitfalls

**Domain:** File browser/validator for XML integration files on remote network shares
**Researched:** 2026-05-22
**Confidence:** HIGH (multiple verified sources, known platform behaviors)

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or a feature that users abandon because it feels broken.

### Pitfall 1: Blocking the UI on Network I/O

**What goes wrong:** Every file system call to a network share can take 50ms to 30+ seconds depending on VPN latency, SMB negotiation, and folder size. If directory listings or file reads happen synchronously on the main thread (or are awaited without timeout), the app freezes. Users see a white screen or spinning cursor and assume the app crashed. This is the single most common reason users abandon desktop file tools that work over networks.

**Why it happens:** SMB was designed for LAN conditions. Each request waits for an acknowledgement before continuing. Over VPN, 20-30ms of added latency multiplies across every round-trip. A directory listing of 500 files can require hundreds of SMB round-trips. Developers test on local filesystems or fast LAN and never encounter the problem until production.

**Consequences:**
- App appears unresponsive (ANR on some platforms)
- Users force-quit and lose trust in the tool
- If the main Tauri thread is blocked, even window resize/close stops working

**Prevention:**
- ALL file I/O must run in Rust async commands on the Tokio thread pool (never on Tauri's main thread)
- Wrap every network I/O call in `tokio::time::timeout()` with a sensible default (e.g., 10s for directory listing, 30s for file read)
- Use Tauri Channels (not events) for streaming progress back to the frontend -- events serialize as JSON strings and are not designed for throughput; channels are optimized for ordered streaming
- Show skeleton/loading states immediately on navigation, never wait for data before rendering the frame
- Implement cancellation tokens so users can abort a slow operation and navigate elsewhere

**Detection:** Test with a simulated high-latency filesystem. On macOS, use `dnctl` to add 200ms latency. On Windows, use `clumsy` or `NetLimiter`. If any click produces > 200ms of visual delay without a loading indicator, this pitfall is present.

**Phase:** Must be addressed in the very first phase (folder tree/sidebar). Every subsequent phase inherits this pattern.

---

### Pitfall 2: `tokio::fs::read_dir` Never Terminates on Network Paths

**What goes wrong:** There is a known issue (tokio-rs/tokio#5473) where `tokio::fs::read_dir` on UNC/network paths can loop endlessly -- the iterator never returns `None`. The program hangs indefinitely, consuming a thread pool slot.

**Why it happens:** Tokio's async FS operations delegate to `std::fs` via `spawn_blocking`. The underlying OS directory enumeration on network shares can behave differently than local filesystems, particularly on Windows with UNC paths where the SMB client may not properly signal end-of-directory.

**Consequences:**
- Thread pool exhaustion (Tokio's default blocking pool is 512 threads, but each hung `read_dir` permanently consumes one)
- The specific folder appears to load forever with no error
- Eventually the entire app stops being able to do any file I/O

**Prevention:**
- Always wrap `read_dir` iteration in `tokio::time::timeout()`
- Set a maximum entry count per directory (e.g., 10,000) and paginate beyond that
- Test specifically with UNC paths (`\\server\share\path`) on Windows, not just mapped drives
- Consider using `std::fs::read_dir` inside a manually managed `spawn_blocking` with explicit timeout rather than `tokio::fs::read_dir`, so you have more control over iteration limits
- Log and surface timeout errors to the user as "Network share unreachable or too slow" rather than silently hanging

**Detection:** Open a folder on a network share that has 1000+ files. If the loading spinner never stops, or the thread pool is exhausted (other operations start failing), this pitfall is present.

**Phase:** Must be solved in the first phase alongside basic folder browsing. This is the foundation of every subsequent feature.

---

### Pitfall 3: Cross-Platform Path Incompatibility (Windows UNC vs macOS Mount Points)

**What goes wrong:** Windows uses UNC paths (`\\server\share\folder`) or mapped drives (`Z:\folder`). macOS mounts SMB shares at `/Volumes/share` or a custom mount point using `mount_smbfs`. Users configure a root folder path on one OS, and it is meaningless on the other. Worse, Tauri's `fs` plugin's scope validation may reject UNC paths or mounted network paths that don't match its allowed path patterns.

**Why it happens:** The PROJECT.md states "Must work on both macOS and Windows." Network share paths are fundamentally different between these OSes. A user on Windows will paste `\\fileserver\integrations\inbound`; a user on macOS will paste `/Volumes/integrations/inbound`. The same physical share has completely different path representations.

**Consequences:**
- Configured folder sources are not portable between machines/OSes
- Path validation/normalization code that assumes one format breaks on the other
- Tauri's security scope may block access to paths outside its configured allowlist, causing silent failures

**Prevention:**
- Store folder source paths as platform-native strings; do not attempt to normalize UNC paths to POSIX or vice versa
- On Windows, support both UNC paths (`\\server\share`) and mapped drives (`Z:\`); on macOS, support `/Volumes/` mount points
- Validate that paths are accessible at configuration time (try to list the directory, show an error if it fails)
- Configure Tauri's fs plugin scope to allow arbitrary paths (the user explicitly chooses folder sources, so this is intentional, not a security hole)
- Use Rust's `std::path::Path` abstractions rather than string manipulation for path joining -- `Path::join` handles OS differences automatically
- Add a "Test Connection" button when adding folder sources to validate accessibility

**Detection:** Configure a folder source on macOS, then try to load the same config on Windows (or vice versa). If paths break, this pitfall is present.

**Phase:** Must be solved in the folder source configuration phase. Get it wrong and every subsequent feature (browsing, search, watching) inherits path bugs.

---

### Pitfall 4: File Watcher Silently Fails on Network Shares

**What goes wrong:** Native file system watchers (inotify on Linux, FSEvents on macOS, ReadDirectoryChangesW on Windows) do not reliably deliver events for network-mounted filesystems. The watcher may appear to start successfully -- no errors returned -- but events are never delivered. The user enables "watch for new files" and nothing ever happens.

**Why it happens:** The NFS and SMB protocols do not provide network-level support for file notifications. The OS-level APIs were designed for local filesystems. On Windows, `ReadDirectoryChangesW` can be disabled by policy on network shares. On macOS, FSEvents does not monitor network volumes at all. The `notify` Rust crate (which Tauri and most Rust tools use) wraps these OS APIs and inherits their limitations. There is no error -- the watch simply produces zero events.

**Consequences:**
- "Folder watching" feature appears broken on network shares (the exact use case for this app)
- Users lose trust: they expect notifications but get silence
- If the app relies on watchers for cache invalidation, stale data is shown indefinitely

**Prevention:**
- Use polling-based watching for network shares, not native event watchers. The `notify` crate supports `PollWatcher` as a fallback
- Make the polling interval configurable (default 30-60 seconds for network shares; faster polling generates excessive SMB traffic)
- Auto-detect network paths: on Windows, check if path starts with `\\` or is a mapped network drive; on macOS, check if path is under `/Volumes/` on a network mount. Use polling for these, native watchers for local paths only
- Document the limitation clearly in the UI: "Network shares are checked every N seconds" rather than implying real-time monitoring
- Provide a manual "Refresh" button as a fallback regardless of watcher status
- Show "Last checked: X seconds ago" in the UI so users know the watcher is active even when no new files have appeared

**Detection:** Create a new file in a watched network share folder. If the app never detects it (but does detect files created in local folders), this pitfall is present.

**Phase:** This is a later-phase feature (folder watching). But the architecture decision (polling vs native) must be made early because it affects how folder state is managed throughout the app.

---

### Pitfall 5: Serializing Large XML Files Through Tauri IPC

**What goes wrong:** Tauri commands serialize return values to JSON via serde. When a user opens a 50MB XML file, the entire file content must be serialized, sent over the IPC bridge, and deserialized in JavaScript. This causes multi-second delays, excessive memory usage (JSON encoding roughly doubles the payload), and potential IPC timeouts.

**Why it happens:** Tauri's event system and command return values always serialize to JSON strings. Benchmarks show 200ms to send just 3MB over IPC. A 50MB XML file would take 3+ seconds just for the IPC transfer, plus parsing time. The existing codebase returns `SchemaGraph` structs over IPC which are small; XML file content is orders of magnitude larger.

**Consequences:**
- Opening large files feels unresponsive (3-10 second delays)
- Memory spikes: the file exists simultaneously as Rust bytes, JSON string, JavaScript string, and parsed DOM
- Multiple open tabs with large files can exhaust available memory

**Prevention:**
- Use Tauri Channels for streaming file content in chunks rather than returning the entire file at once
- For the XML tree view, parse on the Rust side and return a structured tree (node name, attributes, children count) with lazy child loading -- do not send raw XML to the frontend for parsing
- For the raw source view, stream content in chunks (e.g., 64KB at a time) and use virtualized rendering (only render visible lines)
- Set a file size warning threshold (e.g., 10MB) and prompt the user before loading very large files
- Consider memory-mapped file reading in Rust for very large files rather than loading entire files into memory

**Detection:** Open a 20MB+ XML file. If memory usage spikes by >100MB or the UI freezes for >2 seconds, this pitfall is present.

**Phase:** Must be addressed when building the file viewer (XML tree view and raw source view). Retroactively adding streaming to a viewer built with "load everything at once" is a significant rewrite.

---

## Moderate Pitfalls

### Pitfall 6: Attempting to Parse Malformed XML with a Strict Parser

**What goes wrong:** The entire point of this tool is to find files with illegal characters and encoding issues. But if you use a strict XML parser (one that errors on malformed input), you cannot parse the very files you need to analyze. The parser throws an error and you can show "this file has an error" but cannot tell the user where or what.

**Why it happens:** Most XML parsers (including Rust's `quick-xml` in strict mode) are designed to reject invalid documents. This is correct behavior for data processing but wrong for a validation/diagnostic tool.

**Prevention:**
- Use `quick-xml` in lenient/recovery mode where possible, collecting errors as you go rather than aborting
- For truly unparseable files, fall back to a byte-level scanner that finds illegal character sequences without attempting to parse XML structure
- Build a two-pass approach: (1) byte-level scan for encoding issues, BOM problems, and illegal characters outside valid XML codepoints; (2) attempt structural XML parsing, collecting parse errors with line/column positions
- Show partial results -- "parsed 847 of 1200 lines before encountering a fatal error at line 848"
- For the raw source view, display the file as text regardless of XML validity; only the tree view requires successful parsing

**Detection:** Feed a file with an unescaped `&` in element content to the parser. If you get a single error message with no positional information or partial tree, this pitfall is present.

**Phase:** Address in the file viewer/validation phase. The validation engine architecture must be designed for malformed input from the start.

---

### Pitfall 7: SMB Directory Cache Showing Stale Data

**What goes wrong:** Windows caches SMB directory metadata for 10 seconds by default (`DirectoryCacheLifetime`). After a file is created/deleted on the server, the local SMB client continues serving the old directory listing. Users navigate to a folder they know has new files, but the app shows stale contents. They blame the app, not the OS caching layer.

**Why it happens:** The SMB Network Redirector caches folder metadata to reduce network traffic. The parameters `DirectoryCacheLifetime`, `FileInfoCacheLifetime`, and `FileNotFoundCacheLifetime` all default to 10 seconds. During this window, `read_dir` returns cached results even if the actual share contents have changed.

**Prevention:**
- Do NOT ask users to modify system SMB settings -- this is a department tool, users won't have admin access
- Implement an app-level cache with a visible "last refreshed" timestamp on every folder view
- Provide an obvious "Refresh" button (keyboard shortcut: F5) that forces a re-read
- When a user explicitly refreshes, add a slight delay (500ms) or double-read to work around the SMB cache window
- For the folder watcher (polling mode), note that polled results may also be cached by SMB; the polling interval should be greater than the SMB cache lifetime (>10 seconds)
- Accept that "real-time" is not achievable on network shares and communicate this to users through the UI

**Detection:** Create a file in a network share folder, then immediately list the folder from the app. If the new file doesn't appear but does appear after 10+ seconds, SMB caching is the cause.

**Phase:** Relevant to all phases that display directory contents. Add refresh infrastructure in the first phase.

---

### Pitfall 8: Search Across All Sources Generating Excessive Network Traffic

**What goes wrong:** The feature spec includes "configurable-scope search" including "across all sources." If implemented naively, a cross-source search reads every XML file in every client folder across years of history. On a network share with thousands of files, this could take minutes and generate gigabytes of network traffic, saturating the VPN connection for the entire department.

**Why it happens:** Developers test search with a handful of files locally and it works in milliseconds. In production, "all sources" means two root folders x hundreds of clients x years of dates x varying file counts = potentially hundreds of thousands of files. Reading each file's content over VPN at 100ms per file = hours.

**Consequences:**
- Search appears to hang indefinitely
- VPN bandwidth consumed, affecting other department users
- IT department notices unusual network activity and escalates

**Prevention:**
- Build a local search index that caches file metadata (path, size, modified date) and optionally content snippets on first access
- Index lazily: only index folders/files the user has visited, not the entire share upfront
- Show estimated search scope before executing ("Search will scan ~2,400 files in 12 client folders. This may take several minutes over VPN. Continue?")
- Implement search with streaming results -- show matches as they're found rather than waiting for completion
- Allow search cancellation at any time
- Limit initial search to filename patterns (no file reading required, just directory listings) and require explicit opt-in for content search
- Cache previously read file content in a local SQLite database with last-modified timestamps for cache invalidation
- Rate-limit concurrent file reads (e.g., max 4 concurrent reads) to avoid saturating the network

**Detection:** Run a content search across all sources on a real-scale dataset over VPN. If it takes > 30 seconds or network utilization spikes noticeably, this pitfall is present.

**Phase:** Search is a mid-phase feature, but the caching/indexing architecture should be designed in the first phase to avoid retrofit.

---

### Pitfall 9: VPN Disconnection Mid-Operation Causes Unrecoverable Errors

**What goes wrong:** VPN connections drop intermittently. If a file read, directory listing, or search operation is in progress when the VPN disconnects, the operation may hang for the OS-level TCP timeout (often 30-120 seconds), produce cryptic OS-level errors, or leave the app in an inconsistent state where cached data shows a half-loaded folder.

**Why it happens:** Network I/O errors on SMB shares surface as OS-specific file system errors. Windows may return `ERROR_NETNAME_DELETED` (64) or `ERROR_BAD_NETPATH` (53). macOS may return `ETIMEDOUT` or `ENOTCONN`. These errors are not well-documented in the context of desktop app development, and developers often don't handle them specifically.

**Prevention:**
- Map OS-specific network errors to a consistent "network unreachable" error type in Rust
- Implement a network health indicator: periodically check accessibility of configured folder sources (every 60 seconds, single lightweight `read_dir` on the root)
- Show a clear "Network share unavailable" banner when connectivity is lost, rather than showing errors on individual operations
- Make all operations idempotent and restartable -- if a search was at 40% when VPN dropped, the user should be able to resume after reconnection
- Use timeouts on every I/O operation (this overlaps with Pitfall 1 but is specifically about post-timeout recovery)
- Cache the last-known folder structure locally so the sidebar doesn't go blank during disconnection; show "(offline)" labels on cached items

**Detection:** Start a large search or browse a deep folder tree, then disconnect the VPN. Observe how long the app takes to show an error and whether it recovers cleanly when VPN reconnects.

**Phase:** Error handling infrastructure should be built in the first phase. Network health monitoring can come in a later phase.

---

### Pitfall 10: Memory Leaks from Accumulating Tab State

**What goes wrong:** The spec includes a "tabbed interface for opening multiple XML files simultaneously." Each open tab holds the parsed XML DOM, raw file content, validation results, and scroll/selection state. With large files and many tabs, memory grows unboundedly. Users in this department will leave the app open all day, opening tabs as they investigate issues, and never close old ones.

**Why it happens:** React state for each tab persists in memory. If tabs also hold Rust-side parsed data (e.g., for validation results), both frontend and backend memory grow. There's no natural limit.

**Prevention:**
- Implement tab virtualization: only keep the active tab's full content in memory; background tabs retain metadata (path, scroll position) but release file content
- Set a reasonable tab limit (e.g., 20) with a warning when approached
- Implement "least recently used" eviction: after N tabs, the oldest inactive tab's content is released (tab remains visible but content reloads when selected)
- On the Rust side, use a bounded LRU cache for parsed file data, not unbounded storage
- Monitor memory usage and show a warning if it exceeds a threshold

**Detection:** Open 30+ large XML files in tabs, then check process memory. If it exceeds 1GB or continues growing linearly, this pitfall is present.

**Phase:** Address when building the tabbed viewer interface. Must be designed in from the start, not bolted on later.

---

## Minor Pitfalls

### Pitfall 11: Date Folder Sorting Assumes Consistent Naming

**What goes wrong:** The folder structure is `[client]/[YYYYMMDD]/[files]`. But real-world data has inconsistencies: folders named `20251223`, `2025-12-23`, `12232025`, `Dec2025`, or arbitrary non-date names mixed in. If the app assumes all subfolders are valid YYYYMMDD dates and sorts/formats them accordingly, it crashes or hides non-conforming folders.

**Prevention:**
- Parse date folders with a lenient parser that tries multiple formats
- Folders that don't match any date pattern should still be displayed (unsorted, at the bottom, labeled "Other")
- Never crash or skip a folder because its name is unexpected
- Log parsing failures for debugging but don't surface them to users as errors

**Phase:** First phase (folder tree rendering).

---

### Pitfall 12: File Size Detection Without Reading File Content

**What goes wrong:** Showing file sizes in the browser requires a stat call per file. Over SMB/VPN, calling `metadata()` on hundreds of files in a folder triggers hundreds of round-trips. This makes folder loading noticeably slower.

**Prevention:**
- On Windows, `read_dir` entries include file metadata (size, modified time) without additional stat calls -- use this
- Batch metadata retrieval: get all metadata in a single `read_dir` iteration rather than stat-per-file after listing
- Cache file metadata aggressively; invalidate on manual refresh or watcher events
- For the initial folder view, show files immediately with "loading..." for metadata if needed, then fill in sizes asynchronously

**Phase:** First phase (file listing in sidebar).

---

### Pitfall 13: Encoding Detection Guessing Wrong

**What goes wrong:** The spec requires detecting "non-UTF8, BOM" issues. But encoding detection is inherently probabilistic. A file encoded in Windows-1252 (common in legacy Windows systems) may be detected as ISO-8859-1 or even UTF-8 if it happens to contain only ASCII characters. Reporting the wrong encoding leads to false positives (flagging a valid file) or false negatives (missing a problem).

**Prevention:**
- Use Rust's `encoding_rs` crate which implements the WHATWG Encoding Standard with well-defined detection heuristics
- Check the XML declaration's `encoding` attribute first (`<?xml encoding="..."?>`) and verify it matches the actual byte content
- Report confidence levels: "Detected as Windows-1252 (confidence: high)" vs "Encoding uncertain -- declared UTF-8 but contains non-UTF-8 bytes"
- BOM detection is deterministic (check first 2-4 bytes) -- separate this from encoding guessing
- Show specific byte offsets and hex values for problematic characters so users can verify findings

**Phase:** Validation engine phase. Design the validation result format to include confidence from the start.

---

### Pitfall 14: Bulk Scan Report Taking Hours

**What goes wrong:** "Bulk scan: run validation on an entire folder and produce a summary report" sounds simple but a folder might contain thousands of files. Reading and validating each file over VPN takes time. A bulk scan could take hours, and if the app doesn't handle this gracefully, users start the scan, wait, and eventually give up.

**Prevention:**
- Show real-time progress: "Scanned 47 of 2,341 files (2 issues found so far)"
- Stream results: show findings as they arrive, don't wait for completion
- Allow cancellation and produce a partial report from results gathered so far
- Estimate completion time based on observed per-file timing
- Limit concurrent file reads to avoid network saturation (4-8 concurrent reads)
- Consider a "quick scan" mode that only checks file size, name, and first 1KB (enough for BOM/encoding detection) without reading entire files

**Detection:** Run bulk scan on a folder with 500+ files over VPN. If no progress is shown for > 5 seconds, or total time exceeds 10 minutes with no way to get partial results, this pitfall is present.

**Phase:** Bulk scan phase. But the streaming/progress/cancellation patterns should be established earlier (reuse from search).

---

### Pitfall 15: Tauri FS Plugin Scope Blocking Network Paths

**What goes wrong:** Tauri's `fs` plugin uses a permission-based scoping system with glob patterns that define allowed paths. By default, paths are constrained to app directories. Network share paths (`\\server\share` on Windows, `/Volumes/mount` on macOS) may not match any allowed scope, causing silent access denials.

**Prevention:**
- Use custom Tauri commands in Rust (as the app already does for database operations) for all file I/O rather than the frontend `fs` plugin API. Rust commands bypass the fs plugin scope entirely
- If using the fs plugin, configure scope to include user-selected paths dynamically
- Test with actual network share paths on both platforms during development, not just local paths
- Handle permission errors explicitly and display them to the user ("Cannot access this path -- check VPN connection and share permissions")

**Phase:** First phase (folder source configuration and initial file access).

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Folder source configuration | Cross-platform path incompatibility (#3), FS plugin scope (#15) | Use Rust std::path, test on both platforms, use custom commands not fs plugin |
| Folder tree / sidebar | Blocking UI on I/O (#1), read_dir hangs (#2), stale cache (#7) | Async + timeout on every call, loading states, manual refresh button |
| File viewer (tree + raw) | Large file serialization (#5), strict parser on malformed files (#6) | Stream via channels, lenient parsing with fallback byte scanner |
| Validation engine | Encoding detection accuracy (#13), strict vs lenient parsing (#6) | Two-pass approach, confidence levels, encoding_rs crate |
| Search | Network traffic explosion (#8), VPN disconnection (#9) | Local index, streaming results, cancellation, rate limiting |
| File comparison | Memory from holding two large files simultaneously (#10), serialization (#5) | Chunk-based diff, virtualized rendering |
| Bulk scan | Hours-long operations (#14), network saturation (#8) | Progress streaming, cancellation, partial reports, concurrent read limits |
| Folder watching | Silent watcher failure (#4), stale SMB cache (#7) | Poll-based watcher, configurable interval, manual refresh fallback |
| Tabs | Memory leaks (#10) | LRU eviction, tab content virtualization |
| Date folder display | Inconsistent naming (#11) | Lenient date parsing, "Other" category for non-conforming names |

---

## Sources

- [tokio-rs/tokio#5473: fs::read_dir does not end for network locations](https://github.com/tokio-rs/tokio/issues/5473) -- HIGH confidence
- [notify-rs/notify#475: NFS mount watching fails silently](https://github.com/notify-rs/notify/issues/475) -- HIGH confidence
- [notify-rs/notify#412: Large scale watching drops events](https://github.com/notify-rs/notify/issues/412) -- HIGH confidence
- [Zed IDE #51340: PollWatcher fallback for network filesystems](https://github.com/zed-industries/zed/issues/51340) -- HIGH confidence
- [Tauri discussion #7146: High-rate IPC data transfer limitations](https://github.com/tauri-apps/tauri/discussions/7146) -- HIGH confidence
- [Tauri #13405: Event system not designed for large payloads](https://github.com/tauri-apps/tauri/issues/13405) -- HIGH confidence
- [Microsoft: SMB Directory Cache Lifetime](https://woshub.com/slow-network-shared-folder-refresh-windows-server/) -- HIGH confidence
- [Microsoft: Performance issues with files on file server](https://learn.microsoft.com/en-us/troubleshoot/windows-server/performance/slow-performance-file-server) -- HIGH confidence
- [Mirazon: SMB file transfer performance over VPN](https://www.mirazon.com/issues-with-smb-file-transfer-performance-over-vpn/) -- MEDIUM confidence
- [quick-xml encoding module documentation](https://docs.rs/quick-xml/latest/quick_xml/encoding/) -- HIGH confidence
- [usethe.computer: XMHell - handling large UTF-16 XML with Rust](https://usethe.computer/posts/14-xmhell.html) -- MEDIUM confidence
- [Baeldung: Invalid Characters in XML](https://www.baeldung.com/java-xml-invalid-characters) -- MEDIUM confidence
- [Tauri v2 Calling Frontend documentation](https://v2.tauri.app/develop/calling-frontend/) -- HIGH confidence

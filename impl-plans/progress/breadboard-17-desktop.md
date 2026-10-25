# breadboard-17-desktop progress

Status: implementation complete; downstream formal review and serial integration remain pending.

## Changes

- Added typed dedicated page/workspace mappings for BPMN and breadboard, with tests for forward and inverse mappings.
- Generalized desktop workspace switching and page-follow behavior. Choosing Breadboard selects an existing breadboard page or creates a page named Breadboard; leaving a dedicated workspace selects or creates a general page.
- Mounted BreadboardProblemsPanel with viewport and import warnings, suppressed duplicate generic import notes on breadboard pages, and passed viewport to Inspector.
- Connected BOM, KiCad netlist, and SPICE export actions to connectivity/netlist generation, lazily loaded IO formatters, save-path/writeText, and browser download fallback. Formatter warnings are shown through the export notice.
- Added detached .kicad_sch and .net import handling with stale-request checks, mapped diagnostics, and safe failure when the importer returns no plan.
- Added kicad_sch/net to the native open dialog filter and pinned both in open_filter_includes_kicad.
- No Tauri configuration or other Rust source changed.

## Verification

| Command | Result | Evidence |
| --- | --- | --- |
| `mise exec -- bun test apps/desktop/src/page-workspace.test.ts apps/desktop/src/file/session.test.ts` | exit 0; 72 passed, 0 failed | `tmp/breadboard-mode-s485/breadboard-17-desktop/focused-final.log` |
| `mise exec -- bun test apps/desktop` | exit 0; 159 passed, 0 failed | `tmp/breadboard-mode-s485/breadboard-17-desktop/desktop-final.log` |
| `mise exec -- bun run typecheck` | exit 0; no TypeScript diagnostics | `tmp/breadboard-mode-s485/breadboard-17-desktop/typecheck-final.log` |
| `mise exec -- bunx biome check apps/desktop/src/App.tsx apps/desktop/src/page-workspace.ts apps/desktop/src/page-workspace.test.ts apps/desktop/src/file/session.ts apps/desktop/src/file/session.test.ts` | exit 0 | `tmp/breadboard-mode-s485/breadboard-17-desktop/biome-final.log` |
| `mise exec -- env CARGO_TERM_QUIET=true cargo fmt --manifest-path apps/desktop/src-tauri/Cargo.toml` | exit 0 | `tmp/breadboard-mode-s485/breadboard-17-desktop/cargo-fmt.log` |
| `mise exec -- env CARGO_TERM_QUIET=true cargo fmt --manifest-path apps/desktop/src-tauri/Cargo.toml -- --check` | exit 0 | `tmp/breadboard-mode-s485/breadboard-17-desktop/cargo-fmt-check.log` |
| `mise exec -- env CARGO_TERM_QUIET=true cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml dialogs` | exit 0; 11 passed, 0 failed; includes `open_filter_includes_kicad` | `tmp/breadboard-mode-s485/breadboard-17-desktop/cargo-test.log` |
| Owner-scoped typecheck scans for diagnostics under the G1 regex and `^error TS` | exit 0; no matches | `tmp/breadboard-mode-s485/breadboard-17-desktop/typecheck-final.log` |
| Tauri config unchanged and only `dialogs.rs` changed under `apps/desktop/src-tauri/src` | exit 0 | `tmp/breadboard-mode-s485/breadboard-17-desktop/scope-config.log` |
| ASCII added-line and new-file checks | exit 0 | `tmp/breadboard-mode-s485/breadboard-17-desktop/ascii-added.log`, `tmp/breadboard-mode-s485/breadboard-17-desktop/ascii-new.log` |
| `grep -n '"kicad_sch"' apps/desktop/src-tauri/src/dialogs.rs` | exit 0; filter and test assertions found | `tmp/breadboard-mode-s485/breadboard-17-desktop/grep-filter.log` |
| `grep -n 'isBreadboardPage' apps/desktop/src/App.tsx` | exit 0; predicate, note guard, and panel mount found | `tmp/breadboard-mode-s485/breadboard-17-desktop/grep-panel.log` |
| `git diff --check -- <owned paths>` | exit 0 | `tmp/breadboard-mode-s485/breadboard-17-desktop/diffcheck.log` |

## Superseded attempts

- Direct `bun test apps/desktop` used system Bun 1.4.4 and exited 1 with the known Solid `jsxDEV` runtime error (157 passed, 1 failed). The accepted mise pin reports Bun 1.4.0; rerunning through `mise exec` passed 159 tests with 0 failures.
- Initial typecheck exited 2 because the new local `document` snapshot shadowed the browser global. Renaming it to `snapshot` fixed the issue; final typecheck exits 0.
- Initial Biome check exited 1 on formatting in two owned files. Formatting only the owned TypeScript files resolved it; final Biome check exits 0.

## Completion criteria

- [x] Page kind selects/follows the matching workspace; Breadboard mode opens or creates a Breadboard page.
- [x] Breadboard problems panel receives viewport and import warnings; Inspector receives viewport.
- [x] BOM, KiCad and SPICE actions call the IO formatters and write via export backend or browser download fallback.
- [x] KiCad schematic/netlist opens as detached imports with diagnostics; malformed input leaves the current document intact.
- [x] Open-dialog extensions and Rust regression test cover `.kicad_sch` and `.net`.
- [x] Focused and desktop tests, typecheck, Biome, Cargo format/test, scoped ASCII and no-config-change gates pass.
- [ ] Formal review and serial integration are downstream workflow steps.

# kicad-pcb-13-desktop-open progress

## Pre-edit evidence and intent

Dependency readiness: `kicad-pcb-09-core-index-fixture-integration` is listed in the dispatched item's `acceptedPlanIds`; dispatch review feedback has no findings, and the direct inbox has no messages/findings/repair requests.

Fresh pre-edit SHA-256:
- `apps/desktop/src/file/session.ts`: `bfdf5c878292be8341eddb299625005c6d5e60bf1435027f0bc40db82d765a61`
- `apps/desktop/src/file/session.test.ts`: `4cb0c964741806028e89e8eaa2bee66d13a6d21d496b0cad66bb9c16ee036b4e`
- `apps/desktop/src-tauri/src/dialogs.rs`: `cfd43b38aa91e838cbc6d51a74beecb842847c1ceb846a2616a19035c3347e8c`

Intent snapshot, before source edits:
1. In `session.ts`, recognize the case-insensitive `.kicad_pcb` suffix, dispatch it before Gerber and schematic/netlist routing, and implement the plan's lazy-loaded importer. Read text, stale-check, fail on the first error diagnostic, build via `pcbDocumentFromPlan(plan, {pageName: plan.title})`, map warnings to import notes including location when available, and open with the existing detached-document helper.
2. In `session.test.ts`, add the self-authored board fixture test coverage for normal and upper-case suffixes, malformed root/error retention, and warnings; verify detached/dirty state and no KiCad file writes.
3. In `dialogs.rs`, add `kicad_pcb` to the open extensions and existing KiCad filter test.

## Implementation and verification

Implemented the three intended scoped changes. `.kicad_pcb` is dispatched before Gerber and KiCad schematic/netlist handling. The PCB importer reads the file, stale-checks, reports the first error diagnostic, lazy-loads `pcbDocumentFromPlan`, maps warning locations into import notes, and calls `importDocument` so the source remains detached and dirty. Tests cover lower- and upper-case suffixes, failed-root preservation, warning notes, and no autosave writes. The Rust Open filter and test include `kicad_pcb`.

After review, the implementation order was tightened to read the file and stale-check before lazy-loading the parser, matching the plan's pinned sequence.

Verification on the current shared tree:

| Command | Exit | Result / complete log |
| --- | ---: | --- |
| `BUN_OPTIONS=--jsx-runtime=classic bun test apps/desktop/src/file/session.test.ts` | 0 | 77 passed, 0 failed on final source; `tmp/kicad-pcb-s536/kicad-pcb-13-desktop-open/session-test-final-rerun.log` |
| `bun run typecheck` | 2 | Blocked by sibling-owned `packages/ui-solid/src/inspector/PcbSection.tsx` (unknown type at line 151), `packages/ui-solid/src/pcb-interaction.ts` (unused `Element`), and `packages/ui-solid/src/shapes/pcb-view.ts` (unused `PcbShape`); `tmp/kicad-pcb-s536/kicad-pcb-13-desktop-open/typecheck-final.log` |
| `bun run typecheck` (stability rerun) | 2 | Sibling UI files were still changing: `packages/ui-solid/src/interaction.ts`, `packages/ui-solid/src/pcb-interaction.ts`, `packages/ui-solid/src/pcb-overlay.ts`, `packages/ui-solid/src/PcbLayersPanel.tsx`, `packages/ui-solid/src/PcbOverlay.tsx`, and `packages/ui-solid/src/shapes/pcb-view.ts` report unused imports; `tmp/kicad-pcb-s536/kicad-pcb-13-desktop-open/typecheck-stable-check.log` |
| `bun run typecheck` (continuation rerun) | 2 | Still reports sibling-owned UI issues: unused imports in `packages/ui-solid/src/pcb-interaction.ts`, `packages/ui-solid/src/pcb-overlay.ts`, `packages/ui-solid/src/PcbLayersPanel.tsx`, `packages/ui-solid/src/PcbOverlay.tsx`, and `packages/ui-solid/src/shapes/pcb-view.ts`; `tmp/kicad-pcb-s536/kicad-pcb-13-desktop-open/typecheck-continuation-1-rerun.log` |
| `BUN_OPTIONS=--jsx-runtime=classic bun test apps/desktop/src/file/session.test.ts` (continuation) | 0 | 77 passed, 0 failed against current shared tree; `tmp/kicad-pcb-s536/kicad-pcb-13-desktop-open/session-test-continuation-1.log` |
| `bun run typecheck` (final continuation) | 0 | Sibling UI files stabilized; workspace typecheck passes; `tmp/kicad-pcb-s536/kicad-pcb-13-desktop-open/typecheck-continuation-1-final-rerun.log` |
| `BUN_OPTIONS=--jsx-runtime=classic bun test apps/desktop/src/file/session.test.ts` (stable final run) | 0 | 77 passed, 0 failed after workspace typecheck passed; `tmp/kicad-pcb-s536/kicad-pcb-13-desktop-open/session-test-stable-final.log` |
| `CARGO_TERM_QUIET=true cargo fmt --manifest-path apps/desktop/src-tauri/Cargo.toml` | 0 | `tmp/kicad-pcb-s536/kicad-pcb-13-desktop-open/cargo-fmt.log` |
| `CARGO_TERM_QUIET=true cargo fmt --manifest-path apps/desktop/src-tauri/Cargo.toml -- --check` | 0 | `tmp/kicad-pcb-s536/kicad-pcb-13-desktop-open/cargo-fmt-check.log` |
| `CARGO_TERM_QUIET=true cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml dialogs` | 0 | 12 passed, 0 failed; `tmp/kicad-pcb-s536/kicad-pcb-13-desktop-open/cargo-test-dialogs.log` |
| `bunx biome check apps/desktop/src/file/session.ts apps/desktop/src/file/session.test.ts --diagnostic-level=warn` | 0 | 2 files clean on final source; `tmp/kicad-pcb-s536/kicad-pcb-13-desktop-open/biome-final.log` |
| `test "$(grep -c 'kicad_pcb' apps/desktop/src-tauri/src/dialogs.rs)" -ge 2` | 0 | `tmp/kicad-pcb-s536/kicad-pcb-13-desktop-open/filter-count.log` |
| `test "$(grep -c 'importKicadPcbPath' apps/desktop/src/file/session.ts)" -ge 2` | 0 | `tmp/kicad-pcb-s536/kicad-pcb-13-desktop-open/import-count.log` |

Current source SHA-256:
- `apps/desktop/src/file/session.ts`: `044fa5805cd16d67fedcd562f2f125103029df0261c42ad7f660cd0b8f4c1e3c`
- `apps/desktop/src/file/session.test.ts`: `f0f98bcd265237eb8893322cb8e35361c306478b0309da931f3b657fa44e1efc`
- `apps/desktop/src-tauri/src/dialogs.rs`: `0e2d4f1bd11e5051237499d647abede0f2d2a9b83d2f21ab33519f53fba2ac1c`

Earlier typecheck failures were confined to sibling-owned plan 11/12 paths outside this plan's writePaths and were not edited. The final continuation rerun passed after those files stabilized.

## Completion criteria

- [x] `.kicad_pcb` routes to a detached, dirty PCB document; warnings and errors follow the plan contract.
- [x] Rust open filter and test include `kicad_pcb`.
- [x] Session, Rust dialog, formatter, filter-count and Biome gates pass.
- [x] Workspace typecheck passes after sibling-owned files stabilize.

# kicad-pcb-13-desktop-open

- planId: kicad-pcb-13-desktop-open
- planPath: impl-plans/active/kicad-pcb-13-desktop-open.md
- wave: 4; dependsOn: kicad-pcb-09-core-index-fixture-integration
- design: design-docs/specs/design-kicad-pcb.md section 9 (Open dialog,
  `dialogs.rs`)
- progress log: impl-plans/progress/kicad-pcb-13-desktop-open.md
- protocol: impl-plans/active/kicad-pcb-00-overview.md "Per-worker protocol"

## Intent

Let the desktop Open dialog open `.kicad_pcb` files as a new, detached,
unsaved document with one PCB page. Autosave must never write the KiCad
file. Import diagnostics appear under Import notes.

## Repository context (imitate)

- `apps/desktop/src/file/session.ts`:
  - `isKicadPath` (line ~151) and `isPcbPath` (line ~158)
  - `importPcbPath` (line ~347), which shows the detached-document pattern
    with `importDocument(document, name, warnings)`, stale checks and
    `fail`
  - the `openPath` dispatch that routes by extension
- `apps/desktop/src/file/session.test.ts`: the existing Gerber and KiCad
  open tests (fake backend).
- `apps/desktop/src-tauri/src/dialogs.rs`: `OPEN_FILTER_EXTENSIONS` (line
  ~25) and its tests (lines ~239-245).
- Core and io API: `importKicadPcb` (`@nodetto/io`) and
  `pcbDocumentFromPlan` (`@nodetto/core`).

## Non-goals

- No change to Gerber, KiCad schematic or netlist opening.
- No file association or Info.plist changes.
- No App.tsx changes (plan 12 owns it).

## writePaths

- apps/desktop/src/file/session.ts
- apps/desktop/src/file/session.test.ts
- apps/desktop/src-tauri/src/dialogs.rs
- impl-plans/progress/kicad-pcb-13-desktop-open.md (new)

## sharedPaths

none

## Pinned behaviour

- `isKicadPcbPath(path)`: true for a case-insensitive `.kicad_pcb`
  suffix. Use `toLowerCase().endsWith(".kicad_pcb")`, not a regex split.
  Check it before `isKicadPath` and `isPcbPath`.
- `importKicadPcbPath(path, stale)`:
  1. read the text with `backend.readDocument(path)`
  2. return `false` if stale
  3. call `importKicadPcb(text, {fileName: name})`
  4. if any diagnostic is an error, call `fail("could not import <name>:
     <first error message>")` and return `false`
  5. otherwise build `pcbDocumentFromPlan(plan, {pageName: plan.title})`
     and call `importDocument(document, name, warnings)`, with warnings
     mapped to `{element: name, message}` (add `line:column` when present)
  - Lazy-import the core and io modules, as `importPcbPath` does.
- `dialogs.rs`: add `"kicad_pcb"` to `OPEN_FILTER_EXTENSIONS`, and assert
  it in the existing filter test.

## Pitfalls

- The document must be detached (`filePath: null`, dirty), as
  `importPcbPath` makes it, so autosave never writes the `.kicad_pcb`.
- `.kicad_pcb` must not reach the breadboard KiCad import (`isKicadPath`
  matches only `kicad_sch` and `net`). Keep the dispatch order explicit.
- Run `cargo fmt` after the Rust edit.

## Tests (input -> expected)

- Opening `board.kicad_pcb` with the fixture text in the fake backend ->
  the session has a document with one page of kind `pcb`, `filePath`
  null, `dirty` true, and `fileName` `board.kicad_pcb`.
- A `.KICAD_PCB` upper-case suffix -> the same route.
- Text with root `kicad_sch` named `x.kicad_pcb` -> the session error is
  `could not import x.kicad_pcb: ...`, and no document is replaced.
- Inline text with a `dimension` -> `importWarnings` holds the warning.
- Rust: the filter test asserts that `kicad_pcb` is included.

## Verification

1. `BUN_OPTIONS=--jsx-runtime=classic bun test apps/desktop/src/file/session.test.ts`
   exits 0.
2. `bun run typecheck` exits 0.
3. `CARGO_TERM_QUIET=true cargo fmt --manifest-path apps/desktop/src-tauri/Cargo.toml`,
   then `CARGO_TERM_QUIET=true cargo fmt --manifest-path apps/desktop/src-tauri/Cargo.toml -- --check`
   exits 0.
4. `CARGO_TERM_QUIET=true cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml dialogs`
   exits 0.
5. `bunx biome check apps/desktop/src/file/session.ts apps/desktop/src/file/session.test.ts --diagnostic-level=warn`
   exits 0.

## Done criteria

- `grep -c "kicad_pcb" apps/desktop/src-tauri/src/dialogs.rs` is at
  least 2.
- `grep -c "importKicadPcbPath" apps/desktop/src/file/session.ts` is at
  least 2.
- All verification steps are recorded with exit code 0.

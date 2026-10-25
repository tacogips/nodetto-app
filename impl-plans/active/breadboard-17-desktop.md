# breadboard-17-desktop

- planId: breadboard-17-desktop
- planPath: impl-plans/active/breadboard-17-desktop.md
- wave: 7; dependsOn: breadboard-04-io-kicad, breadboard-09-core-import-layout, breadboard-12-ui-canvas-interaction, breadboard-13-ui-inspector, breadboard-14-ui-problems, breadboard-15-ui-export-dialog
- design: design-docs/specs/design-breadboard.md sections 10 (desktop),
  7.2 (desktop page following); user-QA Q10; design-review residual DR-3
  (duplicate import notes)
- progress log: impl-plans/progress/breadboard-17-desktop.md
- protocol: overview "Per-worker protocol", gates G1 and G2
- G1 ownRegex: `^apps/desktop/src/(App\.tsx|page-workspace(\.test)?\.ts|file/session(\.test)?\.ts)`

## Intent

Wire breadboard pages into the desktop app:
- the page kind selects and follows the `breadboard` workspace, and
  choosing Breadboard in Mode opens or creates a "Breadboard" page
- the problems panel is mounted with import warnings
- the export dialog's BOM, KiCad and SPICE buttons write files through
  the export backend
- `.kicad_sch` and `.net` open as detached imports with notes, through
  the open-dialog filter (one Rust change)

## Non-goals

- No OS file association: no `tauri.*.conf.json` change (Q10).
- No other Rust change, and no new Tauri command.
- No change to BPMN, Mermaid or draw.io open flows.

## writePaths

- apps/desktop/src/App.tsx
- apps/desktop/src/page-workspace.ts (new: pure page-kind to workspace lookup)
- apps/desktop/src/page-workspace.test.ts (new)
- apps/desktop/src/file/session.ts
- apps/desktop/src/file/session.test.ts
- apps/desktop/src-tauri/src/dialogs.rs
- impl-plans/progress/breadboard-17-desktop.md

## sharedPaths

none

## File-level changes

### page-workspace.ts

```ts
export const DEDICATED_WORKSPACES: Readonly<Partial<Record<PageKind, WorkspaceId>>> = { bpmn: "bpmn", breadboard: "breadboard" };
export function dedicatedWorkspaceFor(kind: PageKind | undefined): WorkspaceId | undefined;
export function dedicatedPageKindFor(workspace: WorkspaceId): PageKind | undefined; // inverse
export const DEDICATED_PAGE_NAMES: Readonly<Partial<Record<PageKind, string>>> = { bpmn: "Process", breadboard: "Breadboard" };
```

### App.tsx

- Generalise `changeWorkspace` (App.tsx:153-171) and the follow effect
  (App.tsx:365-375) to use `page-workspace.ts`.
  - When the target workspace has a dedicated page kind and the current
    page is not of that kind, switch to the first page of that kind, or
    create one named from `DEDICATED_PAGE_NAMES`.
  - When leaving a dedicated workspace for a general one while on a
    dedicated page, switch to the first page that is not dedicated, or
    create a freeform "Page".
  - The follow effect selects the page's dedicated workspace. When the
    workspace is dedicated but the page kind does not match, it falls
    back to `flow`.
  - BPMN behaviour must stay exactly as before.
- Add `isBreadboardPage()` beside `isBpmnPage()`. Mount
  `<BreadboardProblemsPanel editor viewport importWarnings={file().importWarnings} />`
  under `<Show when={isBreadboardPage()}>`, next to the BPMN panel
  (App.tsx:1480).
- DR-3: widen the generic "Import notes" guard (App.tsx:899) from
  `!isBpmnPage()` to `!isBpmnPage() && !isBreadboardPage()`, so KiCad
  diagnostics are shown once.
- Pass `viewport={viewport}` to `<Inspector>` (App.tsx:1474). Plan 13 adds
  the optional prop.
- Add `exportBreadboard(kind)`, imitating `exportBpmn` (App.tsx:619-652):
  - build the model with `computeBreadboardConnectivity` and
    `toBreadboardNetlist` from `@nodetto/core`
  - lazily import the formatter from `@nodetto/io`
  - the file name is `${exportBaseName(page.name)}.${csv|net|cir}`
  - call `pickExportPath(name, ext)`, then `writeText`, with the Blob
    download fallback
  - formatter warnings, when present, go through `setExportError` as a
    notice (joined with "; ")
  - pass it as `exportBreadboard` to `ExportDialog` (App.tsx:866)

### file/session.ts

Add a KiCad branch, imitating the draw.io branch (session.ts:417-440):
- `isKicadPath(path)` matches `/\.(?:kicad_sch|net)$/i`.
- Lazily `await import("@nodetto/io/kicad")` and
  `await import("@nodetto/core")`, checking `stale()` after each.
- Call `importKicad(diskText, {fileName: baseName(path)})`.
- Without a plan: `this.fail("could not import <name>: <first error message>")`.
- With a plan:
  `importDocument(layoutBreadboardImport(plan), baseName(path), warnings)`.
  Each diagnostic becomes `{element, message: "<code>: <message>"}`, where
  `element` is its reference, else `<line>:<column>`, else the file name.
  The import is detached, so autosave never rewrites the KiCad file.
- Place the branch before the generic fallback and after the draw.io
  branch.

### src-tauri/src/dialogs.rs

- `OPEN_FILTER_EXTENSIONS` (dialogs.rs:16) gains `"kicad_sch"` and
  `"net"`.
- Add the test `open_filter_includes_kicad` next to
  `open_filter_includes_drawio`.
- Then run `cargo fmt`.

## Pitfalls

- A `.net` file that is not a KiCad netlist (no `export` root) must fail
  cleanly through `fail(...)`. It must not throw.
- Keep the lazy imports lazy. Do not add `@nodetto/io/kicad` to the
  initial bundle with a static import.
- `changeWorkspace` must not create a duplicate dedicated page when one
  exists.
- Rust: run cargo only with `CARGO_TERM_QUIET=true`, and format only with
  `cargo fmt --manifest-path apps/desktop/src-tauri/Cargo.toml`.

## Tests (input -> expected)

`page-workspace.test.ts`:
- `dedicatedWorkspaceFor("breadboard")` -> `"breadboard"`
- `dedicatedWorkspaceFor("bpmn")` -> `"bpmn"`
- `dedicatedWorkspaceFor("freeform")` -> undefined
- `dedicatedPageKindFor("breadboard")` -> `"breadboard"`
- `dedicatedPageKindFor("flow")` -> undefined

`session.test.ts`, imitating the draw.io open test (session.test.ts:535):
- opening `/docs/led-button.net` with the fixture text (read from
  `test-fixtures/kicad/led-button.net`) -> imported detached, document
  page kind `breadboard`, and 4 parts plus a `breadboard.netlist` element
- opening `/docs/led-button.kicad_sch` -> the same shape
- opening `/docs/bad.net` containing `(foo)` -> the session reports the
  failure with the `could not import bad.net` prefix, and no document is
  replaced
- opening `unknown-symbols.net` -> `importWarnings` is non-empty and
  includes `kicad.skippedSymbol`

`dialogs.rs`: `open_filter_includes_kicad` asserts both extensions.

## Verification

```
cd /Users/taco/gits/tacogips/nodetto-app-breadboard
mkdir -p tmp/breadboard-mode-s485/breadboard-17-desktop
bun test apps/desktop/src/page-workspace.test.ts apps/desktop/src/file/session.test.ts   # exit 0, >0 pass, 0 fail
bun test apps/desktop > tmp/breadboard-mode-s485/breadboard-17-desktop/desktop.log 2>&1   # G2
bun run typecheck > tmp/breadboard-mode-s485/breadboard-17-desktop/typecheck.log 2>&1     # G1
bunx biome check apps/desktop/src/App.tsx apps/desktop/src/page-workspace.ts apps/desktop/src/page-workspace.test.ts apps/desktop/src/file/session.ts apps/desktop/src/file/session.test.ts   # exit 0
CARGO_TERM_QUIET=true cargo fmt --manifest-path apps/desktop/src-tauri/Cargo.toml
CARGO_TERM_QUIET=true cargo fmt --manifest-path apps/desktop/src-tauri/Cargo.toml -- --check   # exit 0
CARGO_TERM_QUIET=true cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml dialogs > tmp/breadboard-mode-s485/breadboard-17-desktop/cargo-test.log 2>&1   # exit 0, includes open_filter_includes_kicad
git diff --quiet -- apps/desktop/src-tauri/tauri.conf.json apps/desktop/src-tauri/tauri.macos.release.conf.json apps/desktop/src-tauri/tauri.linux.release.conf.json   # exit 0
```

## Done criteria

- `grep -n '"kicad_sch"' apps/desktop/src-tauri/src/dialogs.rs` prints the filter and the test lines.
- `grep -n 'isBreadboardPage' apps/desktop/src/App.tsx` shows the panel mount and the widened Import notes guard.
- All verification lines pass, with exit codes and counts in the progress log.

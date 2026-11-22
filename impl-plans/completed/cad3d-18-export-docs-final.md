# M18 cad3d-18-export-docs-final

- dependsOn: M11, M20, M21, M22, M15, M17 (everything that ships)
- Design: sections 9 (existing exports), 7.3 (validator cost), 14
  (real-host verification), 15, 16
- writePaths: `packages/core/src/cad/wireframe.ts` (new) and its test,
  `packages/core/src/svg-export/document.ts`,
  `packages/core/src/svg-export/cad.ts` (new) and its test,
  `apps/cli/src/native-parity/cad.test.ts` (one export parity case),
  `apps/cli/src/native-parity/cad.test.ts` (mesh validation deadline),
  `apps/desktop/scripts/cad-viewport-check.mjs` (`--budget` scene and the
  `--serve-only` flag),
  `apps/desktop/scripts/cad-wkwebview-check.swift` (new),
  `apps/desktop/package.json` (script `check:cad-wkwebview`),
  `docs/cad3d.md` (new), `README.md` (one feature paragraph and link),
  `docs/cli.md`, `impl-plans/README.md` (index entries),
  `design-docs/specs/design-cad3d.md` (status line, measured budgets)

## Contract

```ts
// packages/core/src/cad/wireframe.ts (kernel-free)
export interface CadWireframe { readonly segments: Float64Array; // x1,y1,x2,y2 in view units
  readonly bounds: { minX: number; minY: number; maxX: number; maxY: number } | null }
export function cadPageWireframe(elements: readonly Element[], pageId: PageId): CadWireframe;
// packages/core/src/svg-export/cad.ts
export function cadPageSvgBody(wireframe: CadWireframe, options: { stroke: string; strokeWidth: number }): string;
```

## Behavior

- `cadPageWireframe`: for every non-suppressed, structurally valid extrude
  and PCB reference, take the loops, emit the loop edges at both caps and
  one connecting edge per loop vertex that joins two different source
  entities (so circles get no vertical lines), in world space; imported
  meshes contribute their bounding box edges. Project with the fixed
  isometric matrix whose coefficients are the literal constants
  `0.7071067811865476` and `0.408248290463863`, `0.816496580927726`
  (no trigonometry at run time). Deduplicate identical segments.
- SVG export: where `packages/core/src/svg-export/document.ts` builds a
  page, a `cad3d` page gets one `<path>` built from the segments, scaled to
  fit the page frame with a margin, stroke from the export's existing ink
  colour option, plus the caption "Construction view" in the existing
  export font. PDF and PNG follow because they render the SVG. A CAD page
  with no feature exports as an empty page, as an empty 2D page does.
  Other page kinds are byte-for-byte unchanged.
- The CLI `export` command therefore handles CAD pages with no kernel.
- Browser check with budgets: `cad-viewport-check.mjs --label m18
  --budget` (script from M19) repeats the functional assertions against
  the final build and enforces 250 ms edit-to-display; the 16 ms camera
  frame budget on the generated 200,000 triangle page is enforced when
  the GL renderer is hardware and recorded otherwise (the JSON states
  which).
- WKWebView check, `cad-wkwebview-check.swift`, run with `swift`: starts
  no server itself; it takes the URL printed by
  `cad-viewport-check.mjs --serve-only` (new flag: build, serve with the
  production CSP header, print the URL, wait for stdin to close), loads it
  in an off-screen `WKWebView`, polls `window.__cadCheck` through
  `evaluateJavaScript`, and exits 0 only when the engine returned a body
  (Worker and WASM under the production CSP in system WebKit), the shader
  programs linked, and the centre pixel differs from the background in
  both canvas modes. It writes `tmp/cad3d/m18/wkwebview.json` including
  the WebKit and macOS versions. A wrapper script entry
  `check:cad-wkwebview` in `apps/desktop/package.json` runs both
  processes in the foreground and returns the Swift exit code.
- In the packaged desktop webview, drop a valid STL onto the CAD viewport
  and verify that one undo removes the mesh. Drop a file, a browser link,
  and plain text containing a URL on the palette, an open Export dialog,
  an inspector colour swatch and switch, and an editable text field.
  Verify that the app stays on the current document with unsaved edits
  intact and that the text field's value stays unchanged. Also exercise
  the STL picker and save dialog and import a raster image by dropping it
  onto a 2D canvas.
  Record the host, each outcome, and whether WebKitGTK was checked alongside
  the WKWebView report.
- Native mesh validation deadline: a generated document with four
  `cad.mesh` elements of maximum payload length passes `validate` in the
  native binary in under 10,000 ms and with byte parity to Bun.
- `docs/cad3d.md`: what a CAD page is, the content rule, the feature list,
  sketch and extrude workflow, PCB reference, STL import and export, the
  file format (records, NMESH summary, git and merge driver setup),
  limits, the phase list, and the cloud follow-up list of design 15.
- Design document: status "implemented (slice)", measured values from
  `tmp/cad3d/*/` logs filled into section 14, including the WKWebView
  result and its WebKit version; macOS 12 WebKit and WebKitGTK (Linux
  builds) stay listed as unverified hosts, and `docs/cad3d.md` says that
  the viewport shows a message there when WASM, Worker or WebGL2 is
  missing.

## Tests

- `wireframe.test.ts`: a box gives 12 segments; a cylinder (one circle
  loop) gives 2 x n segments and no vertical ones; an invalid extrude
  contributes nothing; 20,000 elements under 1,000 ms.
- `svg-export/cad.test.ts`: the Plate page exports an SVG with one path
  and the caption; exporting twice gives identical bytes; an existing
  non-CAD fixture exports the same bytes before and after this change
  (compare against the export of the same fixture with the CAD branch
  bypassed through the public API, or against a stored expectation that
  the existing export determinism test already owns).
- `native-parity/cad.test.ts`: SVG export of `cad-bracket.jsonl` is byte
  identical between Bun and the native binary and finishes under
  10,000 ms.
- The repository-wide export determinism test
  (`apps/cli/src/export-determinism.test.ts`) passes unmodified.

## Acceptance criteria

- All acceptance criteria of the workflow input are met; the checklist in
  the commit message maps each criterion to its tests.
- `mise run ci` and `mise run test-cli` pass with no skipped parity tests
  and no relaxed deadline.
- `tmp/cad3d/m18/viewport-check.json` and `tmp/cad3d/m18/wkwebview.json`
  exist with every functional assertion true.
- Plan files are moved to `impl-plans/completed/` in this commit.

## Verification (each must exit 0)

1. `sh -c 'bun run typecheck && bun test packages/core/src/cad/wireframe.test.ts packages/core/src/svg-export apps/cli/src/export-determinism.test.ts'`
2. `sh -c 'mkdir -p tmp/cad3d/m18; bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess > tmp/cad3d/m18/strict.log 2>&1; ! grep -E "^packages/(core|ir)/src/" tmp/cad3d/m18/strict.log | grep -vqE "\.test\.tsx?\(" && bun test packages/core/src/cad'`
3. `mise run ci` (the repository's own task: verify, then build; it must
   pass from a tree without `apps/desktop/dist`, so remove that directory
   first)
4. `mise run test-cli`
5. `sh -c 'bun apps/desktop/scripts/cad-bundle-check.ts --label m18 && bun test apps/desktop/src/cad/bundle-rules.test.ts'`
6. `sh -c 'bun apps/desktop/scripts/cad-viewport-check.mjs --label m18 --budget && bun test packages/ui-solid/src/cad/viewport.test.tsx'`
7. `sh -c 'bun --cwd=apps/desktop run check:cad-wkwebview && bun test apps/desktop/src/cad/csp.test.ts'`
   (macOS with a window server; this is the platform of the desktop
   release build)

## Progress

Implemented for adversarial review. Construction views reuse the structural
CAD traversal, fit an explicit viewport or a content frame capped at the
standard slide size, and show mesh bounding boxes. The NMESH codec and its
existing tests moved into the independent `@nodetto/nmesh` workspace package.
The existing IO entry point re-exports the same codec. This keeps the
core's IO isolation test and the public import path intact.

The viewport changes cover IR11-03 and IR21-01 through IR21-03. A drag
survives an unrelated document edit and reports cancellation if its
feature or frame becomes incompatible. The PCB menu protects the current
selection, clears stale notices and returns to Select on dismissal or
when the viewport mounts or unmounts. IR19-01 now times a blocking GPU
readback. The native tests cover PCB references, arcs and maximum inline
mesh validation (IR3-02). The geometry traversal avoids unnecessary
intersection work for adjacent edges and indexed tessellation appends
leave the existing CAD deadlines and output unchanged.

Deviations and host constraints. The Swift check drives real WebGL2 and
the production-CSP worker with a test-only timer because the off-screen
window receives no compositor frames. Chrome measures real frame times.
The repository's Bun discovery excludes ignored scratch under `tmp/`;
the verification commands use explicit paths for scoped tests. Automatic
mise installation is disabled and caches stay in the worktree. The
macOS console was locked, so packaged drag-and-drop and file-dialog
checks need an unlocked run. WebKitGTK and macOS 12 were not tested.
Evidence is under `tmp/cad3d/m18/`.

The seven automated verification commands exited 0. Clean-dist CI passed
4,516 Bun tests and 91 Rust tests. The separate CLI suite passed 560 Bun
tests and 25 Rust tests with every parity test enabled. Hardware Chrome
measured 74.9 ms from edit to display and a 2.6 ms maximum for the
200,000-triangle frame. The system WKWebView reported WebKit
21624.2.5.11.8 and passed all 15 assertions. The unsigned macOS package
contains the release CLI sidecar, which exported both PNG and PDF for the
bracket fixture. The packaged host probe recorded the locked console.

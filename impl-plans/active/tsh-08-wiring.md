# tsh-08-wiring

- planId: tsh-08-wiring
- planPath: impl-plans/active/tsh-08-wiring.md
- progressPath: impl-plans/progress/tsh-08-wiring.md
- wave: 3 (final, runs alone)
- dependsOn: tsh-02-export, tsh-03-view, tsh-04a-navigation, tsh-04b-clipboard, tsh-04c-resize, tsh-05-inspector, tsh-06-cli, tsh-07-docs
- Design: `design-docs/specs/design-table-sheet.md` sections 1, 5, 6, 7, 8, 9, 10, 11, 12.
- Contracts and worker rules: `impl-plans/active/tsh-00-overview.md`.
- writePaths:
  - `packages/core/src/shapes/index.ts`
  - `packages/core/src/svg-export/shapes.ts`
  - `packages/core/src/tools.ts`
  - `packages/core/src/shape-catalogue.ts`
  - `packages/core/src/shape-catalogue.test.ts`
  - `packages/core/src/table-sheet-export.test.ts` (new)
  - `packages/ui-solid/src/shapes/ShapeView.tsx`
  - `packages/ui-solid/src/Canvas.tsx`
  - `packages/ui-solid/src/interaction/pointer.ts`
  - `packages/ui-solid/src/interaction/keyboard.ts`
  - `packages/ui-solid/src/interaction/types.ts`
  - `packages/ui-solid/src/interaction.ts`
  - `packages/ui-solid/src/Inspector.tsx`
  - `packages/ui-solid/src/shape-palette.ts`
  - `packages/ui-solid/src/Toolbar.test.ts`
  - `packages/ui-solid/src/shape-search.test.ts`
  - `packages/ui-solid/src/table-sheet-wiring.test.ts` (new)
  - `apps/cli/src/commands.ts`
  - `apps/cli/src/help.ts`
  - `apps/cli/src/types-command.ts`
  - `apps/cli/src/cli-wiring.test.ts`
  - `apps/cli/src/table-e2e.test.ts` (new)
  - `README.md`
  - `design-docs/specs/design-table-sheet.md`
  - `docs/cli.md`
  - `docs/editing.md`
  - `impl-plans/progress/tsh-08-wiring.md`
  - `tmp/tsh-s780/tsh-08-wiring`
  - `target`
- sharedPaths: none
- artifactRoots: `target`
- The `docs/cli.md` and `docs/editing.md` paths are for serial correction
  only. Use them only if wiring changes a name that tsh-07 documented (for
  example the shape id, see refinement below). Record each such edit.

## Intent and context

This plan connects the wave-1 and wave-2 modules to every shared
registration and dispatch point, documents the feature in the README,
marks the design as implemented, adds end-to-end tests, and runs the
workspace gates. This is the only plan that touches shared files.

The catalogue shape id is `table.sheet`. Design sections 8 and 9 already
say so. Update docs/cli.md only if tsh-07 wrote `table:sheet`.

Producers of the interaction modules, all under
`packages/ui-solid/src/table-sheet/`:

- tsh-04a: `selection.ts` (including `tableSheetCellClick`), `keyboard.ts`,
  `cell-commit.ts`, `CellEditor.tsx`, `SelectionOverlay.tsx`
- tsh-04b: `clipboard.ts`, which takes explicit targets
- tsh-04c: `resize.ts`, which provides `tableSheetRegionAt` and the resize
  drag

## Non-goals

- No new behavior beyond the design.
- No edits to tsh-01..07 module files. If an end-to-end test exposes a
  defect in one of them, do not edit it. Record a blocker in the progress
  log with the failing command, the log path, the file and the symbol, so
  the workflow can amend the owning plan.
- No Rust, no version bump, no release.

## File-level changes

1. `packages/core/src/shapes/index.ts`: import `tableSheetShapeUtil` from
   `../table-sheet/index.ts` and `.register(...)` it next to
   `erdTableShapeUtil`.
2. `packages/core/src/svg-export/shapes.ts`: add
   `case "table.sheet": return renderTableSheet(element, box, theme);`
   next to `case "erd.table"`.
3. `packages/core/src/tools.ts`:
   - Add `Sheet: "table.sheet"` to `Tool`.
   - Add `case Tool.Sheet:` to the group that returns `{ type: tool }`
     (with `Tool.Table`).
   - `Tool.Table` stays `erd.table`.
4. `packages/core/src/shape-catalogue.ts`: add `[Tool.Sheet, "Sheet"]` to
   `general`. `shape-catalogue.test.ts`: update any exact list or count
   assertion and add a case: `findShape("table.sheet")` exists, and
   `shapeCreation` gives `type table.sheet`.
5. `packages/ui-solid/src/shape-palette.ts`: add
   `{ tool: Tool.Sheet, label: "Sheet", icon: "table" }` to the General
   group, following the existing `Tool.Table` entry pattern. Update
   `Toolbar.test.ts` and `shape-search.test.ts` only where exact lists
   require it.
6. `packages/ui-solid/src/shapes/ShapeView.tsx`: add
   `<Match when={props.element.type === "table.sheet"}><TableSheetView element={props.element} /></Match>`
   next to the `erd.table` match.
7. Canvas integration (`Canvas.tsx`, `interaction.ts`,
   `interaction/types.ts`, `interaction/pointer.ts`,
   `interaction/keyboard.ts`):
   - Create one `createTableSheetSelection()` per canvas in `Canvas.tsx`.
     Call `selection.reconcile(editor)` on store and selection changes,
     following the existing store-subscription pattern in Canvas.
   - Double-click: in `Canvas.tsx`, wrap the `onEditRequest` passed to the
     interaction (currently `onEditRequest: (id, region) => props.onEditRequest?.(id, region)`).
     When the target element type is `table.sheet`:
     1. compute the cell with `tableSheetRegionAt(tableSheetLayout(el), point, zoom)`
     2. `selection.activate(...)` and `selection.startEditing()`
     3. never call `props.onEditRequest`
     The point is needed, so extend the interaction option type in
     `interaction/types.ts` with an optional
     `onTableSheetDoubleClick?(id, point): boolean` that is called in
     `pointer.ts:onDoubleClick` before `onEditRequest` when the hit
     element is a `table.sheet`.
     A double-click on a column border calls `resetColumnWidth` instead.
   - Pointer down (`pointer.ts:onPointerDown`): when the hit element is an
     already-selected `table.sheet`:
     - a border region starts `beginTableSheetResize` and routes the
       move, up and cancel events to it (imitate the existing drag gesture
       state in pointer.ts)
     - a cell region calls `tableSheetCellClick` with `shift` from the
       event
     - otherwise, keep the existing behavior
     The first click on an unselected table keeps today's selection
     behavior.
   - Cursor: show `col-resize` or `row-resize` over the border bands of a
     selected table. Follow how pointer.ts sets cursors, or skip if
     cursors are set only in Canvas, and record which.
   - Keyboard (`keyboard.ts:onKeyDown`): after the existing
     `isEditableTarget` guard and before any canvas shortcut (nudge,
     delete, copy, paste):
     1. Clipboard routing. While `selection.state()` is set and the
        element is selected, route the keys to tsh-04b:
        - Cmd/Ctrl+C: `copyTableRange(editor, {elementId, range: selection.range(editor)}, port)`
        - Cmd/Ctrl+X: `cutTableRange` with the same target
        - Cmd/Ctrl+V: `pasteIntoTable(editor, {elementId, row, column}, port)`.
          `row` and `column` are the indices of the active cell, taken
          from `selection.range(editor)` top/left.
        Call `preventDefault()` and return. After a successful paste, set
        the selection to the returned range: `activate` at the top-left
        ids, then `extend` to the bottom-right ids.
        The port uses `navigator.clipboard.writeText` and `readText`. When
        `navigator.clipboard` is undefined, do not route, and fall
        through to the existing behavior.
     2. Then `if (handleTableSheetKey(event, { editor, selection })) return;`.
   - Mount `<TableSheetCellEditor>` when
     `selection.state()?.editing`, and `<TableSheetSelectionOverlay>` in
     the editing overlay layer next to the existing edit handles. Never
     mount them in the export path.
8. `packages/ui-solid/src/Inspector.tsx`:
   - Add the type label `"table.sheet": "Table (sheet)"` in the label map
     (near line 192).
   - Add `<Match when={element().type === "table.sheet"}><TableSheetSection editor=... element=... activeRowId={...} /></Match>`.
   - The active row id comes from the canvas selection only if Inspector
     already receives canvas state. Otherwise pass `undefined`, so
     "Delete row" deletes the last row (design fallback). Record which.
9. `apps/cli/src/commands.ts`: import `tableCommand` and add
   `case "table": return tableCommand(io, rest);`.
   `apps/cli/src/help.ts`:
   - register the `table` topic with `TABLE_HELP`
   - add a top-level usage line
     `nodetto-cli table create|set     Spreadsheet tables from CSV/TSV or JSON; edit cells`
     in the Edit group
   - add `set-cells` to the edit op list in the edit help text
   `apps/cli/src/types-command.ts`: add `"table.sheet"` to `GENERAL`.
   `cli-wiring.test.ts`: assert that `runCli(["table","--help"])` prints
   `TABLE_HELP`, and that `runCli(["table"])` exits 2.
10. `README.md`: one feature bullet for spreadsheet tables and one CLI
    example line. Follow the existing README feature list style.
11. `design-docs/specs/design-table-sheet.md`:
    - change the first sentence of the status paragraph,
      `Status: design, not implemented.`, to
      `Status: implemented (session 778).`
    - make no other edits

## End-to-end tests (input -> expected)

- `packages/core/src/table-sheet-export.test.ts`:
  - `exportSvg` (the public whole-page SVG export function; find its name
    in `svg-export/document.ts` or `svg-export.ts`) on a document with one
    table -> the output contains `nodetto-table-sheet`, a header text per
    column, a pill and a checkbox
  - `createDefaultRegistry().get("table.sheet")` is defined
  - editor bounds for the default 3x3 are 360x116
  - `Tool.Sheet` creation via `shapeCreation("table.sheet")` creates a
    valid element
- `packages/ui-solid/src/table-sheet-wiring.test.ts` (use
  `interaction-test-helpers.ts:interactionFor`):
  - with a table selected and a cell active, ArrowRight moves the cell and
    does NOT change the element `visual.x`
  - Delete clears cells and does NOT delete the element
  - Escape clears the cell selection and keeps the element selected
  - with no active cell, ArrowRight nudges the element (existing behavior
    preserved)
  - a double-click on a cell sets editing state, and `onEditRequest` is NOT
    called
  - a double-click on a `node.generic` still calls `onEditRequest`
- `apps/cli/src/table-e2e.test.ts`, through `runCli`:
  1. `table create doc --csv data.csv --types text,number`
  2. `table set doc <id> --cell 0:1 --value 9`
  3. `lint doc` exits 0 with no table errors
  4. a corrupted copy (number cell `"x"`) linted reports `table.cellType`
     and exits non-zero
  5. `export doc --format svg` output contains `nodetto-table-sheet`
  6. `types table.sheet` mentions `columns`
  7. `draw doc table.sheet` creates a 3x3 table

## Verification (each exit 0; test commands show at least 1 test, 0 fail; logs under `tmp/tsh-s780/tsh-08-wiring/final/`)

1. `bun test ./packages/core/src/table-sheet-export.test.ts ./packages/core/src/shape-catalogue.test.ts ./packages/core/src/svg-export/table-sheet.test.ts ./packages/core/src/table-sheet/layout.test.ts ./packages/core/src/table-sheet/shape.test.ts ./packages/core/src/table-sheet/edits.test.ts ./packages/core/src/table-sheet/apply.test.ts ./packages/core/src/table-sheet/delimited.test.ts ./packages/core/src/table-sheet/coerce.test.ts ./packages/core/src/table-sheet/columns.test.ts ./packages/core/src/table-sheet/grid.test.ts` -> `core.log`
2. `bun test ./packages/ui-solid/src/table-sheet-wiring.test.ts ./packages/ui-solid/src/table-sheet/selection.test.ts ./packages/ui-solid/src/table-sheet/keyboard.test.ts ./packages/ui-solid/src/table-sheet/cell-commit.test.ts ./packages/ui-solid/src/table-sheet/clipboard.test.ts ./packages/ui-solid/src/table-sheet/resize.test.ts ./packages/ui-solid/src/table-sheet-view.test.ts ./packages/ui-solid/src/inspector/table-sheet-section.test.ts ./packages/ui-solid/src/Toolbar.test.ts ./packages/ui-solid/src/shape-search.test.ts ./packages/ui-solid/src/interaction-keyboard-menus.test.ts` -> `ui.log`
3. `bun test ./apps/cli/src/table-e2e.test.ts ./apps/cli/src/cli-wiring.test.ts ./apps/cli/src/table-command.test.ts ./apps/cli/src/edit/operations/table.test.ts ./apps/cli/src/table-docs.test.ts ./apps/cli/src/edit/label-field.test.ts` -> `cli.log`.
   `label-field.test.ts` loops over `ELEMENT_TYPES`. It passes only after
   this plan registers `tableSheetShapeUtil` in
   `packages/core/src/shapes/index.ts`: the default semantic must then
   validate, and `table.sheet` must report "has no text label". It is a
   wave-3 check and is not run by any wave-2 plan.
4. `bun run typecheck` -> `typecheck.log`
5. `mise run lint` -> `lint.log`
6. `mise run test` -> `test.log` (includes the unchanged erd tests and the cargo workspace tests)
7. `mise run test-cli` -> `test-cli.log`. Up to 3 attempts under load,
   each in `attempt-<n>/`, and never relax deadlines. Record the native
   pass and skip counts. A skipped native test is a failure.
8. `mise run build-cli` -> `build-cli.log`
9. `mise run build` -> `build.log`
Integrity check (not a test command): `git diff --stat f59bef4 -- packages/core/src/commands.ts packages/ir/src/registry/erd.ts packages/core/src/shapes/erdTable.ts packages/ui-solid/src/shapes/ErdTableView.tsx` -> `erd-guard.log`. The output must be empty (an integrity check, not a test).

## Done criteria

- Every wiring point listed is done.
- Verifications 1-9 exited 0 (attempts for 7 recorded). The integrity
  check output is empty.
- The README bullet is present, and the design status reads implemented.
- The progress log records the per-edit hashes and any serial repair or
  amendment request.

## Amendment 2026-11-10 (blocked-wave-scope-or-contract, round 1)

Blocker (wave-005): `mise run build` and `mise run build-cli` write outside
the declared `target` artifact root. Decision, with no design change:

- `apps/desktop/dist` is added to writePaths and artifactRoots. It holds the
  Vite output of `bun run build` (`apps/desktop/package.json` `vite build`;
  gitignored by `dist/`).
- `apps/desktop/src-tauri/binaries` is added to writePaths and
  artifactRoots. `apps/cli/scripts/build-sidecar.ts` copies
  `nodetto-cli-<triple>` there (gitignored).
- Cargo output still goes to the existing `target` root (workspace
  `Cargo.toml`, `CARGO_TARGET_DIR` unset).
- `apps/desktop/src-tauri/gen/schemas` is added to writePaths as a source
  path only, because the Tauri `build.rs` run by `cargo build --release` may
  rewrite these tracked JSON files. Do not hand-edit them. Record
  `git hash-object` for each file before and after verification 9 in the
  progress log. `git diff --stat -- apps/desktop/src-tauri/gen/schemas`
  must be empty at the end. If the build changes them, report it as an
  amendment request and do not keep or revert the change by hand.
- Do not add these directories to any other plan, and do not change
  `mise.toml`, `.gitignore`, `build-sidecar.ts` or any Tauri config.

Resume: finish the remaining wiring (Canvas and interaction hooks for the
tsh-04a editor and overlay, tsh-04b clipboard key routing through
`navigator.clipboard`, tsh-04c pointer resize, `table-sheet-wiring.test.ts`).
Then run verifications 1-9 in order. Set the design status line to
implemented only after all of them exit 0.

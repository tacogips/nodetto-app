# erd-highlight-02-table-view

- planId: erd-highlight-02-table-view
- planPath: impl-plans/active/erd-highlight-02-table-view.md
- wave: 1
- dependsOn: none
- design: `design-docs/specs/design-erd-relation-field-highlight.md`
  sections 3, 4.3, 4.4, 5

## Intent and context

The ERD table view must be able to show some column rows as "related to the
selected relation". This plan adds an optional prop to `ErdTableView`,
forwards an optional prop from `ShapeView`, and adds the CSS rule. It does
not decide what to highlight; plan 03 passes the set from Canvas.

Repository facts:
- `packages/ui-solid/src/shapes/ErdTableView.tsx`: `ErdTableViewProps`
  only has `element`. Rows are `<div class="nodetto-erd-row">` inside
  `<For each={semantic().columns}>`.
- `packages/ui-solid/src/shapes/ShapeView.tsx`: `ShapeViewProps` (line
  36). It renders `<ErdTableView element={props.element} />` at about line
  233 and uses `classList` for `nodetto-selected` at line 97.
- ui-solid tests do not mount components. They test pure helpers exported
  from view files (see `packages/ui-solid/src/text-note-view.test.ts`,
  which imports helpers from `./shapes/TextNoteView.tsx`).
- `apps/desktop/src/style.css`: `.nodetto-erd-row` at line 595. Tokens
  are in `:root` (lines 3-16). `color-mix` is already used (lines 338, 678,
  1593).

## Non-goals

- No change to `packages/ui-solid/src/Canvas.tsx` (plan 03).
- No change to `ShapePalette.tsx` or `PrototypePreview.tsx`. They must
  compile unchanged because the new props are optional.
- No new CSS variables and no dark-theme block (the design notes that none
  exists).
- Do not rename or remove the `nodetto-erd-row` class.
  `apps/desktop/scripts/canvas-checklist.mjs` and
  `apps/desktop/scripts/fixtures/responsiveness.tsx` query it, and they must
  not be edited.
- No hover or click handlers on rows (reverse highlight is out of scope).

## writePaths

- packages/ui-solid/src/shapes/ErdTableView.tsx
- packages/ui-solid/src/shapes/ShapeView.tsx
- packages/ui-solid/src/erd-table-view.test.ts
- apps/desktop/src/style.css
- impl-plans/progress/erd-highlight-02-table-view.md

## sharedPaths

- none (`apps/desktop/src/style.css` is owned only by this plan; append one
  rule after `.nodetto-erd-row`)

## File-level changes

1. `ErdTableView.tsx`
   - Export a pure helper:
     `export function erdRowHighlighted(highlightedColumnIds: ReadonlySet<string> | undefined, column: ErdColumn): boolean`.
     It returns `highlightedColumnIds?.has(column.id) === true`.
   - `ErdTableViewProps` gains
     `readonly highlightedColumnIds?: ReadonlySet<string>;` with a short
     doc comment (transient selection state, never persisted).
   - The row div keeps `class="nodetto-erd-row"` and adds
     `classList={{ "nodetto-erd-row-related": erdRowHighlighted(props.highlightedColumnIds, column) }}`.
     The class decision must go through the exported helper.
   - Keep the `For` and the row structure unchanged, so rows stay mounted.
2. `ShapeView.tsx`
   - `ShapeViewProps` gains
     `readonly erdHighlightedColumnIds?: ReadonlySet<string>;` with a
     one-line comment (ERD rows linked to the selected relations; canvas
     only).
   - Change the `erd.table` Match to
     `<ErdTableView element={props.element} highlightedColumnIds={props.erdHighlightedColumnIds} />`.
     No other change.
3. `apps/desktop/src/style.css`: right after the `.nodetto-erd-row { ... }`
   block, add `.nodetto-erd-row-related` with exactly
   `background: color-mix(in srgb, var(--nodetto-accent) 18%, transparent);`
   and `box-shadow: inset 3px 0 0 var(--nodetto-accent);`. Change nothing
   else in the file.
4. `erd-table-view.test.ts`: keep the existing test. Add a test that imports
   `erdRowHighlighted` from `./shapes/ErdTableView.tsx`.

## Key pitfalls

- Do not use `class={... + " nodetto-erd-row-related"}` string
  concatenation. Use `classList`, as `ShapeView.tsx:97` does.
- Do not destructure props (it breaks Solid reactivity). Read
  `props.highlightedColumnIds` inside the JSX expression.
- Do not make either prop required.
- Do not hard-code hex colours in the CSS.
- Do not touch the `.nodetto-erd-header`, key, name or type rules.

## Test cases (input -> expected)

- `erdRowHighlighted(new Set(["a"]), {id: "a", ...})` -> true.
- `erdRowHighlighted(new Set(["a"]), {id: "b", ...})` -> false.
- `erdRowHighlighted(undefined, {id: "a", ...})` -> false.
- `erdRowHighlighted(new Set(), {id: "a", ...})` -> false.

Use self-authored `ErdColumn` objects (`{ id, name, dataType }`).

## Invariants

- `ShapePalette.tsx` and `PrototypePreview.tsx` compile without edits.
- Every column row still has class `nodetto-erd-row`.

## Verification (run from repo root, foreground)

- `bun test packages/ui-solid/src/erd-table-view.test.ts` -> exit 0, the new
  test passes.
- `bun run typecheck` -> exit 0. Plan 01 may be editing core at the same
  time. If an error appears only outside this plan's writePaths, record it
  and do not fix it.
- `bunx biome check packages/ui-solid/src/shapes/ErdTableView.tsx packages/ui-solid/src/shapes/ShapeView.tsx packages/ui-solid/src/erd-table-view.test.ts apps/desktop/src/style.css --diagnostic-level=warn` -> exit 0.
- `git diff --stat -- apps/desktop/scripts` -> empty.

Record each command, its exit status and a log path (for example
`/tmp/nodetto-erd-highlight/erd-highlight-02-table-view/<command>.log`,
outside the repository) in the progress log.

## Edit discipline

- Before each edit, re-read the target file fresh. Record a pre-edit
  SHA-256 and a one-line intent in the progress log, and record the
  post-edit SHA-256 after. On drift (the hash changed unexpectedly), stop
  and record it.
- No state-changing git commands. The workflow commits after joining.

## Acceptance / done criteria

- `grep -n "export function erdRowHighlighted" packages/ui-solid/src/shapes/ErdTableView.tsx` matches once.
- `grep -n "nodetto-erd-row-related" packages/ui-solid/src/shapes/ErdTableView.tsx apps/desktop/src/style.css` matches in both files.
- `grep -n "erdHighlightedColumnIds" packages/ui-solid/src/shapes/ShapeView.tsx` matches the prop declaration and the forwarding.
- Tests and commands above pass. `git diff --name-only` for this plan
  touches only its writePaths.
- `impl-plans/progress/erd-highlight-02-table-view.md` is complete.

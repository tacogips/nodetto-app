# M9 cad3d-09-feature-list-inspector

- dependsOn: M19 (mounted viewport, statuses reach the UI)
- Design: section 5 (feature list, inspector, selection, undo)
- writePaths: `packages/core/src/layer-name.ts`,
  `packages/core/src/cad/feature-list.ts` (new) and its test,
  `packages/ui-solid/src/Layers.tsx`,
  `packages/ui-solid/src/inspector/CadSection.tsx` (new),
  `packages/ui-solid/src/inspector/cad-edits.ts` (new),
  `packages/ui-solid/src/inspector/cad-edits.test.ts` (new),
  `packages/ui-solid/src/Inspector.tsx`,
  `packages/ui-solid/src/cad/status-store.ts` (new) and its test,
  `apps/desktop/src/file/session-cad.test.ts` (new),
  `packages/ui-solid/src/cad/CadViewport.tsx` (publish statuses)

## Contract

```ts
// packages/core/src/cad/feature-list.ts
export interface CadFeatureRow { readonly id: ElementId; readonly depth: 0 | 1;
  readonly name: string; readonly type: string }
export function cadFeatureRows(elements: readonly Element[]): readonly CadFeatureRow[];
// packages/ui-solid/src/inspector/cad-edits.ts (pure, returns Commands)
export function setCadNumber(element: Element, field: string, text: string): Command | { error: string };
export function setCadPoint(element: Element, field: "a" | "b" | "m" | "c", axis: 0 | 1, text: string): Command | { error: string };
export function setCadOperation(element: Element, op: string, bodies: readonly ElementId[]): Command | { error: string };
// packages/ui-solid/src/cad/status-store.ts
export function createCadStatusStore(): { set(pageId: PageId, status: readonly (readonly [ElementId, CadStatus])[]): void;
  get(id: ElementId): CadStatus | undefined; subscribe(fn: () => void): () => void };
```

## Behavior

- `layer-name.ts`: names for `cad.` types (prefix branch like the `pcb.`
  one at `:27`): the `name` field for sketches and features, "Line",
  "Arc", "Circle <r> mm" for entities. `renameLayer` (`:66`): for a `cad.`
  type whose semantic has a `name` field it applies one `updateSemantic`
  with the trimmed name (empty input restores the default name of the
  type) and never writes `visual.layerName`; for a CAD sketch entity it
  returns false. Other types are unchanged.
- `cadFeatureRows`: features in history order (reuse `analyzeCadPage`
  ordering), each sketch followed by its entities at depth 1 sorted by
  index then id.
- `Layers.tsx`: on a CAD page use `cadFeatureRows` for row order and
  indentation and show a badge with the status code for rows whose status
  is not ok (text from the status store; styles reuse existing warning
  classes in `Layers.css`). Rename, hide, lock, delete and drag reorder
  keep using the existing handlers; reordering a feature issues the
  existing `reorder` command. Non-CAD pages are untouched.
- `CadSection.tsx`, chosen in `Inspector.tsx` by the `cad.` prefix next to
  the `pcb.` branch: numeric fields for distance, radius, coordinates and
  plane offset; a select for `op`; a multi-select of earlier bodies for
  `bodies`; checkboxes for `symmetric`, `construction`, `suppressed`; a
  read-only status line. Controls come from
  `packages/ui-solid/src/inspector/controls.tsx`.
- `cad-edits.ts`: parse decimal text, reject non-finite, snap with
  `roundNm`, reject values the registry validator rejects (zero distance,
  non-positive radius), and return one `updateSemantic` command; unchanged
  values return `{ error: "unchanged" }` so no empty history entry appears.
- Each accepted edit is applied with `editor.apply([command])`: one history
  entry. The viewport regenerates through its store subscription (M8).

## Tests

- `feature-list.test.ts`: order and nesting for the Plate document; a
  entity without a `sketch` key (possible only in a hand-edited or merged
  file, since delete cascades) is listed at depth 0 at the end.
- `cad-edits.test.ts`: "6" on radius gives `updateSemantic` with `r: 6`;
  "0" on distance and "-1" on radius give errors; "1.23456789" snaps to
  1.234568; point axis edit replaces the pair atomically; unchanged text
  gives no command.
- Editor level (in `cad-edits.test.ts`): apply an edit, `undo()` restores
  the previous semantic, `redo()` reapplies; history length grows by one
  per edit.
- `status-store.test.ts`: set, get, subscribe, page switch clears.
- Layer name cases for every CAD type go into `feature-list.test.ts`,
  plus rename: renaming an extrude changes `semantic.name`, leaves
  `visual` without `layerName`, shows the new name in `layerName()` and
  in the inspector field, and is one undo step; renaming a circle returns
  false; renaming a 2D shape still writes `visual.layerName`.
- `layerRows` (`packages/core/src/layer-tree.ts:116`) on a CAD page returns
  one row per CAD element (category `node`) and none for a `design.token`
  on that page; the autosave predicate of
  `apps/desktop/src/file/session.ts:515-525` is true for an untitled
  document whose only content is a CAD model (test through the existing
  session test helpers, `apps/desktop/src/file/session-cad.test.ts`,
  new).

## Acceptance criteria

- Editing a parameter in the inspector produces exactly one command and one
  undo step; the layers panel on non-CAD pages renders identically (its
  existing tests pass unmodified).

## Verification (each must exit 0)

1. `sh -c 'bun run typecheck && bun test apps/desktop/src/file/session-cad.test.ts packages/core/src/cad/feature-list.test.ts packages/ui-solid/src/inspector/cad-edits.test.ts packages/ui-solid/src/cad packages/ui-solid/src/layer-window.test.ts packages/ui-solid/src/layer-keyboard.test.ts'`
2. `sh -c 'bunx biome check packages/ui-solid/src/inspector/CadSection.tsx packages/ui-solid/src/inspector/cad-edits.ts packages/core/src/cad packages/core/src/layer-name.ts && bun test packages/ui-solid/src/inspector/cad-edits.test.ts'`
3. `sh -c 'mkdir -p tmp/cad3d/m9; bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess > tmp/cad3d/m9/strict.log 2>&1; ! grep -E "^packages/(core|ir)/src/" tmp/cad3d/m9/strict.log | grep -vqE "\.test\.tsx?\(" && bun test packages/core/src/cad/feature-list.test.ts'`

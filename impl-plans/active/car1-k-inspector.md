# car1-k-inspector: base-plane selector and single-target Add (F6, F14)

- planId: car1-k-inspector. Wave 1. dependsOn: none. Gate: none.
- Design: `design-docs/specs/design-cad3d.md` 19 F6 and F14 (and 6.3
  note).
- Progress log: `impl-plans/progress/car1-k-inspector.md`.

## Intent

- F6: base-plane sketches get an undoable XY/YZ/ZX selector that keeps
  the offset.
- F14: Add never commits more than one target.

## Non-goals

- No change to `sketch-authoring.ts` (plan j), the history validation in
  core, or the Cut and Intersect multi-select.

## Changes

1. `packages/ui-solid/src/inspector/cad-edits.ts`:
   - Add `setCadSketchBase(element, base: string): Edit`:
     - same base: `unchanged`;
     - not a base-plane sketch (`plane.base` not a string) or a base not
       in `xy | yz | zx` (`packages/ir/src/registry/cad.ts`):
       `invalidField`;
     - otherwise `update(element, { ...semantic, plane: { ...plane, base } })`,
       keeping `offset` and every other field.

     Imitate the `setCadNumber` offset branch.
   - `setCadOperation(element, op, bodies)`: for `op === "add"`, keep
     only the first entry of `bodies`. Other ops are unchanged.
2. `packages/ui-solid/src/inspector/CadSection.tsx`:
   - In the `cad.sketch` match, when `offset()` is defined (a base-plane
     sketch), add a `SelectInput` labelled "Base plane" with options
     XY/YZ/ZX (values `xy`/`yz`/`zx`) and `disabled={readOnly()}`, next to
     the offset field. It commits via `edit(setCadSketchBase(...))`.
   - Targets passed to `setCadOperation` must be in display order: the
     listed `earlierBodies()` that are selected, in list order, then stored
     ids not listed, in stored order.
   - With `operation() === "add"`:
     - checking a body commits `[body]`;
     - unchecking the current target is a no-op (no commit).

## Pitfalls

- Each inspector change is its own commit and its own Undo entry. Do not
  batch changes.
- New to Add with no stored target keeps today's empty list.
- `readOnly()` already includes `visual.locked`; reuse it.

## Tests

- `packages/ui-solid/src/inspector/cad-edits.test.ts` (each fails before):
  - `setCadSketchBase` on `{ base: "xy", offset: 5 }` to `yz` gives
    `{ base: "yz", offset: 5 }`;
  - the same base gives `unchanged`;
  - a face sketch gives `invalidField`;
  - `setCadOperation(cut [a,b], "add", [a,b])` gives `bodies: [a]`, and
    `scanCadPage` reports the feature ok.
- `packages/ui-solid/src/test-dom/cad-sketch.dom.tsx`:
  - an XY sketch with offset 5, changed to YZ: the stored plane is
    `{ base: "yz", offset: 5 }`;
  - then to ZX: the same check;
  - Undo gives YZ, and Undo again gives XY;
  - a locked sketch's selector is disabled.
- `packages/ui-solid/src/test-dom/cad-inspector.dom.tsx`:
  1. Convert Cut `[a,b]` to Add: `[a]`, status ok.
  2. Check `b`: `[b]`, status ok.
  3. Uncheck `b`: no commit (the undo size is unchanged).
  4. Undo gives Add `[a]`; Undo again gives Cut `[a,b]`.
  5. The existing New, Cut and Intersect cases pass unchanged.

## Verification

1. `biome check packages/ui-solid/src/inspector/cad-edits.ts packages/ui-solid/src/inspector/CadSection.tsx packages/ui-solid/src/inspector/cad-edits.test.ts packages/ui-solid/src/test-dom/cad-sketch.dom.tsx packages/ui-solid/src/test-dom/cad-inspector.dom.tsx && bun test packages/ui-solid/src/inspector/cad-edits.test.ts packages/ui-solid/src/cad/viewport.test.tsx`
   must exit 0, with the `ok light` and `ok dark` markers of the
   inspector and sketch DOM runs.
2. `bun run typecheck && bun test packages/core/src/cad/emitters.test.ts`
   must exit 0. That test lists DOM files by owner. It is pre-authorized in
   `writePaths`; extend its exact list only if it fails because of this
   plan's DOM edits.

## Done when

- The selector works with Undo.
- Add never stores two targets.
- The existing inspector tests pass.

## Implementation status

- Implemented the base-plane selector, single-target Add behavior, and undo/validation regression coverage. See `impl-plans/progress/car1-k-inspector.md` for verification.
- Formal review and integration are pending downstream workflow steps.

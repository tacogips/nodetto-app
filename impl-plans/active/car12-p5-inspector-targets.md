# car12-p5-inspector-targets

- planId: car12-p5-inspector-targets; wave 1; dependsOn: none
- progressPath: impl-plans/progress/car12-p5-inspector-targets.md
- Finding: `performance-cad-inspector-target-membership` (medium).
- Design: `design-docs/specs/design-ai-capture.md` 29.1 R12-5. Follow the
  worker rules in `car12-00-overview.md`. Evidence:
  `tmp/car12-r12/car12-p5-inspector-targets/`.

## Intent and context

`CadSection.tsx` re-filters the stored `bodies` (`:83-88`) and calls
`targets().includes` on every checkbox row (`:219-233`).
`displayedExtrudeTargets` (`packages/ui-solid/src/cad/extrude-targets.ts:20-31`)
runs nested `includes`. Memoize one validated selection per change, and use
sets.

Non-goals:
- Do not change `extrude-authoring.ts`, `cad-edits.ts` or
  `inspector/cad-edits.test.ts`. That test is run, not edited.
- Display order, the add operation's single target, and every edit command
  are unchanged.

## Changes

`packages/ui-solid/src/cad/extrude-targets.ts`:
- `export const targetSelectionWork = { builds: 0, visits: 0, queries: 0 }`.
- `export function selectTargets(value: unknown): { ids: readonly ElementId[]; has(id: ElementId): boolean }`.
  - It validates like `CadSection.tsx:83-88`: an array filtered to strings.
  - It builds one `Set`, adding `builds += 1` and `visits += length`.
  - `has` increments `queries`.
- `export function orderExtrudeTargets(listed: readonly ElementId[], stored: readonly ElementId[]): ElementId[]`.
  - Same two passes as today: listed ids present in stored, then stored ids
    not in listed, keeping duplicates and order.
  - Uses sets, adding `visits += listed.length + stored.length`.
- `displayedExtrudeTargets` keeps its signature and delegates to
  `orderExtrudeTargets`.

`packages/ui-solid/src/inspector/CadSection.tsx`:
- `const selection = createMemo(() => selectTargets(semantic().bodies))`, and
  `targets = () => selection().ids`.
- `const listedIds = createMemo(() => earlierBodies().map((b) => b.id))`.
- `orderedTargets` becomes a `createMemo` that keeps the
  `cad.extrude`/`new` guard, then returns
  `orderExtrudeTargets(listedIds(), targets())`.
- Rows use `selection().has(body.id)` for both `checked` and the click
  guard.

Pitfalls:
- Keep stored IDs that are not listed: they are appended in stored order,
  as today.
- Do not call `earlierExtrudeBodies` again inside `orderedTargets`.

## Tests

`packages/ui-solid/src/cad/extrude-targets.test.ts`:
- The existing order assertions stay.
- `selectTargets` at N = 500 and 1000: `builds === 1`, `visits === N`, and N
  `has` calls give `queries === N`.
- `orderExtrudeTargets` visits equal `listed.length + stored.length` and
  exactly double at 2N.
- Exact order for selected, unselected and missing IDs.

`packages/ui-solid/src/test-dom/cad-inspector.dom.tsx`, launched by the
existing test in `packages/ui-solid/src/inspector/cad-edits.test.ts:132-147`:
- Mount a cut targeting N = 16 earlier bodies, and separately one targeting
  2N = 32.
- For each: reset `targetSelectionWork`, uncheck one body through the real
  checkbox, then assert `builds === 1` and `queries > 0`.
- Across sizes: `queries(2N) === 2 * queries(N)`.
- The stored `bodies` order after the change is the expected list.
- In an `add` extrude, checking another body replaces the single target.
- Keep the file's `ok light` and `ok dark` output and every existing
  assertion. Imitate its existing `Target bodies` checks (`:180-290`).

## Verification (each command exits 0 and runs tests)

1. `bunx biome check packages/ui-solid/src/cad/extrude-targets.ts packages/ui-solid/src/cad/extrude-targets.test.ts packages/ui-solid/src/inspector/CadSection.tsx packages/ui-solid/src/test-dom/cad-inspector.dom.tsx`
2. `bun test packages/ui-solid/src/cad/extrude-targets.test.ts packages/ui-solid/src/inspector/cad-edits.test.ts`
   - The output contains `ok light` and `ok dark`, and the new counter
     assertions pass.
   - Also save a fail-before log
     (`tmp/car12-r12/car12-p5-inspector-targets/fail-before.log`).

## Done criteria

- Commands 1-2 exit 0.
- `git diff --name-only` stays inside writePaths, and the progress log
  reads `done`.

Implementation phase: complete; focused verification and progress evidence are recorded in `impl-plans/progress/car12-p5-inspector-targets.md`. Formal review and integration gates remain downstream.

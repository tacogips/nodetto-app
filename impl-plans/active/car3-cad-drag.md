# car3-cad-drag

- planId: car3-cad-drag
- planPath: impl-plans/active/car3-cad-drag.md
- progressPath: impl-plans/progress/car3-cad-drag.md
- wave: 1; dependsOn: none
- Finding: function-cad-drag-multitarget-cut-to-add (R3-3, high); reopens
  maintainability-cad-add-targets (F14) on the viewport path.
- Design: `design-docs/specs/design-cad3d.md` section 20 R3-3 (and section 19 F14).
- writePaths: `packages/ui-solid/src/cad/extrude-targets.ts` (new),
  `packages/ui-solid/src/cad/extrude-targets.test.ts` (new),
  `packages/ui-solid/src/cad/extrude-authoring.ts`,
  `packages/ui-solid/src/inspector/CadSection.tsx`,
  `packages/ui-solid/src/inspector/cad-edits.ts`,
  `packages/ui-solid/src/inspector/cad-edits.test.ts`,
  `packages/ui-solid/src/test-dom/cad-sketch.dom.tsx`,
  `packages/ui-solid/src/test-dom/cad-inspector.dom.tsx`,
  `packages/ui-solid/src/cad/viewport.test.tsx`,
  `tmp/car3-r3/car3-cad-drag`, `impl-plans/progress/car3-cad-drag.md`, `target`,
  `tmp/cad3d`
- sharedPaths: none; artifactRoots: `target`, `tmp/cad3d`

Follow the worker rules in `impl-plans/active/car3-00-overview.md`.

## Intent and context

An Add has exactly one target (`packages/core/src/cad/history.ts:262-267` fails
`cad.body.reference` otherwise). The inspector already trims to one target in display
order (`cad-edits.ts:116-133` `setCadOperation`, `CadSection.tsx:87-110`
`earlierBodies`/`orderedTargets`). The viewport drag commit
(`extrude-authoring.ts:387-400`) replaces only `distance` and `op`, so an outward drag
on a two-target Cut stores an Add with two targets.

Non-goals: no change to drag preview, `positiveOp` derivation, inward drag behaviour,
history batching, `packages/core` or `packages/ir`.

## Changes

New `packages/ui-solid/src/cad/extrude-targets.ts` (pure, no Solid imports). It lives
in `cad/` because `inspector/` already imports from `cad/` (`CadSection.tsx:18-19`),
never the reverse:

- `earlierExtrudeBodies(pageElements: readonly Element[], element: Element): Element[]`
  - exactly today's `CadSection.tsx:87-102` filter and `compareCadHistoryOrder` sort
  (`cad.mesh`, or `cad.extrude` with `op === "new"`, before `element`).
- `displayedExtrudeTargets(pageElements, element, stored: readonly ElementId[]): ElementId[]`
  - listed stored ids in list order, then unlisted stored ids in stored order
  (today's `orderedTargets`).
- `targetsForOperation(op: string, displayed: readonly ElementId[]): ElementId[]` -
  `new` -> `[]`; `add` -> first distinct id (or `[]`); `cut`/`intersect` -> distinct
  ids in given order (today's rule in `setCadOperation`).

`cad-edits.ts` `setCadOperation`: compute targets with `targetsForOperation`; behaviour
and return values unchanged.

`CadSection.tsx`: `earlierBodies` memo body calls `earlierExtrudeBodies`
(keep `signals.rev()` and the `type`/`operation` guards); `orderedTargets` calls
`displayedExtrudeTargets`. No visible change.

`extrude-authoring.ts` commit (around line 387): after computing `op`, if
`op === "add"`, set
`bodies = targetsForOperation("add", displayedExtrudeTargets(editor.store.getPageElements(pageId), element, storedBodies))`;
otherwise keep `semantic.bodies` exactly as stored (same array, same order). Put
`distance`, `op` and `bodies` in the single existing `updateSemantic`. When the
result is an empty list, omit `bodies` the way `setCadOperation` does.

## Pitfalls

- Display order comes from `editor.store.getPageElements(pageId)`, not
  `geometryElements()` (which may include collected PCB input).
- Do not reorder stored targets for Cut-to-Cut or inward drags.
- Do not issue two commands (one for distance, one for targets): Undo must restore in
  one step.
- `semantic.bodies` may be missing or not an array; treat it as `[]`.

## Tests

- `extrude-targets.test.ts`: detached id after listed ids; duplicates removed; `new`
  -> `[]`; `add` -> first displayed; `cut` keeps display order; earlier-bodies filter
  excludes later features and non-new extrudes.
- `cad-edits.test.ts`: existing F14 cases pass unchanged (run them).
- `test-dom/cad-sketch.dom.tsx` (run by `viewport.test.tsx`), inside the existing
  extrude flow so the `extrude ok <mode>` markers stay: bodies `left` (history
  first) and `right`, face-based Cut with stored `bodies: [right, left]`, distance -2;
  commit an outward drag (no cancel) -> stored op `add`, distance > 0,
  `bodies: [left]`, `scanCadPage` status ok for the feature, undo stack +1; one Undo
  -> op `cut`, distance -2, `bodies: [right, left]`. Run this case on unmodified code
  first and record the failure (two targets, `cad.body.reference`).
- `test-dom/cad-inspector.dom.tsx` (run by `cad-edits.test.ts`): existing F14 inspector
  cases pass unchanged.
- Touch `viewport.test.tsx` only if a new marker is required.

## Verification

1. `bunx biome check --diagnostic-level=warn packages/ui-solid/src/cad/extrude-targets.ts packages/ui-solid/src/cad/extrude-targets.test.ts packages/ui-solid/src/cad/extrude-authoring.ts packages/ui-solid/src/inspector/CadSection.tsx packages/ui-solid/src/inspector/cad-edits.ts packages/ui-solid/src/test-dom/cad-sketch.dom.tsx && bun test packages/ui-solid/src/cad/extrude-targets.test.ts packages/ui-solid/src/inspector/cad-edits.test.ts packages/ui-solid/src/cad/viewport.test.tsx`
   -> biome clean; all tests pass, including the new drag case and the unchanged F14
   cases.
2. `bun test packages/ui-solid/src/cad/strict-index.test.ts` -> zero strict-index
   diagnostics (round-1 F3 guard; the new module is under `cad/`).

## Done criteria

- [x] New drag DOM case fails on the pre-fix source (recorded) and passes after.
- [x] Both verification commands exit 0; progress log records hashes and log paths.
- Formal review and integration gates remain downstream.

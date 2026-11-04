# clm-12-bpmn-layered

- planId: clm-12-bpmn-layered
- planPath: impl-plans/active/clm-12-bpmn-layered.md
- progressPath: impl-plans/progress/clm-12-bpmn-layered.md
- wave: 1
- dependsOn: none
- Design: `design-docs/specs/design-cli-layout-merge-lint.md`, E2 table and
  "E2.1 Layered on BPMN pages", contract `planLayeredBpmn` in "Continuation
  contracts", Verification row "E2" (BPMN layered part). Owner question Q8
  (default implemented).
- writePaths:
  - `packages/core/src/arrange-layered-bpmn.ts` (new)
  - `packages/core/src/arrange-layered-bpmn.test.ts` (new)
  - `impl-plans/progress/clm-12-bpmn-layered.md`
  - `tmp/clm-s731/clm-12-bpmn-layered`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

A pure planner that lays out a BPMN page: pools and lanes are rows (lane
order unchanged), BFS depth gives global columns shared by every pool, units
in one (row, column) cell stack vertically. It returns two command lists
that the caller applies in order with `Editor.apply`, because
`planBpmnTranslations` (`packages/core/src/bpmn/containment.ts`) carries
every descendant whose position a command did not change. clm-09 adds the
dispatch from `apps/cli/src/arrange-modes.ts`; this plan does not touch it.

Patterns to imitate:
- `packages/core/src/arrange-layered.ts:planLayered` (stable id order,
  `compare`, traversal, `placed` set, integer rounding, `{ error }` result).
- `packages/core/src/bpmn/model.ts:buildBpmnModel` (`parentOf`,
  `descendantsOf`, `order`) for containment and lane order.
- `packages/core/src/bpmn/containment.ts:planBpmnLaneLayout` for lane geometry
  (`x = pool.x + 30`, `width = pool.width - 30`, lanes stacked from pool.y,
  minimum height 30, default height 120).

## Contract (binding)

```ts
export function planLayeredBpmn(
  store: Store, pageId: PageId, registry: ShapeUtilRegistry,
): {
  containerCommands: Command[]; // applied first
  unitCommands: Command[];      // applied second
  placed: ReadonlySet<ElementId>;
} | { error: string };
```

## Rules (implement exactly)

1. Page must be `kind: "bpmn"`, else `{ error }`. A page with no units ->
   `{ containerCommands: [], unitCommands: [], placed: empty }`.
2. Row groups: each `bpmn.participant` with `semantic.collapsed !== true`, in
   ascending `visual.y`, ties by id. Rows of a pool = its leaf lanes
   (`bpmn.lane` with no child lane) in model order (depth-first through
   nested lanes following `model.order`); a pool without lanes is one row.
   Collapsed pools keep their height, get the common width, and are stacked
   in the same y order. Units in no pool form one free row placed after all
   pools.
3. Units: `bpmn.task`, `bpmn.event` (not `bpmn.boundaryEvent`),
   `bpmn.gateway`, `bpmn.callActivity`, `bpmn.subProcess`, `bpmn.dataObject`,
   `bpmn.dataStore`, `bpmn.textAnnotation`, excluding any element that has a
   `bpmn.subProcess` ancestor (it moves with that sub-process).
   `bpmn.group` and boundary events are never units. A unit's row is its
   nearest lane ancestor, else its pool, else the free row.
4. Edges: every BPMN connector (`bpmn.sequenceFlow`, `bpmn.messageFlow`,
   `bpmn.association`, `bpmn.dataAssociation`) whose two ends map to units; an
   end inside a sub-process maps to the outermost sub-process ancestor; a
   boundary event end maps to its `attachedTo` host. Self-loops ignored.
   Edges read in id order.
5. Traversal: the A1 traversal of `planLayered` with this first start: the
   first `bpmn.event` with `semantic.position === "start"` in id order (this
   is the design's "bpmn.startEvent"), else first in-degree-0 unit, else first
   unit. Layer = BFS depth from the start of its search (each restart starts
   at depth 0). Visit index orders units inside a cell.
6. Geometry (constants: `COLUMN_GAP = 120`, `MEMBER_GAP = 60`,
   `FRAME_PADDING = 40`, `POOL_LABEL = 30`, `POOL_GAP = 120`,
   `MIN_ROW = 120`):
   - Origin: integer-rounded top-left of the union of pool boxes and unit
     boxes (`context.boundsOf`).
   - Column widths: widest unit per layer across all rows. Column L's left
     edge = `origin.x + POOL_LABEL + FRAME_PADDING + sum(widths of layers < L) + L * COLUMN_GAP`.
     Units centred in their column.
   - Row height = `max(MIN_ROW, tallest cell stack + 2 * FRAME_PADDING)`, cell
     stack = sum heights + (n-1) * MEMBER_GAP; units stacked from
     `row.y + FRAME_PADDING`, then centred if the cell is shorter than the
     tallest (centre the cell stack vertically in the row).
   - Pool width (all pools, collapsed included) =
     `POOL_LABEL + FRAME_PADDING + sum(column widths) + (L - 1) * COLUMN_GAP + FRAME_PADDING`.
     Pool height = sum of its row heights. Pools stacked from origin.y with
     `POOL_GAP`; the free row follows after the last pool.
   - All written numbers rounded to integers.
7. `containerCommands`: `updateVisual` for each pool box (`x, y, width,
   height`) and each leaf lane `height` that differs. Do not write lane x/y/
   width: `planBpmnLaneLayout` restacks lanes from the pool box.
8. `unitCommands`: absolute `updateVisual {x, y}` for every unit whose
   planned position differs from its position after the container step
   (compute "after container step" by applying `containerCommands` to a
   draft `Editor`/`Store` with the derived planners, i.e. through
   `Editor.apply` on a copy, then diff). Sub-process contents are not written;
   `planBpmnTranslations` carries them when the sub-process moves.
9. `placed` = every unit id plus every element carried with a sub-process.
10. Idempotent: running on the result of applying both lists returns two empty
    lists.

## Pitfalls

- Applying only one combined list would let `planBpmnTranslations` carry
  units that keep their coordinates; the two-step contract exists to prevent
  that. Tests must apply both lists in order through `Editor.apply`.
- Lane order never changes. Never write `semantic.parent`; units end inside
  their own row, so `planBpmnMembership` keeps parents (assert it).
- Use indexed loops, `noUncheckedIndexedAccess`-safe access, and no per-point
  destructuring in loops.
- Do not import or edit `arrange-modes.ts`, `notation.ts`,
  `bpmn/containment.ts` or `editor/transaction.ts` (read-only here).

## Tests (`packages/core/src/arrange-layered-bpmn.test.ts`, direct import)

Build documents with neutral names (pool `Orders`, lanes `Intake`,
`Shipping`, tasks `Check order`, `Pack widgets`, start/end events, a
gateway). Apply `containerCommands` then `unitCommands` with `Editor.apply`
and inspect the store.
- One pool, two lanes, start -> task -> gateway -> two tasks (one per lane) ->
  end -> layers 0..4 left to right; gateway branches share a column; each
  task lies inside its lane box; lanes stay inside the pool, stacked without
  gaps (lane.y = previous lane.y + height, lane.x = pool.x + 30).
- Parents unchanged after apply (`semantic.parent` equal to before).
- Two pools with a message flow -> both pools same width; columns aligned
  (message-flow ends share a column x when they are at the same depth).
- Collapsed pool -> keeps height, gets common width.
- Unit in no pool -> placed in the free row below all pools.
- Sub-process with two inner tasks -> inner tasks keep their offset relative
  to the sub-process.
- Boundary event on a task -> still on the host boundary after apply.
- Rerun on the result -> both lists empty.
- Shuffled element creation order -> identical result.
- Non-BPMN page -> `{ error }`.
- `validateDocument(editor.getSnapshot())` has no errors after apply.

## Working rules

- Fresh read before editing; record pre/post hashes in the progress log; edit
  only writePaths; logs under `tmp/clm-s731/clm-12-bpmn-layered/`.
- Time the planner on a page with 3 pools, 6 lanes and 60 units in Bun and
  record it in the progress log (native timing runs in clm-09).

## Verification (each must exit 0)

1. `bun test packages/core/src/arrange-layered-bpmn.test.ts` -> 0 fail, at
   least 10 tests.
2. `bun test packages/core/src/bpmn/containment.test.ts packages/core/src/bpmn/editor-bpmn.test.ts` -> unchanged, 0 fail.
3. `bun run typecheck`.
4. `bunx biome check packages/core/src/arrange-layered-bpmn.ts packages/core/src/arrange-layered-bpmn.test.ts`.
5. `grep -n "export function planLayeredBpmn" packages/core/src/arrange-layered-bpmn.ts`.

## Done criteria

- Contract symbol exists; verification 1-5 exit 0 with logs; progress log
  has the Bun timing and hashes; only writePaths changed by this plan.

# clm-12-bpmn-layered

## Continuation 2 2026-11-05 (clm-s732) - authoritative

Status at HEAD `29f8691135fb6098a9496495f4a417e93ce0625e`:
`arrange-layered-bpmn.ts` (262 lines) and 10 tests are committed. The free-row
rule (amendment below) is not implemented, and the listed regressions are missing.
Fix the existing planner; do not rewrite it. Replace `tmp/clm-s731` with
`tmp/clm-s732` in every path below. Manifest:
`impl-plans/active/clm-s732-dispatch.json`. wave: 1; dependsOn: none.

### Remaining changes in `packages/core/src/arrange-layered-bpmn.ts`

1. Free row, per design E2.1 and the amendment below:
   - No `FRAME_PADDING` and no `MIN_ROW`: its height is its tallest cell stack.
     Stacks start at the row top and shorter cells are centred within that
     height.
   - With pools: shared column x positions; top = `POOL_GAP` below the last
     pool's bottom. At HEAD `free.y` already uses that y, but
     `(row.height - stack) / 2` and `height + 80` still apply padding.
   - Without pools: column 0's left edge is `origin.x` (HEAD uses
     `originX + 70` for every row) and the top is `origin.y`.
2. Row lookup. At HEAD, `rows.find((r) => r.id === (lane?.id ?? pool?.id)) ?? free`
   sends a unit to the free row, outside its pool, in two cases. Fix both:
   - A unit directly under a non-leaf lane -> the first leaf lane under that lane
     in model order.
   - A unit directly under a pool that has lanes -> the pool's first row.
   In the second case `planBpmnMembership` may then set the lane as its parent;
   this is the only allowed parent change. Record it in the progress log.
3. Collapsed pools: a unit inside a collapsed pool is not a unit. It is carried
   with the pool and never goes to the free row. Add it to `placed`.
4. Any further fix that a regression below reveals, inside this file only.

These three cases resolve what the design leaves unstated, and they keep its
"Units end inside their own row". They do not change design geometry.

### Non-goals

- No `--frames`/TB handling and no dispatch; clm-09 owns both.
- Do not edit `bpmn/containment.ts`, `bpmn/model.ts`, `editor/transaction.ts` or
  `arrange-modes.ts`. If a regression needs a change in one of them, stop and record
  an amendment request.

### Tests to add (input -> expected)

Keep the 10 existing tests. Add, applying `containerCommands` then `unitCommands`
through `Editor.apply`:

- Free-only page, one task at (0,0) -> no commands, task stays at (0,0).
- Free-only page, start event -> task chain -> column 0 at origin.x, top at
  origin.y, rerun returns two empty lists.
- Free row with one pool -> free units `POOL_GAP` below the pool and aligned to the
  pool's column x values; rerun returns empty lists.
- Nested lanes: pool > lane > two leaf lanes -> rows are the leaf lanes, heights
  stack without gaps, each lane inside its parent, and the parent lane height
  equals the sum of its children; rerun empty.
- Unit directly under a non-leaf lane, and directly under a pool with lanes -> inside
  the first leaf row, never in the free row.
- Collapsed pool -> keeps height, gets the common width, is stacked in y order; a
  unit inside it keeps its offset from the pool.
- Two pools with a message flow -> equal widths; the flow's ends at the same depth
  share a column x.
- Expanded sub-process with two inner tasks -> inner offsets from the sub-process
  are unchanged; a connector end inside it maps to the sub-process.
- Boundary event on a task -> still on the host boundary after apply; an edge from
  it maps to the host.
- Shuffled creation order on a two-pool page -> identical commands.
- `validateDocument(editor.getSnapshot())` has no errors after each case above.

### Pitfalls

- Applying one combined list lets `planBpmnTranslations` carry units twice.
- `planBpmnLaneLayout` skips a lane whose parent box changed and otherwise adds the
  height delta to the parent, so a container step that changes only a nested lane's
  height changes its ancestors' heights too. Rerun tests catch a mismatch.
- `Editor.apply` is being edited by clm-02 in the same wave. A failure caused by
  its in-progress edit is drift: record it, wait, rerun. Do not edit its files.

### Done criteria (mechanical)

- Manifest verification commands exit 0, with at least 20 tests in the file.
- The progress log has the Bun timing for 3 pools, 6 lanes, 60 units and pre/post
  hashes. `git status --short` shows only this plan's writePaths changed by it.

---

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

## Amendment 2026-11-04 (integration-paths-outside-writePaths, round 1)

- Finding IR-CLM12-FREEROW: on a page with no pools, rule 6 offsets free-row
  units by `POOL_LABEL + FRAME_PADDING` (x) and `FRAME_PADDING` (y) from an
  origin derived from those same units, so every rerun moves them
  (`tmp/clm-s731/clm-12-bpmn-layered/free-row-redispatch.log`: x = 70, 140,
  210).
- Decision (design E2.1, new "Free row" bullet): the free row has no box, so
  it gets no label band and no padding.
  - With pools: free-row units use the shared column x positions (the same
    left edges as the pool columns), and the row top is `POOL_GAP` below the
    last pool's bottom. Units stack from the row top, with no
    `FRAME_PADDING`.
  - Without pools: column 0's left edge is `origin.x` (no `POOL_LABEL` or
    `FRAME_PADDING`), later columns follow with `COLUMN_GAP`, and the row top
    is `origin.y`.
  - Rule 6 is unchanged for pool rows.
- writePaths are unchanged. The fix is in `packages/core/src/arrange-layered-bpmn.ts`.
- Tests the worker must add, all from the plan's "Tests" list:
  - Free-only page with one task at (0,0): the first run gives no commands
    and the task stays at (0,0).
  - Free-only page with a start event -> task chain: the second run returns
    two empty lists.
  - Free row alongside one pool: free units sit `POOL_GAP` below the pool and
    are aligned to the pool columns, and a rerun gives empty lists.
  - Also add every edge case listed in "Tests" that is still missing: nested
    lanes, collapsed pool, two pools with a message flow, sub-process
    contents, boundary event, shuffled creation order, validateDocument clean.
- Done when verification 1-5 exit 0 and those tests exist.

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

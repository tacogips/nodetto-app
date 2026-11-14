# clm-10-layered-fixes

- planId: clm-10-layered-fixes
- planPath: impl-plans/active/clm-10-layered-fixes.md
- progressPath: impl-plans/progress/clm-10-layered-fixes.md
- wave: 1
- dependsOn: none (clm-07-layered-core is landed at HEAD 4d82d91)
- Design: `design-docs/specs/design-cli-layout-merge-lint.md`, sections
  "Eligible pages" (revised by E2), A1 "Frame order" (Integration fix 2), A1
  "Geometry" (Integration fix 1), the E2 table row for `erd`, and the
  Verification rows "Fix 1 and 2" and "E2" (ERD layered with frames).
- writePaths:
  - `packages/core/src/arrange-layered.ts`
  - `packages/core/src/arrange-layered.test.ts`
  - `impl-plans/progress/clm-10-layered-fixes.md`
  - `tmp/clm-s731/clm-10-layered-fixes`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

`packages/core/src/arrange-layered.ts:planLayered` (landed by clm-07) has two
integration defects, and ERD pages must become eligible for layered mode:

1. TB direction transposes the frame title band onto the x axis. The frame
   renderer always draws the title at the top, so in TB the band must be
   added to the row height and to member y, never to the width or member x.
2. The frame-order comparator calls `explicit.indexOf` and
   `ranked.findIndex((u) => owner(u.id) === ...)` per comparison, and the
   per-column `members` filter calls `owner()` for every unit per column.
   Precompute once.
3. Add `"erd"` to `LAYERED_PAGE_KINDS`. ERD units are `erd.table` and the
   database object types; they are ordinary non-edge elements, so the existing
   unit selection already accepts them. Edges are `erd.relation` (from -> to
   by `endpointReaderFor`).

## Non-goals

- No change to LR output, to the A1 traversal, the origin rule or any other
  file. Do not edit `packages/core/src/shapes/frame.ts` (read
  `FRAME_TITLE_BAND` only), `arrange-modes.ts` (clm-06) or
  `arrange-layered-bpmn.ts` (clm-12).
- Do not add `bpmn` here; BPMN layered is a separate planner (clm-12).

## File-level changes

`packages/core/src/arrange-layered.ts`:

- `LAYERED_PAGE_KINDS`: append `"erd"` (keep the existing order, then `erd`).
- Before sorting frames, build once:
  - `ownerOf: Map<ElementId, ElementId | undefined>` for every ranked unit
    (the existing `owner()` walk, executed once per unit);
  - `firstRank: Map<ElementId, number>`: for each frame, the smallest index in
    `ranked` of a unit whose owner is that frame;
  - `explicitIndex: Map<ElementId, number>` from `options.frameOrder`.
  The comparator reads only these maps. Ordering result must equal today's:
  explicit frames first in given order, then by first member rank
  (missing = +infinity), ties by `compare(a.id, b.id)`.
- Per column, members are taken from a `Map<frameId | undefined, Element[]>`
  filled once in `ranked` order (same order as today's filter).
- TB geometry (LR unchanged):
  - `width = round(stack + (frame ? 80 : 0))`
  - `height = round(cross + (frame ? 80 + title : 0))`
  - stacking offset starts at `frame ? 40 : 0` (along x)
  - member `ny = round(y + (frame ? title + 40 : 0) + (cross - box.height) / 2)`
    for framed rows; for the free row (no frame) keep `round(y + (height - box.height) / 2)`.
  - Use the existing `FRAME_TITLE_BAND` and `showTitle !== false` rule for
    `title`; never hard-code 24.
- Keep indexed loops; `noUncheckedIndexedAccess`-safe map reads (`?? default`).

## Pitfalls

- The LR branch must stay byte-identical: existing LR tests in
  `arrange-layered.test.ts` must pass unmodified. If an existing TB test
  asserted the old (buggy) geometry, change only that assertion and record it
  in the progress log with before/after values.
- `Math.min(...)` over boxes is unchanged; do not refactor unrelated code.
- `firstRank` must use the index in `ranked` (visit order), not unit id order.

## Tests (add to `packages/core/src/arrange-layered.test.ts`)

- TB, one frame with `showTitle` default, members `Idle` (w 120, h 60) and
  `Running` (w 120, h 40) -> frame height = `max(member h) + 80 + FRAME_TITLE_BAND`,
  frame width = `120 + 120 + 60 + 80`; each member's y equals
  `frame.y + FRAME_TITLE_BAND + 40 + (60 - h) / 2` (rounded); first member x =
  `frame.x + 40`.
- Same with `semantic.showTitle: false` -> no band in height or y.
- LR exact-geometry test from clm-07 still passes unchanged (band in height,
  first member at `y + 40 + band`).
- Frame order: three frames whose first member ranks are 2, 0, 1 -> order by
  rank; with `frameOrder: [c]` -> c first then by rank; a frame without
  members last. Results equal the pre-change ordering on the same fixtures.
- ERD page (`kind: "erd"`) with frames `Stage0`, `Stage1`, tables `orders`,
  `order_items`, `widgets` and `erd.relation` edges -> `planLayered` returns
  commands (not `{ error }`), tables end inside their frames, rerun on the
  result -> no commands.
- ERD page without frames -> `{ error }` with the "needs frames" message.
- `LAYERED_PAGE_KINDS` includes `"erd"` and not `"bpmn"`.

## Working rules

- Read each file fresh before editing; record `git hash-object` before and
  after each edited file in the progress log.
- Edit only writePaths. No git commands that change state, no worktrees, no
  broad formatters. Evidence logs (.log/.txt/.json only) under
  `tmp/clm-s731/clm-10-layered-fixes/`.

## Verification (each must exit 0)

1. `bun test packages/core/src/arrange-layered.test.ts` -> all pass, more than
   13 tests (clm-07 had 13), 0 fail.
2. `bun run typecheck` -> exit 0.
3. `bunx biome check packages/core/src/arrange-layered.ts packages/core/src/arrange-layered.test.ts`.
4. `grep -n '"erd"' packages/core/src/arrange-layered.ts` -> matches.
5. `sh -c '! grep -n "findIndex" packages/core/src/arrange-layered.ts'` -> no
   `findIndex` left in the file.

## Done criteria

- Verification 1-5 exit 0 with logs in the evidence directory.
- Progress log lists the TB geometry before/after, any changed assertion, and
  file hashes.
- `git status --short` shows only this plan's writePaths changed by this plan.

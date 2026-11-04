# clm-11-container-carry

- planId: clm-11-container-carry
- planPath: impl-plans/active/clm-11-container-carry.md
- progressPath: impl-plans/progress/clm-11-container-carry.md
- wave: 2
- dependsOn: clm-02-connector-edit-perf (the `ApplyOptions.keepMembers`
  engine option and the planner `keep`/`reparent` parameters). It runs after
  wave 1, so `apps/cli/src/edit/operations/elements.ts` (edited by clm-13 in
  wave 1) is already in its final wave-1 form.
- Design: `design-docs/specs/design-cli-layout-merge-lint.md`, E1 (table,
  error texts, mechanics), A6 (frame default kept), contracts (clm-11 block),
  Verification row E1. Owner question Q7 (default implemented).
- writePaths:
  - `apps/cli/src/edit/carry-members.ts` (new)
  - `apps/cli/src/edit/carry-members.test.ts` (new)
  - `apps/cli/src/edit/operations/elements.ts`
  - `apps/cli/src/edit-frame-carry.test.ts`
  - `impl-plans/progress/clm-11-container-carry.md`
  - `tmp/clm-s731/clm-11-container-carry`
  - `target`
- sharedPaths: none
- sharedPathNotes:
  - `apps/cli/src/edit/operations/elements.ts`: replace only the A6
    `carryMembers` block inside `updateOne` (introduced by clm-13) with a call
    to `heldMembers`; pass `{ keepMembers }` instead of `{ placed }`. No other
    edit in this file.
- artifactRoots: `target`

## Intent and context

`carryMembers:false` on `update` must keep members at their absolute
positions for every carrying container kind, on move and on resize. Today
(A6, clm-04) only frames are accepted, and only via `placed`, which does not
stop `planConstraints`, BPMN or breadboard carry. clm-02 adds the engine
option `ApplyOptions.keepMembers` honored by `planFrameTranslations`,
`planConstraints`, `planBpmnTranslations`, `planBreadboardTranslations` and
(as re-parent set) `planBpmnMembership`.

Code to imitate: the current A6 block in
`apps/cli/src/edit/operations/elements.ts` (frame descendants through
`frameParents`, transitive walk), `packages/core/src/bpmn/model.ts:buildBpmnModel`
(`descendantsOf`), `OperationError` usage in `apps/cli/src/edit/operation-input.ts`.

## Contract (binding)

```ts
export const CARRY_CONTAINER_TYPES: readonly string[];
// ["frame", "bpmn.participant", "bpmn.lane", "bpmn.subProcess", "breadboard.board"]
export function heldMembers(editor: Editor, element: Element, visual: unknown, index: number): ReadonlySet<ElementId>;
// throws OperationError with the E1 messages
```

## Rules (implement exactly; messages are fixed strings)

- Called only when `carryMembers === false` (boolean validation stays as in
  A6: `"carryMembers" must be true or false`). `carryMembers: true` or absent
  -> today's behavior (no option passed).
- `group` -> `carryMembers does not apply to a group: a group has no box of its own; move its members, or ungroup it.`
- Type not in `CARRY_CONTAINER_TYPES` and not `group` ->
  `carryMembers applies only to frame, bpmn.participant, bpmn.lane, bpmn.subProcess and breadboard.board; <type> does not move other elements.`
- `frame` with a truthy `semantic.layout` ->
  `carryMembers:false cannot be used on frame "<name>": it lays out its members ("layout"); remove "layout" first.`
  (`<name>` = `semantic.name`, else the short id.)
- `bpmn.lane`: if `visual` (the op's `visual` object) sets `x`, `y` or
  `width` to a value different from the lane's current value ->
  `carryMembers:false on lane "<name>": a lane's x, y and width follow its pool; change the pool, or change only "height".`
- Held set, computed from the state before the update:
  - frame: transitive descendants from `frameParents` (today's A6 walk).
  - `bpmn.participant`, `bpmn.lane`, `bpmn.subProcess`:
    `buildBpmnModel(snapshot, page).descendantsOf(id)` minus every
    `bpmn.lane`.
  - `breadboard.board`: every other element on the board's page.
- The update handler applies `editor.apply(commands, { keepMembers })`.
- With `where` (clm-13), `updateOne` runs per match, so the set is computed
  per element.

## Pitfalls

- Do not reintroduce `placed` for frames: `keepMembers` also covers
  `planConstraints` on resize, which `placed` did not.
- Lanes are never in the held set (they are pool bands and must follow the
  pool through `planBpmnLaneLayout`).
- Members placed by earlier operations of the same batch must keep those
  positions (the held set is read from the current store, which already
  contains them).
- Do not edit core files; if `keepMembers` behaves wrongly, record a finding
  against clm-02 in the progress log and stop that item.

## Tests

`apps/cli/src/edit/carry-members.test.ts` (direct import with an `Editor`),
and `apps/cli/src/edit-frame-carry.test.ts` (through `runCli edit`), neutral
names (`Orders` pool, `Intake`/`Shipping` lanes, `Check order` task,
`Stage0` frame, `widgets`):
- frame move `carryMembers:false` -> members unchanged, frame moved; default
  move -> members carried (existing test kept).
- frame resize from top-left (x, y, width change) with a child that has
  `visual.constraints` -> child unchanged with `false`; moved by default.
- frame with explicit `memberIds` -> members unchanged, `memberIds` unchanged.
- frame with `semantic.layout` -> exit 2 with the layout message.
- pool move `false` -> lanes follow pool (lane.x = pool.x + 30), tasks keep
  absolute x/y, tasks now outside their lane are re-parented (to the
  geometric container or none); `validateDocument` has no errors.
- pool resize `false` -> lanes restacked inside the pool, tasks unchanged.
- lane `height` change `false` -> lane members unchanged; a sibling lane below
  moves down and its own members move with it.
- lane `x` change `false` -> exit 2 with the lane message.
- expanded sub-process move `false` -> inner tasks unchanged and re-parented.
- breadboard board move `false` -> plugged parts unchanged.
- group `false` -> group message; `node.generic` `false` -> generic message.
- batch: a task moved by op 0, then pool moved with `false` by op 1 -> the
  task keeps the op-0 position.
- each case: nothing written when the op fails.

## Working rules

- Fresh read before each edit; record pre/post hashes in the progress log;
  edit only writePaths; logs under `tmp/clm-s731/clm-11-container-carry/`.

## Verification (each must exit 0)

1. `bun test apps/cli/src/edit/carry-members.test.ts apps/cli/src/edit-frame-carry.test.ts apps/cli/src/edit/operation-fields.test.ts apps/cli/src/edit/selectors.test.ts` -> 0 fail.
2. `bun test packages/core/src/keep-members.test.ts packages/core/src/bpmn/containment.test.ts` -> 0 fail.
3. `bun run typecheck`.
4. `bunx biome check apps/cli/src/edit/carry-members.ts apps/cli/src/edit/carry-members.test.ts apps/cli/src/edit/operations/elements.ts apps/cli/src/edit-frame-carry.test.ts`.
5. `grep -n "keepMembers" apps/cli/src/edit/operations/elements.ts` matches and
   `sh -c '! grep -n "carryMembers applies only to frames" apps/cli/src/edit/operations/elements.ts'`.

## Done criteria

- Verification 1-5 exit 0 with logs; one test per kind in the E1 table is
  present; only writePaths changed by this plan.

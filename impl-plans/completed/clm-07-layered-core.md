# clm-07-layered-core

- planId: clm-07-layered-core
- planPath: impl-plans/active/clm-07-layered-core.md
- progressPath: impl-plans/progress/clm-07-layered-core.md
- wave: 1
- dependsOn: none
- Design: `design-docs/specs/design-cli-layout-merge-lint.md`, sections
  "Eligible pages" and A1, and the A1 row of "Verification".
- writePaths:
  - `packages/core/src/arrange-layered.ts` (new)
  - `packages/core/src/arrange-layered.test.ts` (new)
  - `packages/core/src/shapes/frame.ts` (amendment round 1: additive export only)
  - `impl-plans/progress/clm-07-layered-core.md`
  - `tmp/clm-s725/clm-07-layered-core`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Amendment 2026-11-04 (blocked-wave-scope-or-contract, round 1)

- Blocker: the frame title-band height is an inline literal in
  `packages/core/src/shapes/frame.ts:frameShapeUtil.hitTest` (`24` when
  `showTitle !== false`, otherwise `8`). That file was outside writePaths, so
  `arrange-layered.ts:169-172` copied `24`.
- Decision: `packages/core/src/shapes/frame.ts` is added to writePaths for
  one additive change:
  - export `FRAME_TITLE_BAND = 24`;
  - `hitTest` uses the constant instead of its literal `24`. The `8` edge
    margins and every other line stay as they are, so behavior and rendering
    are byte-identical.
- `arrange-layered.ts` imports `FRAME_TITLE_BAND` from `./shapes/frame.ts`
  and removes its copied `24`. Keep the existing rule: no title band when
  `semantic.showTitle === false`.
- No other pending plan writes `shapes/frame.ts`. clm-02 owns
  `frame-translation.ts` and `frame-tree.ts`, which are different files, so
  there is no same-wave write clash.
- Do not edit `packages/core/src/index.ts` (clm-09 owns it). The import is
  internal to core.
- Coverage still owed, listed in Tests below:
  - source (in-degree-0) start without an initial state;
  - cycle-only start;
  - disconnected components;
  - exact TB transposition, comparing LR and TB geometry for the same input;
  - shuffled creation order.
- Verification adds `packages/core/src/frame.test.ts` (existing frame hit
  test coverage must pass unchanged).
- No design change.

## Intent and context

This plan is the pure placement half of `arrange --mode layered`: frames
become columns, members are stacked by traversal rank, and frames are
resized. clm-06 adds the route stage and the CLI module. Imitate
`packages/core/src/arrange.ts:planArrangement`, which returns
`{ commands, placed }` for `editor.apply(commands, { placed })`. Build the
shape context with `createShapeContext(store, registry, 1)`, as
`packages/core/src/auto-layout.ts` does.

## Non-goals

- No connector changes and no CLI.
- Do not edit `arrange.ts`, `arrange-graph.ts` or `packages/core/src/index.ts`.

## Contract (clm-06 depends on it)

```ts
export const LAYERED_PAGE_KINDS: readonly PageKind[]; // state, flowchart, freeform, architecture, uml
export interface LayeredOptions {
  readonly direction: "LR" | "TB";
  readonly frameOrder?: readonly ElementId[]; // already resolved column frame ids
}
export function planLayered(store: Store, pageId: PageId, registry: ShapeUtilRegistry, options: LayeredOptions):
  { commands: Command[]; placed: ReadonlySet<ElementId> } | { error: string };
export function columnFrames(store: Store, pageId: PageId, registry: ShapeUtilRegistry): readonly Element[]; // sorted by id
```

## Rules (design A1, implement exactly)

- Column frames are frames with no frame parent, per `frameParents`.
- Units are top-level layers that are not edges, `resource`, frames or
  group children. A group is one unit. A nested frame is a unit and moves
  with its contents: translate its descendants yourself and add them to
  `placed`. Test that.
- No column frames -> `{ error: "arrange --mode layered needs frames on the page; use --mode tidy" }`.
- A `frameOrder` id that is not a column frame on the page -> an error
  naming it. clm-06 resolves names and prints the candidate list.
- Rank:
  - Edges are category `edge` elements whose two endpoints map to units (an
    endpoint inside a group maps to the group), taken in id order.
    Self-loops are ignored.
  - The start is the first `state.node` with `kind` `initial`, else the
    first unit by id with in-degree 0, else the first unit by id.
  - BFS over outgoing edges, in id order. Restart at the first unvisited
    unit with in-degree 0 among the unvisited, else the first unvisited.
- Frame order: `frameOrder` first, then by smallest member rank, then
  frames without members by id. Units in no frame form a last, boxless
  column.
- Geometry (LR):
  - Origin: the integer-rounded top-left of the union bounds of the column
    frames and units.
  - `COLUMN_GAP 120`, `MEMBER_GAP 60`, `FRAME_PADDING 40`. Members are
    centred on the column axis.
  - Add the frame's title band height at the top when the frame renderer
    draws the name inside the box. Read it from the frame shape util or
    frame layout code; do not invent a constant. Record the source in the
    progress log.
  - TB transposes the layout.
  - Every written number is an integer (`Math.round`).
- Output: move commands as `planArrangement` builds them, plus
  `updateVisual` for the frame `x`, `y`, `width` and `height`. Every moved
  member id goes in `placed`. Omit commands whose values equal the current
  ones, so a rerun plans nothing.

## Pitfalls

- Derive the layout only from ids, sizes and the origin, never from
  current member order or positions. Otherwise a second run changes the
  result.
- Never depend on store `Map` insertion order. Sort by id.
- Use indexed loops and guard every array lookup
  (`noUncheckedIndexedAccess`).

## Tests (input -> expected)

`arrange-layered.test.ts`:
- Initial `Idle` -> `Running` -> `Done` across frames `Stage0` and `Stage1`
  -> Stage0 is the first column, and members are stacked in BFS order.
- No initial state -> the in-degree-0 start. Cycle only -> the smallest id
  starts. Two disconnected components -> the second is ranked after the
  first.
- `frameOrder: [Stage1, Stage0]` -> Stage1 is the first column.
- LR: frame width and height equal the member extents plus padding, and
  after applying, each member's frame parent (`frameParents`) is unchanged.
- TB is the transposition.
- A document built in shuffled creation order with the same ids -> the
  same commands.
- Apply, then plan again -> no commands.
- No frames -> the error. A non-column frame id -> an error.

## Verification (each must exit 0)

1. `bun test packages/core/src/arrange-layered.test.ts packages/core/src/arrange.test.ts packages/core/src/frame.test.ts`.
2. `bun run typecheck`.
3. `bunx biome check packages/core/src/arrange-layered.ts packages/core/src/arrange-layered.test.ts packages/core/src/shapes/frame.ts`.
4. `grep -n "export const FRAME_TITLE_BAND" packages/core/src/shapes/frame.ts`
   matches.
5. `grep -c "? 24" packages/core/src/arrange-layered.ts` prints 0. grep exits
   1 when there are no matches; record that as the expected outcome. Use
   `! grep -q "? 24" packages/core/src/arrange-layered.ts` as the
   exit-0 form.

## Done criteria

- The contract signatures exist exactly as above, and the tests pass.
- `FRAME_TITLE_BAND` is exported from `shapes/frame.ts` and used by both
  `hitTest` and `arrange-layered.ts`. `git diff packages/core/src/shapes/frame.ts`
  shows only the export and the one literal replacement.
- Tests exist for the in-degree-0 start, the cycle-only start, disconnected
  components, exact TB transposition and shuffled creation order.
- Verification 1 to 5 exit 0, with logs under
  `tmp/clm-s725/clm-07-layered-core/`.
- `git status --short` shows only writePaths changed.

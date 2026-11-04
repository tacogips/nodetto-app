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
  - `impl-plans/progress/clm-07-layered-core.md`
  - `tmp/clm-s725/clm-07-layered-core`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

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

1. `bun test packages/core/src/arrange-layered.test.ts packages/core/src/arrange.test.ts`.
2. `bun run typecheck`.
3. `bunx biome check packages/core/src/arrange-layered.ts packages/core/src/arrange-layered.test.ts`.

## Done criteria

- The contract signatures exist exactly as above, and the tests pass.
- Verification 1 to 3 exit 0, with logs under
  `tmp/clm-s725/clm-07-layered-core/`.
- `git status --short` shows only writePaths changed.

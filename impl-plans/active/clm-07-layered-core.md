# clm-07-layered-core

- planId: clm-07-layered-core
- planPath: impl-plans/active/clm-07-layered-core.md
- progressPath: impl-plans/progress/clm-07-layered-core.md
- wave: 1
- dependsOn: none
- Design: `design-docs/specs/design-cli-layout-merge-lint.md`, section A1
  ("Eligible pages", "A1. --mode layered") and the A1 row of "Verification".
- writePaths:
  - `packages/core/src/arrange-layered.ts` (new)
  - `packages/core/src/arrange-layered.test.ts` (new)
  - `impl-plans/progress/clm-07-layered-core.md`
  - `tmp/clm-s725/clm-07-layered-core`
  - `target`
- artifactRoots: `target`

## Intent and context

This plan is the pure placement half of `arrange --mode layered`. Frames
become columns, members are stacked by traversal rank, and frames are
resized. The route stage and the CLI come later: clm-06 adds the route
stage, and clm-09 composes it with this plan's output. Imitate
`packages/core/src/arrange.ts:planArrangement`, which returns
`{ commands, placed }` for `editor.apply(commands, { placed })`.

## Non-goals

- No connector changes and no CLI.
- No edits to `arrange.ts`, `arrange-graph.ts` or `packages/core/src/index.ts`.

## Contract (clm-09 depends on it)

```ts
export const LAYERED_PAGE_KINDS: readonly PageKind[]; // state, flowchart, freeform, architecture, uml
export interface LayeredOptions { readonly direction?: "LR" | "TB"; readonly frames?: readonly string[] /* resolved full frame ids */ }
export type LayeredPlan =
  | { readonly ok: true; readonly commands: readonly Command[]; readonly placed: ReadonlySet<ElementId> }
  | { readonly ok: false; readonly message: string };
export function planLayeredArrangement(store: Store, pageId: string, context: ShapeContext, options: LayeredOptions): LayeredPlan;
export function columnFrames(store: Store, pageId: string, context: ShapeContext): readonly Element[]; // sorted by id; used by clm-09 for --frames resolution
```

## Rules (from design A1, implement exactly)

- Column frames are frames with no frame parent, per `frameParents`
  (`frame-tree.ts`).
- Units are top-level layers that are not edges, `resource`, frames or
  group children. A group is one unit. A nested frame is a unit and moves
  with its contents: put its descendants in `placed` after translating them
  yourself, or let the frame translation carry them; choose one and test
  it.
- A page with no column frames returns `ok:false` with
  `arrange --mode layered needs frames on the page; use --mode tidy`.
- `options.frames` that are not column frames on the page return `ok:false`.
  clm-09 resolves names and prints the candidate list.
- Rank:
  - Edges are category `edge` elements whose two endpoints map to units (an
    endpoint inside a group maps to the group). Take them in id order and
    ignore self-loops.
  - The start is the first `state.node` with `kind` `initial`, else the
    first unit by id with in-degree 0, else the first unit by id.
  - Run BFS over outgoing edges in id order. Restart at the first unvisited
    unit with in-degree 0 among the unvisited, else the first unvisited.
- Frame order: `options.frames` first, then the smallest member rank, then
  frames without members by id. Units in no frame form a free column, last.
- Geometry:
  - Origin: the floor-rounded top-left of the union bounds of column frames
    and units.
  - `COLUMN_GAP 120`, `MEMBER_GAP 60`, `FRAME_PADDING 40`.
  - Add the frame title band at the top when the frame renderer draws the
    name inside the box. Read it from the frame shape util or
    `frame-layout` code; do not invent a constant. Record the source in the
    progress log.
  - Members are centred on the column axis.
  - TB transposes the layout.
  - All written numbers are integers (`Math.round`).
- Output:
  - Use `moveElements`-equivalent commands. Imitate how `planArrangement`
    builds move commands and `placed`.
  - Use `updateVisual` commands for frame `x`, `y`, `width` and `height`.
  - Every member id goes in `placed`.
- Idempotent: planning on the result yields `commands.length === 0`, or only
  no-op values. Omit commands whose values equal the current ones.

## Pitfalls

- Work only from ids and sizes, never from current member order or
  positions, except for the origin. Otherwise a second run changes the
  result.
- Do not depend on `Map` insertion order from the store. Sort by id.
- Use indexed loops and guard every array lookup
  (`noUncheckedIndexedAccess`).

## Tests (input -> expected)

`arrange-layered.test.ts`:
- Initial `Idle` -> `Running` -> `Done` across frames `Stage0` and
  `Stage1` -> frames ordered Stage0 then Stage1, and members stacked in BFS
  order.
- A page with no initial state -> the in-degree-0 start is used.
- A cycle-only graph -> the smallest id starts.
- Two disconnected components -> the second is ranked after the first.
- `frames: [Stage1, Stage0]` -> Stage1 is the first column.
- LR geometry: frame width and height equal the member extents plus
  padding, and members sit inside their frame's bounds (check with
  `frameParents` after applying).
- TB geometry is transposed.
- Determinism: the same commands for a document built in shuffled creation
  order with the same ids.
- Idempotent: applying, then planning again -> no changes.
- No frames -> `ok:false` with the message.
- A frame id that is not a column frame -> `ok:false`.

## Verification (each must exit 0)

1. `bun test packages/core/src/arrange-layered.test.ts packages/core/src/arrange.test.ts packages/core/src/arrange-graph.test.ts`.
2. `bun run typecheck`.
3. `bunx biome check packages/core/src/arrange-layered.ts packages/core/src/arrange-layered.test.ts`.

## Done criteria

- The contract signatures exist exactly as above. The tests listed pass.
- `git diff --stat` shows only writePaths.

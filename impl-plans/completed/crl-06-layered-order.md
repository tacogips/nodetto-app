# crl-06-layered-order

- planId: crl-06-layered-order
- planPath: impl-plans/active/crl-06-layered-order.md
- progressPath: impl-plans/progress/crl-06-layered-order.md
- wave: 2
- dependsOn: crl-02-metric-fixture
- Design: `design-docs/specs/design-connector-routing-arranging.md`, section "Member ordering in `layered`".
- Worker rules and contracts: `impl-plans/active/crl-00-overview.md`.
- writePaths:
  - `packages/core/src/arrange-layered.ts`
  - `packages/core/src/arrange-layered.test.ts`
  - `packages/core/src/arrange-layered-order.ts` (new)
  - `packages/core/src/arrange-layered-order.test.ts` (new)
  - `impl-plans/progress/crl-06-layered-order.md`
  - `tmp/crl-s749/crl-06-layered-order`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

`planLayered` stacks each column by breadth-first rank only, which can add crossings. This plan adds two more
orderings and a selector that keeps the best measured one. The selector takes its evaluation as a parameter, so
it does not depend on crl-05; crl-07 supplies it.

## Non-goals

- Do not edit `arrange-route.ts`, `arrange-modes.ts`, `index.ts` or `arrange-layered-bpmn.ts`.
- Do not change column (frame) order, gaps, frame sizing or geometry rules.
- Do not make `planLayered`'s default differ from today. `memberOrder` absent is `rank`.
- No crossing-count estimator of your own: the selector uses `evaluate`.

## File-level changes

`arrange-layered-order.ts`, pure, with no import of `arrange-layered.ts`:

- `orderColumnMembers(kind, columns, neighbors, stackPosition)`, where `columns` is the ranked member-id lists per column, `neighbors` maps a unit to neighbor units, and `stackPosition` gives a unit's current coordinate along the stack axis. Returns new lists.
- `rank`: unchanged lists.
- `input`: by `stackPosition`, ties by rank position.
- `barycenter`: start from rank. 4 sweeps, with column order forward, backward, forward, backward. A member's key is the mean of its neighbors' normalized stack index (`index / max(size - 1, 1)`) over neighbors in other columns. A member with none keeps its current index as its key on the same normalized scale. Stable sort, ties keep current order. Each sweep updates a column before the next column reads it.

`arrange-layered.ts`:

- `LayeredOptions.memberOrder`.
- After `membersByOwner` is built, build column lists in the existing column order and apply `orderColumnMembers`. Neighbors come from the existing `outgoing` map, both directions, with duplicates kept so parallel edges weigh more.
- `firstRank`, `ordered` and frame order stay computed from rank, before reordering.
- `selectLayeredOrder`, per the pinned contract: for `rank`, `input`, `barycenter` in that order, plan, copy with `new Store(store.getSnapshot())`, `applyCommands(draft, commands)`, call `evaluate(draft)`. Keep the lowest `edgeCrossings`, then `segmentOverlaps`. On a tie, a candidate with no commands wins, then the earlier candidate; this keeps the baseline rule that a second `layered` run is a no-op. Skip evaluating a candidate whose commands equal an earlier candidate's. Errors from the first plan return as is.

Imitate the draft pattern in `packages/core/src/arrange-route.ts:planRoute` (`new Store(store.getSnapshot())`, `applyCommands`).

## What a careless implementation gets wrong

- Reordering before `firstRank` is computed would change frame order.
- On a tie, a no-commands candidate wins, then `rank`, so an unarranged page with no strictly better candidate matches today's output.
- `input` on `TB` uses x, on `LR` uses y.
- `Map` iteration from parse order is forbidden: `elements` is sorted by id already. Keep it that way.
- Self-loops are already excluded from `outgoing`.
- The free column (`undefined` owner) is a column too.
- Comparing commands by `JSON.stringify` is fine here, since each page has few candidates.
- Do not iterate more than 4 sweeps or add convergence checks.

## Tests

`packages/core/src/arrange-layered-order.test.ts`:

- `rank` -> same lists.
- `input` with reversed positions -> reversed, ties by rank.
- Two columns where rank order crosses and barycenter uncrosses -> barycenter gives the uncrossed order.
- Member with no neighbors keeps its relative slot.
- Same input twice -> same output.

`packages/core/src/arrange-layered.test.ts`:

- `memberOrder` absent and `rank` -> identical commands, equal to today's expected results.
- `memberOrder: "barycenter"` -> frame order and frame sizes unchanged, and members all inside their frames.
- `selectLayeredOrder` with an `evaluate` scoring rank worst -> picks another candidate's commands.
- `evaluate` returning all equal, every candidate with commands -> rank's commands.
- `evaluate` returning all equal, on a page already arranged in a non-rank order -> empty commands.
- `evaluate` equal crossings, differing overlaps -> lower overlaps wins.
- Candidates with identical commands -> `evaluate` call count is below 3.
- No frames -> the same error as `planLayered`.

## Verification (each must exit 0)

1. `bun test packages/core/src/arrange-layered-order.test.ts packages/core/src/arrange-layered.test.ts` -> 0 fail.
2. `bun run typecheck`.
3. `bunx biome check packages/core/src/arrange-layered.ts packages/core/src/arrange-layered.test.ts packages/core/src/arrange-layered-order.ts packages/core/src/arrange-layered-order.test.ts`.

## Done criteria

- Verification 1-3 exit 0 with logs recorded.
- `grep -n "export function selectLayeredOrder" packages/core/src/arrange-layered.ts` matches.
- `git diff --stat packages/core/src/arrange-route.ts packages/core/src/arrange-layered-bpmn.ts apps/cli/src/arrange-modes.ts` shows no change from this plan.
- Progress log complete.

# schematic-04-ir-sweep-netlist-model

- planId: schematic-04-ir-sweep-netlist-model; wave 3;
  dependsOn: schematic-01-ir-semantics, schematic-03-ir-coordinate (index.ts chain)
- design: sections 3.4 (netlist model), 5.1 (path lookup, `sweepAxisContacts`),
  13 item 16
- progress log: impl-plans/progress/schematic-04-ir-sweep-netlist-model.md

## Intent

Provide two shared pure building blocks in ir (io cannot import core):
the row/column sweep used by core connectivity and the KiCad importer, and
the `SchematicNetlist` data model consumed by io formatters.

## Non-goals

No connectivity rules, no KiCad-specific tolerance logic (plan 15 adapts its
own query rows), no diagonal handling.

## writePaths

- packages/ir/src/segment-sweep.ts (new)
- packages/ir/src/segment-sweep.test.ts (new)
- packages/ir/src/schematic.ts (new)
- packages/ir/src/index.ts
- impl-plans/progress/schematic-04-ir-sweep-netlist-model.md
- target
- tmp/cad3d

artifactRoots: target, tmp/cad3d. sharedPaths: none.

## Contracts (pinned)

```ts
export interface AxisSegment { readonly id: number; readonly line: number; readonly from: number; readonly to: number } // from <= to, integer keys
export interface AxisQuery { readonly id: number; readonly line: number; readonly at: number }
export interface SweepStats { sweepWork: number }
export function sweepAxisContacts(
  segments: readonly AxisSegment[], queries: readonly AxisQuery[],
  onContact: (segmentId: number, queryId: number) => void, stats?: SweepStats,
): void;
```
One call handles one axis (callers call it once for rows, once for columns).
Algorithm: group by `line` with a Map; per line sort segments by `from` and
queries by `at`; sweep with a binary min-heap keyed by `to`; push when
`from <= at`, pop while top `to < at`; every heap member contains the query.
`stats.sweepWork += pushes + pops + contacts`.

`schematic.ts`: `SchematicNetlist` exactly as design 3.4 (components with
`elementId`, `type: SchematicPartType`, `reference`, `value`, `partName`,
`description`, `footprint: ""`, `pins: {number,name}[]`; nets reuse
`BreadboardNetlistNet`).

## Pitfalls

- Touching endpoints count (`from <= at <= to`, inclusive both ends).
- Overlapping collinear segments all report (K contacts).
- Report order is not part of the contract; callers must not depend on it.
- No recursion; heap is an array; noUncheckedIndexedAccess-safe reads.

## Tests (segment-sweep.test.ts)

- row contacts, column contacts via separate calls, endpoint touching,
  overlapping collinear segments both reported, query between disjoint
  segments reports none.
- N=1000 disjoint segments on one row, one query inside each: exactly 1000
  contacts and `sweepWork <= 4N`.
- sparse 50x50 grid (one call per axis) with 100 queries:
  `sweepWork <= 2S + Q + K` per call.

## Verification

- `bun test packages/ir/src/segment-sweep.test.ts packages/ir/src/semantics/schematic.test.ts packages/ir/src/coordinate-key.test.ts`
  exits 0. The last two are plans 01 and 03's tests on the shared
  `packages/ir/src/index.ts`.
- `bunx biome check <owned .ts files>` exits 0.

## Done criteria

All bullets pass; index exports `sweepAxisContacts`, its types and
`SchematicNetlist` types.

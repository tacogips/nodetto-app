# schematic-15-io-kicad-schematic-contacts

- planId: schematic-15-io-kicad-schematic-contacts; wave 4;
  dependsOn: schematic-04-ir-sweep-netlist-model, schematic-06-io-kicad-netlist-linear,
  schematic-07-io-kicad-diagonal-lookup
- design: section 8.3 "Existing importer work bounds" (contacts, global
  budget policy, exact preservation evidence)
- progress log: impl-plans/progress/schematic-15-io-kicad-schematic-contacts.md

## Intent

Replace the all-pairs segment/point scan in the `.kicad_sch` importer with
bounded candidate selection, add the opt-in diagonal budget policy, and pin
exact result preservation with an oracle test.

## Non-goals

Label/name pass (plan 20). No change to symbol mapping, diagnostics text or
the breadboard import behaviour for callers without the policy.

## writePaths

- packages/io/src/kicad/schematic.ts
- packages/io/src/kicad/index.ts
- packages/io/src/kicad/schematic.test.ts
- impl-plans/progress/schematic-15-io-kicad-schematic-contacts.md
- target
- tmp/cad3d

artifactRoots: target, tmp/cad3d. sharedPaths: none.

## Changes

- `index.ts`: options gain `diagonalBudget?: "schematic"`; pass through to
  `importSchematic`. When `importSchematic` signals over-budget, return
  `{diagnostics: [...diagnostics, {severity: "error", code:
  "schematic.importTooComplex", message}]}` with no plan.
- `schematic.ts` (lines ~383-387 replaced):
  - Axis-parallel segments: candidates via `sweepAxisContacts` (ir) on rows
    `y-1..y+1` (columns `x-1..x+1` for vertical) with ranges grown by 1;
    count candidates in `stats.segmentCandidates`.
  - Diagonal segments: `diagonalCandidates` (plan 07); when the policy flag is
    set, compute `diagonalBudgetLimit(S, P)` after collecting points and
    segments, store it in `stats.diagonalBudgetLimit`, pass it as `budget`,
    and stop with over-budget when `exceeded`.
  - Degenerate segments: look up `pointIndex` keys within +-1.
  - Every candidate is confirmed by the existing `onSegment` before joining.
  - `points.indexOf(anchor.point)` -> direct index offset; Map
    accumulations push instead of spread-copying.

## Pitfalls

- The contact set must be identical to the old scan: candidates must be a
  superset; `onSegment` decides.
- Without the policy flag, no budget is applied (legacy callers unchanged).
- No double union of the same pair is harmful, but avoid O(n^2) dedupe.

## Tests (schematic.test.ts, additions; existing assertions unchanged)

- Oracle: a test-local verbatim copy of the old all-pairs contact scan;
  plans (parts, nets, node order, names, diagnostics) equal the oracle on every
  `test-fixtures/kicad/*.kicad_sch` and on generated inputs (orthogonal grid,
  parallel diagonals, 45-degree fan, points at the +-1 edge).
- N disjoint segments on one row each with a label: `segmentCandidates <= 3N`.
- long-lattice fixture (design 11) with `diagonalBudget: "schematic"`:
  `schematic.importTooComplex`, no plan, `stats.diagonalBudgetLimit ===
  diagonalBudgetLimit(S, P)`, `stats.diagonalWork <= limit + 1`; large-
  coordinate variant same; without the flag the same file completes and
  equals the oracle.
- disjoint mixed, overlapping parallel, short-lattice and midpoint fixtures
  complete under the policy and equal the oracle.

## Verification

- `bun test packages/io/src/kicad/schematic.test.ts packages/io/src/kicad/netlist.test.ts packages/core/src/breadboard/kicad-golden.test.ts` exits 0.
- `bunx biome check <owned .ts files>` exits 0.

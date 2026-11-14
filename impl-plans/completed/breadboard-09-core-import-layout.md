# breadboard-09-core-import-layout

- planId: breadboard-09-core-import-layout
- planPath: impl-plans/completed/breadboard-09-core-import-layout.md
- wave: 3; dependsOn: breadboard-02-core-foundation
- design: design-docs/specs/design-breadboard.md section 8.6.5, 3.2
  (netlist card), 3.3 (geometry storage)
- progress log: impl-plans/progress/breadboard-09-core-import-layout.md
- protocol: overview "Per-worker protocol", gates G1 and G2
- G1 ownRegex: `^packages/core/src/breadboard/import-layout(\.test)?\.ts`

## Completion (session-490)

- Status: COMPLETE. Accepted by test-integrity, adversarial and the
  session-490 serial integration review (comm-009184, all 18 plans on the
  combined tree); archived to `impl-plans/completed/` in Step 8.
- Combined-tree verification: `mise exec -- bun run typecheck` exit 0;
  `mise exec -- bun test --path-ignore-patterns 'tmp/**'` exit 0 (2501 pass,
  18 skip, 0 fail); `CARGO_TERM_QUIET=true mise run lint` exit 0;
  `CARGO_TERM_QUIET=true mise exec -- cargo test --workspace` exit 0.
  Evidence (local, untracked): `tmp/breadboard-mode-s485/reconcile-s490/`.
- Open item owned by `breadboard-00-overview`, which stays in
  `impl-plans/active/`: `CARGO_TERM_QUIET=true mise run verify` exited 1
  because its `bun test` also collects git-ignored scratch copies under
  `tmp/breadboard-mode-s485/breadboard-05-collab/`
  (RECON-S490-W1-VERIFY-TMP-SCRATCH).
- The sections below are the dispatch-time plan.

## Intent

Turn an ir `BreadboardImportPlan` into a new, deterministic `Document`:
- one breadboard page
- a half board
- the target netlist card
- the parts staged below the board

The CLI and the desktop call this after `importKicad` (plan 04). Output must
be byte-stable so CLI output and goldens stay stable.

## Non-goals

- No KiCad parsing. Tests build plans by hand.
- No wires and no placement onto the board.
- No annotation: references are kept verbatim.

## writePaths

- packages/core/src/breadboard/import-layout.ts (new)
- packages/core/src/breadboard/import-layout.test.ts (new)
- impl-plans/progress/breadboard-09-core-import-layout.md

## sharedPaths

- packages/core/src/breadboard/index.ts

## sharedPathNotes

- packages/core/src/breadboard/index.ts: append exactly
  `export * from "./import-layout.ts";`.

## Contract (pinned; plans 16, 17, 18 rely on it)

```ts
export function layoutBreadboardImport(plan: BreadboardImportPlan): Document;
```

## File-level changes

Follow design 8.6.5 exactly:
- Document title `plan.title`. One page
  `{id: "page-1", kind: "breadboard", name: "Breadboard"}`.
- Board `board-1`: `breadboard.board`, size `half`, top-left at page
  (0, 0).
- Card `target-netlist`: `breadboard.netlist` with semantic
  `plan.target`, top-left at `(BW + 2, 0)` pitches, where BW is the
  half-board width from `boardLayout("half")`.
- Staging origin `y = BH + 4` pitches. Parts `part-<n>` (n from 1, in plan
  order) are at rotation 0, placed left to right from `x = 0`:
  - pin 1 sits on the lattice point that puts the left edge of the part's
    box at or right of the cursor (use `breadboardLocalBox`)
  - the cursor advances by the box width plus 2 pitches
  - a row wraps when the next box would pass 66 pitches
  - the next row starts at the previous row's tallest box plus 2 pitches
- Semantic per part: the catalogue default for its type, overlaid with
  `parameters`, `reference` and `value`. Write `visual.x/y/width/height`
  from the catalogue box.
- Element order and fractional indexes: board first, then the card, then
  the parts. Use the fractional index generator from
  `packages/core/src/fractional.ts` in sequence.
- The document id and every other generated field must be deterministic.
  Derive them from the plan, with no clock and no random ids.
- The result must pass `validateDocument` from ir with no errors.

## Pitfalls

- Do not use the Editor or any id source with randomness.
- Pin 1 is not the box corner. Place by pin 1, as the design says.
- Unknown `parameters` keys must not leak into the semantic. Keep only the
  keys the type's semantic defines, so validation stays clean.

## Tests (input -> expected)

- a plan with R1, D1, SW1, BT1 -> ids `board-1`, `target-netlist`,
  `part-1..4`; page kind `breadboard`; the card semantic deep-equals
  `plan.target`
- every part pin is on the 10-unit lattice, and every part box top is at
  or below `(BH + 4) * 10`
- 30 resistors -> rows wrap; no box right edge passes 660 page units; the
  second row starts below the first row's tallest box plus 20 units
- the same plan laid out twice -> `serializeDocument` output identical
  (dev-dependency `@nodetto/io` is allowed in core tests)
- the layout result passes ir `validateDocument` with no error issues
- a part with `parameters: {span: 6, bogus: 1}` -> span 6 and no `bogus`
  key

## Verification

```
cd /Users/taco/gits/tacogips/nodetto-app-breadboard
mkdir -p tmp/breadboard-mode-s485/breadboard-09-core-import-layout
bun test packages/core/src/breadboard/import-layout.test.ts   # exit 0, >0 pass, 0 fail
bun test packages/core > tmp/breadboard-mode-s485/breadboard-09-core-import-layout/core.log 2>&1   # G2
bun run typecheck > tmp/breadboard-mode-s485/breadboard-09-core-import-layout/typecheck.log 2>&1   # G1
bunx biome check packages/core/src/breadboard/import-layout.ts packages/core/src/breadboard/import-layout.test.ts   # exit 0
```

## Done criteria

- The barrel line is present once.
- All verification lines pass, with exit codes and counts in the progress log.

# Plan 08 progress: core notation and SVG export

## Implemented

- Added `resistorBands` using the shared IR component-value parser. It supports 4-band and 5-band significant digits, multipliers from silver through white, tolerance bands including the 20% no-band case, exact-value tolerance checks, and the zero-ohm special case.
- Added shared original breadboard notation for all 13 element types. Board artwork includes grouped holes, rails, channel and labels; part artwork includes resistor bands, LED cathode mark, electrolytic polarity stripe, IC notch/pin-one mark and other catalogue silhouettes; wires have outline/color strokes and square ends; target netlist cards show source and counts. Parts expose upright reference labels, and secondary cards render at half opacity.
- Added SVG dispatch for breadboard elements through the shared notation primitives. Labels are emitted outside the element rotation group and included in export bounds. Wire geometry comes from the registered plan-06 shape utility. No transient net highlight or ratsnest is exported.
- Appended the two plan-owned exports to `packages/core/src/breadboard/index.ts`; existing plan-02/06/07/09 exports remain present. `packages/core/src/bpmn/notation.ts` is unchanged.
- Added focused resistor code, per-type notation, and default-registry SVG tests.

## Current-source verification

All commands ran in the foreground from the repository root. Complete logs are under `tmp/breadboard-mode-s485/breadboard-08-core-notation-svg/`.

| Command | Exit | Result | Log |
|---|---:|---|---|
| `bun test packages/core/src/breadboard/notation.test.ts packages/core/src/breadboard/resistor-bands.test.ts packages/core/src/breadboard/svg-export-breadboard.test.ts` | 0 | 11 passed, 0 failed, 96 assertions | `focused-final.log` |
| `bun test packages/core` | 0 | 1213 passed, 4 skipped, 0 failed | `core-rerun.log` |
| `bun run typecheck` | 0 | TypeScript check passed | `typecheck-rerun.log` |
| `! grep -E '^packages/core/src/breadboard/(notation|resistor-bands|svg-export-breadboard)(\\.test)?\\.ts|^packages/core/src/svg-export\\.ts' typecheck-rerun.log` | 0 | No plan-owned diagnostics | `g1-ownregex-final.log` |
| `! grep -E '^error TS' typecheck-rerun.log` | 0 | No TypeScript diagnostics | `g1-unscoped-final.log` |
| `bunx biome check` on the six plan-owned TypeScript files | 0 | Six files checked; no fixes required | `biome-final.log` |
| `git diff --quiet -- packages/core/src/bpmn/notation.ts` | 0 | BPMN notation file unchanged | `bpmn-final.log` |
| ASCII scans of new source/tests/progress, the shared barrel, and added SVG/barrel lines | 0 | No non-ASCII bytes | `ascii-final.log`, `ascii-shared-barrel.log`, `added-ascii-final.log`, `ascii-progress-final3.log` |
| Contract counts: `isBreadboardElementType`, two barrel lines once each, progress nonempty | 0 | All required markers present | `contracts-verified.log` |

## Superseded attempts

- `attempt-01-focused.log` records an initial test syntax typo; corrected without changing test intent.
- `focused-attempt-02.log` records a label-position expectation that incorrectly assumed the unrotated page y-axis; corrected to assert that the pre-rotated upright label is outside the rotated frame.
- `core-final.log` and `typecheck-final.log` were first written before the BPMN regression fix and contain the superseded failure. The successful source-matched reruns are `core-rerun.log` and `typecheck-rerun.log`; these are the final-source gates. The regression was caused by passing a prefix-parameterized renderer directly to `.map()`, which fed the item index as the prefix. All existing BPMN renderer maps now use explicit callbacks and the full core suite passes.
- The first `contracts-final.log` check used an over-escaped grep pattern and also ran before this progress file existed. The corrected contract check is `contracts-final-rerun.log`.

## Done criteria

- Breadboard SVG dispatch uses `isBreadboardElementType`: pass.
- Focused behavior, full core suite, workspace typecheck, Biome, ASCII gates, unchanged BPMN notation and barrel/progress contracts: pass on current source.
- Implementation work for plan 08 is complete. Independent review and serial combined-tree integration gates remain downstream workflow steps.

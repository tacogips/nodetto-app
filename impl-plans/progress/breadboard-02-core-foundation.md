# breadboard-02-core-foundation progress

Status: implementation complete; ready for the assigned review gates.

Dependency readiness: `breadboard-01-ir-contract` is listed in the dispatched
implementation item's accepted plan IDs. This plan adds only core geometry,
catalogue data, shared types, tests and its barrel exports. There is no GitHub
issue; the issue reference is the workflow input "Circuit breadboard drawing
mode (KiCad/Fritzing-inspired)".

## Completed work

- Added the fixed ten-part `breadboardCatalogue`, pin definitions, geometry,
  bonds, names, descriptions, footprints and valid IR defaults.
- Added full, half and mini board layouts with 830, 400 and 170 holes,
  terminal strips, continuous grouped rails, labels and centre channels.
- Added the pinned connectivity, 13-rule severity, finding, ratsnest and probe
  types, plus first-visible target-netlist lookup in fractional element order.
- Added the three-line breadboard barrel and one core root export.
- Added focused tests for catalogue pin tables, rotations, defaults, board
  counts, strip membership, rail spacing, page mapping, target selection and
  rule severities.

## Final-source verification

| Command | Exit | Result | Complete log |
|---|---:|---|---|
| `bun test packages/core/src/breadboard/catalogue.test.ts packages/core/src/breadboard/board.test.ts` | 0 | 14 passed, 0 failed | `tmp/breadboard-mode-s485/breadboard-02-core-foundation/focused-final5.log` |
| `bun test packages/core` | 0 | 1156 passed, 4 skipped, 0 failed | `tmp/breadboard-mode-s485/breadboard-02-core-foundation/core-final4.log` |
| `bunx biome check packages/core/src/breadboard packages/core/src/index.ts` | 0 | 7 files checked; no fixes | `tmp/breadboard-mode-s485/breadboard-02-core-foundation/biome-final5.log` |
| `bun run typecheck` | 0 | Workspace typecheck passed | `tmp/breadboard-mode-s485/breadboard-02-core-foundation/typecheck-final5.log` |
| Plan 02 ownRegex grep over `typecheck-final5.log` | 0 | No plan 02 diagnostics | `tmp/breadboard-mode-s485/breadboard-02-core-foundation/g1-ownregex-final5.log` |
| ASCII gate over the six new breadboard source/test files using the plan's `find ... | xargs perl` command | 0 | No non-ASCII characters | `tmp/breadboard-mode-s485/breadboard-02-core-foundation/ascii-new-final5.log` |
| `git diff -U0 -- packages/core/src/index.ts | perl ...` added-lines ASCII gate | 0 | No non-ASCII added lines | `tmp/breadboard-mode-s485/breadboard-02-core-foundation/ascii-index-final5.log` |
| ASCII gate over `impl-plans/progress/breadboard-02-core-foundation.md` | 0 | No non-ASCII characters | `tmp/breadboard-mode-s485/breadboard-02-core-foundation/ascii-progress-final6.log` |
| Pinned barrel and root export count checks | 0 | Exactly three ordered barrel lines; root export appears once | `tmp/breadboard-mode-s485/breadboard-02-core-foundation/barrel-final5.log` |

## Superseded attempt

The first focused run had three incorrect expected-coordinate assertions.
Those assertions were corrected against the plan's coordinate conventions;
the current-source focused and core suites above pass. The earlier run is
retained at `tmp/breadboard-mode-s485/breadboard-02-core-foundation/focused-attempt2.log`.

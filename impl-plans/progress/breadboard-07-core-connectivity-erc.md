# breadboard-07-core-connectivity-erc progress

Dependency readiness: `breadboard-02-core-foundation` is in the dispatch item's acceptedPlanIds. The accepted design and plan 07 contracts were read before implementation.

## Implemented

- `connectivity.ts` derives deterministic connectivity from visible board holes, terminal strips, continuous rails, wire endpoints, coincident pin/wire points, and catalogue bond groups. Overlapping holes use board z-order. It exposes pin and wire net lookups, hole/end validity, `toBreadboardNetlist`, `breadboardNetHighlight`, and `breadboardNetMembers`.
- Netlist components use natural reference order; net nodes and nets use component/pin order; battery and fallback net names are stable and collision-safe.
- `erc.ts` implements rules 1-8, supply classification, resistor/potentiometer/button reach, zero-ohm LED path checks, cross-probe element ids, and deterministic finding sorting. It contains exactly one `parity findings (plan 10)` insertion marker.
- `test-builder.ts` builds board, part, wire and optional target-card test documents. It remains unexported by the barrel.
- Connectivity tests cover terminal-strip union, channel split, rail-to-strip wires, highlighting, button bonds, hidden wires, topmost-board ownership and deterministic net-name collisions. ERC tests contain 19 test declarations and cover every assigned rule, exact rule/pin finding order, rail-short element ids, reversed/forward polarity through a resistor and button, and zero-ohm LED paths.
- The shared `packages/core/src/breadboard/index.ts` preserves prior lines and includes the plan 07 `connectivity.ts` and `erc.ts` exports once; `test-builder.ts` remains unexported.

## Verification

- Current-source `bun test packages/core/src/breadboard/connectivity.test.ts packages/core/src/breadboard/erc.test.ts`: exit 0, 24 pass, 0 fail, 54 expect calls. Log: `tmp/breadboard-mode-s485/breadboard-07-core-connectivity-erc/ti-focused.log`.
- Current combined-tree `bun test packages/core`: exit 0, 1215 pass, 4 skip, 0 fail across 1219 tests. Log: `tmp/breadboard-mode-s485/breadboard-07-core-connectivity-erc/ti-core.log`.
- Current `bun run typecheck`: exit 0 (`tsc --noEmit`). The plan 07 ownRegex has no matches. Log: `ti-typecheck.log`; G1 output: `ti-g1.log`.
- `bunx biome check packages/core/src/breadboard/connectivity.ts packages/core/src/breadboard/connectivity.test.ts packages/core/src/breadboard/erc.ts packages/core/src/breadboard/erc.test.ts packages/core/src/breadboard/test-builder.ts`: exit 0. Log: `ti-biome.log`.
- Current ASCII and contract gates: exit 0. Logs: `ti-ascii.log`, `ti-contracts.log`; unchanged source hashes: `ti-source-hashes.log`.
- `bunx biome format --write` on the same five owned files: exit 0; formatting only. Log: `format-final.log`.
- ASCII source gate: exit 0. Shared barrel added-lines ASCII gate: exit 0. Sentinel emitted `+a` plus the non-ASCII test character and exited 1 as expected. Logs: `ascii-source-final.log`, `ascii-barrel-final.log`, `ascii-sentinel-final.log`.
- Contract gate: exit 0. The eight ERC ids are present in tests, `erc.ts` has one parity marker, `test-builder.ts` is absent from the barrel, and `erc.test.ts` has 17 test declarations. Log: `contracts-final.log`.

## Earlier attempts

- Focused attempt 1: exit 1 because `test-builder.ts` imported `breadboardDefaultSemantic` from `@nodetto/ir`; corrected to import from core `catalogue.ts`.
- Focused attempts 2-4: exit 1 on test assumptions about array matching, resistor span, rail geometry and endpoint locations; tests and a zero-ohm supply-start predicate were corrected. These logs are retained as `focused-attempt1.log` through `focused-attempt4.log`.
- Typecheck attempt 1: exit 2 before the plan-pinned `BreadboardHighlight` type was defined locally and unused declarations were removed. A later run on the moving tree also had a sibling plan 06 diagnostic; current typecheck passes.
- Initial targeted Biome check found formatting errors. The five owned files were formatted and the final check passes.
- Earlier aggregate `bun test packages/core` and typecheck attempts failed on sibling plan 06 files; subsequent current-tree reruns pass. Their historical logs remain unchanged.
- The test-integrity reviewer also observed a moving-tree aggregate failure and typecheck syntax error in sibling plan 08 files (`/tmp/ti07-core.log`, `/tmp/ti07-tc.log`). Current combined-tree reruns pass (`ti-core.log`, `ti-typecheck.log`); these historical sibling diagnostics were not caused by plan 07.

Implementation criteria for plan 07 are complete: its focused behavioral suite, owner-scoped typecheck, full core behavioral suite, formatting, ASCII and contract gates pass on the current combined tree. F07-TI-1's five missing assertions are covered without source changes or weakening existing tests. Later plans own parity insertion and all UI, CLI and desktop integrations; formal review and serial integration remain downstream workflow steps.

## Adversarial review repairs

- F07-AR-1: `conductiveEdges` now links the net shared by button bond group 0 to the net shared by bond group 1 as the closed-switch edge. Added tests for a forward LED through a button without a resistor, reversed polarity through a button, and a button path with a series resistor.
- F07-AR-2: rule 5 now depends only on its zero-ohm LED/diode/button walk, separate from rule 4's resistor reach. The walk terminates at any supply net, returning success only for the requested polarity alone; rule 5 skips LEDs whose terminal net is shorted. Added tests for two series LEDs (both flagged), a resistor in that series path (neither flagged), a reversed LED (polarity only), and a shorted battery supply.
- Final-source focused suite: 26 pass, 0 fail, 62 expect calls (`ar-focused-verified.log`). Full core: 1217 pass, 4 skip, 0 fail (`ar-core-verified.log`). Typecheck exits 0 with no plan 07 diagnostics (`ar-typecheck-verified.log`, G1 output `ar-g1-verified.log`). Biome checks all five owned files with exit 0 (`ar-biome-verified.log`). ASCII and contract gates exit 0 (`ar-ascii-final.log`, `ar-contracts-final.log`).
- The first adversarial-focused attempt identified a reversed-LED test-fixture orientation error; it is retained in `ar-focused-attempt1.log`. The corrected fixture passes in `ar-focused-verified.log`. An initial Biome check identified one formatting-only test hunk; the final owned-file Biome gate passes.

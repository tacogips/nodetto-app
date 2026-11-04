# clm-02 connector edit performance: in progress

- The assigned plan matches the accepted connector semantics and A7 design and has no prerequisites.
- Built the pre-change native binary at `target/clm-baseline/nodetto-cli`. The initial fixture's native baseline was real 1.19 s, user 0.58 s, sys 0.02 s (`tmp/clm-s725/clm-02-connector-edit-perf/baseline-native.log`). The Bun and native outputs matched. The captured expected file hash is `341fcd8654fc18d560c8895df1a05617a6b8ac39`.
- Bun CPU profile is `target/clm-baseline/profile.md.md`. Its 14 samples show module initialization as the dominant self time; `applyBatch`, `planDerivedCommands`, and repeated `listElements` appear in the call tree. This does not confirm the reported A7 root cause. Investigate whether this fixture exercises it before choosing a fix.
- Added fixture and expected output, connector semantic type fields, and extracted `pointAlongRoute` and `connectorLabelBoxAt`. These are partial implementation only. Validator, key orders, resolver, regression tests, confirmed root cause, performance fix, after timing and required verification remain outstanding. Do not regenerate the expected output after implementation changes.
- `bun run typecheck` passed on this partial moving shared tree; log: `tmp/clm-s725/clm-02-connector-edit-perf/partial-typecheck.log`.

## Continuation

- Added routing-position validation, registry ordering, endpoint positioning, same-side loops and focused IR/core tests. Added Bun and native fixture parity and deadline tests. The expected hash remains `341fcd8654fc18d560c8895df1a05617a6b8ac39`.
- Current native timing: real 0.72 s, user 0.68 s, sys 0.01 s; baseline user 0.58 s, CPU user ratio 1.17. Output matches the captured fixture. This timing does not establish an improvement.
- The checkpoint already includes `planFrameTranslations`' no-moving-frame early exit (commit `266f219`), so the suspected repeated frame membership route resolution does not occur for this fixture. The historical two-minute root cause remains unconfirmed; no speculative performance change was made. A representative reproduction or stronger profiling is required to complete A7's confirmed-cause/fix criterion.
- Current shared-tree tests: CLI 8 pass, IR/core 160 pass, frame/routing/golden 142 pass, native parity 1 pass; typecheck and owned-file Biome pass. Logs: `continuation-cli.log`, `final/ir-core.log`, `continuation-core.log`, `final/native.log`, `final/typecheck.log`, `final/biome.log` under `tmp/clm-s725/clm-02-connector-edit-perf/`. Formal reviews and integration remain downstream.

## Second continuation

- A 300-batch Bun CPU profile (819 samples, 1.25 s) identifies repeated snapshot sorting/copying as measurable current-fixture overhead: `getSnapshot` 29.7% total, `compareSnapshotOrder` 17.4% self. Evidence: `tmp/clm-s725/clm-02-connector-edit-perf/continuation-profile.md` and `continuation-profile.log`.
- `planDerivedCommands` now reuses its unchanged store snapshot for the feature check and draft construction, removing one full sorted snapshot per nonempty operation while retaining all planners. This fixes the confirmed duplicate work, but the historical two-minute cause is still unconfirmed: the checkpoint's existing guards prevent the suspected route-resolution path on this fixture.
- Final native edit: real 0.58 s, user 0.53 s, sys 0.02 s; baseline real 1.19 s, user 0.58 s, sys 0.02 s; user CPU ratio 0.91. The expected output remains byte-identical and its git hash remains `341fcd8654fc18d560c8895df1a05617a6b8ac39`. Evidence: `round2-timing.log`, `round2-cmp.log`.
- Final shared-tree gates: CLI 8 pass; IR/core 160 pass; frame/routing/golden 142 pass; native parity 1 pass; typecheck and scoped Biome pass. Complete logs use `round2-` prefix in the plan evidence directory. Historical cause remains an open acceptance criterion; independent review and integration are downstream.

## Third continuation

- Corrected fractional port placement on elliptical outlines, including inset ellipses, and added a regression for a quarter-position initial-state port. `round3-ir-core.log` reports 161 pass, 0 fail. Existing midpoint behavior is unchanged.
- Final native edit: real 0.58 s, user 0.54 s, sys 0.01 s; baseline user 0.58 s, ratio 0.93. Output matches the expected fixture, whose git hash remains `341fcd8654fc18d560c8895df1a05617a6b8ac39`. Native parity: 1 pass, 0 fail. The other required targeted suites, typecheck and Biome pass; logs use `round3-` in this plan's evidence directory.
- The historical A7 cause remains unconfirmed. History establishes only that pre-checkpoint guards avoid the suspected route resolution on this fixture; it does not establish the version or document used in the original report. A representative reproduction or decision on the acceptance criterion is needed.

## clm-s731 readiness blocker

- The continuation matches the accepted A7/E1 design and has no declared predecessor. The pre-change baseline binary exists and the single-page fixture hash remains `341fcd8654fc18d560c8895df1a05617a6b8ac39`.
- `packages/core/src/editor/facade/core.ts:305` calls `applyCommands` on the full live store. `packages/core/src/commands.ts:429-432` copies every element into a new map for each call, including elements on unrelated pages. The A7 design expressly forbids per-operation copies outside the dirty set. `commands.ts` and the facade are outside this plan's write paths; the plan requires an amendment when the fix needs an outside file. Request a checkpoint amendment authorizing the command-layer change and any necessary corresponding tests before proceeding. Evidence: `tmp/clm-s731/clm-02-connector-edit-perf/readiness.log`.
- No implementation or baseline fixture capture has been performed. Completion, all behavioral gates, profile and timings remain outstanding; formal reviews remain downstream.

# clm-02 connector edit performance: in progress

## s732 implementation in progress

- Issue-resolution mode; the plan matches the accepted A7/E1 design and has no predecessors. Captured both multi-page expected outputs before engine edits and matched each against `target/clm-baseline/nodetto-cli`: hashes `872e266430b5a59930a4f87474869514a2c126cc` and `4f5c88d5b1c4bc44c3afbd743fb76089bb0d34aa`; evidence `tmp/clm-s732/clm-02-connector-edit-perf/baseline-compare.log`. Single-page hash remains `341fcd8654fc18d560c8895df1a05617a6b8ac39`.
- Bun profiles `target/clm-s732-profile/` and `tmp/clm-s732/clm-02-connector-edit-perf/profile-top.txt` show snapshot ordering (`compareFractional`, `compareSnapshotOrder`), manual route preservation, `listElements`, and command application. Baseline user CPU: multi 4.77 s, mixed multi 7.14 s, single 1.07 s, mixed single 1.16 s; complete timing logs are in the plan evidence directory.
- All planners retain their order and run against a scoped store with all page records. The first successful nonempty apply, revision mismatches, page commands, resource/master changes, cross-page links, duplicate creates and out-of-scope references widen to the document. Deletes materialize the full ordered command map for reference closure. The store indexes elements by page; apply-batch tracks store diffs. `keepMembers` is forwarded to carry, constraints and membership planners.

| Planner | Scope and widening |
| --- | --- |
| Text styles, color and number tokens, component refresh | Dirty pages; whole document for resources, masters and cross-page links |
| Text resize, aspect ratios, auto layout | Dirty pages; whole document for stale state or page commands |
| Frame translation and constraints | Dirty pages; cross-page links widen to whole document |
| BPMN lane, translation and membership | Dirty pages; cross-page links widen to whole document |
| Breadboard, PCB and UML ports | Dirty pages; cross-page links widen to whole document |
| Manual route preservation | Dirty pages with a scoped shape context; cross-page links widen |

- Per-edit intentions and pre/post hashes are in `tmp/clm-s732/clm-02-connector-edit-perf/` (`fixture-*`, `overlay-*`, `keep-*`, `store-*`, `dirty-*`, `transaction-*`, `facade-*`, `apply-batch-*`, `format-*`); final hashes must be checked again at handoff. Focused moving-tree checks: 266 core/golden and 34 editor/CLI tests passed; typecheck passed. Full plan verification and performance ratios remain pending.

### Current blocked performance result

- The two original captured inputs are reproduced byte-for-byte with deterministic fixture indexes (`captured-input-compare.log`); neither expected output was regenerated. Prefix lookup now caches sorted IDs and invalidates on membership or page changes. The store maintains a layer-flag count so shape context avoids the remaining live-store scan. The scoped-apply test allows at most one live `listElements` call and observes zero after this change.
- Current-source moving-tree suites pass: 51, 267 and 34 tests respectively; typecheck and scoped Biome pass. Native parity runs three tests with zero failures. Logs: `final-gate-{1,2,3,4}.log`, `final-gate-biome.log`, and `final/native.log` under `tmp/clm-s732/clm-02-connector-edit-perf/`.
- Current release user CPU from `final-time-*.log`: single 0.92 s, multi 1.85 s (ratio 2.01); mixed single 1.03 s, mixed multi 1.93 s (ratio 1.87). Against the baseline multi and mixed multi are 0.39 and 0.27 respectively. Both required 1.5 ratios remain unmet. Pre-change Bun profiles and the post-change profile under `target/clm-s732-profile/` identify snapshot sorting and one-time document validation/serialization as remaining costs; the exact remaining native contribution needs further profiling. No passing ratio line is recorded.
- The prior prefix test measured 0.85 s single and 1.78 s multi, prompting the prescribed cache. Per-edit hash evidence includes `prefix-cache-pre-hashes.txt`, `prefix-format-post-hashes.txt`, and `layer-perf-intent.txt`. Formal review and final integration remain downstream; this plan is not complete while the CPU gates fail.

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

Current prefix timing: single 0.89 s, multi 1.87 s, ratio 2.10; logs `prefix-current-single-time.log` and `prefix-current-multi-time.log`. Final Bun profile evidence: `profile-final-summary.txt` and `target/clm-s732-profile/final-{multi,mixed}.cpuprofile`; samples show `applyBatch`, derived planning, document parsing, validation and serialization. Further native profiling and optimization are required.

Final file hashes (HEAD before this plan, then current):
| File | Before | After |
| --- | --- | --- |
| `apps/cli/src/__fixtures__/obstacle-routing-batch.ts` | `81fe3254c4c1e210be7c8cd4c0e8616936996cb7` | `e34e7b5b923967ea536f860025c98bd782cc13de` |
| `apps/cli/src/__fixtures__/obstacle-routing-batch.multi-page.expected.jsonl` | `absent` | `872e266430b5a59930a4f87474869514a2c126cc` |
| `apps/cli/src/__fixtures__/obstacle-routing-batch.mixed-multi-page.expected.jsonl` | `absent` | `4f5c88d5b1c4bc44c3afbd743fb76089bb0d34aa` |
| `apps/cli/src/edit-performance.test.ts` | `198addbc514c3afe8cb20f3e15feb20704c836ca` | `40716ad0974a745e3660deaa08ed430365151e70` |
| `apps/cli/src/native-parity/edit-performance.test.ts` | `e75947fd09978721c6ef837e6b5a0ccc8ea89b07` | `314a9afce7b0568e517e060f0868d5ccdaa8b3a5` |
| `apps/cli/src/edit/apply-batch.ts` | `b7c5d65adad3d083a332216f4d80f53ee5f463c3` | `03530e9fb38b5e3430712fefd40e8a5aec62a816` |
| `apps/cli/src/edit/batch.ts` | `c818bb0bfa447da3617bab5637103544f1d10b66` | `46be1e7dc15d9114513e529593513fa17c39499d` |
| `apps/cli/src/edit/selectors.ts` | `328fcc290778397f6a61b24db4606effb12e9299` | `871671a327bf49672bdb0cafaea20c90a10eaf17` |
| `apps/cli/src/edit/selectors.test.ts` | `c0aa8c1cad72055c4abbdbbbfd4906b96e295b1c` | `ba78842c1b2c8cf8a026e8e52be70e61c1eca758` |
| `packages/core/src/commands.ts` | `63d8b95ef72a57b9af3c1c9451287efb531ce534` | `7377b5182d31e91a25466df1ae762b3c5c7511e7` |
| `packages/core/src/store-commands.test.ts` | `e8cd3b25b3b4499be50cfb98deca20febe20bb61` | `d100eda0b77931d2da6639e15ec17515acc87077` |
| `packages/core/src/store.ts` | `01ea3998b9ca93f10006262028bb395459d41c69` | `2d2a504562a8bb77342a29e36e2d7922e5aacedc` |
| `packages/core/src/editor/dirty-pages.ts` | `absent` | `a4754dbd08e43ad06bd300921d80144e0bb8841e` |
| `packages/core/src/dirty-pages.test.ts` | `absent` | `9acd2715ca0bb9a9060b07dc651b0dd699622cb4` |
| `packages/core/src/editor/transaction.ts` | `290885bd2fe9c5690a3cd7cb6b5c14efca49bd1b` | `466de0da6589ae894a82a0f49605413a04a5e4e4` |
| `packages/core/src/editor/facade/core.ts` | `e59f250e7a83166a3a4f6796c9e760bdf4e86409` | `270d160894d18401937b290e1b7bdad528fb8597` |
| `packages/core/src/editor/types.ts` | `be8a4ab2f430d6d450857970e91f0ff1f3f84d09` | `de16dafe29cc1031a1770a95fe50234f8fbfe0bc` |
| `packages/core/src/constraints.ts` | `67cd117c5216513548285f734457878127e1f66f` | `22e8d5b37a261c68949e4ac1df14dc6f76e658b5` |
| `packages/core/src/bpmn/containment.ts` | `0a71911d792f2ff55317628d9107cee228b30a75` | `18724e1d78788ff38e281452877ca1f4d80cb73b` |
| `packages/core/src/breadboard/board-carry.ts` | `716e41170fdc6b3dab924ce6dd11a5b11cfe427b` | `879ebae5e425cb824eb333d5a45e0f87bead84e1` |
| `packages/core/src/keep-members.test.ts` | `absent` | `c395ae4680536a613d787e3e2399291bfa07693f` |
| `packages/core/src/layer-state.ts` | `9250deb0d29b45a0802dbc3416c3810b72e78f52` | `9e4c614db9ca2d81cca94771cb3dca9efc568a04` |
| `packages/core/src/layer-state.test.ts` | `2b40b348e397c7ab024ff7284abd5ede54ea682f` | `a6e4ba1ab83f3930698e80f8d25953824b453dae` |

## A7 ratio redispatch 2026-11-05

- Finding IR-S732-CLM02-A7-RATIO remains open. The same current release build measured user CPU: single 0.54 s, multi-page 1.24 s (2.30x); mixed single 0.72 s, mixed multi-page 1.33 s (1.85x). Complete logs: `tmp/clm-s732/clm-02-connector-edit-perf/redispatch-gates/timing2-*.log`. Both ratios exceed 1.5. These are independent measurements and do not replace prior recorded ratios.
- Native per-planner attribution has not been obtained. Source inspection identifies repeated sorted snapshots as a candidate, but does not establish native cost or whether the target is reachable while retaining rule 1. Manual route preservation skips the fixture's non-manual routes. No speculative source change was made. A native instrumented build or equivalent per-phase profile is required before an owner decision.
- Manifest gates were rerun: gates 1-3 and 5-12 and 15 passed; gates 13-14 (ratio checks) failed. Gate 4 (`bun run typecheck`) failed on readonly assignments in sibling-owned `packages/core/src/arrange-layered-bpmn.test.ts:442-445`. Logs: `tmp/clm-s732/clm-02-connector-edit-perf/redispatch-gates/gate-*.log`. All three expected fixture hashes remain unchanged.
- Progress log before this append: `80e850a783b30e30f73b4408991d124dc4367c9e`. The plan remains blocked pending native attribution and the target decision or a measured compliant fix; the sibling typecheck failure also needs its owner.

## s737 clm-02 redispatch: partial implementation

- Before-binary provenance check passed; reuse `target/clm-s737-before/nodetto-cli`, without rebuilding it. Log: `tmp/clm-s737/clm-02-connector-edit-perf/provenance-check.log`.
- Added optional `elementPages` validation scope, keeping global page and duplicate-ID checks and original element indices. Regression covers scoped issues, an out-of-scope duplicate and a malformed page.
- Source edit hashes: `packages/ir/src/validate.ts` pre `518d27c72627c976dd1f9796f88f145d4740d56e`, post `4bfb55cc8246aa3bd8bd2a3448ddc0de311bc77a`; `packages/ir/src/validate.test.ts` pre `a0d94520f6eec3b3382d3b8c7356e54e3687bd7e`, post `4eab08c5fc090bb8ea1e6cac51706cc5e37a433f`. Scoped Biome format then changed these respectively to `a487f1f82b267e51d300c3720ebdf5ce4d1f1c45` and `e8f5a3623349d5acb419b2b3a6e839812c888246`.
- Focused `bun test packages/ir/src/validate.test.ts`: 87 pass, 0 fail; `bun run typecheck` and `bunx biome check packages/ir/src/validate.ts packages/ir/src/validate.test.ts`: exit 0. Logs under `tmp/clm-s737/clm-02-connector-edit-perf/`.
- Incomplete: source-line verification and parsing/serialization, batch integration, remaining tests, native measurements and all manifest gates. Finding `S737-W1-CLM02-NOT-IMPLEMENTED` remains unresolved; no completion or timing claim is made.

## s737 continuation: source lines and scoped batch validation

- The before binary was reused after the provenance check. The after release binary bundles the current shared tree, including clm-11 work. Every run and its `/usr/bin/time -p` output is in `tmp/clm-s737/clm-02-connector-edit-perf/final/timing.log`; each input was copied afresh before timing.
before A7 medians: single1=0.36 multi1=0.82 single50=0.53 multi50=0.99 mixedSingle=0.59 mixedMulti=1.02
after A7 medians: single1=0.34 multi1=0.68 single50=0.60 multi50=0.80 mixedSingle=0.57 mixedMulti=0.88
before A7 marginal ratio batch: 1.0000
before A7 marginal ratio mixed: 0.8696
after A7 marginal ratio batch: 0.4615
after A7 marginal ratio mixed: 0.8696
A7 fixed cost multi 1-op: before 0.82 after 0.68

- Implemented identity-keyed source lines with conservative canonical verification, scoped diff tracking through arrangement, full-write differential seam, and one-operation fixture. Added serializer reuse proof, normalization, migration, differential, frozen-batch, identity and native parity tests. Per-edit intents and fresh reads are in `tmp/clm-s737/clm-02-connector-edit-perf/`.
- Source hashes (pre -> post; formatting transitions recorded separately):
  - `packages/io/src/jsonl/source-lines.ts`: absent -> `87565a825d12e185e8dbdcefc5951cb1822c69b9` -> `06402c48025173f0902836182f9c474ccec24881`.
  - `packages/io/src/jsonl/parse.ts`: `f6b1a6f0beb3216fe15bbd66f551e4c40b52a20f` -> `4514f99f6b3038cc3b69e5e10cced01438ad17f1` -> `9f7cb9e4ce0f4cf84cc2a36b244db527421668ac`.
  - `packages/io/src/jsonl/serialize.ts`: `ea347030edd88186c3f140ef6b9eea05f3731ac5` -> `8760bbdaf16f99ecc7ebf34718f0d2dae67a300b` -> `1ee37993ad6b8df497dfa646e23d6c9ca66df023`.
  - `apps/cli/src/edit/apply-batch.ts`: `03530e9fb38b5e3430712fefd40e8a5aec62a816` -> `97d0610fb5b8c2d936ab1d481b970ad075d90d06` -> `fb99d7db26b6468604e215617cadb5b7f01c8eb1`.
  - `apps/cli/src/__fixtures__/obstacle-routing-batch.ts`: `e34e7b5b923967ea536f860025c98bd782cc13de` -> `ca995a3d0ddcefa5448d415aa8b80a3fb32a7671`.
  - `apps/cli/src/native-parity/edit-performance.test.ts`: `314a9afce7b0568e517e060f0868d5ccdaa8b3a5` -> `5f9a4613f2903b97131c12c1751c10f733971103` -> `b03586c744ac078b2171c54f4adc6dee7d844f0a`.
  - `apps/cli/src/edit/apply-batch.test.ts`: `0152771494176d8bf1f517c31eb2c31247e5d657` -> `8fefc53c41800e02f45de4b1c264155ef198753a` -> `cb7a218c2436172475c8367e1ff83cbfcfcb03ae` -> `de034512a47c9adc3d19a59e72ba4389266a3b4f` -> `2cdd6a5668b0e899d0e8c335c323c95cd1f62a32` -> `be71a1019ea113022e7019b5458d155f5be0e224` -> `db467717971d876495492f6ae53bbaa3325ee5a7` -> `bcf6ba092148ee0e9078a47a31dc40bdcae65a56` -> `54c5afb8aca40c9eef53bca4076133bc2397fc32`.
  - `packages/io/src/jsonl/source-lines.test.ts`: absent -> `fefa5ca8b8eeeeb655da0b27e270b236e4edeb90` -> `5fdc4541c90766b4254c4a07308e5191a884f6dd` -> `3361138766de5d243a74f79bd863c7f380fbfb9d` -> `373fae2b3afe3dc6cb095bd7d747dda9f6cd0c26` -> `37317304b969152a3c4769ca1cafb6e6bd78d76b` -> `938940b1164565f9be0834e8f2f1225a6c21feac` -> `e5ba00acee98da8703a4b1afd2e367487def41f3` -> `53f077fa1d915d1b8b8bedb44572f851faa0f363` -> `a45f1214c1f6687ef93690ce4371d407b9f0d8f5` -> `331163c1fb8446e3dbc8313bbf5d8093f635c517`.
- Final verification is in progress; review decisions remain downstream.

### s737 final verification record

- Manifest Bun suites: 107, 368, and 52 tests passed respectively; typecheck and the exact manifest Biome check passed. Logs: `final/current-gate-1.log` through `final/current-gate-5.log` under this plan's evidence directory.
- Native release build and parity gate passed on the first attempt: 7 tests, 0 failures. Logs: `final/native-build.log`, `final/native-1.log`, `final/native.log`, and `final/native-gate.log`.
- Manifest mechanical checks 6-19 passed, including all three expected hashes, both binaries, provenance, ratios, API wiring, unchanged Cargo files and plan file. Logs: `final/mechanical-6.log` through `final/mechanical-19.log`.
- The differential invalid-operation case is rejected by the command before post-batch validation; validator tests exercise scoped errors and original indices directly. Formal test-integrity, adversarial and integration review decisions are downstream.
- Previous progress append hash: `e6950f64d8508eee0cb5b21a40f515aae55fd2fa` -> `501e637dd541fd987b6ab663a247f5aed3729b00`.
- Staleness proof added: `packages/io/src/jsonl/source-lines.test.ts` `331163c1fb8446e3dbc8313bbf5d8093f635c517` -> `dd64221030562164b9fc769666e3ca7fb221ecc0` -> formatted `3b9c70b032664d75eb39cbbfa5296d96d3ede530`. The current serializer suite (368 pass), typecheck and Biome gate passed again in `final/last-gate-1.log` through `final/last-gate-3.log`. Other gates and native binary are unaffected by this test-only addition.
- Previous progress append hash: `501e637dd541fd987b6ab663a247f5aed3729b00` -> `6da9bd61e71c136d49f2f5451fb9ce375c5634af`.

## Test-integrity revision S737-CLM02-TI-POST-BATCH-ERROR

- Pre-edit `apps/cli/src/edit/apply-batch.test.ts` hash: `54c5afb8aca40c9eef53bca4076133bc2397fc32` (matches review). Add a visual.x invalid-value differential with explicit post-batch error assertions.
- Correction to the earlier fallback note: the `missing` case fails in selector resolution, while an update with `visual.x: "abc"` reaches post-batch validation. The differential now checks identical errors in both modes and explicitly asserts the optimized error contains `The result is not a valid document` and `visual.x`.
- Test hash: `54c5afb8aca40c9eef53bca4076133bc2397fc32` -> `ec53436544cfa1387e3dc6cfad00659aa1f23a6b` -> formatted `2609e5feb85703b0a5db7d3276290e974006a722`. Scoped Biome, manifest suite (107 pass, 0 fail, 1297 assertions), typecheck, full scoped Biome and Cargo/plan diff all passed; logs `final/ti-final-1.log` through `final/ti-final-6.log`. The five production hashes remain as specified by the review, in `final/ti-final-6.log`.
- Integration review must rerun native parity and attributed timing against the combined stable tree: the sibling `apps/cli/src/edit/carry-members.ts` changed after the earlier native run, and the earlier timing log does not identify binary digests.
- Progress hash before prior revision append: `b79d460d467bd0f550d0f2bdb1b08646f0f05d1c` -> `f6bc92072e4e14e5c72f42433fecc39937c41f74`.

## Integration feedback: export scan and attributed timing

- Removed only `target/clm-s737-before/src` after verifying the before binary SHA-256 `e4dedd48a17e326338daeb97f0a8bc3d019cf4541ddc30ccd7c4d11533a3100d`; the digest remained unchanged. Plain `bun test`: 3151 pass, 0 fail; native CLI suite: 259 pass, 0 fail. Logs: `final/review-bun-all.log`, `final/review-build.log`, `final/review-cli-1.log`.
- paired rounds, 11 or more; before SHA-256 e4dedd48a17e326338daeb97f0a8bc3d019cf4541ddc30ccd7c4d11533a3100d; after SHA-256 5e155b320928f13d675780b968b175e7f2e5637f266e305db29c060f5f2f9770; earlier values remain on record. All runs and load readings: `final/timing-paired.log`.
before A7 medians: single1=0.47 multi1=1.10 single50=0.71 multi50=1.39 mixedSingle=0.76 mixedMulti=1.39
after A7 medians: single1=0.47 multi1=0.84 single50=0.70 multi50=1.11 mixedSingle=0.75 mixedMulti=1.16
before A7 marginal ratio batch: 1.2083
before A7 marginal ratio mixed: 1.0000
after A7 marginal ratio batch: 1.1739
after A7 marginal ratio mixed: 1.1429
A7 fixed cost multi 1-op: before 1.10 after 0.84

- Progress pre-edit git hash-object: `6015d482113a38b0f5efa38e854b00488c00676f`; post-edit hash recorded in plan-local `final/progress-review-hashes.log`.

- Current-tree manifest verification: all 20 commands exited 0, including three Bun suites (56, 187, 26 pass), native parity (4 pass), typecheck, Biome, three fixture hashes, provenance and the ratio gate. Individual exact commands and complete logs are indexed in `final/review-manifest-results.json`; native output is `final/native.log`. `final/review-artifacts.log` confirms export absence, unchanged before digest, no target paths in plain test output, nonempty paired timing log and unchanged after digest. Final formal reviews and downstream wiring remain pending.
- Progress hash before this append: `9e620684b1979f5b0ed4061493f264dad6d9bb88`; post-append hash is in `final/progress-gates-hash.log`.

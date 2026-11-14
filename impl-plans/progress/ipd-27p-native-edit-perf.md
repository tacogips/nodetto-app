# ipd-27p-native-edit-perf progress

Status: implementation complete; formal review and workflow finalization remain downstream.

A generic four-batch scratch driver uses iPhone frames, explicit parents, select, and three iOS kit shapes. Each row is resulting element count, operation count, and wall time in milliseconds. Timings include process startup. The after Bun run overlapped native measurement and is not an isolated comparison.

| Elements | Operations | Before native | Before Bun | After native | After Bun |
| --- | --- | --- | --- | --- | --- |
| 156 | 60 | 8090 | 233 | 8335 | 407 |
| 212 | 57 | 11751 | 242 | 12152 | 528 |
| 268 | 57 | 16346 | 285 | 16432 | 661 |
| 324 | 57 | 21344 | 341 | 21430 | 557 |

The Bun CPU profile's leading sampled frames were `packages/core/src/frame-tree.ts:frameParents` (69 samples), `fractional.ts:compareFractional` (44), and `hit-test.ts:boundsOf` (30). The native sample showed Boa `Array::for_each`, iterator creation, `boa_gc::Collector::collect`, and `mark_heap`. `packages/core/src/editor/transaction.ts:planDerivedCommands` repeatedly constructs drafts and scans planners; its role requires further measurement. Profile artifacts and driver are in `tmp/ipd-s772/ipd-27p-native-edit-perf/`.

Changed `apps/cli/src/edit/selectors.ts:resolveElementReference` to avoid sorting all element IDs when resolving an `@ref`; `resolveId` does not consult IDs for this case. The measured native batches still exceed 3 seconds and grow with document size, so this is not the required performance fix.

Checks completed on the current source:

- `CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli`: exit 0; build.log.
- `bun test apps/cli/src/edit`: exit 0; 131 pass, 0 fail; edit-tests.log.
- `bun test apps/cli/src/edit packages/core`: exit 0; 1915 pass, 4 skip, 0 fail; edit-core.log.
- `bun run typecheck --pretty false`: exit 0; typecheck.log.
- `bunx biome check apps/cli/src/edit/selectors.ts`: exit 0; 1 file; biome.log.

Remaining: remove the dominant per-operation work without changing results, add the required native synthetic regression with normalized parity and timing assertions, rerun the complete prescribed gates, and record final timings. Formal review and workflow finalization are downstream.

## Continuation 1

`packages/core/src/editor/transaction.ts` now avoids constraint hierarchy planning when no existing frame's actual bounds changed size; the original planner still runs when a frame did resize. `apps/cli/src/native-parity/edit-performance.test.ts` now contains a generic four-batch parity and timing regression with 48 additions per batch and the accepted generated-value normalizer. Its focused run passed 5 tests, 0 failed (`cont1-perf-test.log`; before formatting only). The previous section's checks predate this continuation.

The same 55-addition driver measured native batches at 2312, 2221, 3129 and 3790 ms for 156, 212, 268 and 324 elements respectively (`cont1-native.log`). The largest batches still exceed the 3-second target, so the performance goal is not complete. The constraint guard aggregate passed `bun test apps/cli/src/edit packages/core` (exit 0, 1915 pass, 4 skip, 0 fail; `cont1-core.log`, before formatting). Typecheck exited 0 (`cont1-typecheck.log`); the full scoped Biome check exited 0, 63 files (`cont1-biome.log`).

`CARGO_TERM_QUIET=true mise run test-cli` was interrupted with exit 130 after it created scratch under `tmp/ipd-s772/ipd-26-example-sample/`, which is outside this plan's declared artifact roots. Its incomplete log is `cont1-test-cli.log`; it is not a passing gate. `apps/cli/src/native-parity/iphone-kit-example.test.ts:168` and `:296` hard-code this location. Resume after a checkpoint amendment authorizes that scratch root or its owner changes the harness to authorized OS temporary storage. Then complete the performance optimization, rebuild, rerun all prescribed final-source gates, and record final timings.

## Round 25 continuation

The regression now enforces the binding 5000 ms and 4x limits. The constraint guard avoids constructing the frame ownership tree when no existing frame changes bounds; `planConstraints` itself only acts after such a size change. The earlier native profile identified Boa array iteration and GC (`Collector::collect`, `mark_heap`); Bun's profile identified `frame-tree.ts:frameParents`, `fractional.ts:compareFractional` and `hit-test.ts:boundsOf`. The guard removes unnecessary hierarchy planning, while reference resolution avoids unnecessary ID sorting. Profiles remain in the plan evidence directory.

For the generic driver, before native/Bun and after native/Bun milliseconds respectively were: 156 elements, 60 operations: 8090/233 and 2312/124; 212 elements, 57 operations: 11751/242 and 2221/110; 268 elements, 57 operations: 16346/285 and 3129/124; 324 elements, 57 operations: 21344/341 and 3790/136. Native after measurements are from `cont1-native.log`; isolated Bun after measurements are `final/bun-timings.log`. All four native batches meet round 25 limits.

Final-source checks, logs under `tmp/ipd-s772/ipd-27p-native-edit-perf/final/`:

- `CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli`: exit 0, `build.log`.
- `NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity/edit-performance.test.ts`: exit 0, 5 pass, 0 fail, `performance.log`.
- `bun test apps/cli/src/edit packages/core`: exit 0, 1915 pass, 4 skip, 0 fail, `core.log`.
- `CARGO_TERM_QUIET=true mise run build-cli`: exit 0, `build-cli.log`.
- `bun run typecheck --pretty false`: exit 0, `typecheck.log`.
- `bunx biome check apps/cli/src/edit packages/core/src/editor packages/core/src/store.ts packages/core/src/auto-layout.ts packages/core/src/text-layout.ts packages/core/src/text-styles.ts packages/core/src/color-tokens.ts packages/core/src/number-tokens.ts packages/core/src/aspect-ratio.ts packages/core/src/insertion-parent.ts packages/core/src/kits/ios/insert.ts apps/cli/src/native-parity/edit-performance.test.ts`: exit 0, 63 files, `biome.log`.
- `CARGO_TERM_QUIET=true cargo fmt --check -p nodetto-cli`: exit 0, `fmt.log`.

Status remains blocked: `CARGO_TERM_QUIET=true mise run test-cli` includes `apps/cli/src/native-parity/iphone-kit-example.test.ts:169,297`, which creates scratch under `tmp/ipd-s772/ipd-26-example-sample/`, outside this plan's artifact roots and the round-25 authorized scratch locations. The prior interrupted attempt is `cont1-test-cli.log` and is not passing evidence. Resume after a checkpoint amendment authorizes that scratch or the owning plan changes the harness, then run the complete aggregate and record its exit and counts. Formal review and finalization remain downstream.

## Round 26 verification

The round-26 scratch rule supersedes the prior scratch blocker. The implementation and synthetic regression satisfy the round-25 performance limits; the timings and profiles above remain the measured evidence. Fresh verification on the current shared tree completed with logs in `tmp/ipd-s772/ipd-27p-native-edit-perf/round26/`:

- `CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli`: exit 0; `build.log`.
- `NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity/edit-performance.test.ts`: exit 0; 5 pass, 0 fail; `performance.log`.
- `bun test apps/cli/src/edit packages/core`: exit 0; 1915 pass, 4 skip, 0 fail; `core.log`.
- `CARGO_TERM_QUIET=true mise run test-cli`: exit 0; 496 pass, 0 fail, compared with the 438 pass, 0 fail baseline; `test-cli.log`.
- `CARGO_TERM_QUIET=true mise run build-cli`: exit 0; `build-cli.log`.
- `bun run typecheck --pretty false`: exit 0; `typecheck.log`.
- `bunx biome check apps/cli/src/edit packages/core/src/editor packages/core/src/store.ts packages/core/src/auto-layout.ts packages/core/src/text-layout.ts packages/core/src/text-styles.ts packages/core/src/color-tokens.ts packages/core/src/number-tokens.ts packages/core/src/aspect-ratio.ts packages/core/src/insertion-parent.ts packages/core/src/kits/ios/insert.ts apps/cli/src/native-parity/edit-performance.test.ts`: exit 0; 63 files; `biome.log`.
- `CARGO_TERM_QUIET=true cargo fmt --check -p nodetto-cli`: exit 0; `fmt.log`.

The shared tree contains earlier plans' changes outside this plan's scope; they predate this continuation and are preserved. No source files outside this plan were edited in this continuation. Formal integrity and adversarial review remain downstream.

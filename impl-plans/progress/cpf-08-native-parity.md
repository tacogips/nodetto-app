# cpf-08-native-parity progress

Implementation complete; independent integrity, adversarial and serial integration review remain downstream. Dependencies cpf-04 and cpf-06 were accepted by dispatch. The committed plan matches the accepted design. All commands below ran on the shared combined tree; stable integration checks remain downstream.

## Changes and hashes

All four files were absent before this plan (see `tmp/cpf-s748/cpf-08-native-parity/before.log`). After hashes (`git hash-object`):

- `apps/cli/src/native-parity/convert.test.ts`: `efaf0fb936aff5298c5598a770c0c74c86a1b5d3` — shape conversions in JSON and text, dry-run dropped fields and connector, multiple selection, bounds and endpoint failures, BPMN and reconnect.
- `apps/cli/src/native-parity/frame-scope.test.ts`: `58b91cc0614ce17bca343250eaf93167f46b733f` — catalog, straddling zone, late frame, text and JSON lint.
- `apps/cli/src/native-parity/sequence-participant.test.ts`: `038fbc50925c7e8c24ac24f14588a12457435d09` — SVG, types in text and JSON, and PNG exit parity.
- `impl-plans/progress/cpf-08-native-parity.md`: initial state absent; after hash and per-edit intentions are recorded in `tmp/cpf-s748/cpf-08-native-parity/intentions.log`.

## Evidence

- `CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli`: exit 0, `tmp/cpf-s748/cpf-08-native-parity/build.log`.
- `NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity/convert.test.ts apps/cli/src/native-parity/frame-scope.test.ts apps/cli/src/native-parity/sequence-participant.test.ts`: exit 0, 3 pass, 0 fail, 0 skip (Bun omits the skip line when zero), 96 assertions; `tmp/cpf-s748/cpf-08-native-parity/parity-final.log`.
- `bun run typecheck`: exit 0, `tmp/cpf-s748/cpf-08-native-parity/typecheck-final.log`.
- `bunx biome check apps/cli/src/native-parity/convert.test.ts apps/cli/src/native-parity/frame-scope.test.ts apps/cli/src/native-parity/sequence-participant.test.ts`: exit 0, `tmp/cpf-s748/cpf-08-native-parity/biome-final.log`.
- Pre-change source is `target/cpf-baseline/.src`, archived from `1e8f43d224d7b43e200eb2229e7be17b39ca033c`; baseline release build exit 0 (`baseline-build.log`), executable check exit 0 (`baseline-executable.log`), and convert probe reports `Unknown op` with exit 2 (`baseline-probe.log`). The find check finds no test files outside `.src` (`baseline-find.log`).
- `timing.txt` records three-run median user CPU. Current/baseline ratios: update 0.989, DDL 1.010, lint 0.990, SVG 0.964; no shared command exceeds 1.25. Current-only convert and reconnect medians are 6.26s and 1.60s. Commands and individual runs are in `timing-run.sh` and `timing-final-raw.txt`; both timing runner logs exit 0. The first attempt missed `--page` for SVG and is retained under `timing-attempt1`; it was corrected without changing deadlines.
- `git diff --quiet 1e8f43d -- apps/cli/src/native-parity/harness.ts apps/cli/native crates`: exit 0 (`unchanged.log`). No cargo clean was run.

All evidence paths above are under `tmp/cpf-s748/cpf-08-native-parity/` unless otherwise specified. Final serial `CARGO_TERM_QUIET=true mise run verify` and `CARGO_TERM_QUIET=true mise run test-cli` belong to integration.

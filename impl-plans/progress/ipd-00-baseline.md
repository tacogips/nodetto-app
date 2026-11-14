# ipd-00 baseline progress

Baseline source: `f59bef4`; HEAD `6708e5746e242ad683700547b8acf4f7684edbee` on `feat/iphone-app-design`. Plan blob: `96a567f6dfb1041343c8bda49663d716776c28c0`. Before and after source diffs against f59bef4 were empty. Evidence: `tmp/ipd-s772/ipd-00-baseline/final/`.

| Command | Exit | Counts |
| --- | ---: | --- |
| `CARGO_TERM_QUIET=true mise run verify` | 0 | Bun 3484 pass, 64 skip, 0 fail, 44275 expects, 3548 tests; Rust 85 pass, 0 fail, 0 ignored |
| `CARGO_TERM_QUIET=true mise run test-cli` | 0 | Bun 438 pass, 0 skip, 0 fail, 13372 expects; Rust 20 pass, 0 fail, 0 ignored |
| `CARGO_TERM_QUIET=true mise run build-cli` | 0 | 0 tests, 0 failures |
| `bun run typecheck` | 0 | 0 tests, 0 failures |
| `NODETTO_ENGINE_OUT_DIR="$PWD/tmp/ipd-s772/ipd-00-baseline/engine" bun apps/cli/scripts/build-engine.ts` | 0 | 0 tests, 0 failures |
| `wc -c tmp/ipd-s772/ipd-00-baseline/engine/diagram.js` | 0 | 1007675 bytes; 0 tests, 0 failures |

The `test-cli` task sets `NODETTO_CLI_TEST_BINARY` to `target/release/nodetto-cli` for Bun parity tests (`mise.toml:58`); the log reports 438 tests with no skips. The built sidecar `apps/desktop/src-tauri/binaries/nodetto-cli-aarch64-apple-darwin` is 19623760 bytes.

## Baseline failures

None. No exclusions are required by this baseline.

## Completion

All four final logs are nonempty; `git diff --stat -- packages apps crates` is empty. No product source was changed. Formal review and later integration are downstream.

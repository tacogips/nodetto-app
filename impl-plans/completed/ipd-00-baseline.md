# ipd-00-baseline

- planId: ipd-00-baseline
- planPath: impl-plans/active/ipd-00-baseline.md
- progressPath: impl-plans/progress/ipd-00-baseline.md
- wave: 1. dependsOn: none. This plan runs alone, before any source edit.
- Design (binding): `design-docs/specs/design-iphone-app-design.md`, section "Verification", item "Baseline unit first".
- Evidence: `tmp/ipd-s772/ipd-00-baseline/final/`.
<!-- ownership:start -->
- writePaths:
  - `impl-plans/progress/ipd-00-baseline.md`
  - `tmp/ipd-s772/ipd-00-baseline`
  - `target`
  - `apps/desktop/src-tauri/binaries`
- sharedPaths:
  - none
- sharedPathNotes:
  - none
- artifactRoots:
  - `tmp/ipd-s772/ipd-00-baseline`
  - `target`
  - `apps/desktop/src-tauri/binaries`
<!-- ownership:end -->

Build artifact roots: `target` (and `apps/desktop/src-tauri/binaries` where declared) are outputs of cargo, `mise run test-cli` and `mise run build-cli`. They are git-ignored and contain no authored source. Never edit files under them by hand. Cargo's lock serializes concurrent builds; `ipd-24` additionally depends on `ipd-23`, so the W9 parity builds do not overlap.

## Intent and context

The iPhone app design work (plans `ipd-01` to `ipd-28`) gates on "no new failures versus f59bef4".

This plan records the failures at the starting tree. The tree is f59bef4 plus the committed design docs and plans, which contain no code changes. Record which commands pass and fail on it, so later plans and the finish plan can compare against it.

This plan runs alone in wave 1 so that no other worker edits source while the suites run.

## Non-goals

- Fix nothing.
- Edit no source, test, doc, lockfile or config file.
- Change no deadline.
- No git state changes.

## Steps

1. Record:
   - `git rev-parse HEAD`;
   - `git status --porcelain` (must show no source changes);
   - `git diff --stat f59bef4 -- packages apps crates Cargo.toml package.json bun.lock`, which must be empty.
2. Run, each with full output to its own log in `final/`:
   - `CARGO_TERM_QUIET=true mise run verify` -> `final/verify.log`;
   - `CARGO_TERM_QUIET=true mise run test-cli` -> `final/test-cli.log`;
   - `CARGO_TERM_QUIET=true mise run build-cli` -> `final/build-cli.log`;
   - `bun run typecheck` -> `final/typecheck.log`.
3. For each command, record in the progress log:
   - exit code;
   - Bun summary lines (pass, skip, fail, expect counts);
   - Rust test summaries (`test result:` lines).
4. If a suite fails, list every failing test by file and name. Classify it:
   - deterministic: fails again on one rerun of that file alone;
   - timeout or flaky: passes on the rerun; record both runs.

   The list goes in a "Baseline failures" table: command, file, test name, classification, log line. This table is the exclude list that later gates use.
5. Record the engine bundle size, the icon bundle-size reference (design Decision 2.1):
   - Run `NODETTO_ENGINE_OUT_DIR="$PWD/tmp/ipd-s772/ipd-00-baseline/engine" bun apps/cli/scripts/build-engine.ts`, then `wc -c tmp/ipd-s772/ipd-00-baseline/engine/diagram.js`.
   - Record both exit codes and the byte count.
   - Pitfall: cargo and build-cli write the bundle under `target/**/out` (`apps/cli/native/build.rs` sets `NODETTO_ENGINE_OUT_DIR=$OUT_DIR`). `apps/cli/native/engine/` does not exist, so do not measure it.
6. Record the size of the built sidecar in `apps/desktop/src-tauri/binaries/`.

## What a careless run gets wrong

- Run the commands in the foreground, one at a time, with nothing else running.
- An incomplete log is not a result. If a command is killed, rerun it into `attempt-<n>/` and keep both.
- `mise run test-cli` is the only gate that runs native parity. Check that its log shows the native tests were not skipped (`NODETTO_CLI_TEST_BINARY` set by the task).
- Do not "fix" a failing baseline test.

## Invariants

The working tree source is unchanged. `git status --porcelain` before and after shows the same entries; only gitignored `tmp/`, `target/`, binaries and the progress log change.

## Worker rules

- Record `git hash-object impl-plans/active/ipd-00-baseline.md` first.
- Edit only the progress log and files under `tmp/ipd-s772/ipd-00-baseline/`.
- No state-changing git commands. No emojis.
- No file in the evidence directory may match a Bun test name pattern (`*.test.*`, `*.spec.*`, `*_test.*`).

## Done criteria (mechanically checkable)

- `test -s tmp/ipd-s772/ipd-00-baseline/final/verify.log`
- `test -s tmp/ipd-s772/ipd-00-baseline/final/test-cli.log`
- `test -s tmp/ipd-s772/ipd-00-baseline/final/build-cli.log`
- `test -s tmp/ipd-s772/ipd-00-baseline/final/typecheck.log`
- The progress log contains:
  - a table row per command with its exit code and counts;
  - a "Baseline failures" table, possibly empty and then marked "none";
  - the engine bundle size from `tmp/ipd-s772/ipd-00-baseline/engine/diagram.js`, with both exit codes.
- `git diff --stat -- packages apps crates` is empty after the run.

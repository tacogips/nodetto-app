# cpf-08-native-parity

- planId: cpf-08-native-parity
- planPath: impl-plans/active/cpf-08-native-parity.md
- progressPath: impl-plans/progress/cpf-08-native-parity.md
- wave: 4
- dependsOn: cpf-04-edit-convert-op, cpf-06-wiring
- Design: `design-docs/specs/design-convert-participant-frame-scope.md`, "Rollout and verification
  constraints".
- Worker rules: `impl-plans/active/cpf-00-overview.md`.
- writePaths:
  - `apps/cli/src/native-parity/convert.test.ts`
  - `apps/cli/src/native-parity/frame-scope.test.ts`
  - `apps/cli/src/native-parity/sequence-participant.test.ts`
  - `impl-plans/progress/cpf-08-native-parity.md`
  - `tmp/cpf-s748/cpf-08-native-parity`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

The native CLI runs the same TypeScript bundle in Boa. E1, E2 and E3 must produce the same stdout,
stderr, exit code and file bytes as the Bun CLI, and must not slow existing commands. This plan adds
parity tests and records CPU time against a pre-change binary.

## Non-goals

- No product code, Rust change, deadline change or `harness.ts` change.
- Do not list a binary-less native command: without `NODETTO_CLI_TEST_BINARY`, these tests skip.

## File-level changes

Three new test files, imitating `apps/cli/src/native-parity/edit-usability.test.ts`, with `compare`,
`compareFile` and `nativeTest` from `./harness.ts`, and temp directories cleaned in `finally`.

## What a careless implementation gets wrong

- `keyAfter` is random: converting to `sequence.participant` without `semantic.order` differs between
  runs. Always pass `semantic.order` where the file is compared.
- Generated ids are random: pass explicit `id` values in `add` ops, or build the document once and
  compare from that file.
- `compareFile` writes the source before each run. Reuse it so both CLIs start from the same bytes.
- PNG bytes can differ by platform fonts: compare SVG for E2. For PNG or PDF compare the exit code
  only, with a single-space name.
- A native deadline timeout gets up to 3 attempts. Do not relax a deadline.

## Tests

`convert.test.ts`:

- `convert` by id with `shape`, `--format json` and text -> identical output and file.
- `--dry-run` listing a dropped field and connectors -> identical, file unchanged.
- `where`/`expect` multi-match -> identical.
- Incompatible table bounds, invalid connector, BPMN flow on a text annotation -> identical stderr
  and exit code 2, file unchanged.
- `delete` with `reconnectTo` -> identical output and file.
- `reconnectTo` failure -> identical stderr, file unchanged.

`frame-scope.test.ts`, using the `catalog`, `zone`, widgets and gadgets repro:

- `ddl --frame catalog --strict` -> identical SQL, exit 0.
- `ddl --frame zone --strict` -> identical stderr naming gadgets, exit 3.
- Positional frame above a table -> identical SQL.
- `lint --page ...`, text and JSON -> identical, with a `frame-straddle` finding.

`sequence-participant.test.ts`:

- `export --format svg` with actor, service, db and messages -> identical.
- `types sequence.participant`, text and JSON -> identical.
- `export --format png` with a single-space name -> same exit code 0 in both.

## Timing

1. Build the pre-change binary. The source copy must be in the hidden directory
   `target/cpf-baseline/.src` before any test command runs. `bun test` collects test files from
   non-hidden directories under `target`, so a non-hidden copy adds pre-change tests to sibling
   commands and the final gates (recorded in `impl-plans/progress/zorder-08-native-parity.md:12`).
   - `mkdir -p target/cpf-baseline/.src`
   - `git archive 1e8f43d224d7b43e200eb2229e7be17b39ca033c | tar -x -C target/cpf-baseline/.src`
   - `ln -s "$PWD/node_modules" target/cpf-baseline/.src/node_modules`
   - `mkdir -p target/cpf-baseline/.src/packages/core/node_modules`
   - `ln -s "$PWD/packages/core/node_modules/polygon-clipping" target/cpf-baseline/.src/packages/core/node_modules/polygon-clipping`
   - `CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli --manifest-path target/cpf-baseline/.src/Cargo.toml --target-dir target/cpf-baseline/cargo`
   - Prove it is pre-change: `edit` with a `convert` op on that binary reports `Unknown op`. The
     `node_modules` links could otherwise resolve `@nodetto/*` to the changed tree.
2. `CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli`.
3. With `/usr/bin/time -p`, for both binaries, three runs each with the median user CPU, on a generated
   realistic document (300 nodes and 300 edges on one page, 40 tables in nested frames, 20 sequence
   participants): an `edit` batch of 50 `update` ops, `ddl --frame`, `lint`, and `export --format svg`.
4. Current binary only: a 50-op `convert` batch with `--dry-run`, a `delete` with `reconnectTo`.
5. Record all of it in `tmp/cpf-s748/cpf-08-native-parity/timing.txt`. A shared command must be at
   most 1.25 times the baseline. If it exceeds that, report it as a finding. Do not relax anything.

## Verification

1. `CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli` exits 0.
2. `NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity/convert.test.ts apps/cli/src/native-parity/frame-scope.test.ts apps/cli/src/native-parity/sequence-participant.test.ts`
   exits 0, with the tests running, not skipped. Up to 3 attempts for deadline timeouts only.
3. `bun run typecheck` exits 0.
4. `bunx biome check` on the three test files exits 0.

## Done criteria

- The log for command 2 shows `0 skip`.
- `test -x target/cpf-baseline/cargo/release/nodetto-cli` exits 0, and `timing.txt` holds both binaries.
- `find target/cpf-baseline -path target/cpf-baseline/.src -prune -o -name '*.test.ts' -print` produces no output.
- `git diff --quiet 1e8f43d -- apps/cli/src/native-parity/harness.ts apps/cli/native crates` exits 0.
- The progress log lists evidence for each command, and never runs `cargo clean`.

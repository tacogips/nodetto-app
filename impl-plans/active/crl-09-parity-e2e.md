# crl-09-parity-e2e

- planId: crl-09-parity-e2e
- planPath: impl-plans/active/crl-09-parity-e2e.md
- progressPath: impl-plans/progress/crl-09-parity-e2e.md
- wave: 2; dependsOn: crl-08-repair-labels (parity, end-to-end checks and timings measure its routes and labels)
- Manifest (single source for writePaths, sharedPaths, artifactRoots): `impl-plans/active/crl-s754-dispatch.json`
- Design (binding): `design-docs/specs/design-connector-routing-arranging.md`, sections "Fixture and acceptance tests" and "Baseline binary and timing".
- Evidence: `tmp/crl-s754/crl-09-parity-e2e/`, with gate logs in `final/`.

## Intent and context

Finishes W3 and W4, and carries the unfinished test list from `crl-07-wiring`. Bun and the native CLI (a Rust host running the shared TypeScript engine in Boa) must give byte-identical results for connector routing, arrange and lint. Timings against the pre-change binary are recorded.

## Non-goals

- No new behavior. A source edit is allowed only to fix a defect that a test here exposes, and only in the source paths this plan lists. Record the failing test with each such edit.
- Do not edit `apps/cli/src/__fixtures__/connector-arrange.ts`, help, docs, `commands.ts` or `packages/core/src/index.ts`.
- Do not change `bunfig.toml`, `mise.toml` or `package.json` to influence test discovery.
- No raster assertions. Do not add a new timing assertion or relax a deadline.

## Baseline binary

The decision is final: build outside the repository working tree. Never use `target/crl-baseline`, and never place baseline source anywhere `bun test` can discover it. Do not follow the baseline steps in `crl-07-wiring`.

1. `BASE=$(mktemp -d)`, and confirm it does not start with the repository root.
2. `mkdir "$BASE/src"`, then `git archive 1e8f43d | tar -x -C "$BASE/src"`.
3. In `$BASE/src`: `bun install --frozen-lockfile`.
4. `CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli --manifest-path "$BASE/src/Cargo.toml" --target-dir "$BASE/build"`.
5. Record under "Baseline audit" in the progress log: the commit, `bun --version`, `cargo --version`, each command with its exit code, and `shasum -a 256` of the binary.

## Timing

Run with `/usr/bin/time -p`, 3 runs each, baseline and current release binaries, on fresh copies:

- `arrange <copy> --page States --mode layered --write`, then `--mode route --write`
- `lint <copy> --metrics`, and `lint <copy> --fix`
- the batch and mixed fixtures used by `apps/cli/src/native-parity/edit-performance.test.ts`

Generate the fixture with `bun apps/cli/src/__fixtures__/connector-arrange.ts`. Record user seconds, means and the current to baseline ratio. The ratio is a record, not a gate. Current layered then route above a few seconds in total is a repair item, hot loops first. If baseline rejects a command, record its output and exit code, and report that row as not comparable.

## File-level changes

`apps/cli/src/native-parity/connect-routing.test.ts`, using `nativeTest`, on independent documents as the existing test does (created connector ids differ, so compare semantic and visual, not raw bytes):

- top-level `routing` and `routingAvoidObstacles`
- `visual.routing` moved to semantic
- precedence: explicit field over page default over page convention
- `set-page-routing` set, then clear with `"routing":null`
- `add-page` with `connectorRouting`, plus the rejection of `manual` (same exit code and stderr)
- plain `connect` following uniform peers (page convention)

`apps/cli/src/native-parity/connector-arrange.test.ts`, using `compare` and `compareFile` (byte comparison, because ids are fixed):

- keep the layered and route steps
- `lint --metrics` in text and JSON on the arranged document; assert `overlapping segment pair(s)` in the text
- `lint --fix` on an arranged document with one label forced into overlap by a stored `labelPosition` or offset; assert stdout contains `moved label`
- replace the export of the connector-free Architecture page with a self-authored fixed-id document holding A, C, B, D and connectors stored in the `semantic` and `visual` forms

`apps/cli/src/connector-routing-e2e.test.ts` (new), which drives the CLI commands in process or by spawning Bun, and reads SVG geometry:

- A, C, B on one row and D below, using `box-a`, `box-c`, `box-b` and `box-d` from the Architecture page of `connectorArrangeDocument()`.
- Parse the connector geometry from the `polyline` `points`, or `line` for a 2-point route, as `packages/core/src/svg-export/connectors.ts` emits it. A `path` output is a test failure to investigate.

Remaining `crl-07-wiring` tests, in `apps/cli/src/connector-arrange.test.ts`, `apps/cli/src/lint-diagram.test.ts` or `apps/cli/src/arrange-modes.test.ts`. For each, first search for an existing test. If one covers it, record which in the progress log and do not duplicate it.

## What a careless implementation gets wrong

- `compareFile` restores the source before each binary, and leaves the native result in the file. Read the file before the next step, as the existing test does.
- A `lint --fix` on an already clear document moves nothing, so a parity pass there proves nothing about label moves. Assert the `moved label` line.
- Forced overlap must survive `parseDocument`. Set it through a stored semantic, then confirm `labelOverlaps` is above 0 before the fix.
- A self-loop side check must read stored ports after layered then route, for both `from` and `to` of every other edge on that state.
- Run a `nativeTest` only with the binary set. A skipped `nativeTest` is a failure. Never list a binary-less native command.
- Keep the raster rule: geometry and metrics only.
- A native result counts only if its log shows no `target/crl-baseline` path.

## Tests to add (situation -> outcome)

End-to-end (W4):

- `set-page-routing` orthogonal with `routingAvoidObstacles`, then plain `connect` A->B, `export --format svg` -> no segment enters C's box, polyline equals `resolveConnector` points, two exports byte-identical.
- Peer connector stored as orthogonal with `routingAvoidObstacles`, no page default, plain `connect` A->B -> same outcome.
- D->B with `semantic` routing fields -> every consecutive pair of points has equal x or equal y.
- D->B with `visual` routing fields, loaded from JSONL -> same.
- Fixture after layered then route -> each `loop-*` side is used by no other connector end on that state.

Carried from `crl-07-wiring`:

- Second `--mode layered --write` -> "0 layer update(s)".
- Small two-frame page where `barycenter` or `input` strictly beats `rank`: `layered --write`, then `--check` -> exit 0, and a second `--write` -> "0 layer update(s)".
- Same page with a manual connector, `layered` without `--reset-manual` -> its stored semantic is unchanged, apart from label fields.
- Arranged fixture -> no route segment enters a state that is not its endpoint.
- Each `loop-*` label box -> score 0.
- `--check` on the arranged page -> exit 0; on the input -> exit 1 with no `Moved` line.
- Arranged fixture with a label forced into overlap, `lint --fix --metrics --format json` -> `labelOverlaps` 0 on `States`, `fixes` lists moves, second run -> no fixes.
- Architecture page with a `label-collision` finding, `lint --fix` -> finding gone.
- Document with both wrap and label fixes -> exactly one `writeText`, rerun -> none, and `formatFixLines` includes both `line break(s)` and `moved label`. The existing "fix writes once" assertion stays.
- A failing label batch -> nothing written, wrap fixes not saved.
- `.bpmn` with `--fix` -> exit 2.
- `lint --metrics` text and JSON -> `segmentOverlaps` per page and in the summary.

## Invariants

The fixture generator is unchanged. No deadline changes. `apps/cli/src/lint-diagram.test.ts` keeps `expect(writes).toBe(1)` in "fix writes once". Existing assertions change only under the rebaseline rule in `crl-08-repair-labels`.

## Worker rules

Before starting, record `git hash-object` of this plan. Read each file fresh before each edit and record pre and post `git hash-object` in the progress log. On drift, re-read, keep the other change, record it. Edit only your own progress log. No state-changing git commands. No broad formatting. Never run `cargo clean`. Neutral names only. No emojis. Before repeating a gate, move `final/` to `attempt-<n>/`. An incomplete log is not a passing check.

## Verification (each must exit 0, full output in `final/<name>.log`)

1. `bun test apps/cli/src/connector-routing-e2e.test.ts apps/cli/src/connector-arrange.test.ts apps/cli/src/lint-diagram.test.ts apps/cli/src/arrange-modes.test.ts apps/cli/src/lint-metrics.test.ts` -> 0 fail.
2. `bun run typecheck` -> exit 0.
3. `bunx biome check apps/cli/src/connector-routing-e2e.test.ts apps/cli/src/native-parity/connect-routing.test.ts apps/cli/src/native-parity/connector-arrange.test.ts` -> exit 0.
4. `sh -c 'CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity/connect-routing.test.ts apps/cli/src/native-parity/connector-arrange.test.ts apps/cli/src/native-parity/layout.test.ts apps/cli/src/native-parity/edit-performance.test.ts'` -> 0 fail, 0 skip. Up to 3 attempts on a deadline timeout only, with CPU time compared to baseline.
5. `test ! -e target/crl-baseline` -> exit 0.
6. `git diff --exit-code -- apps/cli/src/__fixtures__/connector-arrange.ts` -> exit 0.

## Done criteria

- Verification 1 to 6 exit 0 with complete logs and exit statuses in the progress log.
- The progress log holds "Baseline audit", all timing rows with ratios, the coverage record for each carried test, and the failing test for any source edit.
- `grep -c 'moved label' apps/cli/src/native-parity/connector-arrange.test.ts` is at least 1.
- `grep -n 'connectorRouting' apps/cli/src/native-parity/connect-routing.test.ts` matches.

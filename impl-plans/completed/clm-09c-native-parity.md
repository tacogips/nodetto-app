# clm-09c-native-parity

- planId: clm-09c-native-parity
- planPath: impl-plans/active/clm-09c-native-parity.md
- progressPath: impl-plans/progress/clm-09c-native-parity.md
- Manifest: `impl-plans/active/clm-s740-dispatch.json`. Workflow mode: `issue-resolution`.
- wave: 1; dependsOn: none. Evidence: `tmp/clm-s740/clm-09c-native-parity/`.
- Design: `design-docs/specs/design-cli-layout-merge-lint.md`, sections "Verification" (row "Native parity" and rows A1
  to A5, B1, B3, C1 to C3, A6, D1 to D3, E1, E2, F1 to F3), and "Continuation 5 partition".

## Intent and context

The native CLI runs the shared TS engine in Boa. New commands and flags are wired at HEAD 235b8c8, but no native parity
test covers them, and native behavior of route mode is still unobserved. This plan adds four topic files that compare
Bun with the release binary.

## Non-goals

- No Rust changes, and no feature logic. A defect in a feature module or the Rust host is a finding in the progress log
  for the owning plan, or a blocker when no plan owns it.
- No edits to help, docs, `commands.ts`, or `cli-wiring.test.ts`.
- Never relax a deadline. Never list a binary-less native parity command.
- No test pins the Q11 reproduction either way.

## File-level changes

- `apps/cli/src/__fixtures__/bpmn-layered.ts` (new). Contract, also used by clm-09-wiring timing:
  `export function bpmnLayeredDocument(units = 60): string` returns canonical JSONL with one page of kind `bpmn` named
  `Flow`, 3 pools, 6 lanes (2 per pool), `units` tasks spread evenly with sequence flows, and neutral names such as `Order
  step 12`. Deterministic ids. No randomness. Imitate `apps/cli/src/__fixtures__/obstacle-routing-batch.ts`. The document
  must validate cleanly.
- `apps/cli/src/native-parity/harness.ts`: add one additive export, `compareFile(args, documentPath, source, cwd?)`, which
  writes `source`, runs Bun and captures output and the resulting file, writes `source` again, runs the binary, and asserts
  exit code, stdout, stderr and file bytes are equal. `compare` stays unchanged. No other harness edit, unless an asserted
  output changed.
- New test files use `nativeTest` from the harness, with a temp directory from `mkdtempSync` removed in `finally`. Imitate
  `apps/cli/src/native-parity/edit-performance.test.ts` and `documents.test.ts`.
- `apps/cli/src/native-engine.ts`: only for a native-only wiring gap a test proves. Record whether touched.

## Pitfalls

- `compare` runs Bun then native on the same files. For a command that writes (`--write`, `edit`, `lint --fix`, `merge
  --output`), the second run sees changed input. Use `compareFile`.
- `apps/cli/src/native-parity/edit-usability.test.ts` and the others must use the same absolute document path in both runs,
  because messages can contain paths.
- `nativeTest` skips without the binary, so a run without `NODETTO_CLI_TEST_BINARY` proves nothing. Your native gate must
  show more than 0 pass, and the grep gate enforces that.
- The binary bundles the shared TS at build time. Sibling plans edit `help.ts`, `commands.ts` and other shared files during
  this wave, so a mismatch can come from a stale binary. The gate command rebuilds on each attempt. A failure must trace to
  your files or a real defect before you act on it.
- Do not assert help text, which clm-09a is changing.
- Only this plan builds the release binary in wave 1. Do not delete or rebuild `target/clm-baseline` or
  `target/clm-s737-before`, and do not run `cargo clean`.
- Boa: do not add `String.prototype.split` with a regex on whole documents, or per-point destructuring in hot loops, to
  `native-engine.ts`.
- Per edit: fresh read, `git hash-object` before and after in the progress log, and a one-line intent. No state-changing
  git commands in this repository, no broad formatter, no lockfile changes.

## Tests (input -> expected)

Every case asserts Bun equals native (exit, stdout, stderr, and file bytes when written). Expected exit codes are also
stated, so a shared failure does not pass.

`native-parity/layout.test.ts`:

- `arrange --mode layered` on a state page with frames, and on an ERD page with frames -> exit 0.
- `arrange --mode layered` on `bpmnLayeredDocument()` -> exit 0; `--write` then `--check` -> exit 0.
- `arrange --mode route` on a BPMN page with a label collision -> exit 0, the file gets `labelPosition`. On an ERD page ->
  exit 0.
- Reset regression (design row A2): a connector with `routing: "manual"` and non-empty `routingWaypoints` with its straight
  path blocked. Without `--reset-manual` -> routing and waypoints unchanged. With it -> `routing: "orthogonal"`, no waypoints,
  and no element moves.
- `lint --metrics` on BPMN and ERD pages, text and JSON -> exit codes equal, `metrics` present.
- Sequence page with either mode -> exit 2.
- Deadline: `obstacleRoutingBatch().document` with `arrange --mode layered` on the binary -> exit 0, under 10000 ms measured
  with `performance.now()`, spawn timeout 60000, test timeout 120000.

`native-parity/merge.test.ts`:

- Clean, conflict and error merges with `compareFile`, using `--output` -> exits 0, 1, 2. Conflict stderr equal.
- Git driver scenario with the binary: the design B2 setup, with the same isolation as `apps/cli/src/merge-git.test.ts`
  (`GIT_CONFIG_GLOBAL=/dev/null`, `GIT_CONFIG_NOSYSTEM=1`, temp `HOME`, `commit.gpgsign=false`, `git init -b main`, quoted
  driver path) -> disjoint merge exits 0 and has both edits, and a conflicting merge exits non-zero and keeps ours.
- SVG export of a fixture with a raster attachment, with `TZ` and `LANG` different between Bun and native runs -> output
  file bytes equal.

`native-parity/edit-usability.test.ts`:

- C1: `update` with `label`. C2: an unknown field -> exit 2 with suggestion text.
- A6 and E1: frame `carryMembers:false`; pool move with `carryMembers:false` -> members keep positions; lane `x` change ->
  exit 2 with the E1 message; lane height below the minimum -> exit 2 with `at least`.
- F1: ambiguous `name:` -> exit 2 listing candidates. F2: `where` with wrong `expect` -> exit 2 with the file unchanged, and
  correct `expect` -> exit 0 with the matched line. F3: `select` then `update @ref` -> exit 0.
- C3: `textLayoutProblemDocument()` and a document with repeated warnings -> collapsed line; `--quiet` on `validate`, `edit`
  and `export --format svg`; `validate --strict --quiet` -> exit 3.

`native-parity/lint-rules.test.ts`:

- D1: overlapping ERD tables -> `node-overlap` row.
- D3: a missing image -> `file not found` and exit 1; an attachment symlink to a file outside the folder -> `cannot be read
  (outside the document folder, too large, or unreadable)`; a document opened through `../<dir>/doc.jsonl` with `cwd` set
  -> present image clean.
- D2: `lint --fix` with `compareFile` -> identical fixed file content; a second run makes no change; `.bpmn` -> exit 2.

## Invariants

- Existing parity files and deadlines stay as they are, unless wiring changed an asserted output. Record any such change.
- `compare` keeps its behavior.

## Verification

Each command must exit 0. See the manifest for the exact list. It builds the binary and runs the four topic files with up
to 3 attempts, checks that more than 0 tests passed and 0 failed, and runs typecheck and Biome on owned files.

## Done criteria

- All manifest verification commands exit 0, with every attempt's log kept in the evidence directory.
- `impl-plans/progress/clm-09c-native-parity.md` records each edit's hashes, attempts, and findings.

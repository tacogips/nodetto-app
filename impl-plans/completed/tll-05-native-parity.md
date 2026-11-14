# tll-05-native-parity

- planId: tll-05-native-parity
- planPath: impl-plans/active/tll-05-native-parity.md
- wave: 3
- dependsOn: tll-03-cli-lint, tll-04-cli-export
- Design: `design-docs/specs/design-text-layout-lint.md`, sections "Native
  CLI" and "Test plan" (native-parity part).
- Read `impl-plans/active/tll-00-overview.md` first.

## Intent and context

The native `nodetto-cli` runs the same TypeScript command bundle in the Boa
interpreter. `apps/cli/native/src/render.rs` only rasterises. So the new
lint and export behavior reaches the native binary with no Rust change.

This plan proves that:

- the native binary gives byte-identical stdout, stderr and exit codes to
  the TS CLI for the new lint and export cases;
- a dense architecture page lints within the existing per-launch deadline
  style.

## Non-goals

- No change under `apps/cli/native/**`, `Cargo.toml` or `Cargo.lock`, and no
  change to the existing parity tests or their budgets.
- No new golden JSONL under `packages/io/src/__fixtures__`, because that
  would grow the per-fixture loop at
  `apps/cli/src/native-parity.test.ts:43-64`.

## writePaths

- apps/cli/src/native-parity.test.ts
- impl-plans/progress/tll-05-native-parity.md
- tmp/text-layout-lint-s551/tll-05-native-parity
- target

sharedPaths: none.

## artifactRoots

- target. This is the cargo build output (release `nodetto-cli` binary)
  that `mise run test-cli` writes. It is git-ignored, and it is tracked as
  a digest manifest only, never as content. This plan writes no source
  under it.

## File-level changes

### `apps/cli/src/native-parity.test.ts`

Append one `nativeTest(...)` block at the end of the file. It uses the
existing `compare(args, cwd)` helper (:28-40).

- Make a temp dir with `mkdtempSync(join(tmpdir(), "nodetto-native-text-layout-"))`
  and remove it in `finally`. Imitate the export block at :250-300.
- Write these files from the `./__fixtures__/text-layout.ts` builders:
  - `problem.jsonl` (`textLayoutProblemDocument().source`);
  - `clean.jsonl`;
  - `dense.jsonl` (`textLayoutDenseDocument(300).source`).
- Run `compare` with `cwd` for:
  - `["lint", "clean.jsonl"]`
  - `["lint", "problem.jsonl"]`
  - `["lint", "problem.jsonl", "--format", "json"]`
  - `["lint", "problem.jsonl", "--page", "Architecture"]`
  - `["export", "problem.jsonl", "--format", "svg"]`
  - `["export", "problem.jsonl", "--format", "svg", "--output", "out.svg"]`
- After the export compares, also assert that the native stderr contains
  `warning: label-overflow node-clipped:`. This proves the behavior is not
  trivially absent on both sides.
- For the dense page, run the native binary alone, as
  `apps/cli/src/dense-relations.test.ts:63` does:
  - `Bun.spawnSync([binary!, "lint", "dense.jsonl", "--format", "json"], { cwd, timeout: 60000 })`;
  - expect exit 0 and no `panicked` in stderr;
  - stdout must equal the TS result from
    `Bun.spawnSync([process.execPath, source, "lint", "dense.jsonl", "--format", "json"], { cwd })`.
- Test budget argument: `180000`. Comment it the way :61-62 is commented
  (launch count times per-launch budget).

## Pitfalls

- Import the fixture builders with a relative path (`./__fixtures__/text-layout.ts`),
  as `dense-relations.test.ts` does.
- `compare` without `cwd` resolves relative paths against the test process
  cwd. Always pass `cwd`.
- Without `NODETTO_CLI_TEST_BINARY`, the block must skip (it uses
  `nativeTest`). With the binary, it must run. Show in the log that it ran
  and was not skipped.
- The release binary embeds the bundle at build time. Run the full
  `mise run test-cli` after waves 1-2 are done, so the binary contains the
  tll-03 and tll-04 changes. Do not run a stale binary.
- If a mismatch appears, do not "fix" it in this file by loosening the
  comparison. Record it with the diff and the owning plan (03, 04 or 01).

## Test cases (`input -> expected`)

- TS and native `lint clean.jsonl` -> identical: exit 0, empty stdout and
  stderr.
- TS and native `lint problem.jsonl` in text, JSON and `--page` forms ->
  identical output and exit 0.
- TS and native `export problem.jsonl --format svg`, to stdout and with
  `--output` -> identical stdout and stderr, and stderr has the
  `label-overflow node-clipped` warning.
- Native dense lint -> finishes within 60 s and equals the TS JSON.

## Verification (each must exit 0; logs under the scratch root)

1. `BUN_OPTIONS=--jsx-runtime=classic bun test apps/cli/src/native-parity.test.ts > tmp/text-layout-lint-s551/tll-05-native-parity/parity-skip.log 2>&1; echo "exit=$?"`.
   Evidence: exit 0 with the native tests skipped (no binary set), so the
   file compiles.
2. `BUN_OPTIONS=--jsx-runtime=classic CARGO_TERM_QUIET=true mise run test-cli > tmp/text-layout-lint-s551/tll-05-native-parity/test-cli.log 2>&1; echo "exit=$?"`.
   Evidence: exit 0, and the log shows the new text-layout parity test as
   passed, not skipped.
3. `bunx biome check apps/cli/src/native-parity.test.ts > tmp/text-layout-lint-s551/tll-05-native-parity/biome.log 2>&1; echo "exit=$?"`.
4. `git diff --quiet -- apps/cli/native; echo "exit=$?"`.
   Evidence: exit 0.

## Done criteria

- Commands 1-4 meet their evidence.
- The `test-cli` log path and its final pass and fail counts are in the
  progress log.
- The progress log has hashes, the intent snapshot and `STATUS: done` as
  the last line.

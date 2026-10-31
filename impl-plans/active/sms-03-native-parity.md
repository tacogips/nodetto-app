# sms-03-native-parity

- planId: sms-03-native-parity
- planPath: impl-plans/active/sms-03-native-parity.md
- progressPath: impl-plans/progress/sms-03-native-parity.md
- wave: 3 of 3 in session 575. It runs alone in its wave and is the last
  plan.
- dependsOn: sms-02-cli-edit (which depends on sms-01-editor-facade). The
  parity gates build the release binary from the whole tree, so the
  earlier plans must be finished. This plan also runs the final combined
  verification.
- Design: `design-docs/specs/design-source-module-split.md`. Read
  "3. Native parity tests", "4. Documentation", "5. Verification" (commands
  1-9) and "Rollout constraints".
- Evidence directory: `tmp/source-module-split-s575/sms-03-native-parity/`.
  Write only `.log` and `.txt` files there.

## Intent and context

`apps/cli/src/native-parity.test.ts` is 1012 lines and has 17 `nativeTest`
blocks. Each block compares the TypeScript CLI (`bun main.ts`) with the
release binary (`NODETTO_CLI_TEST_BINARY`). When the binary variable is
unset, `nativeTest` is `test.skip`. This plan moves the shared harness into
a non-test module and the blocks into five test files named for their
topic. Names, bodies, assertions and timeouts stay the same. `mise run
test-cli` (`bun test apps/cli/src` with the binary set) must still run all
17 blocks.

## Non-goals

- Do not change any test name, assertion, timeout, fixture or command
  argument.
- Do not touch `apps/cli/src/__fixtures__/`, `main.ts`, other test files,
  or any source file. Do not touch `packages/`.
- Do not update completed design records that mention
  `native-parity.test.ts` (design section 4).

## File-level changes

1. `apps/cli/src/native-parity/harness.ts` (new, not a test file). It
   exports:
   - `binary` (`process.env.NODETTO_CLI_TEST_BINARY`);
   - `cliSrcDir` (`join(import.meta.dir, "..")`, the old file's
     `import.meta.dir`);
   - `cliEntry` (`join(cliSrcDir, "main.ts")`, the old module-level
     `source`);
   - `fixtureRoot` (`join(cliSrcDir, "../../../packages/io/src/__fixtures__")`);
   - `nativeTest` (`binary ? test : test.skip`);
   - `compare(args: string[], cwd?: string, stdin?: string)`, moved
     unchanged (lines 34-47), using `cliEntry`.

   Only constants and functions are defined: no `readdirSync`, no file
   writes, nothing else at import time.
2. New test files under `apps/cli/src/native-parity/`. Keep the original
   order of blocks within each file:
   - `documents.test.ts`, 5 blocks: "native CLI matches every JSONL golden
     fixture ..." (line 53), "native CLI matches help, element catalogue
     ..." (72), "native --cwd supports document commands ..." (199),
     "native CLI lists stable page aliases ..." (397), and "native CLI
     reads a document with a 20,000-point path quickly" (881). This file
     defines `const goldenFixtures = readdirSync(fixtureRoot).filter(...)`
     at module level, because block 1's timeout
     `goldenFixtures.length * 5000` is read when the test is registered.
   - `drawing.test.ts`, 4 blocks: "native edit handles refs ..." (115),
     "native CLI draws and exports a state flow" (466), "native CLI creates
     a flowchart ..." (547), "native CLI keeps manual bends fixed ..."
     (611).
   - `export.test.ts`, 3 blocks: "native renders SVG with byte parity
     ..." (253), "native CLI exports Mermaid, D2 and every Code panel
     output" (318), "native PNG export fills its last row and column ..."
     (836), plus the local helper `decodeRgbaPng` (787-835).
   - `pcb.test.ts`, 3 blocks: "native CLI writes the same breadboard PCB
     archive ..." (659), "native pcb import and gerber match ..." (698),
     "native gerber import matches ..." (737).
   - `text-layout.test.ts`, 2 blocks: "native CLI matches text-layout lint
     and export, including dense pages" (917), "native CLI matches
     text-layout lint on wide labels, freeform and flowchart pages" (961).
     Import the fixtures from `../__fixtures__/text-layout.ts`.
3. Delete `apps/cli/src/native-parity.test.ts`.
4. `apps/cli/native/README.md`: in the last paragraph, change
   "`apps/cli/src/native-parity.test.ts` compares commands ..." so that it
   names `apps/cli/src/native-parity/`: a shared `harness.ts` and topic
   files for documents, drawing, export, PCB and text layout. Keep the rest
   of the sentence and the `mcp-stdio.test.ts` sentence.
5. `impl-plans/progress/sms-03-native-parity.md` (new): the progress log.

## Patterns to imitate

- The old file itself. Copy each block's text exactly, changing only the
  path expressions.
- Imports: each file imports only what it uses, from `bun:test`,
  `node:fs`, `node:os`, `node:path`, `node:zlib`, `@nodetto/core`,
  `@nodetto/io` and `./harness.ts`. Biome flags unused imports.

## Pitfalls

- Paths. Every `join(import.meta.dir, X)` in a block (old lines 477, 558,
  663, 702 and 740) becomes `join(cliSrcDir, X)` with the same `X`. A bare
  `import.meta.dir` in a moved block would point at
  `apps/cli/src/native-parity/` and break fixture paths. Search each new
  file for `import.meta.dir`: only `harness.ts` may contain it.
- Local variables named `source` inside blocks (for example old line 120)
  stay as they are. Only the module-level `source` becomes `cliEntry`.
- `compare` keeps `binary!` (a non-null assertion) and calls `expect`.
  Import `expect` and `test` from `bun:test` in `harness.ts`.
- Do not wrap blocks in `describe`. That would change the reported test
  names.
- Pass the block count and the skip check (G4 and G5) before deleting the
  old file, so that no block is lost or duplicated.

## Shared working directory protocol

- Before each edit, read the file fresh. Record its `shasum -a 256` before
  and after the edit in the progress log, including the deleted file's
  pre-delete hash.
- On drift, stop, record it, and re-read.
- Before the first edit, record the intent snapshot (the block-to-file
  table above) in the progress log.

## Steps

1. Baseline, on the tree before any edit: B1 and B2.
2. Create `harness.ts` and the five test files. Delete the old file. Edit
   the README.
3. Run G1-G12 (G1-G9 are the combined-tree final verification).

## Tests

No new test cases. The 17 blocks move unchanged. Evidence that nothing is
lost:

- the block count in the new files is 17 (G4);
- without the binary, all 17 are reported as skipped (G5);
- with the binary, all 17 pass and none is skipped (G3).

## Verification

Every gate must exit 0. Record each one's exit code and log path in the
progress log.

- B1:
  `BUN_OPTIONS=--jsx-runtime=classic bun test > tmp/source-module-split-s575/sms-03-native-parity/baseline-bun-test.log 2>&1`.
  Record the summary lines.
- B2: `test "$(grep -c '^nativeTest(' apps/cli/src/native-parity.test.ts)" -eq 17`
  exits 0.
- G1 (design command 1):
  `BUN_OPTIONS=--jsx-runtime=classic CARGO_TERM_QUIET=true mise run verify > tmp/source-module-split-s575/sms-03-native-parity/verify.log 2>&1`
  exits 0. The log has ` 0 fail`. Its pass count equals B1's, and its
  skip count equals B1's, because the same 17 blocks still skip there.
  Also record that the final pass count is at least sms-01's B1 pass count
  plus the tests that sms-02 added.
- G2 (design command 2):
  `CARGO_TERM_QUIET=true mise run test-cli > tmp/source-module-split-s575/sms-03-native-parity/test-cli.log 2>&1`
  exits 0, with ` 0 fail`.
- G3 (design command 3):
  `NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity > tmp/source-module-split-s575/sms-03-native-parity/native-parity.log 2>&1`
  exits 0. Then
  `grep -Ex ' *17 pass' tmp/source-module-split-s575/sms-03-native-parity/native-parity.log`
  exits 0, and
  `test -z "$(grep -E '^ *[1-9][0-9]* skip$' tmp/source-module-split-s575/sms-03-native-parity/native-parity.log)"`
  exits 0.
- G4 (design command 4):
  `test "$(cat apps/cli/src/native-parity/*.test.ts | grep -c '^nativeTest(')" -eq 17`
  exits 0.
- G5: without the binary,
  `env -u NODETTO_CLI_TEST_BINARY bun test apps/cli/src/native-parity > tmp/source-module-split-s575/sms-03-native-parity/parity-skip.log 2>&1`
  exits 0, and `grep -Ex ' *17 skip' tmp/source-module-split-s575/sms-03-native-parity/parity-skip.log`
  exits 0. All blocks are collected and gated by `nativeTest`.
- G6 (design command 5, full scope):
  `find packages/core/src/editor.ts packages/core/src/editor apps/cli/src/edit-command.ts apps/cli/src/edit apps/cli/src/native-parity -name '*.ts' -exec awk 'FNR == 701 { print FILENAME " exceeds 700 lines"; bad = 1 } END { exit bad }' {} +`
  exits 0, and
  `test "$(wc -l < packages/core/src/editor.ts)" -le 450 && test "$(wc -l < apps/cli/src/edit-command.ts)" -le 300`
  exits 0.
- G7 (design command 6):
  `test -z "$(find packages/core/src/editor apps/cli/src/edit apps/cli/src/native-parity -name '*[0-9]*')" && test ! -e apps/cli/src/native-parity.test.ts`
  exits 0.
- G8 (design command 7): the export-surface command, copied verbatim from
  the design, exits 0 and prints `export surface unchanged`. Also
  `git diff --exit-code b52e4dbe5509f739a3c1e996377ee2ac0e70059b -- packages/core/src/index.ts`
  exits 0.
- G9 (design commands 8 and 9):
  `test -z "$(bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess 2>&1 | grep -E '^packages/core/src/(editor\.ts|editor/)')"`
  exits 0, and the facade import scan, copied verbatim from the design,
  exits 0 and prints `facade imports ok`.
- G10: `test -z "$(grep -rn 'import.meta.dir' apps/cli/src/native-parity | grep -v '/harness.ts:')"`
  exits 0.
- G11: `grep -q 'apps/cli/src/native-parity/' apps/cli/native/README.md`
  exits 0.
- G12: record, for the progress log,
  `wc -l packages/core/src/editor.ts packages/core/src/editor/*.ts packages/core/src/editor/facade/*.ts apps/cli/src/edit-command.ts apps/cli/src/edit/*.ts apps/cli/src/edit/operations/*.ts apps/cli/src/native-parity/*.ts > tmp/source-module-split-s575/sms-03-native-parity/final-wc.txt`.
  It exits 0 because every glob matches a file once all three plans are
  done.

## Acceptance criteria

- `apps/cli/src/native-parity/` holds `harness.ts` and the five topic test
  files, with 17 `nativeTest` blocks in total and the same names.
  `apps/cli/src/native-parity.test.ts` no longer exists.
- G1-G12 exit 0, with logs in the evidence directory. G3 shows 17 pass and
  no skip on the release binary.
- The README names the new location.
- The progress log has the baseline, the gate results, the hashes, drift
  events and `final-wc.txt`.

## Progress log

`impl-plans/progress/sms-03-native-parity.md` records the intent snapshot,
baselines, steps, gate exit codes, log paths, drift events and final line
counts. Edit only this progress log, not any other plan or progress file.

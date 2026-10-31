# sms-03-native-parity

- planId: sms-03-native-parity
- planPath: impl-plans/active/sms-03-native-parity.md
- progressPath: impl-plans/progress/sms-03-native-parity.md
- wave: 3 of 3 in session 589. It runs alone in its wave and is the last
  plan.
- Source state: `apps/cli/src/native-parity.test.ts` and
  `apps/cli/native/README.md` are byte-identical to b52e4db, so every line
  number below still applies.
- dependsOn: sms-02-cli-edit (which depends on sms-01-editor-facade). The
  parity gates build the release binary from the whole tree, so the
  earlier plans must be finished. This plan also runs the final combined
  verification.
- Design: `design-docs/specs/design-source-module-split.md`. Read
  "3. Native parity tests", "4. Documentation", "5. Verification" (commands
  1-10), "Rollout constraints" and D11.
- Evidence directory: `tmp/source-module-split-s589/sms-03-native-parity/`.
  Write only `.log` and `.txt` files there. Baselines and the pre-delete
  check go directly in it. The gate run goes in `final/` (the design's
  `$d`). If it must be repeated after a fix, first `mv final` to
  `attempt-<n>/`, then rerun into a fresh `final/`.
- Write paths (manifest `impl-plans/active/source-module-split-s589-dispatch.json`):
  `apps/cli/src/native-parity.test.ts` (deleted),
  `apps/cli/src/native-parity/`, `apps/cli/native/README.md`, the progress
  log, the evidence directory and `target/`. `target/` is the git-ignored
  build output root (`artifactRoots: ["target"]`).

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
- Local variables named `source` inside blocks (old lines 120-121) stay as
  they are. Only the module-level `source` (old line 31) becomes
  `cliEntry`. Its references are `compare` (old line 35) and the inline
  spawns at old lines 217, 678, 709, 748 and 945, in the `--cwd`, PCB,
  gerber-import and text-layout blocks. Every one of them becomes
  `cliEntry`. A missed site fails typecheck or the parity run.
- `compare` keeps `binary!` (a non-null assertion) and calls `expect`.
  Import `expect` and `test` from `bun:test` in `harness.ts`.
- Do not wrap blocks in `describe`. That would change the reported test
  names.
- Before you delete the old file, pass G4 and a directory-only
  collection check, so that no block is lost or duplicated. Run
  `env -u NODETTO_CLI_TEST_BINARY bun test apps/cli/src/native-parity/ > tmp/source-module-split-s589/sms-03-native-parity/pre-delete-collect.log 2>&1`
  and then `grep -Ex ' *17 skip'` on that log. The trailing slash keeps
  the old file out of this run. While the old file still exists, the
  un-slashed G5 filter would report 34 skip. G5 itself runs only after the
  deletion.
- Never edit a test deadline, a timeout (including block 1's
  `goldenFixtures.length * 5000`), `mise.toml` or another test file to
  make a gate pass. Retry only through the G1, G2 and G13 loops. Run them
  exactly as written, through `sh -c` or `bash -c`, because a bare `exit`
  in your own shell would end the session.

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
3. Run G1-G14 into `final/`, with G13 directly after G2 (G1-G9 and G13
   are the combined-tree final verification).

## Tests

No new test cases. The 17 blocks move unchanged. Evidence that nothing is
lost:

- the block count in the new files is 17 (G4);
- without the binary, all 17 are reported as skipped (G5);
- with the binary set by `mise run test-cli`, the run has ` 0 fail`, no
  skip line and the unchanged pass count of 183 (G2 and G3). So all 17
  blocks ran and passed on the release binary.

## Verification

Every gate must exit 0. Record each one's exit code and log path in the
progress log. Below, `F` stands for
`tmp/source-module-split-s589/sms-03-native-parity/final`; write the
literal path in every command.

- B1, with up to three attempts because `bun test` has deadlines too:
  `sh -c 'd=tmp/source-module-split-s589/sms-03-native-parity; mkdir -p "$d"; for i in 1 2 3; do BUN_OPTIONS=--jsx-runtime=classic bun test > "$d/baseline-bun-test-$i.log" 2>&1 && cp "$d/baseline-bun-test-$i.log" "$d/baseline-bun-test.log" && exit 0; done; exit 1'`.
  Record the summary lines of `baseline-bun-test.log`.
- B2: `test "$(grep -c '^nativeTest(' apps/cli/src/native-parity.test.ts)" -eq 17`
  exits 0.
- G1 (design command 1, load-tolerant):
  `sh -c 'd="$1"; mkdir -p "$d" && rm -f "$d"/verify-[123].log "$d/verify.log"; for i in 1 2 3; do BUN_OPTIONS=--jsx-runtime=classic CARGO_TERM_QUIET=true mise run verify > "$d/verify-$i.log" 2>&1 && cp "$d/verify-$i.log" "$d/verify.log" && exit 0; done; exit 1' sh F`
  exits 0. `grep -E '^ *0 fail$' F/verify.log` exits 0. Its pass count
  equals B1's, and its skip count equals B1's, because the same 17 blocks
  still skip there. B1 is expected to be ` 2956 pass` and ` 25 skip`:
  sms-01's 2945 plus the 11 tests from sms-02. So
  `grep -Ex ' *2956 pass' F/verify.log` and `grep -Ex ' *25 skip' F/verify.log`
  both exit 0. If B1 differs, compare against B1 and record why.
- G2 (design command 2, load-tolerant):
  `sh -c 'd="$1"; mkdir -p "$d" && rm -f "$d"/test-cli-[123].log "$d/test-cli.log"; for i in 1 2 3; do CARGO_TERM_QUIET=true mise run test-cli > "$d/test-cli-$i.log" 2>&1 && cp "$d/test-cli-$i.log" "$d/test-cli.log" && exit 0; done; exit 1' sh F`
  exits 0.
- G3 (design command 3; native parity is verified only through test-cli).
  On the green copy `F/test-cli.log`, all of these exit 0:
  - `grep -E '^ *0 fail$' F/test-cli.log`
  - `test -z "$(grep -E '^ *[1-9][0-9]* skip$' F/test-cli.log)"`
  - `grep -Ex ' *183 pass' F/test-cli.log`

  183 is the test-cli baseline: the ` N pass` line of
  `tmp/source-module-split-s589/sms-02-cli-edit/final/test-cli.log`. This
  plan adds no test. With the binary set, all 17 moved blocks run and
  pass inside this run. If all three G2 attempts fail, the gate fails and
  is never waived as load. A missing or extra block, or a path error in a
  moved block, is a regression to fix in this plan.
- G4 (design command 4):
  `test "$(cat apps/cli/src/native-parity/*.test.ts | grep -c '^nativeTest(')" -eq 17`
  exits 0.
- G5 (the collection check of design command 3): without the binary,
  `env -u NODETTO_CLI_TEST_BINARY bun test apps/cli/src/native-parity > F/parity-collect.log 2>&1`
  exits 0, and `grep -Ex ' *17 skip' F/parity-collect.log`
  exits 0. All blocks are collected and gated by `nativeTest`. The path
  filter now matches the `apps/cli/src/native-parity/` directory.
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
  `wc -l packages/core/src/editor.ts packages/core/src/editor/*.ts packages/core/src/editor/facade/*.ts apps/cli/src/edit-command.ts apps/cli/src/edit/*.ts apps/cli/src/edit/operations/*.ts apps/cli/src/native-parity/*.ts > F/final-wc.txt`.
  It exits 0 because every glob matches a file once all three plans are
  done.
- G13 (design command 10, CPU time). Run it directly after G2, with no
  source edit in between. Copy the multi-line `bash -c` command verbatim
  from design section 5, command 10. Replace only the trailing `"$d"`
  with the literal `F` path, and keep `/opt/homebrew/bin/nodetto-cli 0.8.5`
  as the last two arguments. It exits 0. Record the reference and new user
  times and their ratio from `F/cpu-time.log`. If the reference binary is
  missing or not 0.8.5, stop and record a blocker for the orchestrator.
  Do not create a git worktree yourself.
- G14: `git diff --exit-code 9e6ccc7 -- mise.toml` exits 0 (no test
  deadline or timeout configuration changed).

## Acceptance criteria

- `apps/cli/src/native-parity/` holds `harness.ts` and the five topic test
  files, with 17 `nativeTest` blocks in total and the same names.
  `apps/cli/src/native-parity.test.ts` no longer exists.
- G1-G14 exit 0, with logs in `final/`. G3 shows ` 183 pass`, ` 0 fail`
  and no skip line in `final/test-cli.log`, G5 shows ` 17 skip`, and
  G13's `final/cpu-time.log` shows a new user time at most 1.15 times the
  reference. The progress log records which attempt went green for G1, G2
  and G13.
- The README names the new location.
- The progress log has the baseline, the gate results, the hashes, drift
  events and `final-wc.txt`.

## Progress log

`impl-plans/progress/sms-03-native-parity.md` records the intent snapshot,
baselines, steps, gate exit codes, log paths, drift events and final line
counts. Edit only this progress log, not any other plan or progress file.

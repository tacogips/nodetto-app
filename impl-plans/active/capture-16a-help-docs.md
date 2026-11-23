# M16a capture-16a-help-docs (session 889)

- Stage: wave 1 of dispatch `capture-s889`. dependsOn: none (M1 to M15,
  M17 to M20, M22, M23a to M23f are accepted at `ac31a91`).
- Design: `design-docs/specs/design-ai-capture.md` revision 7, sections
  4.1 to 4.6, 5, 6.2, 6.6, 6.7, 7, 8.3, 8.5 ("M16 reduced scope"), 12, 13,
  CAP-R7-01 and CAP-R7-02.
- writePaths: `apps/cli/src/capture-help.ts`, `apps/cli/src/capture-docs.test.ts`
  (new), `docs/capture.md` (new), `docs/cli.md`,
  `impl-plans/active/capture-16a-help-docs.md`, `target`.
- artifactRoots: `target` (logs only under `target/capture-m16a/`).
- Pre-authorized existing tests (run, not edited): `capture-command.test.ts`,
  `ai-commands.test.ts`, `table-docs.test.ts`, `capture-cad.test.ts`,
  `capture-io.test.ts`, `capture-interference-options.test.ts`,
  `mcp-image.test.ts`. If one of them needs an edit, stop and record a
  scope amendment; do not edit it.

## Intent

An AI agent that only has `nodetto-cli --help`, `nodetto-cli help capture`
and the repository docs finds `capture` and knows how to use it on 2D and
3D CAD pages, how to read interference text and the hatched overlay, the
exit codes, MCP inline images and the desktop Export dialog.

## Non-goals

No option, behaviour, output or exit-code change. No edit of
`capture-help/*.ts` part files, `help.ts`, `mcp.ts`, `README.md`,
`impl-plans/README.md`, `mise.toml`, the design or the overview. No
description of cad3d M18 or M21 beyond the one `export` versus `capture`
sentence of design 8.3. No measured numbers (M16b measures, M16c writes
them into `docs/capture.md`).

## Changes

1. `apps/cli/src/capture-help.ts` (`CAPTURE_HELP`): replace only the last
   array entry `"Exit codes: 0 success, 2 usage, input or output error."`
   with one exit-code line and add one line after it:
   - Exit codes, matching design 4.2: 0 image written (also when identical
     bytes already existed); 1 only with `--fail-on-interference` when a
     pair interferes or a candidate was not checked; 2 usage, input,
     output, refusal (work limit) errors.
   - One line: the desktop Export dialog offers PNG and JPG of 2D pages and
     "3D view image" on CAD pages; full guide in `docs/capture.md`.
   Keep the usage block, part order and every part body unchanged. Keep
   each line at most 80 characters, like the existing parts.
2. `docs/capture.md` (new). Sections in this order, user wording, every
   claim taken from the cited design section (do not invent behaviour):
   purpose and one-line form; options table (every option of the help
   usage block with default); output (stdout lines and `--json`, including
   `approximate`, `uncheckedCount`, the `refinement capped` line; 4.2);
   where files go, `--force`, Store CLI `--output` note (4.3); 2D pages
   (5); 3D CAD pages (orthographic camera, the seven `--view` values with
   the `iso` octant, `--direction`, `--eye`, `--target`, `--up`, `--zoom`,
   `camera` and `frame` lines, body notes, meshes and open meshes,
   reference bodies, the sampled `cad.result.empty`, also with
   `--no-interference`; 6.2, 6.7, CAP-R4-09); `export` versus `capture` on
   a CAD page (8.3, one sentence); interference (definition, text form,
   cell and guarantee in the words of 6.6, facet note, hatched overlay and
   colours `#335c67`/`#fffdf8`, dark `#5fb4c7`/`#1f2427`, the four options);
   `## Exit codes` (0, 1, 2 and the three refusal messages of 12, each
   suggesting a smaller `--size`); determinism (7); MCP (`nodetto_capture`,
   `--inline`, 1 MiB limit, token cost; 4.5); desktop (Export dialog
   "3D view image", seven views plus "Current view", PNG or JPG, no
   interference switch in `captureCadImage`, 2D PNG/JPG not byte-equal to
   the CLI; 13); an agent loop example; `## Measured budgets` with exactly
   one sentence "Values are recorded by M16 from `target/capture-m16/`; see
   design section 10.3." (M16c replaces it); licences (the IJG sentence
   verbatim, pointer to `THIRD_PARTY_NOTICES.md`).
   Fenced example rules (the test runs them): each command line starts
   with `nodetto-cli capture `; no quotes, no shell variables, no pipes;
   a trailing `  # comment` is allowed; 2D examples use document
   `drawing.jsonl`, CAD examples use `plate.jsonl`; no `--element`,
   `--font-dir` or `--page <name>` in fenced lines (use `--page-number 1`);
   `--output` paths are relative.
3. `docs/cli.md`: (a) one line above line 141
   (`nodetto-cli export flow.jsonl --page Flow --format png ...`):
   `nodetto-cli capture flow.jsonl --output flow.png` with a short `#`
   comment; (b) append at the end of the file a section
   `## Capturing page images` of five to ten lines with two fenced
   examples (one 2D, one CAD with `--view`) and a link
   `[capture guide](capture.md)`. The two fenced examples follow the
   fenced example rules of change 2 (`drawing.jsonl` and `plate.jsonl`).
   Touch nothing else (cad3d M18 edits the 3D CAD section).
4. `apps/cli/src/capture-docs.test.ts` (new, `bun:test`). Imitate
   `apps/cli/src/capture-cad.test.ts:harness` (memory `CommandIo`, fake
   `CaptureBackend`) and `apps/cli/src/capture-command.test.ts:harness`
   plus `addRect` for the 2D document. Read docs with
   `readFileSync(new URL("../../../docs/capture.md", import.meta.url))`.

## Tests to add (capture-docs.test.ts)

- Every `--option` matched in the first `\n\n` block of `CAPTURE_HELP`
  -> appears in `docs/capture.md`.
- `docs/capture.md` -> contains `orthographic`, `--view`, `--eye`,
  `interference`, `cell`, `approximate`, `hatch`, `--fail-on-interference`,
  `## Exit codes`, `nodetto_capture`, `--inline`, `3D view image`,
  `Current view`, `## Measured budgets` and the IJG sentence verbatim.
- `CAPTURE_HELP` -> contains `0`, `1` and `2` in the exit-code line,
  `--fail-on-interference` and `docs/capture.md`.
- Every fenced `nodetto-cli capture` line of `docs/capture.md` and of the
  `## Capturing page images` section of `docs/cli.md` (at least 4 lines in
  total; assert the count) -> tokenized on whitespace after removing a
  trailing `#` comment; a token with a quote fails the test; run through
  `captureCommand` against the CAD plate document
  (`capturePlateDocument()`) when the document token is `plate.jsonl`, else
  a 2D `Editor` document with one rect -> `exitCode` is 0 and stderr does
  not contain `Usage: nodetto-cli capture`. The fake backend accepts png
  and jpg in `renderSolid`, implements `transcode`, and returns a report
  with no pairs.
- `docs/cli.md` -> contains `(capture.md)` and one `nodetto-cli capture`
  line before the first `nodetto-cli export flow.jsonl --page Flow` line.

## Pitfalls

- Do not change `capture-help.ts` parts or the usage block: the existing
  test "capture is discoverable in the overview and explains every option"
  parses it, and native parity compares help text from the same string.
- Do not add a new `--` token to `CAPTURE_HELP` that is not an existing
  option (the usage regex scan would then require it in docs).
- The CLI unit tests compare stderr with `CAPTURE_HELP` dynamically; they
  must still pass unedited. Run them with `UPDATE_CAPTURE_FIXTURES=0` so
  `capture-cad.test.ts:207-209` never rewrites tracked fixtures.
- Never write under the repository `tmp/`.

## Acceptance criteria

- The help ends with the 4.2 exit-code line and the desktop/docs line;
  `docs/capture.md` and the `docs/cli.md` section exist as above.
- `capture-docs.test.ts` passes with at least 4 executed fenced lines.
- Both verification commands exit 0; `git diff --exit-code --
  apps/cli/src/__fixtures__` exits 0.

## Verification (each must exit 0; logs under target/capture-m16a/)

1. `sh -c 'mkdir -p target/capture-m16a && (bun run typecheck && bunx biome check apps/cli/src/capture-help.ts apps/cli/src/capture-docs.test.ts && bun test apps/cli/src/capture-docs.test.ts apps/cli/src/capture-command.test.ts apps/cli/src/ai-commands.test.ts apps/cli/src/table-docs.test.ts) > target/capture-m16a/help-docs.log 2>&1; s=$?; echo "exit=$s" >> target/capture-m16a/help-docs.log; test $s -eq 0 && grep -Eq "^ *[1-9][0-9]* pass$" target/capture-m16a/help-docs.log && grep -Eq "^ *0 fail$" target/capture-m16a/help-docs.log'`
2. `sh -c 'mkdir -p target/capture-m16a && UPDATE_CAPTURE_FIXTURES=0 bun test apps/cli/src/capture-command.test.ts apps/cli/src/capture-cad.test.ts apps/cli/src/capture-io.test.ts apps/cli/src/capture-interference-options.test.ts apps/cli/src/mcp-image.test.ts > target/capture-m16a/cli-unit.log 2>&1; s=$?; echo "exit=$s" >> target/capture-m16a/cli-unit.log; test $s -eq 0 && grep -Eq "^ *[1-9][0-9]* pass$" target/capture-m16a/cli-unit.log && git diff --exit-code -- apps/cli/src/__fixtures__'`

## Progress

Implementation complete 2026-11-23; formal review and acceptance remain downstream.
The help, guide, CLI discovery and executable documentation examples satisfy
this plan. The first help/docs attempt failed typecheck on an import path;
the path was corrected and both final gates passed on the current source.
Per-edit intentions and hashes are in `tmp/capture-s889/capture-16a-help-docs/`.
The formatter was applied to the newly created test after its initial write;
the later edit snapshot records the resulting content and hash. No drift was
observed in owned files. Final source hashes:

- `apps/cli/src/capture-help.ts`: `85101801f150e59c5ca3238257eee00d33cd30b0`
- `apps/cli/src/capture-docs.test.ts`: `8fe58205b2ac8e522d1ef82b6bcac9235fc092d3`
- `docs/capture.md`: `3649646f1ac222b8226cdce439dbbc8dbb38e09c`
- `docs/cli.md`: `be9e1a65b6c56c3b836d559c0567bb6adf3df604`

- Help/docs gate: exit 0, 60 passed, 0 failed; `target/capture-m16a/help-docs.log`.
- CLI unit gate with `UPDATE_CAPTURE_FIXTURES=0`: exit 0, 81 passed, 0 failed;
  `target/capture-m16a/cli-unit.log`; fixture diff clean.
- Earlier attempt: exit 1 (typecheck exit 2),
  `tmp/capture-s889/capture-16a-help-docs/help-docs-attempt1.log`.
- Full repository verification remains deferred as specified by CAP-R7-01.

# M16 capture-16-docs-final (revision 7, session 885)

- Stage: wave 6 of dispatch `capture-s885`. dependsOn:
  capture-23e-native-parity (the last link of M23a to M23f; M23f is
  reached through it).
- Artifact roots: `target` and `tmp` (design 8.5: the gates run every
  repository test, and existing tests write `tmp/capture`, `tmp/cad3d`).
- Design (revision 6): sections 2.2, 4, 8.5 ("M16 gates", "M23 split"),
  9, 10.2, 14, 15, and section 18.
- writePaths: `docs/capture.md` (new), `docs/cli.md` (one section
  `## Capturing page images` appended at the end, and one `capture` line
  above the three `export ... --format png` lines of the AI section near
  `:141-143`), `apps/cli/src/capture-docs.test.ts` (new),
  `design-docs/specs/design-ai-capture.md` (status line, a "Measured" table
  in section 10, a short "Deviations" list),
  `impl-plans/active/capture-00-overview.md` (progress table only),
  `impl-plans/active/capture-16-docs-final.md`, `impl-plans/README.md`
  (index entry), `tmp`, `target`. Gate logs go to `tmp/capture/m16/`.
- Pre-authorised: none. `README.md` is not edited (cad3d M18 edits it).
  Plans are not moved; archiving is the workflow's job.

## Intent

An agent finds `capture` unprompted and knows its options, outputs,
guarantees and limits; measured budgets are recorded; the final tree
passes every gate with positive parity evidence.

## Non-goals

No source change outside the docs test. No edit of `mise.toml`. No new
behaviour. Do not describe cad3d M18 or M21 features beyond the one
`export` versus `capture` sentence of design 8.3.

## Changes

- `docs/capture.md`: purpose and one-line form; options with defaults;
  stdout and JSON forms (design 4.1, 4.2, including `approximate`,
  `uncheckedCount`, the capped line); where default captures go, what is
  never replaced, `--force`, the Store CLI `--output` note; 2D pages (same
  drawing as `export`, default bound, fonts, `--theme dark` changes only
  the background); 3D CAD pages (orthographic camera, view table, `iso`
  octant note, direction, eye and target, up, zoom, `centre`, `frame`;
  results of new, add, cut, intersect; reference bodies; meshes; body
  notes; the sampled `cad.result.empty`; other differences, design 6.7;
  sketch-only pages); `export` versus `capture` on a CAD page;
  interference (definition, text form, cell and guarantee in the words of
  design 6.6, facet note, hatch, the four options, exit code); determinism
  (design 7); MCP (`nodetto_capture`, `--inline`, size note); desktop
  (Export dialog entry, Current view, JPG for artwork, webview rasterizer
  for 2D); an agent loop example; licences (IJG sentence, pointer to
  `THIRD_PARTY_NOTICES.md`); the cloud follow-up list of design 14.
  Revision 5 behavior to describe in the user's words:
  - The three refusal messages (work, tile list entries, picture boundary
    scans), each exit 2 and suggesting a smaller `--size`.
  - Open meshes: an open first tool makes the body a surface that is not
    checked; an open mesh in a later step is an empty operand.
  - The emptied-body check also runs with `--no-interference` (design 6.7,
    CAP-R4-09).
  - The desktop `captureCadImage` has no interference switch.
- `docs/cli.md`: the appended section, five to ten lines, two examples, a
  link to `docs/capture.md`.
- Design: status `implemented (slice)`. Add a "Measured" table from
  `tmp/capture/m10r/` and `m23/` (`release.txt`, `native-parity.txt`,
  `timing.json`) and the earlier `m08/` and `m09/` logs, giving machine,
  date, value and budget for each row; every value is measured on this
  machine from those logs, never copied from the design's spike tables.
  Add a short "Deviations" list that points to the section 18 rows
  CAP-R4-01 to CAP-R4-10, CAP-R5-01 to CAP-R5-04 and CAP-R6-01 to
  CAP-R6-05. Change nothing else in the design.
- Overview progress table: set every row (M1 to M22, M23a to M23f, M16)
  to `accepted` only when all three gates below have passed. M10, M20,
  M22, M15, M17, M18, M11, M12 and M14 were accepted by per-plan review at
  `e883b4b`. M23a to M23f are accepted by their reviews in this dispatch;
  M23 counts as accepted only when all six are. If a gate fails, leave
  M16 unaccepted and report the failure as a blocker.
- `impl-plans/README.md`: one Completed entry for the capture plans in the
  file's existing form.

## Tests

- `capture-docs.test.ts`: `docs/capture.md` contains every option of
  `COMMAND_HELP.capture` (parsed from its usage block), the IJG sentence and
  `orthographic`, `interference`, `cell`, `approximate`, `wireframe`,
  `--inline`; every fenced `nodetto-cli capture ...` line in
  `docs/capture.md` and the new `docs/cli.md` section parses without a
  usage error through `captureCommand` with a memory I/O and a fake
  backend (imitate `apps/cli/src/capture-cad.test.ts` fakes);
  `docs/cli.md` links to `capture.md`.
- Existing docs tests run unchanged: `apps/cli/src/table-docs.test.ts`,
  `help-convert-frame.test.ts`, `document-examples.test.ts`,
  `packages/core/src/bpmn/docs-example.test.ts`.

## Final gates (design 8.5; run each to its end, record command, exit
status and complete log path under `tmp/capture/m16/`)

1. Workspace: `env CARGO_TERM_QUIET=true CARGO_TARGET_DIR="$PWD/target/capture-m16" mise run verify`
   (if Bun discovery stalls or runs out of memory on ignored `tmp/` and
   `target/`, the fallback replaces it: `bun test apps packages` and
   `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/capture-m16 cargo test --workspace`).
2. Shared native contracts: `env CARGO_TERM_QUIET=true CARGO_TARGET_DIR="$PWD/target/capture-m16" cargo test -p nodetto-native`.
3. CLI and parity: `env CARGO_TERM_QUIET=true CARGO_TARGET_DIR="$PWD/target/capture-m16" sh -c 'cargo test -p nodetto-cli && cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$CARGO_TARGET_DIR/release/nodetto-cli" bun test apps/cli/src'`;
   its log must show capture native parity tests passed and none skipped.
   The manifest command also reruns `apps/cli/src/native-parity/capture.test.ts`
   alone into `tmp/capture/m16/capture-parity.log` and requires a positive
   pass count and no skip there. Skips in unrelated suites are allowed.

A nonzero gate (including the Foundation atomic-write denials recorded at
M10) stays a failure; retries are logged; M16 is not accepted until every
gate has a passing run, and a remaining failure is reported as a blocker.

## Acceptance criteria

- Docs and help let an agent discover and use `capture`; measured budgets
  are in the design; all three gates exit 0 with parity evidence; the
  progress table marks every milestone accepted.

## Verification (each must exit 0)

1. `sh -c 'bun run typecheck && bunx biome check apps/cli/src/capture-docs.test.ts && bun test apps/cli/src/capture-docs.test.ts apps/cli/src/table-docs.test.ts apps/cli/src/help-convert-frame.test.ts apps/cli/src/document-examples.test.ts packages/core/src/bpmn/docs-example.test.ts'`
2. `sh -c 'mkdir -p tmp/capture/m16; bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess > tmp/capture/m16/strict.log 2>&1; ! grep -E "^packages/(core|ir)/src/" tmp/capture/m16/strict.log | grep -vqE "\.test\.tsx?\(" && bun test packages/core/src/capture'`
3. Final gates 1, 2 and 3 above.

## Progress

Pending (revision 7). Read each owned file fresh before editing and
record `git hash-object` before and after; a hash that differs from the
last recorded value is drift: stop and record it. Workers append entries: date, command, exit status,
full log path under `tmp/capture/m16/`, retries, and `git hash-object` of
each owned file before and after.

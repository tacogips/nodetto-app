# M16 capture-16-docs-final (revision 4)

- Stage: closing. dependsOn: M23 (which includes every other milestone).
- Design: sections 2.2, 4, 8.5 ("M16 gates"), 9, 10.2, 14, 15.
- writePaths: `docs/capture.md` (new), `docs/cli.md` (one section
  `## Capturing page images` appended at the end, and one `capture` line
  above the three `export ... --format png` lines of the AI section near
  `:141-143`), `apps/cli/src/capture-docs.test.ts` (new),
  `design-docs/specs/design-ai-capture.md` (status line, a "Measured" table
  in section 10, a short "Deviations" list),
  `impl-plans/active/capture-00-overview.md` (progress table only),
  `impl-plans/active/capture-16-docs-final.md`, `impl-plans/README.md`
  (index entry), `tmp/capture/m16`, `target`
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
- `docs/cli.md`: the appended section, five to ten lines, two examples, a
  link to `docs/capture.md`.
- Design: status `implemented (slice)`; "Measured" table from
  `tmp/capture/m10r/`, `m23/` and earlier `m08/`, `m09/` logs (machine,
  date, value, budget); "Deviations" lists design 18 rows of revision 4.
- Overview progress table: every milestone `accepted` only when the gates
  below all passed; otherwise the failing milestone stays as it is.
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

Pending (revision 4).

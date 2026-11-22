# M16 capture-16-docs-final

- dependsOn: M12, M13, M15 (everything that ships; M12 and M15 include
  all other milestones)
- Design: sections 2.2, 4, 9, 10.2, 14, 15
- writePaths: `docs/capture.md` (new), `docs/cli.md` (one new section
  `## Capturing page images` appended at the end of the file, and the
  three `export ... --format png` lines of the AI section at `:141-143`
  gain one `capture` line above them),
  `apps/cli/src/capture-docs.test.ts` (new; docs tests live with the CLI),
  `design-docs/specs/design-ai-capture.md` (status line, measured values
  in section 10), `impl-plans/README.md` (index entries),
  `impl-plans/active/capture-*.md` moved to `impl-plans/completed/`
- Pre-authorised: none. `README.md` is not edited (cad3d M18 edits it).

## Behavior

- `docs/capture.md`:
  - what the command is for and the one-line form;
  - options with defaults, the stdout form and the JSON form (the text of
    design sections 4.1 and 4.2);
  - where default captures go, what is never replaced, `--force`, the
    Store CLI note (use `--output` inside the authorized folder);
  - 2D pages: same drawing as `export`, default bound, fonts, and that
    `--theme dark` changes only the background;
  - 3D CAD pages: orthographic camera, the view table, that `iso` looks
    from +X +Y +Z and does not show the front face, direction, eye and
    target, up, zoom, `centre` and `frame`; what the picture shows
    (results of new, add, cut, intersect; reference bodies; meshes); the
    body notes and the sampled `cad.result.empty` error; the other
    differences from the app's kernel result (design 6.7); that a page
    with sketches only cannot be captured yet;
  - `export` against `capture` on a CAD page: after the cad3d export
    milestone, `export` draws a wireframe construction view of the tool
    solids and `capture` the shaded result;
  - interference: definition, text form, the cell and the guarantee in
    the words of design 6.6, the facet note, the hatch, the four options
    and the exit code;
  - determinism statement (design 7);
  - MCP: `nodetto_capture`, `--inline`, size and token note;
  - desktop: Export dialog entry, Current view, JPG for artwork, and the
    statement that 2D desktop pictures use the webview rasterizer;
  - an agent loop example: edit, capture, read the picture, edit again;
  - licences: the IJG sentence and a pointer to `THIRD_PARTY_NOTICES.md`;
  - the private-cloud follow-up list of design section 14.
  Every command shown is run by the docs test.
- `docs/cli.md`: the appended section is five to ten lines with two
  examples and a link to `docs/capture.md`.
- Design document: status `implemented (slice)`; section 10 gains a
  "Measured" table with the values from `tmp/capture/m08/`, `m09/`,
  `m10/`, `m11/`, `m12/`, `m17/` (machine, date, value, budget); any deviation
  recorded during the milestones is listed in a short "Deviations"
  section.
- `impl-plans/README.md`: an entry for the capture plans in the form the
  file uses for other features, added under Completed, in a paragraph of
  its own.
- The overview's progress table is complete; the plan files move to
  `impl-plans/completed/` in this commit (links inside them are updated).

## Tests

- `capture-docs.test.ts`: `docs/capture.md` exists and contains every
  option name of `COMMAND_HELP.capture` (parsed from the usage block), the
  IJG sentence and the words `orthographic`, `interference`, `cell`,
  `wireframe` and `--inline`; every fenced `nodetto-cli capture ...` line in
  `docs/capture.md` and in the new `docs/cli.md` section parses without a
  usage error when run through `captureCommand` with a memory I/O and a
  fake backend (document names in the examples are created in the memory
  I/O); `docs/cli.md` links to `capture.md`.
- Acceptance checklist test, `apps/cli/src/native-parity/capture.test.ts`
  (already present cases are listed in the commit message against the
  acceptance criteria of the workflow input; no new case is required
  unless a criterion has no test).
- Whole-repository runs below.

## Acceptance criteria

- All acceptance criteria of the workflow input are met; the commit
  message maps each criterion to its tests (design section 15).
- `mise run verify` and `mise run test-cli` exit 0 with no skipped native
  parity test and no relaxed deadline. If the only failure is an existing
  timing test under load (for example the 10,000 ms `cad check` case of
  `apps/cli/src/native-parity/cad.test.ts`, whose margin is known to be
  small, `impl-plans/active/cad3d-16-cli.md` Progress), it is re-run once
  alone; both results are recorded in `tmp/capture/m16/`; a second
  failure is reported as a blocker, not worked around.
- The design document states measured budgets.

## Verification (each must exit 0)

1. `sh -c 'bun run typecheck && bun test apps/cli/src/capture-docs.test.ts apps/cli/src/table-docs.test.ts apps/cli/src/help-convert-frame.test.ts apps/cli/src/document-examples.test.ts packages/core/src/bpmn/docs-example.test.ts'`
2. `sh -c 'mkdir -p tmp/capture/m16; bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess > tmp/capture/m16/strict.log 2>&1; ! grep -E "^packages/(core|ir)/src/" tmp/capture/m16/strict.log | grep -vqE "\.test\.tsx?\(" && bun test packages/core/src/capture'`
3. `mise run verify`
4. `mise run test-cli`

## Progress

Pending.

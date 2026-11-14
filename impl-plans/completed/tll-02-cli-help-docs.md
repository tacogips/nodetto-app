# tll-02-cli-help-docs

- planId: tll-02-cli-help-docs
- planPath: impl-plans/active/tll-02-cli-help-docs.md
- wave: 1
- dependsOn: none
- Design: `design-docs/specs/design-text-layout-lint.md`, section "Help
  text". `design-docs/specs/export.md` section 5 and
  `design-docs/specs/design-cli-ai-drawing.md` "export" already carry the
  design cross-references and are not part of this plan.
- Read `impl-plans/active/tll-00-overview.md` first.

## Intent and context

Users and AI agents discover lint and export behavior from
`nodetto-cli help <command>` and from `docs/cli.md`. Both currently say that
lint covers only BPMN and breadboard pages. Update them to describe the new
architecture-page text-layout lint, its three stable rule ids, and the
export stderr warnings. This is text-only work and needs no code.

## Non-goals

- No change to command behavior, option parsing or exit codes. Those belong
  to tll-03 and tll-04.
- No change to other help entries, `README.md`, `design-docs/` or
  `impl-plans/` (apart from this plan's progress log).
- Do not add an export `--strict` mention. Export has no `--strict`.

## writePaths

- apps/cli/src/help.ts
- docs/cli.md
- impl-plans/progress/tll-02-cli-help-docs.md
- tmp/text-layout-lint-s551/tll-02-cli-help-docs

sharedPaths: none.

## File-level changes

### `apps/cli/src/help.ts`

1. Overview line 29: change
   `  nodetto-cli lint <doc|bpmn>     Lint BPMN and breadboard pages` to
   `  nodetto-cli lint <doc|bpmn>     Lint BPMN, breadboard and architecture pages`.
   Keep the column alignment. Do not add lines, because
   `apps/cli/src/ai-commands.test.ts:93` caps the overview at under 40
   lines.
2. `lint` entry (around :472-479). Keep the `Usage:` lines and the final
   `Exit codes:` line unchanged.
   - Replace the first sentence with `Lint BPMN, breadboard and architecture pages from a nodetto document or BPMN XML.`
   - Keep the sentences on text output, JSON output and `.bpmnlintrc`.
   - Insert one paragraph before `Exit codes:`. It must say that
     architecture pages are checked for text layout with the warning rules:
     - `label-overflow`: a node or shape label line is clipped or spills
       outside its box;
     - `label-collision`: an edge label box overlaps another edge label or
       an element;
     - `note-overflow`: note text is cut off or runs into or close to the
       element below.
   - The paragraph must also say:
     - messages give measured and available sizes;
     - the rule ids are stable, for use in check scripts;
     - the findings match what export renders.
   - Wrap at the existing width, about 78 columns.
3. `export` entry (around :348). After the option list, before any existing
   trailing text such as exit codes, add one paragraph:
   - SVG, PNG and PDF exports of a whole architecture page print text-layout
     lint findings on stderr as `warning: <rule-id> <element-id>: <message>`;
   - the exported output and exit code are unchanged;
   - see `nodetto-cli help lint`.

   Read the whole export entry first and place the paragraph where it reads
   naturally.

### `docs/cli.md`

At about line 35, the sentence "`lint` checks BPMN and breadboard pages."
becomes one that says `lint` checks BPMN, breadboard and architecture pages.
On architecture pages it reports the text-layout warnings `label-overflow`,
`label-collision` and `note-overflow` with measured and available sizes. A
whole-page SVG, PNG or PDF export prints the same findings as `warning:`
lines on stderr. Keep the rest of the paragraph (exit codes, no `--strict`)
unchanged.

## Pitfalls

- `help.ts` uses template literals. Do not introduce a backtick or `${`
  inside the text.
- Use the exact rule-id spellings, with hyphens. Nothing tests the wording,
  but tll-05 compares `--help` output between the TS and native CLIs, so the
  text must be plain ASCII.
- Do not touch `EXIT_CODES` or other commands' entries.

## Tests

Text-only change, so no new test file. These existing checks must still
pass:

- overview -> `ai-commands.test.ts` overview line-count assertion passes;
- `nodetto-cli help lint` -> contains `label-overflow`, `label-collision`,
  `note-overflow` and `architecture`. Check with the commands below.

## Verification (each must exit 0; logs under the scratch root)

1. `bun apps/cli/src/main.ts help lint > tmp/text-layout-lint-s551/tll-02-cli-help-docs/help-lint.txt 2>&1; echo "exit=$?"`, then `grep -c -e label-overflow -e label-collision -e note-overflow -e architecture tmp/text-layout-lint-s551/tll-02-cli-help-docs/help-lint.txt`.
   Evidence: a count of at least 4.
2. `bun apps/cli/src/main.ts help export > tmp/text-layout-lint-s551/tll-02-cli-help-docs/help-export.txt 2>&1; echo "exit=$?"`, then `grep -n "warning: <rule-id>" tmp/text-layout-lint-s551/tll-02-cli-help-docs/help-export.txt`.
   Evidence: one line.
3. `BUN_OPTIONS=--jsx-runtime=classic bun test apps/cli/src/ai-commands.test.ts > tmp/text-layout-lint-s551/tll-02-cli-help-docs/ai-commands.log 2>&1; echo "exit=$?"`.
4. `bunx biome check apps/cli/src/help.ts > tmp/text-layout-lint-s551/tll-02-cli-help-docs/biome.log 2>&1; echo "exit=$?"`.
5. `grep -n "architecture pages" docs/cli.md`.
   Evidence: at least one line.

## Done criteria

- Commands 1-5 meet their evidence.
- `git diff --stat` for this plan lists only `apps/cli/src/help.ts` and
  `docs/cli.md`.
- The progress log has hashes, the intent snapshot and `STATUS: done` as
  the last line.

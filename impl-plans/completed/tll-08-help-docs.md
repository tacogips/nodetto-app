# tll-08-help-docs

- planId: tll-08-help-docs
- planPath: impl-plans/active/tll-08-help-docs.md
- wave: 1
- dependsOn: none
- Design: `design-docs/specs/design-text-layout-lint.md`, section "Help text
  and CLI docs".
- Read `impl-plans/active/tll-06-overview.md` first.

## Intent and context

The CLI help and `docs/cli.md` describe the text-layout lint as
architecture-only, and say its findings "match what export renders". After
this revision:

- the lint and export warnings cover architecture, freeform and flowchart
  pages (Q1);
- the lint measures East Asian wide and fullwidth characters at 1 em, so it
  reports real-font clipping that export geometry does not show (Q2).

This plan updates only the user-facing text.

## Non-goals

- No behavior change. Do not touch `commands.ts`, `export-command.ts` or any
  test.
- Do not document Q3 or Q4 alternatives. Do not add new flags or a new
  exit code.
- No README or other docs files.

## writePaths

- apps/cli/src/help.ts
- docs/cli.md
- impl-plans/progress/tll-08-help-docs.md
- tmp/text-layout-lint-s552/tll-08-help-docs

sharedPaths: none.

## File-level changes

### `apps/cli/src/help.ts`

1. Overview line (:29), `nodetto-cli lint <doc|bpmn>     Lint BPMN, breadboard and architecture pages`.
   Change the description to name the five kinds, for example
   `Lint BPMN, breadboard, architecture, freeform and flowchart pages`. Keep
   the column alignment of the line.
2. `export` help paragraph (:395-397). Replace `a whole architecture page`
   with `a whole architecture, freeform or flowchart page`. Keep the rest:
   the line format `warning: <rule-id> <element-id>: <message>`, "output and
   exit code are unchanged", and `See nodetto-cli help lint`. Rewrap to the
   surrounding width (lines at most about 78 columns, as in the existing
   paragraph).
3. `lint` help (:479-492):
   - The first line becomes
     `Lint BPMN, breadboard, architecture, freeform and flowchart pages from a nodetto document or BPMN XML.`
     Wrap it if it exceeds the paragraph width.
   - The paragraph `Architecture pages are checked for text layout with warning rules:`
     becomes `Architecture, freeform and flowchart pages are checked for text layout with warning rules:`.
     Keep the three rule descriptions word for word.
   - Add one sentence after `Messages give measured and available sizes.`:
     East Asian wide and fullwidth characters (CJK, kana, hangul,
     fullwidth forms) are measured at 1 em, so the lint reports lines that
     real fonts clip even when export geometry fits.
   - Replace `findings match what export renders` with
     `findings match export geometry, except for that wide-character width`.
   - The exit-code line stays unchanged.
   - Use plain ASCII in help text. Do not put CJK sample characters in it.

Imitate the existing wrapping and indentation of the `lint` and `export`
templates in the same file. Do not reflow other commands' help.

### `docs/cli.md` (:35-40)

Inside the existing paragraph:

- `` `lint` checks BPMN, breadboard and architecture pages. On architecture pages it reports ... ``
  becomes `` `lint` checks BPMN, breadboard, architecture, freeform and flowchart pages. On architecture, freeform and flowchart pages it reports ... ``.
- After `with measured and available sizes.`, add: `East Asian wide and
  fullwidth characters are measured at 1 em, so the lint also reports lines
  that real fonts clip.`
- `A whole-page SVG, PNG or PDF export prints the same findings` becomes
  `A whole-page SVG, PNG or PDF export of an architecture, freeform or flowchart page prints the same findings`.
- Do not change the other sentences in the paragraph (exit codes, bpmn,
  breadboard).

## Invariants

- `git diff 45cc69f -- apps/cli/src/help.ts` touches only the overview
  `lint` line, the export text-layout paragraph and the `lint` template.
- No test asserts the changed help strings today. Checked:
  `grep -rn "Lint BPMN\|Architecture pages" apps/cli/src/*.test.ts` returns
  no help assertions. If one appears, record it and stop. Do not edit tests.
- No emojis. Help is ASCII-only.

## Verification

Logs go to `tmp/text-layout-lint-s552/tll-08-help-docs/<name>.log`.

| Command | Must show |
| --- | --- |
| `bunx biome check apps/cli/src/help.ts` | exit 0 |
| `bun test apps/cli/src/commands.test.ts` | exit 0, 0 fail (help output tests unaffected) |
| `bun apps/cli/src/main.ts help lint` and `bun apps/cli/src/main.ts help export` (`main.ts` is the entry the parity tests run, `native-parity.test.ts:30`) | output names architecture, freeform and flowchart pages and the 1 em sentence |
| `grep -n "freeform" docs/cli.md` | the updated lint sentence and the export sentence |
| `bun run typecheck` (shared-input gate; sibling tll-07) | exit 0 |

## Done criteria

- Every text change above is present, and no other help section changed.
- Commands pass with their required results, logged with exit codes and log
  paths in `impl-plans/progress/tll-08-help-docs.md`, with sha256 before and
  after for both files.
- The last line of the progress log is `STATUS: done`.

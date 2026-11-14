# ddl-frame-02-help-docs

- planId: ddl-frame-02-help-docs
- planPath: impl-plans/active/ddl-frame-02-help-docs.md
- wave: 1; dependsOn: none. Runs in parallel with ddl-frame-01-resolver
  (disjoint files).
- design: design-docs/specs/design-cli-ai-drawing.md, sections "Ids and names"
  and "ddl --frame resolution (designed 2026-10-25)", paragraph "Help and docs".
- progress log: impl-plans/progress/ddl-frame-02-help-docs.md (this worker only)
- evidence: tmp/ddl-frame/ddl-frame-02-help-docs/ (tmp/ is git-ignored)
- repository: nodetto-app (public submodule), branch main, same working
  directory as the sibling plan. No worktrees, no private branches, and no git
  write operations.

## Intent

Document the new `ddl --frame` resolution, and state the ids-and-names rule in
the CLI help and the README:

- Page and element ids are assigned automatically, are opaque and never change.
  `rename-page` changes only the display name.
- People and scripts should refer to pages and frames by name.

This plan changes text only, plus one test of that text.

## Files and symbols

| File | Change |
| --- | --- |
| `apps/cli/src/help.ts` | Edit the `ddl` entry of `COMMAND_HELP` (around lines 282-300) and the `pages` entry (around lines 84-101). |
| `README.md` | Edit the "Multiline nodes and scoped schema export" section (around line 1542). |
| `apps/cli/src/ai-commands.test.ts` | Add one `test(...)` next to "top-level help is a short overview ..." (around line 91). |
| `impl-plans/progress/ddl-frame-02-help-docs.md` | Create it. This is your progress log. |

### help.ts, ddl entry

- In the usage line, change `[--frame <id>]` to `[--frame <id|short-id|name>]`.
  Keep the column alignment of the continuation lines.
- Rewrite the `--frame` option description. Keep the existing sentence about
  cross-scope warnings, and keep option-column alignment like the other
  options. Add:
  - the frame is resolved only among frames on the selected page, in this order:
    exact id, exact name, then a unique id prefix of at least 6 characters;
  - an unknown or ambiguous value exits 2 (`EXIT_ERROR = 2` in commands.ts;
    `EXIT_CODES` in help.ts calls it "usage or input error") and lists the
    page's candidate frames as short id, name and full id.
- Add a short paragraph (1-3 lines) stating the ids-and-names rule above.
- The ddl entry has no Examples block today; it ends with the expression
  paragraph and then `${EXIT_CODES}`. Do not add an Examples block. You may
  mention `--page "Shop schema" --frame "orders store"` inline in the new
  paragraph.

### help.ts, pages entry

- Add 1-2 sentences after the existing "Short IDs are stable ..." paragraph:
  page and element ids are assigned automatically, opaque and unchanging;
  `rename-page` changes only the display name; use names as the human-facing
  key (`--page`, and `--frame` for ddl).
- Do not change the existing sentences or the `--format`/`--kind` lines.

### README.md

- In the example `nodetto-cli ddl diagram.jsonl --page Schema --frame database-frame-id --dialect postgresql`,
  replace `database-frame-id` with a quoted frame name, for example
  `--frame "Orders"`.
- Add one sentence: `--frame` takes the frame's name, its full id or a unique id
  prefix of at least six characters, matched only among frames on the selected
  page. Ids are generated and never change, so prefer names in scripts.
- Do not edit any other part of README.md.

## Tests to add (apps/cli/src/ai-commands.test.ts)

Add one test. Use `COMMAND_HELP`, which the file already imports from
`./help.ts`, and/or `runCli(["help", "ddl"], memoryIo({}), "t")`, in the style of
the existing help test:

- `COMMAND_HELP.ddl` contains `--frame <id|short-id|name>` -> true.
- `COMMAND_HELP.ddl` does not contain `[--frame <id>]` -> true.
- `COMMAND_HELP.ddl` and `COMMAND_HELP.pages` each mention `rename-page` and the
  word `opaque` -> true. (Pick stable wording and assert on it.)
- `runCli(["ddl", "--help"], ...)` stdout equals `` `${COMMAND_HELP.ddl}\n` `` ->
  true.

Regression proof: add the test first and run it. It must fail on f705c09; save
the output as `tmp/ddl-frame/ddl-frame-02-help-docs/red.log`. Then edit help.ts,
and save the passing run as `green.log`.

## Invariants and pitfalls

- `OVERVIEW` must stay under 40 lines, because the existing test asserts it. Do
  not edit `OVERVIEW` unless it is needed; the design does not require it.
- Before editing, grep `apps/cli/src/*.test.ts` for strings from the ddl and
  pages help (for example `grep -n "Short IDs\|--frame <id>" apps/cli/src/*.test.ts`)
  so no existing assertion breaks. `pages-command.test.ts` must still pass.
- Do not touch `apps/cli/src/commands.ts`, `apps/cli/src/commands.test.ts`
  (owned by ddl-frame-01-resolver), the native sources, design docs, `docs/`
  or other plans.
- Use only neutral wording. Do not mention external issues, projects, products
  or people.
- Use no emojis. Keep lines within the existing help width (about 80 columns).

## Verification (run from the nodetto-app root, in the foreground)

1. `bun test apps/cli/src/ai-commands.test.ts apps/cli/src/pages-command.test.ts 2>&1 | tee tmp/ddl-frame/ddl-frame-02-help-docs/green.log`
   -> exit 0, 0 fail.
2. `bun run typecheck` -> exit 0.
3. `bunx biome check apps/cli/src/help.ts apps/cli/src/ai-commands.test.ts`
   -> exit 0.
4. `bun apps/cli/src/main.ts help ddl` (the `nodetto-cli` bin in
   apps/cli/package.json) prints the new usage line. Save the output as
   `tmp/ddl-frame/ddl-frame-02-help-docs/help-ddl.txt`.
5. `git diff --stat README.md` -> only a few changed lines.

Workspace-wide lint, `bun test apps/cli/src` and
`CARGO_TERM_QUIET=true mise run test-cli` belong to reconcile and integration
review.

## Concurrency protocol

Before every edit, re-read the file fresh and record its sha256 (`shasum -a 256`)
in the progress log. Record it again after the edit. If the pre-edit hash differs
from your last recorded hash, stop, log the drift and re-read.

## Done criteria (mechanically checkable)

- [ ] `grep -c "\-\-frame <id|short-id|name>" apps/cli/src/help.ts` is at least 1.
- [ ] `grep -n "\[--frame <id>\]" apps/cli/src/help.ts` finds no match.
- [ ] `grep -n "database-frame-id" README.md` finds no match.
- [ ] red.log shows the new test failing, and green.log shows 0 fail.
- [ ] Verification commands 2 and 3 exit 0.
- [ ] The progress log records the hashes, the commands run, their exit codes and
  the log paths.

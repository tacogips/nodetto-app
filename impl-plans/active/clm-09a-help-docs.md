# clm-09a-help-docs

- planId: clm-09a-help-docs
- planPath: impl-plans/active/clm-09a-help-docs.md
- progressPath: impl-plans/progress/clm-09a-help-docs.md
- Manifest: `impl-plans/active/clm-s740-dispatch.json`. Workflow mode: `issue-resolution`.
- wave: 1; dependsOn: none. Evidence: `tmp/clm-s740/clm-09a-help-docs/`.
- Design: `design-docs/specs/design-cli-layout-merge-lint.md`, sections "Help and documentation", "CLI surface", B1 to
  B3, C1 to C3, D, "A3 metrics", E1, E2, E2.1, F1 to F4 and "Continuation 5 partition".

## Intent and context

The new CLI behavior is registered at HEAD 235b8c8, but `apps/cli/src/help.ts`, `docs/cli.md` and `README.md` hold only
a short first draft. The owner requires full help and documentation for every new command, mode, flag, op and field.
`COMMAND_HELP` is also the MCP tool description (`apps/cli/src/mcp.ts` is not edited), so help text reaches MCP clients.

## Non-goals

- No behavior changes and no edits outside `writePaths`. If documented behavior and code disagree, write what the code
  does, and record a finding in the progress log. Do not change the code.
- No edits to `apps/cli/src/mcp.ts`, no new commands, and no help-driven refactor of `help.ts`.
- User-facing text never names Q11 or other internal plan or finding ids.

## File-level changes

Before writing help text, read the design section named on each row, and the code named there for exact messages.

### `apps/cli/src/help.ts`

Imitate the layout of `COMMAND_HELP.edit` and `COMMAND_HELP.export`. Tables are plain aligned text.

| Key | Content to reach |
| --- | --- |
| `OVERVIEW` | One-line edits in place: the `arrange` line names tidy, overlaps, layered and route; the `lint` line names the wider page set. `merge` and global `--quiet` are already listed. |
| `arrange` | Usage line from "CLI surface" with `--frames`, `--ids` and `--reset-manual`. `--direction` applies to tidy and layered. `--check` exits 1 when arranging would change anything. Flag rules: `--frames` only with layered, `--ids` only with route, `--reset-manual` not with tidy or overlaps. Manual-setting rule (Q6: stored ports and routes count as manual; rerun with `--reset-manual` to recompute). The E2 page-kind table with each exclusion reason (sequence, breadboard, pcb). BPMN: pools and lanes are rows, columns are global, `--frames` and `--direction TB` exit 2, nested lanes may get full boxes rewritten and keep their order. The three E2.1 refusals in plain words. The depth-one limitation from the "Help and documentation" limits row. ERD rule: column ends get no ports and are not spread (E2.2). Neutral examples with `Stage0` frames. |
| `edit` | `label` on update with the mapping table from C1: `text.note` text, `frame` name, `node.generic` label, `state.node` name, `erd.table` tableName, `state.transition` trigger, BPMN flows name, `edge.generic` label. Unknown fields rejected, with valid fields listed (C2). Reference resolution order and `name:` matching and scope (F1). `where` keys including `page`, AND semantics, at least one key; `expect` integer at least 0, allowed only with `where`; zero matches without `expect` is an error; `expect: 0` is a no-op (F2). `select` rules (F3). Report line `operation <i> (<op>): matched <n> element(s)`, JSON `matches`, and `--quiet` does not hide them. The E1 per-kind carry table, the non-carrying kinds, the "attachments always follow" note, the E1 error rules and the as-built geometry errors. The `Approve` / `Update status` delete example from F2. |
| `lint` | Usage line with `--fix` and `--metrics`. The page and rule table from "D, Page selection". `node-overlap`, `image-missing`. `--fix` wraps at CJK break rules, exits 2 on `.bpmn`, and does not resize boxes (Q4). `--metrics` text line, JSON fields, supported page kinds, and that it never changes the exit code. |
| `merge` | Usage. Conflict policy: ours kept, arrays atomic, delete-against-modify rules, integrity pass. Conflict lines on stderr, never hidden by `--quiet`. Git driver: both `git config` lines and the `.gitattributes` line from B2. Its own exit line starting `Exit codes:` with 0, 1 and 2 as in B1. Remove `${EXIT_CODES}` from this page, because the shared text says 1 means out of date. |
| `export` | Determinism guarantee from B3: text exports (SVG, Mermaid, D2, draw.io) are a pure function of canonical content and attachment bytes; PNG and PDF depend on fonts and are excluded. |
| pages that print warnings | `validate`, `edit`, `draw`, `export`, `ddl`, `bpmn` and import pages: `--quiet` and the collapsed-line form ` (and <n> more like this)`, per C3. `--strict` still exits 3. |

### `docs/cli.md`

Expand the section "Layout, selection, and merging" so it has the same content as help, including the E1 and E2 tables,
the git driver recipe, the SVG regeneration recipe with a post-merge hook example (B3), and `lint --fix` and `--metrics`
examples. Add the BPMN layered limits.

### `README.md`

The section "Layout, selection, and merging" currently sits after "## License". Move it above "## License", at a heading
level that fits the surrounding CLI content. It names every command, mode, flag, op and field, and every carrying
container and page kind, includes both recipes, and links to `docs/cli.md` for the per-kind tables.

### `design-docs/specs/export.md`

One bullet in "1. Goals" and one in "8. Rollout constraints" with the B3 guarantee. Leave the non-goal about PDF and PNG
byte determinism in place.

### `design-docs/specs/design-cli-ai-drawing.md`

The pointer to the clm design exists at line 129. Change it only if the help wording differs. Record whether touched.

### Tests

- `apps/cli/src/ai-commands.test.ts`: add assertions on `COMMAND_HELP` and `OVERVIEW`, listed below.
- `apps/cli/src/mcp.test.ts`: existing assertions on `nodetto_merge`, `where`, `select` and `carryMembers` stay. Add
  only if a new help fact needs it.

## Pitfalls

- `ai-commands.test.ts` asserts `OVERVIEW` has fewer than 40 lines when split, and it is at the limit. Edit lines in
  place. Do not add a line.
- Help strings are template literals. A backtick or `${` in the text breaks or changes them. Keep `${EXIT_CODES}` on every
  page except `merge`.
- Copy messages from `apps/cli/src/edit/carry-members.ts`, `packages/core/src/arrange-layered-bpmn.ts` and
  `apps/cli/src/arrange-modes.ts`. `where` includes `page`, which the first draft omitted.
- The first-draft phrase "invalid pool geometry" must become the specific rules: minimum lane height and lane widths.
- Do not edit `commands.test.ts`, `mcp-stdio.test.ts`, or any other test outside `writePaths`. A help assertion elsewhere
  that your text breaks is recorded in the progress log and fixed in wave 2.
- Examples and fixtures stay neutral: widgets, orders, `Idle`, `Running`, `Stage0`, `Approve`.
- Per edit: fresh read, `git hash-object` before and after in the progress log, and a one-line intent. No state-changing
  git commands, no broad formatter, and no lockfile changes.

## Tests (input -> expected)

- `COMMAND_HELP.arrange` -> contains `--frames`, `--ids`, `--reset-manual`, `layered`, `route`, `sequence`, `breadboard`,
  `pcb`, `bpmn` (matching the case you document), `--direction TB`, and text saying a lane can end outside its pool.
- `COMMAND_HELP.edit` -> contains `name:`, `where`, `expect`, `select`, `carryMembers`, `matched`, `tableName`, `trigger`,
  `bpmn.lane`, `breadboard.board`, `at least`, `Attachments`.
- `COMMAND_HELP.lint` -> contains `--fix`, `--metrics`, `node-overlap`, `image-missing`, `erd`, `state`, `uml`.
- `COMMAND_HELP.merge` -> contains `merge=nodetto`, `merge.nodetto.driver`, `conflict`, `Exit codes:`, and does not
  contain `out of date`.
- `COMMAND_HELP.export` -> contains `SVG` and `time zone`. `COMMAND_HELP.validate` -> contains `--quiet`.
- No help page or `OVERVIEW` contains `Q11`.

## Invariants

- Help describes existing behavior only. `apps/cli/src/mcp.ts` stays unchanged.
- No file outside `writePaths` changes.

## Verification

Each command must exit 0. See the manifest for the exact list. It runs `ai-commands.test.ts`, `mcp.test.ts` and
`mcp-stdio.test.ts`, typecheck, Biome on the owned TS files, token greps on `help.ts`, `docs/cli.md` and `README.md`,
the no-Q11 grep, and the check that `mcp.ts` is unchanged.

## Done criteria

- All manifest verification commands exit 0.
- `impl-plans/progress/clm-09a-help-docs.md` records each edit's hashes, each command's exit status and whether
  `design-cli-ai-drawing.md` was touched.

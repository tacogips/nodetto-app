# sef-08-help-docs

- planId: sef-08-help-docs
- planPath: impl-plans/active/sef-08-help-docs.md
- progressPath: impl-plans/progress/sef-08-help-docs.md
- wave: 2
- dependsOn: sef-01-edit-visual-merge, sef-02-edit-style-keys, sef-03-font-coverage-host, sef-04-glyph-attribution, sef-05-box-label-layout
- Design: `design-docs/specs/design-style-export-fixes.md`, section "Docs".
- Worker rules: `impl-plans/active/sef-00-overview.md`.
- writePaths:
  - `apps/cli/src/help.ts`
  - `docs/cli.md`
  - `apps/cli/src/help-style-export.test.ts` (new)
  - `impl-plans/progress/sef-08-help-docs.md`
  - `tmp/sef-s733/sef-08-help-docs`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

Users of `edit`, `export` and `lint` must find the new behavior in help and docs. sef-06 and sef-07 run at the same time; this plan documents the accepted design, so the text does not depend on their code.

## Non-goals

- No behavior changes. No `README.md` change: nothing there covers these details.
- No reformatting or rewrapping of existing text: a sibling branch edits both files. Add small hunks only.
- Do not rewrite `design-docs/specs/export.md`.

## File-level changes

`apps/cli/src/help.ts`, edit help, by the `update deep-merges objects` note (line 251), must state:

- `update` deep-merges `visual` and `semantic`; arrays replace; null removes a key.
- `strokeDashArray: []` means solid: it removes `strokeDashArray` and `dash`, unless the same patch sets `dash`. `null` removes only `strokeDashArray`, so a stored `dash` still applies.
- Removing a required field is an error.
- Unknown `visual.style` keys in `add` and `update` are rejected, with suggestions.
- `visual.style.verticalAlign` (`top`, `middle`, `bottom`; default `middle`) positions `node.generic` and `shape.geo` labels. `add` and `update` also write `boxLabelAlign: true`, which makes the value take effect. Without that marker, a box label stays centered; a hand-written JSONL document must include it.
- Setting `verticalAlign` on a box bound to a text style removes that element's link. `boxLabelAlign: true` alone keeps the link and follows the style's value. `verticalAlign: null` removes both keys.

`help.ts`, export help, by `--font-dir` (line 390): PNG and PDF load fallback fonts when the base fonts lack a glyph; a glyph no font has gives `warning: glyph-missing <id>: ...` on stderr. SVG is unchanged.

`help.ts`, lint help (line 477): add `[--font-dir <dir>]` to the usage. State that `glyph-missing` is a warning, reported on any page kind where font coverage can be determined, naming the element and code points, and that documents with no lintable page and no missing glyph keep today's error.

`docs/cli.md`: the same facts, as short additions near the `lint` paragraph (line 37) and in the `export` and `edit` sections. Use neutral examples such as `Idle`.

## What a careless implementation gets wrong

- Do not change the top-line overview `lint` description or other commands' help.
- `apps/cli/src/ai-commands.test.ts:98` and `apps/cli/src/mcp.test.ts:103` read `COMMAND_HELP` dynamically; they must pass with the new text.
- Do not name any fallback font path. The list may change.
- Help stays plain ASCII, except what already exists.

## Tests (`apps/cli/src/help-style-export.test.ts`)

Importing `COMMAND_HELP`:

- `edit` help contains `verticalAlign`, `boxLabelAlign`, `strokeDashArray`, and `null removes a key`.
- `export` help contains `glyph-missing`.
- `lint` help contains `glyph-missing` and `--font-dir`.

## Verification (each must exit 0)

1. `bun test apps/cli/src/help-style-export.test.ts apps/cli/src/ai-commands.test.ts apps/cli/src/mcp.test.ts` -> 0 fail.
2. `bun run typecheck`.
3. `bunx biome check apps/cli/src/help.ts apps/cli/src/help-style-export.test.ts`.
4. `grep -n "boxLabelAlign" docs/cli.md`, `grep -n "glyph-missing" docs/cli.md`, `grep -n "strokeDashArray" docs/cli.md` -> each matches.

## Done criteria

- Verification 1-4 exit 0 with logs recorded.
- `git diff --stat apps/cli/src/help.ts docs/cli.md` shows additions with few deletions; existing lines are changed only for the lint usage.
- Progress log complete.

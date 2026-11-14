# tll-09-core-rules

- planId: tll-09-core-rules
- planPath: impl-plans/active/tll-09-core-rules.md
- wave: 1 in session 555 (wave 2 in session 552)
- dependsOn: tll-07-wide-width (accepted at 5b65f96)
- Design: `design-docs/specs/design-text-layout-lint.md`, sections "Module",
  "Rule `label-overflow`", "Rule `note-overflow`" and "Test plan" (fixture,
  `rules.test.ts`, `engine.test.ts`).
- Read `impl-plans/active/tll-06-overview.md` first.

## Session 555: re-validation mode

The changes below are already implemented at 5b65f96, and
`impl-plans/progress/tll-09-core-rules.md` ends with `STATUS: done` from
session 552. They have not been reviewed. In session 555 this plan is
dispatched so that the review step reviews it:

1. Do not rewrite working code. Read each writePath fresh and record its
   sha256 in a new `## Session 555` section appended to the progress log.
   (Remove the old trailing `STATUS: done` line first, so that the new one
   is again the last line.)
2. Compare the code with "File-level changes" below, item by item, and
   record each as `matches` or `differs: <what>`. Do the same for the
   test cases listed under `rules.test.ts`.
3. Run every command in "Verification", with logs under
   `tmp/text-layout-lint-s555/tll-09-core-rules/`.
4. Edit a writePath only to fix a check that fails or an item that
   differs. Record the intent snapshot first, and the sha256 before and
   after.
5. Review corrections from the review step use the same rules: fix them
   only in this plan's writePaths.

## Intent and context

This plan wires the tll-07 helper into the committed lint rules and widens
the page kinds:

- Q1: `TEXT_LAYOUT_LINT_PAGE_KINDS` becomes
  `["architecture", "freeform", "flowchart"]`. The CLI lint filter
  (`apps/cli/src/commands.ts:291-296`) and the export gate
  (`apps/cli/src/export-command.ts:337`) already read this constant, so no
  CLI code changes here.
- Q2:
  - `label-overflow`'s line-width check measures each export-rendered line
    with `wideAwareTextWidth`;
  - `note-overflow` gains two findings, a wide line and a wide wrapped
    height.

It also adds the shared wide fixture to the CLI fixture module, which tll-10
and tll-11 consume.

Current code: `packages/core/src/text-layout-lint/rules.ts`.

- `labelOverflow` (:53-121): the width loop calls `estimatedTextWidth` at
  :79.
- `pairFindings` (:132-275): the note loop at :155-197 computes `px`, `py`,
  `font`, `lh`, `lines`, `free`, `offset` and `drawn`, and pushes the
  "Clipped" finding.

## Non-goals

- Do not change `label-collision`, note proximity (the probe and sweep), the
  label height check, message templates of existing findings, rule ids,
  ordering, de-duplication or `engine.ts`.
- Do not touch `text-layout.ts`, `wide-text-width.ts` (tll-07),
  `packages/core/src/index.ts`, `svg-export/**`, `label-layout.ts` or
  `node-label.ts`.
- Do not edit any `apps/cli/src/*.test.ts` file or `apps/cli/src/commands.ts`.
  The three CLI test failures caused by freeform becoming lintable (listed
  in tll-06 "Known transient state") are fixed by tll-10.
- Do not run `bun test apps/cli/src` or `mise run test-cli` as a pass/fail
  gate. Those gates belong to tll-10 and tll-11.
- Do not change the existing fixture builders or `TEXT_LAYOUT_EXPECTED`.

## writePaths

- packages/core/src/text-layout-lint/rules.ts
- packages/core/src/text-layout-lint/rules.test.ts
- packages/core/src/text-layout-lint/engine.test.ts
- apps/cli/src/__fixtures__/text-layout.ts
- impl-plans/progress/tll-09-core-rules.md
- tmp/text-layout-lint-s555/tll-09-core-rules

sharedPaths: none.

## File-level changes

### `packages/core/src/text-layout-lint/rules.ts`

1. `TEXT_LAYOUT_LINT_PAGE_KINDS` (:21-23) becomes
   `["architecture", "freeform", "flowchart"]`.
2. Import `wideAwareTextWidth` and `wideAwareLineCount` from
   `"../wide-text-width.ts"`. Remove the `estimatedTextWidth` import if it
   becomes unused. Keep `estimatedTextWidth` itself in `text-layout.ts` and
   the core index.
3. `labelOverflow` width loop: replace `estimatedTextWidth(line, layout.fontSize, letterSpacing)`
   with `wideAwareTextWidth(...)` and the same arguments. Everything else in
   the function stays as is: the first offending line only, `line.trim()`,
   `available`, both message templates and the height check.
4. In the note loop of `pairFindings`, after the existing "Clipped" push and
   before the rotation/probe `continue`:
   - **Wide line.** Let `A = Math.max(1, box.width - 2 * px)`, the exact
     wrap width already passed to `wrapTextLines`. Hoist it into a local
     and reuse it for the `wrapTextLines` call. For `i` in `0 .. drawn-1`,
     take the first `lines[i]` with `lines[i].trim() !== ""` and
     `W = wideAwareTextWidth(lines[i], font, letterSpacing) > A + EPS`.
     Push one `note-overflow` finding:
     `Text line ${i + 1} of ${lines.length} is ${fmt(W)} wide but the text area is ${fmt(A)} wide at ${fmt(font)}px; export draws it past the note padding.`
   - **Wide wrapped height.** Only when `drawn === lines.length`: compute
     `wideCount = sum of wideAwareLineCount(line, A, font, letterSpacing)`
     over all `lines`. Then compute
     `wideFree = Math.max(0, box.height - 2 * py - wideCount * lh)` and
     `wideOffset` with the same `verticalAlign` ternary as `offset`. If
     `py + wideOffset + wideCount * lh > box.height + EPS`, push:
     `Text needs ${wideCount} lines with wide characters at 1 em (${fmt(2 * py + wideCount * lh)} high with padding) but the box is ${fmt(box.height)} high; real fonts overflow it.`
   - Both checks also run for rotated notes. They come before the rotation
     `continue`.
   - `letterSpacing` is `style?.letterSpacing ?? 0`, as the existing
     `wrapTextLines` call uses.

Pitfalls:

- Do not reuse `offset`/`free` for the wide height. They are computed from
  the export line count. With `wideCount === lines.length`, the new
  condition is exactly the negation of "all lines drawn", so text with no
  wide graphemes never gets this finding. A test pins that.
- Do not compute wide-aware widths for lines beyond `drawn`.
- Do not change the existing `fmt`, `EPS` or `finding` helpers.

### `packages/core/src/text-layout-lint/rules.test.ts`

Keep all existing tests unchanged. Add a `describe("wide characters", ...)`
built with `Editor` and `buildElement`, imitating `example()` (:6-56).
Cases, as input -> expected:

- `node.generic` 140x60 labelled `在庫照会サービス（試験運用中）` -> exactly one
  `label-overflow` with message
  `Label line 1 of 1 is 195 wide but the text area is 120 wide at 13px; export clips it.`
- `node.generic` 140x60 labelled `Payment gateway` -> no finding.
- `shape.geo` rect 140x60 with the CJK label -> exactly one
  `label-overflow` ending `export draws it past the label padding.`, with
  `is 195 wide but the text area is 124 wide`.
- Fixed `text.note` 120x44 with `在庫照会サービスの再試行ポリシー` -> exactly two
  `note-overflow`:
  `Text line 1 of 2 is 182 wide but the text area is 104 wide at 13px; export draws it past the note padding.`
  and
  `Text needs 3 lines with wide characters at 1 em (58.8 high with padding) but the box is 44 high; real fonts overflow it.`
- The same note at 120x80 -> only the wide-line finding. Three lines fit,
  since `6 + 46.8 <= 80`.
- The 120x44 note with `style.verticalAlign` `"middle"` and then `"bottom"`
  -> the same two findings. The 120x60 note with each of the three
  alignments -> only the wide-line finding. When `wideFree > 0` the offset
  can never push the block past the box, so alignment does not change the
  result. This test pins that the alignment formula is applied without
  error.
- ASCII regression guard: fixed note 200x21.6 with `Retry three times`
  (one export line, `drawn === n === 1`, exactly `py + lh` high) -> no
  finding at all. A wrong formula using `2 * py + n * lh > B` would report
  it.
- Agreement: imitate the existing test
  "renderer wraps the fitting label and clips the overflowing label"
  (`rules.test.ts:79-100`). `editor.exportPageSvg()` for the CJK node page
  has exactly one `<text>` in the `data-id="..."` group of the wide node,
  and its `y + 7.8 <= 60` (export draws one fitting line), while the lint
  reports the node.

### `packages/core/src/text-layout-lint/engine.test.ts`

- :16 `expect(TEXT_LAYOUT_LINT_PAGE_KINDS).toEqual(["architecture"])`
  becomes `["architecture", "freeform", "flowchart"]`. Change nothing else.

### `apps/cli/src/__fixtures__/text-layout.ts`

Add, reusing the private `build`, `node` and `note` helpers:

```ts
export function textLayoutWideDocument(kind = "architecture"): string;
export const TEXT_LAYOUT_WIDE_EXPECTED: readonly { readonly ruleId: string; readonly elementId: string }[];
```

- Elements, placed far apart so that no collision or proximity finding
  appears (at least 300 units apart in x):
  - `node-wide`: `node.generic` 140x60, `在庫照会サービス（試験運用中）`;
  - `node-ascii`: `node.generic` 140x60, `Payment gateway`;
  - `geo-wide`: `shape.geo` 140x60, the same CJK label;
  - `note-wide`: fixed note 120x44, `在庫照会サービスの再試行ポリシー`.
- `TEXT_LAYOUT_WIDE_EXPECTED`, in lint order: `label-overflow node-wide`,
  `label-overflow geo-wide`, `note-overflow note-wide`,
  `note-overflow note-wide`. Element order in the page decides the order, so
  create them in that order. Core tests must not import from `apps/cli`.
  This plan checks the fixture with the `bun -e` command in Verification.
  tll-10 pins it in a CLI test.
- Same page id and name as the other builders (`page-architecture`,
  `Architecture`), with `pageKind` set to `kind`.

## Invariants

- Existing `TEXT_LAYOUT_EXPECTED` and all existing rule test messages are
  unchanged.
- `grep -rln "wide-text-width" packages apps --include=*.ts` lists only
  `packages/core/src/text-layout-lint/rules.ts` and
  `packages/core/src/wide-text-width.test.ts`.
- `git diff 45cc69f -- packages/core/src/text-layout-lint/engine.ts packages/core/src/index.ts`
  is empty.

## Verification

Logs go to `tmp/text-layout-lint-s555/tll-09-core-rules/<name>.log`. Prefix
bun tests with `BUN_OPTIONS=--jsx-runtime=classic`.

| Command | Must show |
| --- | --- |
| `bun test packages/core/src/text-layout-lint packages/core/src/wide-text-width.test.ts` | exit 0, 0 fail, new wide cases present |
| `bun test packages/core` | exit 0, 0 fail (export and snapshot tests unchanged) |
| `bun test packages/io` | exit 0, 0 fail (golden fixtures unchanged) |
| `git diff --stat 45cc69f -- packages/core/src/svg-export packages/core/src/label-layout.ts packages/core/src/node-label.ts packages/io/src apps/cli/native Cargo.toml Cargo.lock` | empty |
| `git diff --numstat 45cc69f -- packages/core/src/text-layout.ts` | `1	1` |
| `bunx biome check packages/core/src/text-layout-lint apps/cli/src/__fixtures__/text-layout.ts` | exit 0 |
| `bun run typecheck` | exit 0 |
| `bun -e 'import {lintTextLayoutPage} from "@nodetto/core"; import {parseDocument} from "@nodetto/io"; import {textLayoutWideDocument} from "./apps/cli/src/__fixtures__/text-layout.ts"; console.log(JSON.stringify(lintTextLayoutPage(parseDocument(textLayoutWideDocument()), "page-architecture").map(f => [f.ruleId, f.elementId])))'` | run from the repo root (tsconfig `paths` resolve `@nodetto/*`); prints exactly `[["label-overflow","node-wide"],["label-overflow","geo-wide"],["note-overflow","note-wide"],["note-overflow","note-wide"]]` |
| `bun test apps/cli/src/text-layout-lint.test.ts apps/cli/src/text-layout-export.test.ts apps/cli/src/breadboard-commands.test.ts` | informational only, not a pass/fail gate. Expected: exit 1 with exactly 3 failures, the three tests listed in tll-06 "Known transient state". Any other failure is a tll-09 defect. tll-10 updates these files and runs them as its gate. |

## Done criteria

- The constant, label width, two note findings, the fixture and the tests
  are as specified. Each edited file's sha256 is recorded before and after.
- All required commands show their results. The informational CLI run lists
  only the three expected tll-10-owned failures.
- The last line of `impl-plans/progress/tll-09-core-rules.md` is
  `STATUS: done`.

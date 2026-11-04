# clm-03-lint-core

- planId: clm-03-lint-core
- planPath: impl-plans/active/clm-03-lint-core.md
- progressPath: impl-plans/progress/clm-03-lint-core.md
- wave: 1
- dependsOn: none
- Design: `design-docs/specs/design-cli-layout-merge-lint.md`, sections D1
  and D2, and the D1 and D2 rows of "Verification". Owner questions Q2
  (page kinds for `node-overlap`) and Q4 (keep wrapping even when height
  overflows).
- writePaths:
  - `packages/core/src/diagram-lint/node-overlap.ts` (new)
  - `packages/core/src/diagram-lint/node-overlap.test.ts` (new)
  - `packages/core/src/text-wrap.ts` (new)
  - `packages/core/src/text-wrap.test.ts` (new)
  - `packages/core/src/text-layout-lint/fix.ts` (new)
  - `packages/core/src/text-layout-lint/fix.test.ts` (new)
  - `packages/core/src/text-layout-lint/rules.ts`
  - `packages/core/src/text-layout-lint/index.ts`
  - `impl-plans/progress/clm-03-lint-core.md`
  - `tmp/clm-s725/clm-03-lint-core`
  - `target`
- artifactRoots: `target`

## Intent and context

This plan adds the pure core parts of the lint additions: the
`node-overlap` rule and the text-wrap fix planner. The CLI wiring comes
later, in clm-08.

- `packages/core/src/text-layout-lint/rules.ts` already computes
  `label-overflow` (for `node.generic` and `shape.geo`, field `label`) and
  `note-overflow` (for `text.note`, field `text`). It measures with
  `wideAwareTextWidth` and `graphemes` from
  `packages/core/src/wide-text-width.ts`.
- `packages/core/src/text-layout-lint/index.ts` is the barrel that
  `packages/core/src/index.ts` already re-exports with `export *` (line 372).
  New exports added to that barrel therefore reach the CLI without editing
  `packages/core/src/index.ts`.

## Non-goals

- Do not change any existing finding, message or export warning. The
  existing tests in `text-layout-lint/*.test.ts` must pass unchanged.
- Do not edit `packages/core/src/index.ts`.
- No CLI changes.

## File-level changes

1. `diagram-lint/node-overlap.ts`
   - Signature:
     ```ts
     export interface NodeOverlapFinding { readonly elementId: string; readonly otherId: string; readonly ruleId: "node-overlap"; readonly severity: "warning"; readonly message: string }
     export function lintNodeOverlaps(document: Document, pageId: string): NodeOverlapFinding[];
     export const NODE_OVERLAP_PAGE_KINDS: readonly PageKind[]; // ["erd","state","flowchart","uml"]
     ```
   - Build an `Editor` and get bounds with `getBounds(id, createShapeContext(1))`,
     the way `text-layout-lint/engine.ts` does.
   - Candidates per page kind:
     - erd: `erd.table` and `isDatabaseObjectType`.
     - state: `state.node`.
     - flowchart and uml: elements of category `node`, except `frame`,
       `group`, `text.note` and `image.raster`.
   - A pair is reported when the intersection area is greater than 1. That
     includes containment and identical bounds. Touching boxes (area 0) are
     not reported.
   - Exemptions:
     - one element is the other's group or frame parent (use `frameParents`
       for frames and the group membership the editor uses);
     - on uml pages only, a `usecase.node` with `semantic.kind === "system"`
       that contains the other element.
     - Nothing on erd or state pages is exempt.
   - One finding per unordered pair, on the element whose id is smaller by
     code-unit compare. Iterate in sorted id order. A simple x-sorted sweep
     is fine; avoid O(n^2) work over all page elements when you can, but
     correctness comes first.
   - Message: `<noun> "<name>" overlaps <noun> "<name>" on page "<page name>" (<w>x<h>)`.
     - noun: `table` for erd tables, `state` for state nodes, otherwise the
       type id.
     - name: `tableName`, `name`, `label` or `text`, whichever is a
       non-empty string. Otherwise fall back to the short id, the first 6
       characters of the id.
     - `w` and `h`: the intersection size, rounded to 1 decimal like `fmt`
       in `rules.ts`.
2. `text-wrap.ts`
   - Signature:
     `export function wrapTextToWidth(text: string, width: number, fontSize: number, letterSpacing?: number): string`.
   - Wrap each existing line independently, and keep the existing `\n`.
   - Measure with `wideAwareTextWidth` and iterate with `graphemes`. Do not
     use `Intl.Segmenter` directly, and do not use a regex split over the
     text.
   - Break preference, in order:
     - after a run of spaces (the spaces are dropped at the break);
     - after the closing and separating punctuation set in design D2;
     - before the opening bracket set;
     - between two wide graphemes;
     - hard break at a grapheme boundary when a word alone is too wide.
   - No line may start with closing punctuation, `ー` or small kana. Move the
     break one grapheme earlier when that is possible.
   - Return the input unchanged when every line already fits.
3. `text-layout-lint/rules.ts`: additive only. Export a helper that returns,
   for one item, the text field name and the available width and font size
   the rules use (`labelTextArea(item)` and `noteTextArea(item)`, or a
   single `textArea(item)`). Existing function results and messages must
   not change.
4. `text-layout-lint/fix.ts`
   - Signature:
     ```ts
     export interface TextWrapFix { readonly pageId: string; readonly elementId: string; readonly ruleId: "label-overflow" | "note-overflow"; readonly field: "label" | "text"; readonly before: string; readonly after: string }
     export function planTextWrapFixes(document: Document, pageId: string): TextWrapFix[];
     ```
   - Find the width-caused findings (a line wider than the area). Apply
     `wrapTextToWidth` with the same width and font size. Include a fix only
     when `after !== before`. Sort by element id.
   - Vertical-only overflow produces no fix.
5. `text-layout-lint/index.ts`: export `planTextWrapFixes`, `TextWrapFix`,
   `wrapTextToWidth`, `lintNodeOverlaps`, `NodeOverlapFinding` and
   `NODE_OVERLAP_PAGE_KINDS` (re-exported from `../text-wrap.ts` and
   `../diagram-lint/node-overlap.ts`).

## Tests (input -> expected)

`node-overlap.test.ts`, all on an erd page unless stated:
- Two tables with identical bounds -> 1 finding naming both tables and the
  page.
- A table fully inside another -> 1 finding.
- A partial overlap of 40x20 -> 1 finding, with message dims `40x20`.
- Tables that share an edge -> 0 findings.
- Three mutually overlapping tables -> 3 findings, each pair once.
- A uml `usecase.node` system box containing a use case -> 0 findings; two
  overlapping use cases inside it -> 1 finding.
- Overlapping states on a state page -> 1 finding.
- A freeform page -> `lintNodeOverlaps` is not applicable (the CLI does not
  call it). The exported kinds list has no freeform.

`text-wrap.test.ts`:
- `"alpha beta gamma"` at a width that fits 2 words -> `"alpha beta\ngamma"`.
- A long Latin word -> hard split, and no line exceeds the width.
- CJK text with `、` and `。` -> breaks right after the punctuation.
- A break that would start a line with `」` -> the break moves earlier.
- Text that already fits -> returned unchanged (same string).
- Idempotent: wrapping the result again returns the same result.
- Existing `\n` is kept.

`fix.test.ts`:
- A `node.generic` with an overflowing label on a flowchart page -> 1 fix
  (`field` `label`), and re-running the lint on the fixed document gives no
  width finding.
- A `text.note` with an overflowing line -> a `text` fix.
- A note that is only too tall -> no fix.
- Non-overflowing text -> no fix.

## Verification (each must exit 0)

1. `bun test packages/core/src/diagram-lint packages/core/src/text-wrap.test.ts packages/core/src/text-layout-lint`.
   The new tests pass, and the existing text-layout-lint tests pass
   unchanged.
2. `bun run typecheck`.
3. `bunx biome check packages/core/src/diagram-lint packages/core/src/text-wrap.ts packages/core/src/text-wrap.test.ts packages/core/src/text-layout-lint`.

## Done criteria

- The exports are reachable through the core barrel: one test in
  `fix.test.ts` imports `lintNodeOverlaps` and `planTextWrapFixes` from
  `../index.ts`.
- `git diff --stat` shows only writePaths.

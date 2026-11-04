# clm-03-lint-core

- planId: clm-03-lint-core
- planPath: impl-plans/active/clm-03-lint-core.md
- progressPath: impl-plans/progress/clm-03-lint-core.md
- wave: 1
- dependsOn: none
- Design: `design-docs/specs/design-cli-layout-merge-lint.md`, sections D1
  and D2, and the D1 and D2 rows of "Verification". Owner questions Q2
  (node-overlap page kinds) and Q4 (keep wrapping when height overflows).
- writePaths:
  - `packages/core/src/diagram-lint/node-overlap.ts` (new)
  - `packages/core/src/diagram-lint/node-overlap.test.ts` (new)
  - `packages/core/src/text-wrap.ts` (new)
  - `packages/core/src/text-wrap.test.ts` (new)
  - `packages/core/src/text-layout-lint/fix.ts` (new)
  - `packages/core/src/text-layout-lint/fix.test.ts` (new)
  - `packages/core/src/text-layout-lint/rules.ts`
  - `impl-plans/progress/clm-03-lint-core.md`
  - `tmp/clm-s725/clm-03-lint-core`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

This plan adds the pure core parts of the lint additions: the
`node-overlap` rule and the text-wrap fix planner. clm-08 calls them from
the CLI, and clm-09 re-exports them.

- `packages/core/src/text-layout-lint/rules.ts` computes `label-overflow`
  (`node.generic` and `shape.geo`, field `label`) and `note-overflow`
  (`text.note`, field `text`). It measures with `wideAwareTextWidth` and
  `graphemes` from `packages/core/src/wide-text-width.ts`.
- `text-layout-lint/engine.ts:lintTextLayoutPage` shows how to build a
  `Store` and a shape context from a `Document`.

## Non-goals

- No change to any existing finding, message or export warning. The
  existing `text-layout-lint/*.test.ts` tests pass unchanged.
- Do not edit `packages/core/src/index.ts` or
  `packages/core/src/text-layout-lint/index.ts`. clm-09 adds the exports.
- No CLI changes.

## Contract (clm-08 depends on it)

```ts
// diagram-lint/node-overlap.ts
export const NODE_OVERLAP_PAGE_KINDS: readonly PageKind[]; // ["erd","state","flowchart","uml"]
export interface NodeOverlapFinding {
  readonly pageId: PageId; readonly elementId: ElementId; readonly otherId: ElementId;
  readonly message: string; readonly width: number; readonly height: number;
}
export function lintNodeOverlaps(document: Document, pageId: PageId): NodeOverlapFinding[];
// text-wrap.ts
export function wrapTextToWidth(text: string, width: number, fontSize: number, letterSpacing?: number): string;
// text-layout-lint/fix.ts
export interface TextWrapFix {
  readonly pageId: PageId; readonly elementId: ElementId; readonly ruleId: string;
  readonly field: string; readonly before: string; readonly after: string;
}
export function planTextWrapFixes(document: Document, pageId: PageId): TextWrapFix[];
```

The rule id is `node-overlap` and the severity is `warning`. clm-08 adds
both when it maps findings to rows.

## File-level changes

1. `diagram-lint/node-overlap.ts`
   - Bounds come from `getBounds` with a shape context at scale 1, the way
     `engine.ts` builds one.
   - Candidates by page kind:
     - erd: `erd.table` and database object types (`isDatabaseObjectType`);
     - state: `state.node`;
     - flowchart and uml: elements of category `node`, except `frame`,
       `group`, `text.note` and `image.raster`.
     - Any other kind returns `[]`.
   - A pair is reported when the intersection area is greater than 1. That
     includes containment and identical bounds. Touching boxes (area 0) are
     not reported.
   - Exempt pairs:
     - one element is the other's frame or group parent (`frameParents`
       for frames, the store's group membership for groups);
     - on uml pages only, a `usecase.node` with `semantic.kind === "system"`
       that contains the other.
     - Nothing on erd or state pages is exempt.
   - One finding per unordered pair, on the element whose id is smaller by
     code-unit compare, sorted by (elementId, otherId).
   - Message: `<noun> "<name>" overlaps <noun> "<name>" on page "<page name>" (<w>x<h>)`.
     - noun: `table` for erd tables, `state` for state nodes, otherwise the
       type id.
     - name: the first non-empty string among `tableName`, `name`, `label`
       and `text`; otherwise the first 6 characters of the id.
     - `w` and `h`: the intersection size, formatted like `fmt` in
       `rules.ts`.
   - Sort by x and sweep, with indexed loops. Correctness comes before
     speed.
2. `text-wrap.ts`
   - Wrap each existing line on its own, and keep existing `\n`.
   - Measure with `wideAwareTextWidth` and iterate with `graphemes`. Do not
     use `Intl.Segmenter` directly or a regex split.
   - Break preference, in order:
     - after a run of spaces (the spaces at the break are dropped);
     - after `、 。 ， ． ・ ： ； ！ ？ 」 』 ） 】 〉 》 ］ ｝ 〕 / ／`;
     - before `「 『 （ 【 〈 《 ［ ｛ 〔`;
     - between two wide graphemes;
     - a hard grapheme break when a word alone is too wide.
   - A line never starts with closing punctuation, `ー` or small kana. Move
     the break one grapheme earlier when that is possible.
   - Return the same string when every line already fits.
3. `text-layout-lint/rules.ts`: additive only. Export
   `textWrapArea(item): { field: "label" | "text"; width: number; fontSize: number; letterSpacing: number } | undefined`,
   using the exact values the overflow rules use. Existing results and
   messages do not change.
4. `text-layout-lint/fix.ts`
   - For width-caused `label-overflow` and `note-overflow` findings (a line
     wider than the area), apply `wrapTextToWidth` with the same area.
     Include a fix only when `after !== before`. Sort by element id.
   - Vertical-only overflow gives no fix.

## Tests (input -> expected)

`node-overlap.test.ts` (erd page unless stated):
- Identical bounds -> 1 finding naming both tables and the page.
- A table fully inside another -> 1. A 40x20 partial overlap -> 1, message
  ends `(40x20)`. A shared edge -> 0.
- Three mutually overlapping tables -> 3 findings, each pair once.
- A uml system `usecase.node` containing a use case -> 0. Two overlapping
  use cases inside it -> 1.
- Overlapping states on a state page -> 1.
- A freeform page -> `[]`, and `NODE_OVERLAP_PAGE_KINDS` has no freeform.

`text-wrap.test.ts`:
- `"alpha beta gamma"` at a width that fits 2 words -> `"alpha beta\ngamma"`.
- A long Latin word -> hard split, and no line exceeds the width.
- CJK with `、` and `。` -> breaks right after the punctuation.
- A break that would start a line with `」` -> the break moves earlier.
- Text that fits -> the same string. Wrapping twice -> same result.
  Existing `\n` is kept.

`fix.test.ts`:
- A `node.generic` with an overflowing label on a flowchart page -> 1 fix
  with field `label`. Re-linting the fixed document gives no width finding.
- An overflowing `text.note` line -> a `text` fix.
- A note that is only too tall -> no fix. Text that fits -> no fix.

## Verification (each must exit 0)

1. `bun test packages/core/src/diagram-lint/node-overlap.test.ts packages/core/src/text-wrap.test.ts packages/core/src/text-layout-lint`:
   the new tests pass, and the existing text-layout-lint tests pass
   unchanged.
2. `bun run typecheck`.
3. `bunx biome check packages/core/src/diagram-lint/node-overlap.ts packages/core/src/diagram-lint/node-overlap.test.ts packages/core/src/text-wrap.ts packages/core/src/text-wrap.test.ts packages/core/src/text-layout-lint/fix.ts packages/core/src/text-layout-lint/fix.test.ts packages/core/src/text-layout-lint/rules.ts`.

## Done criteria

- The contract symbols exist with the signatures above.
- Verification 1 to 3 exit 0, and their logs are under
  `tmp/clm-s725/clm-03-lint-core/`.
- `git status --short` shows only writePaths changed.

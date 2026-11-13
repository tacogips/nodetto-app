# stb-01-text-format

- planId: stb-01-text-format; wave 1; dependsOn: none
- Design: section 3.1 of `design-docs/specs/design-selection-toolbar-icons.md`.
- writePaths: `packages/ui-solid/src/text-format.ts` (new),
  `packages/ui-solid/src/text-format.test.ts` (new),
  `impl-plans/progress/stb-01-text-format.md`, `tmp/stb-s857/stb-01-text-format`,
  `target`. artifactRoots: `target`.

## Intent and context

The selection toolbar gets a Text disclosure (wired in stb-03). This plan
adds only its pure, DOM-free logic: the current text state of a style and
the `StylePatch` each control writes. stb-03 calls these functions and
passes the patch to `editor.setSelectionStyle`. That call is one undo step,
and `null` in a patch clears a field.

## Non-goals

- No Solid, JSX, DOM or `Editor` usage. No edits to `SelectionToolbar.tsx`,
  `StyleSection.tsx`, `index.ts`, IR or core.
- No font family, colour, line height or letter spacing controls.

## Contract (stb-03 depends on these exact names)

```ts
export const DEFAULT_FONT_SIZE: number; // = TEXT_NOTE_FONT_SIZE from @nodetto/core (13)
export const FONT_SIZE_STEPS: readonly number[]; // [8,9,10,11,12,13,14,16,18,20,24,28,32,40,48,64,72]
export const MIN_FONT_SIZE: number; export const MAX_FONT_SIZE: number; // 8, 72
export type TextAlignValue = "start" | "middle" | "end";
export type VerticalAlignValue = "top" | "middle" | "bottom";
export interface TextFormatState { readonly fontSize: number; readonly bold: boolean;
  readonly italic: boolean; readonly underline: boolean; readonly strikethrough: boolean;
  readonly textAlign: TextAlignValue | null; readonly verticalAlign: VerticalAlignValue; }
export function textFormatState(style: VisualStyle | undefined): TextFormatState;
export function stepFontSize(current: number, direction: -1 | 1): number | null;
export function fontSizePatch(style: VisualStyle | undefined, direction: -1 | 1): StylePatch | null;
export function boldPatch(style: VisualStyle | undefined): StylePatch;
export function italicPatch(style: VisualStyle | undefined): StylePatch;
export function decorationPatch(style: VisualStyle | undefined, flag: "underline" | "line-through"): StylePatch;
export function textAlignPatch(style: VisualStyle | undefined, value: TextAlignValue): StylePatch;
export function verticalAlignPatch(style: VisualStyle | undefined, value: VerticalAlignValue): StylePatch;
export function supportsVerticalAlign(leaves: readonly Pick<Element, "type">[]): boolean;
```

Types: `VisualStyle` and `Element` are type imports from `@nodetto/ir`.
`StylePatch` and `TEXT_NOTE_FONT_SIZE` come from `@nodetto/core`. Both are
already exported (`packages/core/src/index.ts:138`, `:298`). Imitate the
import style of `packages/ui-solid/src/inspector/StyleSection.tsx:9-19`.

## Rules (design 3.1)

- `fontSize`: `style?.fontSize ?? DEFAULT_FONT_SIZE`.
- `bold`: `(style?.fontWeight ?? 400) >= 600`. `boldPatch` gives
  `{ fontWeight: null }` when bold, otherwise `{ fontWeight: 700 }`.
- `italic`: `fontStyle === "italic"`. `italicPatch` gives
  `{ fontStyle: null }` when italic, otherwise `{ fontStyle: "italic" }`.
- `underline` / `strikethrough`: the `textDecoration` value split on spaces
  contains `underline` / `line-through`. `"none"` and `undefined` set both
  to false. `decorationPatch` flips one flag and writes the result: both set
  gives `"underline line-through"` (exactly this order), one set gives that
  value, none set gives `null`. Never write `"none"`.
- `textAlign`: `style?.textAlign ?? null`. `textAlignPatch` writes `null`
  when `style.textAlign === value`, otherwise `value`.
- `verticalAlign` state: `style?.verticalAlign ?? "top"`.
  `verticalAlignPatch` writes `null` when `style.verticalAlign === value`
  (compare the explicit field, not the defaulted state), otherwise `value`.
- `stepFontSize`: for +1, the smallest step strictly greater than `current`;
  for -1, the largest step strictly smaller. Return `null` when there is
  none. A non-finite `current` returns `null`. `fontSizePatch` gives
  `{ fontSize: n }` or `null`.
- `supportsVerticalAlign`: `leaves.length > 0 &&` every `type === "text.note"`.
  This is the same rule as `StyleSection.tsx:895`.

## Pitfalls

- `noUncheckedIndexedAccess`: no `FONT_SIZE_STEPS[i]` without an undefined
  check. Use `find` / `findLast` or a `for...of` loop.
- Do not mutate the input style. Return fresh patch objects.
- `MIN_FONT_SIZE` / `MAX_FONT_SIZE` must be literals or derived safely (not
  `FONT_SIZE_STEPS[0]!`).
- No `any`, no non-null assertions, no emojis.

## Tests (`text-format.test.ts`, `bun:test`)

- `textFormatState(undefined)` gives fontSize 13, all flags false,
  textAlign null, verticalAlign "top".
- Full style `{fontSize: 20, fontWeight: 700, fontStyle: "italic",
  textDecoration: "underline line-through", textAlign: "end",
  verticalAlign: "bottom"}` gives every flag true and the values carried.
- `fontWeight: 600` gives bold true. `500` gives false. `textDecoration: "none"`
  gives both flags false.
- `boldPatch`, `italicPatch` in both states give the exact patch objects
  (`toEqual`).
- decorationPatch: from none with underline gives `"underline"`. From
  `"underline"` with line-through gives `"underline line-through"`. From
  `"underline line-through"` with underline gives `"line-through"`. From
  `"line-through"` with line-through gives `null`.
- textAlignPatch: unset with middle gives `"middle"`. `"middle"` with middle
  gives `null`.
- verticalAlignPatch: unset with top gives `"top"`. `"top"` with top gives
  `null`. `"top"` with bottom gives `"bottom"`.
- stepFontSize: 13 +1 gives 14, 13 -1 gives 12, 15 +1 gives 16, 15 -1 gives
  14, 72 +1 gives null, 8 -1 gives null, 100 -1 gives 72, 4 +1 gives 8,
  NaN gives null.
- fontSizePatch(undefined, 1) gives `{fontSize: 14}`. At 72 with +1 it gives
  null.
- supportsVerticalAlign: `[]` gives false, two text.note leaves give true,
  text.note with shape.geo gives false.
- `DEFAULT_FONT_SIZE === 13` and `FONT_SIZE_STEPS` is strictly ascending.

## Verification (each must exit 0; logs under tmp/stb-s857/stb-01-text-format/)

1. `bun test packages/ui-solid/src/text-format.test.ts` shows all tests
   passing with 0 failures.
2. `bun run typecheck`. If it fails only in stb-02's files during the wave,
   record the diagnostic and re-run after stb-02 lands.
3. `bunx biome check --diagnostic-level=warn packages/ui-solid/src/text-format.ts packages/ui-solid/src/text-format.test.ts`
4. `sh -c 'mkdir -p tmp/stb-s857/stb-01-text-format && bunx tsc --noEmit --pretty false -p tsconfig.json --noUncheckedIndexedAccess > tmp/stb-s857/stb-01-text-format/strict-index.log 2>&1; ! grep -E "^packages/ui-solid/src/text-format(\.test)?\.ts\(" tmp/stb-s857/stb-01-text-format/strict-index.log'`
   This must show no strict-index diagnostic in the owned files.

## Done criteria

- Both files exist and export every contract name above.
- All four commands exit 0.
- Progress log `impl-plans/progress/stb-01-text-format.md` records the
  changes, each command with its exit code and log path, and any deviations.

## Coordination

Same branch and working tree as stb-02. Edit only your writePaths. Before
each edit, re-read the file and record its pre-edit and post-edit
`git hash-object` in the progress log. If a file changes without your edit,
stop and record drift; never revert another plan's work. Make no git state
changes (no commit, stash, checkout or reset).

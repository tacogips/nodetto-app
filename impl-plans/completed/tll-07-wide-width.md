# tll-07-wide-width

- planId: tll-07-wide-width
- planPath: impl-plans/active/tll-07-wide-width.md
- wave: 1
- dependsOn: none
- Design: `design-docs/specs/design-text-layout-lint.md`, section "Wide-aware
  width helper: `packages/core/src/wide-text-width.ts`" and the
  `wide-text-width.test.ts` bullets in "Test plan".
- Read `impl-plans/active/tll-06-overview.md` first (protocol, invariants,
  pinned contracts).

## Intent and context

Export wraps text by an estimate of 0.55 em per grapheme
(`packages/core/src/text-layout.ts:glyphAdvance`, `AVERAGE_GLYPH_WIDTH`).
Real fonts draw CJK, kana, hangul and fullwidth forms at about 1 em, so PNG
output clips text that the estimate fits. The owner decided (Q2) that the
lint, and only the lint, measures East Asian Wide (`W`) and Fullwidth (`F`)
graphemes at 1.0 em. This plan adds that measurement as a standalone,
table-driven helper. It must be cheap in the native CLI's Boa interpreter.

## Non-goals

- Do not change `wrapTextLines`, `glyphAdvance`, `estimatedTextWidth`,
  `measureTextNote` or any constant in `text-layout.ts`.
- Do not export the helper from `packages/core/src/index.ts`.
- Do not wire the helper into the lint rules. That is tll-09.
- No Ambiguous (`A`) handling beyond treating it as narrow. No font
  metrics, no locale switches.

## writePaths

- packages/core/src/wide-text-width.ts (new)
- packages/core/src/wide-text-width.test.ts (new)
- packages/core/src/text-layout.ts (one-word change)
- impl-plans/progress/tll-07-wide-width.md
- tmp/text-layout-lint-s552/tll-07-wide-width

sharedPaths: none.

## File-level changes

### `packages/core/src/text-layout.ts`

- Add `export` to `function graphemes(text: string): string[]` (:20).
  Change nothing else in the file. Record the sha256 before and after. The
  diff must be exactly one line.

### `packages/core/src/wide-text-width.ts` (new)

Exports the pinned contract, plus the table as
`export const EAST_ASIAN_WIDE_RANGES: readonly number[]` for the test. The
table is not re-exported from the core index.

```ts
export const WIDE_GLYPH_WIDTH = 1;
export function isWideCodePoint(codePoint: number): boolean;
export function wideAwareTextWidth(text: string, fontSize: number, letterSpacing = 0): number;
export function wideAwareLineCount(line: string, maxWidth: number, fontSize: number, letterSpacing = 0): number;
```

- Imports: only `AVERAGE_GLYPH_WIDTH` and `graphemes` from `./text-layout.ts`.
  Nothing else from core.
- Table: `EAST_ASIAN_WIDE_RANGES`, a flat `readonly number[]` of inclusive
  `[start, end, start, end, ...]` code points. It holds every code point with
  `East_Asian_Width` `W` or `F` in Unicode 16.0.0 `EastAsianWidth.txt`, with
  adjacent and overlapping ranges merged and sorted ascending. Put a comment
  above it naming the source (`EastAsianWidth.txt`, Unicode 16.0.0, `W` and
  `F` only). Write the numbers as hex literals (`0x1100`). Keep reserved
  code points that the file lists as `W` (for example the CJK extension
  planes `0x20000-0x2FFFD` and `0x30000-0x3FFFD`). If you cannot fetch the
  file, transcribe it from your knowledge of Unicode 16.0.0, and record that
  in the progress log. The tests below pin the representative points.
- `isWideCodePoint(cp)`: return `false` when `cp < 0x1100`. Otherwise do a
  binary search over the pairs. No regular expressions, no `\p{...}`, no
  `Intl` calls, no `Array.prototype.find` linear scans over the table.
- Per-grapheme class: `grapheme.codePointAt(0)`. A grapheme is wide when that
  code point is wide.
- Advances: `narrow = Math.max(0.1, fontSize * AVERAGE_GLYPH_WIDTH + letterSpacing)`.
  This copies the private `glyphAdvance` formula. Do not import or export
  `glyphAdvance`. `wide = Math.max(0.1, fontSize * WIDE_GLYPH_WIDTH + letterSpacing)`.
- `wideAwareTextWidth`: count narrow and wide graphemes, then return
  `narrowCount * narrow + wideCount * wide`. Do not sum per grapheme. The
  result must be bit-identical (`toBe`) to `estimatedTextWidth` when there
  are no wide graphemes.
- `wideAwareLineCount(line, maxWidth, ...)`: break greedily by grapheme with
  running counts `n` and `w` on the current line. A grapheme goes on the
  current line when the line is empty, or when
  `(n + dn) * narrow + (w + dw) * wide <= maxWidth + 0.01`. Otherwise start
  a new line holding that grapheme. Return the line count, with a minimum
  of 1 (an empty string returns 1). No word-boundary logic.
- Style: follow `packages/core/src/text-layout.ts` (short JSDoc on exported
  functions, no classes, two-space indent, double quotes). The `0.01`
  tolerance mirrors `EPS` in `text-layout-lint/rules.ts:38`. Define a local
  `const EPS = 0.01` rather than importing from the lint.

Pitfalls:

- `for...of` over a string iterates code points, not graphemes. Always use
  `graphemes()`.
- Never call `graphemes` inside a per-grapheme loop. Segment each line once.
- Do not classify by `charCodeAt`. Surrogate pairs (U+20000, U+1F600) need
  `codePointAt(0)`.
- Fullwidth forms span `0xFF01-0xFF60` and `0xFFE0-0xFFE6`. Halfwidth
  katakana `0xFF61-0xFF9F` is `H` (narrow). U+3000 (ideographic space) is
  `F`.

### `packages/core/src/wide-text-width.test.ts` (new)

Use `bun:test`, in the style of `packages/core/src/text-layout-lint/engine.test.ts`.
Cases, as input -> expected:

- `isWideCodePoint` of `0x1100`, `0x3000`, `0x3001`, `0x3042`, `0x30a2`,
  `0x30fc`, `0x4e00`, `0xac00`, `0xff08`, `0xff09`, `0xffe0`, `0x1f600`,
  `0x20000` -> true.
- `isWideCodePoint` of `0x41`, `0xe9`, `0x2026` (Ambiguous), `0x410`,
  `0xff61` (Halfwidth), `0x10ff`, `0x1160` (just after `0x1100-0x115f`)
  -> false.
- `EAST_ASIAN_WIDE_RANGES` is well-formed: even length; `start <= end` for
  each pair; each `start` is greater than the previous pair's `end + 1`
  (sorted, merged, non-overlapping); the first pair starts at `0x1100`.
- `wideAwareTextWidth("Payment gateway", 13)` -> `toBe(estimatedTextWidth("Payment gateway", 13))`.
  Also `"café"`, and a ZWJ sequence that starts with a narrow code
  point, with the same `toBe` equality.
- `wideAwareTextWidth("在庫照会サービス（試験運用中）", 13)` -> 195.
- `wideAwareTextWidth("ab在", 10, 1)` -> `2 * 6.5 + 11`.
- `wideAwareLineCount("", 104, 13)` -> 1.
- For every line of `wrapTextLines("Payment gateway authorisation service", 120, 13)`:
  `wideAwareLineCount(line, 120, 13)` -> 1.
- `wideAwareLineCount("在庫照会サービスの再試行ポリ", 104, 13)` (14
  graphemes, the first export line of the tll-09 note fixture) -> 2.
  `wideAwareLineCount("シー", 104, 13)` -> 1.
- `wideAwareLineCount("在", 5, 13)` -> 1 (one grapheme wider than the width
  still takes one line).

## Invariants

- `git diff 45cc69f -- packages/core/src/text-layout.ts` shows exactly one
  changed line, the `export` keyword on `graphemes`.
- No other file outside the writePaths changes.

## Verification

Run each command with output redirected to
`tmp/text-layout-lint-s552/tll-07-wide-width/<name>.log`:

| Command | Must show |
| --- | --- |
| `bun test packages/core/src/wide-text-width.test.ts` | exit 0, all new cases pass, 0 fail |
| `bun test packages/core/src/text-layout.test.ts packages/core/src/label-layout.test.ts packages/core/src/node-label.test.ts packages/core/src/text-layout-lint` | exit 0, 0 fail (wrapping unchanged) |
| `bunx biome check packages/core/src/wide-text-width.ts packages/core/src/wide-text-width.test.ts packages/core/src/text-layout.ts` | exit 0 |
| `bun run typecheck` (shared-input gate; siblings tll-08) | exit 0 |
| `git diff --numstat 45cc69f -- packages/core/src/text-layout.ts` | `1	1	packages/core/src/text-layout.ts` |

## Done criteria

- Both new files exist, and the module exports exactly the pinned symbols
  plus `EAST_ASIAN_WIDE_RANGES`.
- All commands above have their required results, logged in
  `impl-plans/progress/tll-07-wide-width.md` with exit codes and log paths,
  plus sha256 before and after for each edited file.
- The last line of the progress log is `STATUS: done`.

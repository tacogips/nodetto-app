# ipd-02-text-measure

- planId: ipd-02-text-measure
- planPath: impl-plans/active/ipd-02-text-measure.md
- progressPath: impl-plans/progress/ipd-02-text-measure.md
- wave: 2. dependsOn: ipd-00-baseline
- Design (binding): `design-docs/specs/design-iphone-app-design.md`, Decision 1.2 (proportional measure) and 1.4 (`APP_FONT_STACK`).
- Evidence: `tmp/ipd-s772/ipd-02-text-measure/`.
<!-- ownership:start -->
- writePaths:
  - `packages/core/src/text-measure.ts`
  - `packages/core/src/text-measure.test.ts`
  - `packages/core/src/text-metrics`
  - `scripts/generate-text-metrics.ts`
  - `impl-plans/progress/ipd-02-text-measure.md`
  - `tmp/ipd-s772/ipd-02-text-measure`
- sharedPaths:
  - `packages/core/src/index.ts`
- sharedPathNotes:
  - path: `packages/core/src/index.ts`; intendedEdit: append export lines only; re-read immediately before writing; never reorder or remove lines; verify sibling plans' new lines survive after writing
- artifactRoots:
  - `tmp/ipd-s772/ipd-02-text-measure`
<!-- ownership:end -->

Download audit record: the progress log (a writePath) is the tracked audit manifest for every downloaded input. For each download, record the exact download command, its exit code, the URL, the version, and the SHA-256 or npm integrity of the archive. Downloads and extracted files stay under this plan's `tmp/ipd-s772/ipd-02-text-measure` artifact root and are never committed.

## Intent and context

The text layer, control labels, truncation and the app lint all need one deterministic width measure that is closer to real fonts than the 0.55 em estimate. This plan pins it.

The measure is a committed advance-width table for U+0020-U+00FF in regular and bold. It is derived from Liberation Sans 2.x (SIL OFL 1.1, metric-compatible with Arial/Helvetica). It must run inside the Boa-hosted native CLI: pure TS, no Node APIs, no Intl beyond `Intl.Segmenter`, which `text-layout.ts:graphemes` already uses.

## Non-goals

- No change to `wrapTextLines`, `estimatedTextWidth`, `measureTextNote` or any renderer. Those switch over in `ipd-09` and `ipd-12`.
- No font embedding and no font files committed.
- `THIRD_PARTY_NOTICES.md` is owned by `ipd-03`. Send the Liberation entry text to `ipd-03` through your progress log; the text is already pinned there.

## File-level changes

New `packages/core/src/text-measure.ts`:

- `export const APP_FONT_STACK = '-apple-system, "SF Pro Text", "SF Pro", system-ui, "Helvetica Neue", Helvetica, Arial, sans-serif'`
- `export type TextMeasureMode = "estimate" | "proportional"`
- `export interface TextMeasureStyle { readonly fontSize: number; readonly fontWeight?: number; readonly letterSpacing?: number }`
- `export function textMeasureMode(visual: { readonly textMeasure?: "proportional" }): TextMeasureMode`
- `export function measureTextWidth(text: string, style: TextMeasureStyle, mode: TextMeasureMode): number`
  - Width of one line. Newlines are measured as spaces.
- `export function wrapMeasuredLines(text: string, maxWidth: number, style: TextMeasureStyle, mode: TextMeasureMode): string[]`
  - Explicit `\n` always breaks.
  - Greedy fill by words split on spaces.
  - A word longer than `maxWidth` is broken by graphemes.
  - Trailing spaces never cause a wrap.
  - `maxWidth <= 0` yields one grapheme per line.
  - The result has at least one line.
- `export function truncateToWidth(text: string, maxWidth: number, style: TextMeasureStyle, mode: TextMeasureMode): { readonly text: string; readonly truncated: boolean }`
  - Single line: newlines are replaced with spaces first.
  - If the text fits, it is returned unchanged.
  - Otherwise, remove whole graphemes from the end and trim trailing spaces until `text + "…"` fits.
  - If not even `"…"` fits, return `""` with `truncated: true`.

Mode `estimate` must return exactly `estimatedTextWidth` from `packages/core/src/text-layout.ts:54` for the same input. Reuse it, and do not duplicate the 0.55 constant.

Mode `proportional`, per grapheme:

- code point in U+0020-U+00FF: the table advance / unitsPerEm * fontSize. Use the bold table when `fontWeight >= 600`, else regular.
- East Asian Wide/Fullwidth (`isWideCodePoint` from `packages/core/src/wide-text-width.ts`): 1.0 em.
- otherwise: 0.55 em.
- plus `letterSpacing` per grapheme.
- A multi-code-point grapheme uses its first code point.

New `packages/core/src/text-metrics/advances.generated.ts`:

- `export const LIBERATION_SANS_ADVANCES = { unitsPerEm, regular: readonly number[], bold: readonly number[] }`.
- Both arrays have 224 entries, for U+0020-U+00FF.
- A missing glyph is stored as -1, meaning use 0.55 em.
- The file header comments name:
  - the source font version;
  - the SHA-256 of each source TTF;
  - the generator command.

New `packages/core/src/text-metrics/LICENSE-liberation-sans.txt`: the verbatim SIL OFL 1.1 text from the downloaded font package.

New `scripts/generate-text-metrics.ts`. It is a dev-time Bun script, not imported by any package.

- Arguments: `<regular.ttf> <bold.ttf>`.
- It parses `head.unitsPerEm`, `hhea.numberOfHMetrics`, `hmtx` and `cmap` subtable format 4 (platform 3 encoding 1).
- It writes the generated file deterministically, with sorted keys and integers only.
- No new dependency.
- Download the fonts into `tmp/ipd-s772/ipd-02-text-measure/fonts/`, from the official Liberation fonts 2.x release archive on GitHub (`liberationfonts/liberation-fonts` releases). Record the URL and archive SHA-256 in the progress log.
- If the network is unavailable, stop and record a blocker finding with the failing command. Do not hand-type metrics.

`packages/core/src/index.ts` (sharedPaths, append-only): export `APP_FONT_STACK`, `TextMeasureMode`, `TextMeasureStyle`, `textMeasureMode`, `measureTextWidth`, `wrapMeasuredLines`, `truncateToWidth`.

## Patterns to imitate

- `packages/core/src/wide-text-width.ts:wideAwareTextWidth` for per-grapheme iteration.
- `packages/core/src/text-layout.ts:wrapTextLines` for paragraph handling.

## Pitfalls

- Do not use `TextEncoder`, `DataView` on Node Buffers, or `fs` in `text-measure.ts`. Only the generator script may use Bun APIs.
- cmap format 4 uses the `idRangeOffset` indirection. Test against known glyphs: the advance of `space` and `W` in the regular table must be > 0, and `W` must be wider than `i`.
- Keep the generated file under 20 KB.
- Floating-point determinism: compute `advance / unitsPerEm * fontSize` in that order everywhere, so the TS and native hosts agree.

## Tests: new `packages/core/src/text-measure.test.ts`

- `measureTextWidth("Hello", {fontSize: 13}, "estimate")` -> equals `estimatedTextWidth` for the same input.
- `measureTextWidth("WWW", ...)` > `measureTextWidth("iii", ...)` in proportional mode.
- Bold width >= regular width for `"Settings"`.
- Width of `"A"` at fontSize 17 in proportional mode equals `regular[0x41-0x20] / unitsPerEm * 17`.
- `letterSpacing` 1 adds exactly 1 per grapheme.
- `"漢字"` in proportional mode -> 2 em.
- `wrapMeasuredLines("alpha beta gamma", widthOf("alpha beta"), ...)` -> `["alpha beta", "gamma"]`.
- An explicit newline is preserved. A long word is broken by graphemes.
- `truncateToWidth("Long title text", widthOf("Long ti…"), ...)` -> `"Long ti…"` with `truncated: true`.
- If the text fits, it is unchanged with `truncated: false`. A width smaller than `"…"` -> `""`.

## Verification (evidence in `final/`)

1. `bun test packages/core/src/text-measure.test.ts` -> exit 0, 0 fail.
2. Determinism: run `bun scripts/generate-text-metrics.ts <regular> <bold>` twice, recording `shasum -a 256 packages/core/src/text-metrics/advances.generated.ts` after each run -> both hashes are identical.
3. `bun run typecheck` -> no `error TS` line under `packages/core/src/text-measure.ts`, `packages/core/src/text-metrics` or `scripts/generate-text-metrics.ts`.
4. `bunx biome check packages/core/src/text-measure.ts packages/core/src/text-measure.test.ts scripts/generate-text-metrics.ts` -> exit 0.

## Done criteria

- All verification passes.
- `test -f packages/core/src/text-metrics/LICENSE-liberation-sans.txt`
- `wc -c < packages/core/src/text-metrics/advances.generated.ts` < 20000
- `rg -n 'measureTextWidth|truncateToWidth|APP_FONT_STACK' packages/core/src/index.ts` -> 3 or more matches.

## Worker rules

- Record `git hash-object` of this plan first.
- Read each file fresh before editing it. Record pre and post hashes. On drift, re-read, keep the other change and record it.
- `packages/core/src/index.ts` is shared with `ipd-03` in this wave. Add export lines only, never reorder or remove, re-read immediately before writing, and verify after writing that other new lines survived.
- No state-changing git commands, no lockfile edits, no emojis.
- Evidence files must not match Bun test patterns.

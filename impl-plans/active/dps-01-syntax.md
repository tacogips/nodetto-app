# dps-01-syntax

- planId: dps-01-syntax. Wave 1. dependsOn: none.
- Design: sections 2 and 3.2 of
  `design-docs/specs/design-document-pages-snippets.md`.
- writePaths:
  - New files:
    - `packages/core/src/syntax/types.ts`
    - `packages/core/src/syntax/languages.ts`
    - `packages/core/src/syntax/keywords.ts`
    - `packages/core/src/syntax/tokenize.ts`
    - `packages/core/src/syntax/palette.ts`
    - `packages/core/src/syntax/index.ts`
    - `packages/core/src/syntax/syntax.test.ts`
    - `packages/core/src/syntax/palette.test.ts`
    - `packages/core/src/syntax/boa-safe.test.ts`
    - `packages/core/src/code-snippet/layout.ts`
    - `packages/core/src/code-snippet/layout.test.ts`
    - `packages/core/src/code-snippet/index.ts`
  - Logs and artifacts: `impl-plans/progress/dps-01-syntax.md`,
    `tmp/dps-s861/dps-01-syntax`, `target`.
- sharedPaths: `packages/core/src/index.ts`. Append exactly two lines:
  `export * from "./syntax/index.ts";` and
  `export * from "./code-snippet/index.ts";`. Make no other edit.
- artifactRoots: `target`.

## Intent and context

This plan ports chilla's pure-TS tokenizer and adds the deterministic
code-snippet layout. Later plans consume both:

- the `text.code` shape and its SVG renderer (dps-08);
- the Markdown fenced code (dps-09);
- the canvas view and inspector (dps-10);
- CLI language normalisation (dps-15).

The tokenizer must run in the canvas, in Bun and in the Boa native CLI.

## Non-goals

- No ShapeUtil, SVG renderer, IR change or registration. Those belong to
  dps-08 and dps-17.
- No new npm dependency, WASM or Rust.

## Source to port

Read these files directly:

- `/Users/taco/gits/tacogips/chilla/src/features/pr-diff/prDiffSyntax.ts`
- `/Users/taco/gits/tacogips/chilla/src/features/pr-diff/prDiffSyntaxTypes.ts`
- `/Users/taco/gits/tacogips/chilla/src/features/pr-diff/prDiffSyntaxLanguages.ts`
- `/Users/taco/gits/tacogips/chilla/src/features/pr-diff/prDiffSyntaxKeywords.ts`

If they cannot be read, stop. Record the blocker in the progress log. Do
not invent kinds or aliases.

Every file starts with the header
`// Ported from tacogips/chilla (MIT, same owner), src/features/pr-diff/<file>.`
Copy behaviour, not chilla's UI coupling.

## Contract (other plans import these exact names)

```ts
export const SYNTAX_KINDS: readonly SyntaxKind[]; // exactly chilla's 28 values, "plain" first
export type SyntaxKind = ...;                     // union of those string literals
export const SEGMENT_KINDS = ["plain","keyword","string","comment","number","punctuation","markup"] as const;
export type SegmentKind = (typeof SEGMENT_KINDS)[number];
export interface SyntaxSegment { readonly text: string; readonly kind: SegmentKind }
export const SYNTAX_KIND_LABELS: Readonly<Record<SyntaxKind, string>>;
export function resolveSyntaxKind(token: string): SyntaxKind | null;
export function tokenizeCode(code: string, kind: SyntaxKind): SyntaxSegment[][];
export interface CodePalette { background; border; gutter; lineNumber; plain; keyword; string; comment; number; punctuation; markup; inlineCodeBackground; link; quoteBar; tableHeader; rule: string }
export const CODE_PALETTES: { readonly light: CodePalette; readonly dark: CodePalette };
export function codePaletteFor(fill: string | undefined): { readonly mode: "light" | "dark"; readonly palette: CodePalette; readonly panelFill: string };
export const CODE_FONT_STACK: string; // "ui-monospace, SFMono-Regular, Menlo, monospace"
export interface CodeLayoutInput { code: string; language: string; showLineNumbers?: boolean; wrap?: boolean; width?: number; fontSize?: number; fill?: string }
export interface CodeRun { x: number; text: string; source: string; kind: SegmentKind; columns: number }
export interface CodeLine { y: number; number?: number; runs: readonly CodeRun[] }
export interface CodeLayout { width; height; padding; gutterWidth; fontSize; lineHeight; advance: number; mode: "light" | "dark"; palette: CodePalette; panelFill: string; lines: readonly CodeLine[] }
export function codeSnippetLayout(input: CodeLayoutInput): CodeLayout;
```

`CODE_FONT_STACK` must equal the monospace stack svg-export already uses.
Find it with `rg -n "SFMono" packages/core/src/svg-export`. If a constant
with that value already exists, re-export it instead of duplicating it.
Run `rg -n "export (const|function|type|interface) (CODE_FONT_STACK|SyntaxKind|SYNTAX_KINDS|CodeLayout|codeSnippetLayout|tokenizeCode)" packages/core/src`
before adding names, so `export *` creates no collision.

## Rules

- `resolveSyntaxKind` is case-insensitive. It accepts a canonical id, a
  chilla alias, an extension with or without the leading dot, or a file
  name. Unknown input returns `null`.
- `tokenizeCode`:
  - Normalise `\r\n` and `\r` to `\n` for splitting only.
  - Return one array per line. Concatenating a line's segment texts must
    equal that line exactly.
  - Carry block-comment and multi-line string state across lines.
  - Merge adjacent same-kind segments.
  - An unknown kind tokenizes as plain.
- Palettes:
  - Light: background `#fffdf8`, plain `#1d2a2e`, comment and lineNumber
    `#596366`, keyword and link `#335c67`, border and rule `#d8d2c3`,
    tableHeader and inlineCodeBackground `#dbe6e8`.
  - Dark: background `#1f2427`, plain `#e6e9ea`, comment and lineNumber
    `#a3adb1`, keyword and link `#7fb3bf`, border and rule `#3a4245`,
    tableHeader and inlineCodeBackground `#24393e`.
  - `string`, `number`, `punctuation`, `markup`, `gutter` and `quoteBar` are
    palette-local hex constants. Choose them so the contrast test passes.
    Never change the anchored values.
- `codePaletteFor(fill)`:
  - `panelFill = fill ?? CODE_PALETTES.light.background`.
  - Parse `#rgb`, `#rrggbb` or `#rrggbbaa`. For alpha, ignore the alpha
    channel.
  - WCAG relative luminance below 0.18 gives dark. Anything else,
    including unparsable values, gives light.
- Layout (design 3.2):
  - `fontSize = input.fontSize ?? 13`, `lineHeight = Math.round(fontSize * 1.5)`,
    `advance = fontSize * 0.6`, `padding = 12`.
  - `width = Math.max(80, input.width ?? 480)`.
  - Columns: a grapheme is 1 column, or 2 when `isWideCodePoint` (from
    `../wide-text-width.ts`) is true. A tab advances to the next multiple of
    4. In `text`, the tab is replaced by spaces; `source` keeps `\t`.
  - Gutter with `showLineNumbers`: `(digits(lineCount) + 1) * advance + 8`.
    Without it, the gutter is 0.
  - Run x = `padding + gutterWidth + column * advance`.
  - With `wrap`, break visual lines at
    `Math.max(1, Math.floor(contentWidth / advance))` columns, splitting
    runs. A continuation line has no `number`.
  - Baseline `y = padding + i * lineHeight + Math.round(lineHeight * 0.72)`.
  - `height = 2 * padding + Math.max(1, lines.length) * lineHeight`.
  - Empty code gives one empty line.
  - The language resolves through `resolveSyntaxKind(input.language) ?? "plain"`.

## Pitfalls

- Boa safety. Do not use regex lookbehind, `\p{...}`, named groups, the `d`,
  `v` or `y` flags, or `replaceAll` with a regex. `boa-safe.test.ts` reads
  every `syntax/*.ts` and `code-snippet/layout.ts` source (not tests) and
  fails on `(?<=`, `(?<!`, `\p{`, `(?<name>` and those flags.
- `noUncheckedIndexedAccess`: no unchecked index reads.
- Linear time. No nested backtracking regex on whole input.
- Self-authored fixtures only. Do not copy chilla test fixtures verbatim.

## Tests

- `SYNTAX_KINDS.length === 28`, `SYNTAX_KINDS[0] === "plain"`, all values
  unique, and every kind has a label.
- Every alias in the ported table resolves to a member of `SYNTAX_KINDS`.
  `resolveSyntaxKind(".RS")`, `resolveSyntaxKind("Dockerfile")` and an
  unknown input give the chilla-mapped kind or `null`.
- Per kind, one self-authored snippet gives at least one keyword, string,
  comment or number segment where chilla classifies one. Assert the kinds
  at 2 or more offsets.
- Round trip: segments joined per line equal `code.split(/\r\n|\r|\n/)` for
  a mixed input.
- A block comment opened on line 1 and closed on line 3 makes line 2 a
  comment.
- Contrast is at least 4.5:1 for every foreground (plain, keyword, string,
  comment, number, punctuation, markup, lineNumber, link) on `background`
  and on `inlineCodeBackground`, for both palettes.
- `codePaletteFor(undefined).mode === "light"`,
  `codePaletteFor("#1f2427").mode === "dark"`,
  `codePaletteFor("#fffdf8").mode === "light"` and
  `codePaletteFor("none").mode === "light"`.
- Layout:
  - `"a\tb"` puts `b` at column 4; the `text` has spaces and the `source`
    has a tab.
  - A wide character takes 2 columns.
  - 12 lines with line numbers give `gutterWidth = 3 * advance + 8`.
  - `wrap` on a 200-column line at width 200 yields multiple lines, and
    only the first has `number`.
  - Height follows the formula.
  - Empty code gives height `2 * 12 + 20` at font size 13.
- A 10,000-line generated input tokenizes in under 2 s.

## Verification (each must exit 0; logs go to tmp/dps-s861/dps-01-syntax/)

1. `bun test packages/core/src/syntax packages/core/src/code-snippet`
   shows all passing and 0 failures.
2. `bun run typecheck`. If the only failures are in a sibling wave-1
   plan's files, record them and re-run after that plan lands.
3. `bunx biome check --diagnostic-level=warn packages/core/src/syntax packages/core/src/code-snippet`

## Done criteria

- Every contract name is exported from `@nodetto/core`.
- All three commands exit 0.
- The progress log records the chilla files read, the 28 kinds, each
  command with its exit code and log path, and the pre and post
  `git hash-object` of `packages/core/src/index.ts`.

## Coordination

- This plan shares a branch and working tree with the other wave-1 plans.
  Edit only your writePaths and the two lines in `packages/core/src/index.ts`.
- Re-read `packages/core/src/index.ts` immediately before appending. Record
  its pre and post hashes. If it changed in an unexpected way, record the
  drift and do not revert others' lines.
- No git state changes, no `any`, no emojis.

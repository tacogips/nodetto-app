# sef-04-glyph-attribution

- planId: sef-04-glyph-attribution
- planPath: impl-plans/active/sef-04-glyph-attribution.md
- progressPath: impl-plans/progress/sef-04-glyph-attribution.md
- wave: 1
- dependsOn: none
- Design: `design-docs/specs/design-style-export-fixes.md`, sections "Attribution" and "Page eligibility".
- Worker rules and pinned contracts: `impl-plans/active/sef-00-overview.md`.
- writePaths:
  - `apps/cli/src/glyph-coverage.ts` (new)
  - `apps/cli/src/glyph-coverage.test.ts` (new)
  - `impl-plans/progress/sef-04-glyph-attribution.md`
  - `tmp/sef-s733/sef-04-glyph-attribution`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

Export and lint must name the element whose text holds a code point that no export font has. This
plan adds the pure logic. It runs in the shared engine (Boa) and has no I/O. sef-07 calls it.

## Non-goals

- No font reading, no CLI wiring, no edits to `commands.ts` or `export-command.ts`.
- No use of `textFields` (`packages/core/src/text-replace.ts`): it only sees `TEXT_KEYS`, and rendered text
  such as column types would be missed. Walk every string in `semantic`.

## File-level changes

`apps/cli/src/glyph-coverage.ts`, exporting the pinned symbols:

- Shared walker over `element.semantic`: recurse through arrays and plain objects (`isPlainObject` from
  `@nodetto/ir`). Skip elements whose type starts with `design.`, and elements with `visual.hidden === true`.
- A string is tested with `/[^\x00-\x7f]/.test(value)` before any per-character work. Ids and colors are ASCII,
  so the per-character loop only runs on a few strings. No regex `split`, no `node:*` imports.
- `attributeMissingGlyphs(elements, missing)`:
  - `rows` in input element order, one per element holding a missing code point, with that element's code points
    sorted and unique.
  - `unattributed` is sorted members of `missing` that no row contains. Export reports these on a page line.
  - Elements with no matching code points give no row.
- `glyphRowsByPage(document, coverage)`:
  - Build one text from the non-ASCII strings of all eligible elements across all pages, joined with a newline, and
    call `coverage` once. Empty text -> return an empty map without calling `coverage`.
  - `coverage` returning `undefined`, or an empty `missing` -> empty map.
  - Otherwise group `attributeMissingGlyphs` rows by `element.page`. Pages with no rows have no map entry.
- `glyphMissingMessage(codePoints)`: `no export font has U+246A, U+301C; add a font with --font-dir`. Format each as
  `U+` plus uppercase hex, at least 4 digits. List at most 16, then `and N more`, as in
  `no export font has U+..., and 3 more; add a font with --font-dir`.

## What a careless implementation gets wrong

- Astral code points: iterate by code point (`for...of` or `codePointAt`), not by `charCodeAt`.
- `Set` iteration order is insertion order: sort numerically, since default `sort()` compares as strings.
- `glyphRowsByPage` must not call `coverage` for ASCII-only documents: real coverage opens fonts, and lint performance
  depends on this.
- `Document`, `Element` and `PageId` come from `@nodetto/ir`. Keep it free of `@nodetto/core` runtime imports.

## Tests (`apps/cli/src/glyph-coverage.test.ts`)

- Element with label U+F0000 and `missing` holding it -> one row with `[0xF0000]`, `unattributed` empty.
- Nested string in `semantic.columns[0].type` -> attributed.
- Two elements sharing a code point -> two rows, input order.
- Code point in no element -> in `unattributed`.
- `design.text-style` whose name holds the code point -> no row.
- `visual.hidden: true` element -> no row.
- Label with U+246B and U+246A -> `codePoints` sorted, and U+F0000 sorts numerically after them.
- `glyphRowsByPage` on ASCII-only document -> coverage function not called, empty map.
- `coverage` returns `undefined` -> empty map.
- Two pages, missing only on one -> map holds only that page.
- `coverage` called once for a many-page document.
- `glyphMissingMessage` with 2 and with 19 code points -> exact strings, the second ending in `and 3 more; add a font with --font-dir`.
- 5-digit code point -> `U+F0000`.

## Verification (each must exit 0)

1. `bun test apps/cli/src/glyph-coverage.test.ts` -> new cases pass.
2. `bun run typecheck`.
3. `bunx biome check apps/cli/src/glyph-coverage.ts apps/cli/src/glyph-coverage.test.ts`.
4. `sh -c '! grep -nE "node:|\.split\(/" apps/cli/src/glyph-coverage.ts'` -> no match.

## Done criteria

- Verification 1-4 exit 0 with logs recorded.
- `grep -n "export function" apps/cli/src/glyph-coverage.ts` lists all three pinned functions.
- Progress log complete.

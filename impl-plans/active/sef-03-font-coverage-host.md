# sef-03-font-coverage-host

- planId: sef-03-font-coverage-host
- planPath: impl-plans/active/sef-03-font-coverage-host.md
- progressPath: impl-plans/progress/sef-03-font-coverage-host.md
- wave: 1
- dependsOn: none
- Design: `design-docs/specs/design-style-export-fixes.md`, sections "Font sets" and "Coverage contract".
- Worker rules and pinned contracts: `impl-plans/active/sef-00-overview.md`.
- writePaths:
  - `apps/cli/src/render-profile.ts`
  - `apps/cli/src/raster-backend.ts`
  - `apps/cli/src/font-coverage.ts` (new)
  - `apps/cli/src/font-coverage.test.ts` (new)
  - `apps/cli/src/__fixtures__/test-font.ts` (new)
  - `apps/cli/src/local-io.ts`
  - `apps/cli/src/native-engine.ts`
  - `apps/cli/src/commands.ts`
  - `apps/cli/src/export-command.ts`
  - `apps/cli/scripts/build-engine.ts`
  - `apps/cli/native/src/render.rs`
  - `apps/cli/native/src/engine.rs`
  - `apps/cli/native/Cargo.toml`
  - `Cargo.lock`
  - `impl-plans/progress/sef-03-font-coverage-host.md`
  - `tmp/sef-s733/sef-03-font-coverage-host`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

PNG and PDF export render circled numbers from U+246A, U+301C and U+FF5E as tofu on macOS, with no
warning. Both raster backends load the short `FONT_FILES` list. A full system scan can take tens of
seconds, so it must not be added. This plan adds the fallback font list, a synchronous coverage
query in both hosts, and the fallback switch on rasterize. sef-07 calls them from export and lint.

## Gate: run first

The design depends on the usvg and resvg-js per-character fallback walking faces in load order. This
was not confirmed at design time. As the first implementation step, write the macOS tests marked
GATE below and run them.

- If a listed macOS font path does not exist, adjust `FALLBACK_FONT_FILES` from what `ls` shows in
  `/System/Library/Fonts` and `/System/Library/Fonts/Supplemental`, and record it.
- If a required character cannot be covered by a bounded font list, or if fallback does not render
  through the fallback faces, or if a base-covered character changes with fallback on: stop and record
  a blocker. Do not build a text-run splitter or a system scan.

## Non-goals

- No export or lint flow (sef-07): nothing calls `fontCoverage` yet, and `export-command.ts` only gets
  the optional parameter on the interface.
- `FONT_FILES` does not change. Do not change the system-scan branch.
- No desktop app changes.

## File-level changes

`apps/cli/src/render-profile.ts`: add `FALLBACK_FONT_FILES: readonly string[]` with the candidates listed
in the design. Do not change `FONT_FILES`.

`apps/cli/scripts/build-engine.ts`: add `fallbackFonts: FALLBACK_FONT_FILES` to `render-profile.json`.

`apps/cli/src/commands.ts`: add only the pinned `fontCoverage?` member to `CommandIo`, with an inline
result type and a short comment.

`apps/cli/src/export-command.ts`: add only `fallback?: boolean` to `RasterBackend.rasterize`.

`apps/cli/src/raster-backend.ts`: `rasterize(svg, scale, fontDir, fallback = false)`. With `fallback`, append
existing `FALLBACK_FONT_FILES` after `files` in `fontFiles`.

`apps/cli/src/font-coverage.ts` (new; imports `node:fs`):

- `export function fontCoverage(text: string, fontDir: string | undefined)` returning the pinned shape.
- Check only non-ASCII code points. Skip default-ignorables: U+200B-200F, U+2028-202E, U+2060-206F,
  U+FE00-FE0F, U+FEFF, U+E0100-E01EF. Skip lone surrogates.
- ASCII-only -> `{needsFallback: false, missing: []}` without opening a font.
- No existing `FONT_FILES` entry and no `fontDir` -> `undefined`.
- Base set is existing `FONT_FILES` plus files under `fontDir`, walked recursively for ttf, otf, ttc and
  otc. `needsFallback` is true if a checked code point is not in the base set.
- Fallback files are read only when `needsFallback` is true. `missing` is sorted and unique.
- Read with `openSync` and `readSync`: sfnt or `ttcf` directory, `cmap` table, Unicode subtables (platform
  0, and platform 3 encodings 1 and 10) in formats 4 and 12. Never read a whole font file into memory.
- Unreadable or unparsable fallback or `fontDir` face -> skip it.

`apps/cli/src/local-io.ts`: wire `fontCoverage`. Do not import `font-coverage.ts` from `commands.ts` or
`export-command.ts`: the native bundle must not include `node:fs`.

`apps/cli/native/src/render.rs`:

- Add `fallback_fonts: Vec<String>` to `RenderProfile`, with serde's `rename_all` applied so the JSON key
  `fallbackFonts` deserializes (the current struct has no `rename_all`).
- Extract a font-loading helper. `png(svg, scale, font_dir, fallback: bool)` loads fallback faces after base
  and `--font-dir`, ignoring load errors for fallback files only. Keep today's error for base files.
- `pub fn font_coverage(text: &str, font_dir: Option<String>) -> Result<String, String>` returning the JSON in
  the overview. Same rules as Bun. Look up glyphs with `fontdb::Database::with_face_data` and
  `skrifa::FontRef::from_index(data, index)` plus the charmap (`skrifa::MetadataProvider`).
- Update the existing `png(svg, 1.0, None)` test call.

`apps/cli/native/Cargo.toml`: add `skrifa = "0.44"`. Run a build so `Cargo.lock` updates. Only the `nodetto-cli`
dependency list may change in the lock file, with no new package.

`apps/cli/native/src/engine.rs`: add a `"fontCoverage"` host operation, imitating `"png"` and `optional_string`. Read
`png`'s fourth argument with `to_boolean`.

`apps/cli/src/native-engine.ts`: add to the `native` declaration, wire `io.fontCoverage` (parse the JSON; resolve
`fontDir` through `native.path`), and pass the fourth argument in `rasterize`.

`apps/cli/src/__fixtures__/test-font.ts` (new):
`export function buildTestFont(codePoints: readonly number[]): Uint8Array` and
`export function buildTestCollection(fonts: readonly Uint8Array[]): Uint8Array`. A minimal valid TrueType font
(`head`, `hhea`, `maxp`, `hmtx`, `loca`, `glyf`, `cmap` formats 4 and 12, `name`, `OS/2`, `post`) with one simple
glyph, neutral name `NodettoFixture`. It must also load in resvg and fontdb; sef-07 exercises that.

## What a careless implementation gets wrong

- The sans and mono family choice must read base `files` only, in both `fontOptions` and `render.rs`. If fallback paths
  feed it, the default family can change.
- Bun loads `fontFiles` before `fontDirs` while Rust loads files, the directory, then fallback. Face order for a character
  in both a fallback font and `--font-dir` can differ between hosts. Do not try to fix this; PNG bytes are not required to
  match across hosts. The coverage results must match.
- `needsFallback` false must leave the loaded font set exactly as today, so existing raster output stays identical.
- Never scan system fonts for coverage.
- Keep the Rust scan cheap: iterate the `str` once, collect a sorted unique set, then query.

## Tests

`apps/cli/src/font-coverage.test.ts`:

- Font dir holding `buildTestFont([0xF0000])`, text with U+F0000 -> not in `missing`, `needsFallback` false.
- Same dir in a TTC wrapper -> same.
- A font using cmap format 4 and one using format 12 -> both found.
- Empty dir, text with U+F0000 -> `missing` is `[0xF0000]`, `needsFallback` true.
- ASCII-only with a nonexistent dir -> no font read, `missing` empty.
- Text of only U+200B and U+FE0F -> `missing` empty, `needsFallback` false.
- A corrupt file in the dir beside a valid one -> no throw, valid one still counts.
- Bun `rasterize` with `fallback` omitted equals `fallback: false` byte for byte on an ASCII SVG.
- GATE, macOS only (`test.skipIf(process.platform !== "darwin")`): circled numbers 1 to 20, U+301C and U+FF5E -> `missing` empty.
- GATE, macOS only: `rasterize` with `fallback: true` on SVGs with U+246A and U+246B -> different bytes.
- GATE, macOS only: an SVG with "A" and U+4E2D gives identical bytes with `fallback` true and false.

`apps/cli/native/src/render.rs` tests:

- `font_coverage` with an empty temp `font_dir` and U+F0000 -> JSON with `missing` `[983040]`.
- ASCII-only -> `needsFallback` false, `missing` empty.
- U+200B only -> same.
- GATE, `#[cfg(target_os = "macos")]`: `png` with `fallback` true on SVGs with U+246A and U+246B -> different bytes.

## Verification (each must exit 0)

1. `bun test apps/cli/src/font-coverage.test.ts` -> pass; on macOS the GATE tests run, not skip.
2. `CARGO_TERM_QUIET=true cargo test -p nodetto-cli render::` -> pass.
3. `CARGO_TERM_QUIET=true cargo fmt --manifest-path apps/cli/native/Cargo.toml --check`.
4. `CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli`.
5. `bun run typecheck`.
6. `bunx biome check apps/cli/src/render-profile.ts apps/cli/src/raster-backend.ts apps/cli/src/font-coverage.ts apps/cli/src/font-coverage.test.ts apps/cli/src/__fixtures__/test-font.ts apps/cli/src/local-io.ts apps/cli/src/native-engine.ts apps/cli/scripts/build-engine.ts`.
7. `bun test apps/cli/src/export-command.test.ts apps/cli/src/export-determinism.test.ts` -> 0 fail with unchanged tests.

## Done criteria

- Verification 1-7 exit 0 with logs recorded.
- `git diff Cargo.lock` shows no added `[[package]]`.
- `grep -c "node:" apps/cli/src/native-engine.ts` prints 0.
- `FONT_FILES` unchanged: `git diff apps/cli/src/render-profile.ts` only adds lines.
- Progress log records final font paths and gate results.

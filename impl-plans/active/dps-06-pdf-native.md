# dps-06-pdf-native

- planId: dps-06-pdf-native. Wave 1. dependsOn: none (JSON contract pinned
  in dps-05).
- Design: sections 7.3 and 7.3.1 of
  `design-docs/specs/design-document-pages-snippets.md`.
- writePaths: `apps/cli/native/src/render.rs`,
  `apps/cli/native/src/engine.rs`,
  `apps/cli/native/src/engine_tests.rs`,
  `impl-plans/progress/dps-06-pdf-native.md`,
  `tmp/dps-s861/dps-06-pdf-native`, `target`.
- sharedPaths: none.
- artifactRoots: `target`.

## Intent and context

The native CLI writes single-page PDFs with pdf-writer
(`render.rs::pdf`, :173-226, one hard-coded page). This plan adds a
multi-page writer that carries the Unicode text layer and exposes it to
the embedded JS as the host function `pdfPages`. The JS binding in
`apps/cli/src/native-engine.ts` belongs to dps-14.

## Non-goals

- No change to `render::png` or `font_coverage`.
- No new crate dependency. No TypeScript edits.

## Contract

- Rust: `pub fn pdf_pages(pngs: Vec<u8>, spec_json: String) -> Result<Vec<u8>, String>`.
  - `pngs` is the concatenation of every page PNG, in page order.
  - `spec_json` is exactly the dps-05 native JSON:

    ```text
    {"pages":[{"pngLength":n,"layout":{pageWidth,pageHeight,x,y,width,height},"fontNames":[..],"content":".."}],"fonts":[{name,firstChar,lastChar,widths,glyphProcs:[{glyph,content}],differences:[..],toUnicode}]}
    ```

  - Use the serde setup already in the crate. Run
    `rg -n serde apps/cli/native/Cargo.toml`. If serde is absent, parse
    with the JSON facility `render::pdf` already uses for its layout
    argument (check its implementation first). Do not add a crate.
- Host function: in `engine.rs`, next to `"pdf"` (:139-142), add
  `"pdfPages" => (Uint8Array, string) -> Uint8Array`. Add `'pdfPages'` to
  the allow-list string at :230.

## Rules

- Factor the existing single-page image code (RGB XObject plus alpha
  SMask, content `q w 0 0 h x y cm /Im Do Q`) into a helper, and use it
  for each page.
- `pdf()` keeps its exact current behaviour and output. It may call the
  helper.
- Page tree: one `Pages` node with N kids and count N.
- Each page:
  - MediaBox `[0 0 pageWidth pageHeight]`.
  - Resources: `/XObject` with the image, plus `/Font` mapping each
    `fontNames` entry to its Type3 font ref.
  - Contents: one stream holding the image operators followed by `content`
    bytes.
- Type3 fonts are written once per document with the generic writer
  (`Chunk::indirect(ref).dict()` and `Pdf::stream`):
  - `Type /Font`, `Subtype /Type3`, `FontMatrix`, `FontBBox`, `FirstChar`,
    `LastChar` and `Widths`;
  - `Encoding << /Type /Encoding /Differences [1 /g1 ...] >>`;
  - `CharProcs`, holding one stream per glyph with `content` bytes;
  - `ToUnicode`, a stream with the CMap bytes.

  Before coding, confirm these calls in the pdf-writer 0.15 sources in the
  cargo registry with `cargo doc -p pdf-writer --no-deps` or by reading the
  sources. Record the confirmed API in the progress log.
- Errors return `Err(String)`:
  - the sum of `pngLength` differs from `pngs.len()`;
  - an unknown font name;
  - a malformed spec;
  - zero pages.

  Apply the existing raster limits per page before allocation, in the same
  way as `pdf`.

## Pitfalls

- Do not compress the ToUnicode or CharProcs streams. The content stream
  may stay uncompressed, as `pdf` does today.
- Keep object refs unique and deterministic.

## Tests (Rust `#[cfg(test)]` in render.rs; engine host test in engine_tests.rs)

- Two 1x1 PNGs (generated in the test, for example with the `png` encoder
  the crate already uses for `render::png`) and a spec with one font `NTm1`
  whose ToUnicode maps `<01>` to `<65E5>`. The output:
  - starts with `%PDF-`;
  - contains `/Count 2`, `/Type3` and `/ToUnicode`;
  - contains the CMap text `<01> <65E5>`;
  - contains the content `Tj` text;
  - has two `/MediaBox` entries.
- A mismatched `pngLength` gives `Err`.
- `pdf()` output for the existing test input is unchanged. Capture the
  bytes before refactoring and compare.
- engine host: calling `pdfPages` from JS through the engine test adapter
  returns a Uint8Array starting with `%PDF-`.

## Verification (each must exit 0; logs go to tmp/dps-s861/dps-06-pdf-native/)

1. `CARGO_TERM_QUIET=true cargo test -p nodetto-cli pdf`. Confirm the
   package name with `rg -n '^name' apps/cli/native/Cargo.toml` and use it.
   At least the new tests must run.
2. `CARGO_TERM_QUIET=true cargo fmt -p nodetto-cli -- --check` (after
   `cargo fmt -p nodetto-cli`).
3. `CARGO_TERM_QUIET=true cargo clippy -p nodetto-cli -- -D warnings`

## Done criteria

- `pdf_pages` and the `pdfPages` host function exist.
- All three commands exit 0.
- The progress log records the confirmed pdf-writer API, the commands,
  the exit codes and the log paths.

## Coordination

No other plan writes these files. Re-read each file before editing and
record its hashes. No git state changes.

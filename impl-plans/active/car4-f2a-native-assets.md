# car4-f2a-native-assets

- planId: car4-f2a-native-assets; wave 1; dependsOn: none
- planPath: impl-plans/active/car4-f2a-native-assets.md
- progressPath: impl-plans/progress/car4-f2a-native-assets.md
- Finding: performance-capture-repeated-attachment-svg-expansion (R4-2, high), native
  renderer part.
- Design: `design-docs/specs/design-ai-capture.md` 22.1 R4-2 (contract, Native
  renderer, tests), 22.3, 22.5.
- writePaths: `apps/cli/native/src/render.rs`, `apps/cli/native/src/engine_tests.rs`,
  `tmp/car4-r4/car4-f2a-native-assets`, `impl-plans/progress/car4-f2a-native-assets.md`,
  `target`, `tmp/cad3d`
- sharedPaths: none; artifactRoots: `target`, `tmp/cad3d`

Follow the worker rules and pinned contracts in `impl-plans/active/car4-00-overview.md`.

## Intent and context

Capture will embed each attachment once in an unreferenced `<defs>` carrier and point
each placement at `https://nodetto.invalid/capture-asset/<n>` (carrier format in the
overview). `render::png` (`render.rs:40-102`) must resolve those URLs to the carrier's
decoded bytes through usvg, giving each placement the same `ImageKind` an inline data
URL gives, so PNG bytes are unchanged.

Non-goals: no change to `engine.rs`, `native-engine.ts`, the `png` host signature,
`font_coverage`, export behavior, or any SVG without carriers.

## Changes (`render.rs`)

- `fn capture_assets(svg: &str) -> Result<Vec<(String, Arc<Vec<u8>>)>, String>`: scan
  for each `<image id="nodetto-capture-asset-` in order; parse the decimal index (must be
  0, 1, 2, ... in order), then exactly `" href="data:image/`, the subtype (`png`,
  `jpeg`, `gif`, `webp`), `;base64,`, the payload up to the next `"`, then `/>`.
  Decode with `base64::engine::general_purpose::STANDARD` (already a dependency). Any
  violation -> `Err("Invalid raster attachment.".into())`. MIME string is
  `format!("image/{subtype}")`.
- In `png`, before `usvg::Tree::from_str`: `let assets = capture_assets(&svg)?;` and
  only if non-empty set `options.image_href_resolver` with
  `resolve_data: usvg::ImageHrefResolver::default_data_resolver()` and a
  `resolve_string` closure that owns `assets` (move), maps
  `https://nodetto.invalid/capture-asset/<n>` to
  `(usvg::ImageHrefResolver::default_data_resolver())(&mime, arc.clone(), opts)` and
  every other href to `usvg::ImageHrefResolver::default_string_resolver()`.
  Check the exact usvg 0.48 names in the vendored crate source before writing.

## Pitfalls

- An SVG without carriers must take today's path with default options (no resolver
  installed) so raster export bytes cannot change.
- Decode each payload once; share the `Arc` across placements (do not decode in the
  closure).
- Do not rewrite or expand the SVG string; do not pass payloads through Boa.
- Scanning is linear (`str::find`), in Rust only.

## Tests

- `engine_tests.rs` (or `render.rs` `#[cfg(test)]`, imitating
  `capture_command_renders_a_png_and_reports_its_path` for the host, and calling
  `render::png` directly for parity): for PNG (generated with the `png` crate), JPEG
  (`nodetto_capture::encode::jpeg_rgb8`), GIF (hand-built 2 x 2 bytes) and WebP (base64
  literal produced once by
  `cwebp -quiet -lossless apps/desktop/src-tauri/icons/32x32.png -o -`, recorded in the
  progress log), each with meet, slice, fill and a crop (`<svg overflow="hidden">`
  wrapper) of different sizes, at scales 1 and 2.37: PNG of the carrier SVG equals PNG of
  the independently embedded SVG (each placement its own data URL, no carrier).
- JPG parity: `nodetto_capture::transcode_png(png, ImageFormat::Jpeg { quality: 90 },
  [255, 255, 255])` of both PNGs are equal.
- `capture_assets` of a 32-placement carrier SVG returns 1 entry; out-of-order index,
  bad MIME, bad base64 and missing `/>` each fail with `Invalid raster attachment.`.
- An SVG with no carrier renders the same bytes as before (compare with an inline
  control rendered through the same function).

## Verification (each exits 0 and runs tests)

1. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car4-f2a-native-assets cargo clippy -p nodetto-cli --all-targets -- -D warnings && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car4-f2a-native-assets cargo test --release -p nodetto-cli`
   -> parity tests pass (first gate; a parity failure is reported `blocked`, never
   worked around by reinlining).

## Done criteria

- Byte parity for four MIME types, four placement kinds and two scales; JPG parity;
  one decode per carrier; progress log `done`.

Implementation status: complete; focused clippy and release test gate passed (38 tests).
Formal review and integration remain downstream.

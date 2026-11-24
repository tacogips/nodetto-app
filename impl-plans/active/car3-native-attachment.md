# car3-native-attachment

- planId: car3-native-attachment
- planPath: impl-plans/active/car3-native-attachment.md
- progressPath: impl-plans/progress/car3-native-attachment.md
- wave: 1; dependsOn: none
- Finding: performance-native-artwork-attachment-byte-roundtrip (R3-7, medium).
- Design: `design-docs/specs/design-ai-capture.md` 21.1 R3-7, 21.3.
- writePaths: `apps/cli/native/src/files.rs`, `apps/cli/native/src/engine.rs`,
  `apps/cli/native/src/engine_tests.rs`, `apps/cli/src/commands.ts`,
  `apps/cli/src/native-engine.ts`, `apps/cli/src/capture-artwork.ts`,
  `apps/cli/src/capture-command.test.ts`,
  `apps/cli/src/native-parity/capture-attachments.test.ts` (new),
  `tmp/car3-r3/car3-native-attachment`,
  `impl-plans/progress/car3-native-attachment.md`, `target`, `tmp/cad3d`
- sharedPaths: none; artifactRoots: `target`, `tmp/cad3d`

Follow the worker rules in `impl-plans/active/car3-00-overview.md`.

## Intent and context

Native 2D capture resolves a raster attachment with `io.readAttachment` then
`encodeRasterDataUrl` (`capture-artwork.ts:112-120`). The bytes enter Boa as a
`Uint8Array` (`native-engine.ts:178-179`), become 8,192-byte `String.fromCharCode`
chunks (`packages/ir/src/image.ts:95-97`), and the native `btoa`
(`engine.rs:351`) rebuilds them one character callback at a time. Move reading,
validation and base64 to Rust; the bytes never enter the interpreter.

Non-goals: no change to `export-command.ts`, `bundle-command.ts`,
`packages/ir/src/image.ts`, `crates/native/src/attachments.rs`, the Bun host path, the
R2-10 raster planning code in `capture-artwork.ts` (`captureRasterPlan`,
`pixelFrame`), or messages and exit codes.

## Changes

- `apps/cli/native/src/files.rs`: `pub fn raster_data_url(document: &str, relative:
  &str) -> io::Result<String>` next to the `attachment` re-export (`files.rs:8`). Order:
  1. `nodetto_native::attachments::read` (unchanged; confinement, regular file, 32 MiB);
  2. `len > 30 * 1024 * 1024` -> error `Raster attachment exceeds the 30 MiB attachment limit.`;
  3. sniff in `encodeRasterDataUrl` order: PNG `89 50 4E 47 0D 0A 1A 0A` -> `png`,
     `FF D8 FF` -> `jpeg`, `GIF87a`/`GIF89a` -> `gif`, `RIFF` + bytes 8..12 `WEBP` ->
     `webp`; else error `Attachment is not a supported raster image.`;
  4. `format!("data:image/{mime};base64,{}", STANDARD.encode(&bytes))`.
- `engine.rs`: host arm `"attachmentDataUrl"` (pattern: the `"attachment"` arm at
  `engine.rs:219-226`) returning `js_string!(...)` and mapping errors with
  `host_error` (message preserved); add `'attachmentDataUrl'` to the `native` name
  list in the bootstrap script.
- `commands.ts` `CommandIo`: optional
  `readAttachmentDataUrl?(documentPath: string, relative: string): string;`
  next to `readAttachment` (`commands.ts:107`).
- `native-engine.ts`: `readAttachmentDataUrl: (document, path) =>
  native.attachmentDataUrl(native.path(document), path)` next to `readAttachment`.
- `capture-artwork.ts` `resolveAsset`: cache lookup first (unchanged); then
  `isRasterAttachmentPath` check (unchanged); if `io.readAttachmentDataUrl` exists use
  it, check `isRasterDataUrl(result, MAX_ATTACHMENT_IMAGE_BYTES)` else throw
  `Invalid raster attachment.`; else the existing
  `encodeRasterDataUrl(io.readAttachment(...))`. Cache with `editor.assets.set` in both
  branches.

## Pitfalls

- Keep check order and literal messages identical to `encodeRasterDataUrl`.
- Use the `STANDARD` engine already imported in `engine.rs`; padding must match `btoa`.
- Do not call `native.attachment` or `btoa` on the new path.
- Do not add a production switch or environment variable for the legacy oracle.

## Tests

- `engine_tests.rs` (pattern: `binary_views_write_only_the_selected_bytes_and_attachments_stay_confined`
  and the interception in `solid_capture_runs_through_boa_and_matches_bun_scene_bytes`):
  - PNG/JPEG/GIF/WEBP headers -> `native.attachmentDataUrl` equals
    `'data:image/<mime>;base64,' + btoa(binary)`.
  - `artifacts/fake.png` (text), 30 MiB + 1 byte `artifacts/big.png`, symlink
    `artifacts/escape.png` pointing outside -> the two messages above and
    `Attachment must be a file inside the document directory.`
  - Shared fixture `MULTI_MIB_PNG`: decodable 1100 x 1000 RGB xorshift32 noise
    (seed 1) in stored deflate blocks (about 3.15 MiB); assert its SHA-256 literal.
    2D page, two `image.raster` elements sharing `artifacts/noise.png`, options
    `--output out.png --padding 0`.
  - Release only (`#[cfg_attr(debug_assertions, ignore = "release only")]`): run A
    (new path) intercepts `attachmentDataUrl`, `attachment`, `base64`, `btoa` and the
    SVG given to the rasterize host -> 1, 0, 0, 0 calls. Run B, fresh context:
    replace `native.attachmentDataUrl` with a verbatim JS copy of pre-fix
    `encodeRasterDataUrl` applied to `new Uint8Array(native.attachment(doc, path))`.
    Assert equal data URL, equal SVG, equal PNG; PNG SHA-256 equals literal
    `MULTI_MIB_CAPTURE_SHA256` (recorded from run B).
- `capture-command.test.ts`: fake io with `readAttachmentDataUrl` and a throwing
  `readAttachment` -> capture succeeds, `readAttachmentDataUrl` called once for two
  elements sharing a source (first-use caching); without it -> legacy path used.
- New `native-parity/capture-attachments.test.ts` (pattern:
  `native-parity/capture.test.ts`, `nativeTest`): generate `MULTI_MIB_PNG` with the
  same algorithm and SHA-256 literal; capture the same page and options -> exit 0, PNG
  SHA-256 equals `MULTI_MIB_CAPTURE_SHA256`, second run repeats bytes; refusals for
  fake, big and escape -> stderr message and exit code equal literals measured with
  the `a964ad5` binary before the edit.

## Verification (each exits 0 and runs tests)

1. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car3-native-attachment cargo clippy -p nodetto-cli --all-targets -- -D warnings && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car3-native-attachment cargo test --release -p nodetto-cli`
   -> engine tests pass, including the release-only oracle.
2. `bunx biome check --diagnostic-level=warn apps/cli/src/commands.ts apps/cli/src/native-engine.ts apps/cli/src/capture-artwork.ts apps/cli/src/capture-command.test.ts apps/cli/src/native-parity/capture-attachments.test.ts && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car3-native-attachment cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/car3-native-attachment/release/nodetto-cli" bun test apps/cli/src/native-parity/capture-attachments.test.ts apps/cli/src/capture-command.test.ts`
   -> biome clean; parity, refusal and routing tests pass.

## Done criteria

- Run A interception shows 0 `attachment`/`btoa` calls (pre-fix: 1 each, recorded);
  A and B bytes equal; hash literals recorded; all commands exit 0; progress log
  `done`.

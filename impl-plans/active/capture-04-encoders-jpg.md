# M4 capture-04-encoders-jpg

- dependsOn: M3 (`captureCommand`, `CaptureBackend`)
- Design: sections 3.5, 7, 8.1, 8.2, 9
- writePaths: `Cargo.toml` (workspace member `crates/capture` and the
  profile override below),
  `Cargo.lock`, `crates/capture/Cargo.toml` (new),
  `crates/capture/src/lib.rs` (new), `crates/capture/src/encode/mod.rs`,
  `encode/png.rs`, `encode/jpeg.rs` (new), `crates/capture/src/flatten.rs`
  (new), `crates/capture/tests/encode.rs` (new),
  `crates/capture/licenses/` (licence texts of `jpeg-encoder` 0.7.1:
  `LICENSE-MIT`, `LICENSE-APACHE`, `LICENSE-IJG`, copied unchanged from the
  published crate), `apps/cli/native/Cargo.toml`,
  `apps/cli/native/src/engine.rs` (operation `captureEncode`),
  `apps/cli/native/src/engine_tests.rs` (one new test),
  `apps/cli/src/native-engine.ts`, `apps/cli/src/capture-command.ts` and
  its test, `apps/cli/src/capture-help/jpg.ts` (the part M3 left empty),
  `apps/cli/src/native-parity/capture.test.ts`, `THIRD_PARTY_NOTICES.md`
  (one new section at the end)
- Pre-authorised: none. `packages/cad-kernel/src/dependency.test.ts` passes
  unmodified.

## Contract

```rust
// crates/capture/src/lib.rs
#![forbid(unsafe_code)]
pub mod encode;
pub enum ImageFormat { Png, Jpeg { quality: u8 } }
#[derive(Debug)] pub struct CaptureError(pub String); // Display + std::error::Error
/// Decode an 8-bit RGBA or RGB PNG, flatten on `background`, encode.
pub fn transcode_png(png: &[u8], format: ImageFormat, background: [u8; 3]) -> Result<Vec<u8>, CaptureError>;

// crates/capture/src/encode/mod.rs: depends on nothing else in the crate
pub fn png_rgb8(rgb: &[u8], width: u32, height: u32) -> Result<Vec<u8>, String>;
pub fn jpeg_rgb8(rgb: &[u8], width: u32, height: u32, quality: u8) -> Result<Vec<u8>, String>;
```

```ts
// apps/cli/src/capture-command.ts: CaptureBackend gains
transcode?(png: Uint8Array, format: "jpg", quality: number, background: string): Uint8Array;
```

Native host operation `captureEncode(png, format, quality, backgroundHex)`
returns the encoded bytes. New options: `--format png|jpg`, `--quality
<1-100>` (default 90).

## Behavior

- Root `Cargo.toml`: add the member and
  `[profile.dev.package.nodetto-capture] opt-level = 2`, so that the
  crate's tests are fast in `cargo test --workspace` (debug); timing
  tests are release-only (overview rules).
- `Cargo.toml` of the crate: `png = "0.18"`, `jpeg-encoder = "=0.7.1"` with
  default features only; development dependency `jpeg-decoder = "0.3"`.
  `license = "MIT"`, `publish = false`. Before writing the notice, read
  the `license` field of the resolved `jpeg-encoder` and `png` packages
  (`cargo metadata`); if either differs from design section 9, stop and
  report.
- `png_rgb8`: `png::Encoder` with `ColorType::Rgb`, `BitDepth::Eight`,
  `set_compression(Compression::Balanced)`, `set_filter(Filter::Adaptive)`,
  no ancillary chunks. Rejects a buffer whose length is not `3*w*h` and
  zero or over-limit sides (8192).
- `jpeg_rgb8`: `jpeg_encoder::Encoder::new(&mut out, quality)`, baseline
  (not progressive), `set_sampling_factor(SamplingFactor::R_4_4_4)`,
  default Huffman tables, `ColorType::Rgb`; sides at most 8192 (the format
  allows 65,535). Quality outside 1 to 100 is an error.
- `flatten`: decode with the `png` crate (bounded by the 8192 x 8192 and
  32 megapixel limits before allocation); RGBA is composited on the
  background with `(c*a + bg*(255-a) + 127) / 255` in integers; RGB passes
  through; other colour types are an error.
- `transcode_png(.., Png, ..)` returns the input unchanged (2D PNG keeps
  the renderer's bytes); `Jpeg` flattens and encodes.
- CLI: `--format` is derived from the `--output` extension when absent
  (`.jpg` and `.jpeg` mean jpg), else `png`; a contradiction is a usage
  error; `--quality` without jpg is a usage error. For jpg the command
  rasterizes as before and calls `backend.transcode` with the background
  colour; a backend without `transcode` (the Bun host) fails with `JPG
  capture needs the native nodetto-cli.` The `format:` line and the file
  extension follow the format. Remove the interim M3 message.
- `native-engine.ts` wires `transcode` to `native.captureEncode`.
- Notice: a section `## jpeg-encoder` in `THIRD_PARTY_NOTICES.md` naming
  version 0.7.1, the licence expression, the path of the three licence
  files, that it is linked into the native CLI (and the desktop from M14),
  and the sentence `This software is based in part on the work of the
  Independent JPEG Group.` The same section names `png` 0.18 (MIT OR
  Apache-2.0) as used for encoding. `capture-help/jpg.ts` documents
  `--format`, `--quality` and that JPG is flattened on the background,
  and ends with the same IJG sentence, so the documentation shipped
  inside the binary carries it.

## Tests

- `tests/encode.rs`: PNG round trip through `png::Decoder` gives the same
  pixels; equal input gives equal bytes on two calls; JPEG starts with
  `FF D8`, ends with `FF D9`, decodes with `jpeg-decoder` to the same
  size with a mean absolute channel error under 3 for a self-made
  gradient-and-lines picture at quality 90; equal input gives equal
  bytes; wrong buffer length, zero side and quality 0 are errors;
  `transcode_png` flattens a half-transparent pixel to the expected value
  and rejects a truncated PNG without panicking.
- `engine_tests.rs`: `native.captureEncode(native.png(svg, 1), "jpg", 90,
  "#ffffff")` returns bytes starting with `FF D8`.
- `capture-command.test.ts`: `CAPTURE_HELP` contains `--quality` and the
  IJG sentence; format from extension; contradiction;
  `--quality` validation; fake `transcode` receives the background and the
  result is written with the `.jpg` extension; backend without
  `transcode` gives the message and exit 2.
- `native-parity/capture.test.ts`: native JPG capture of the 2D fixture
  writes a file with the JPEG markers; two runs give equal bytes; the Bun
  host exits 2 with the message.

## Acceptance criteria

- JPG capture of a 2D page works in the native CLI and is deterministic.
- The encoders are usable with raw pixels and nothing else from the crate.
- The notice entry exists and names the IJG sentence.

## Verification (each must exit 0)

1. `sh -c 'CARGO_TERM_QUIET=true cargo fmt --all -- --check && CARGO_TERM_QUIET=true cargo clippy -p nodetto-capture --all-targets -- -D warnings && CARGO_TERM_QUIET=true cargo test -p nodetto-capture'`
2. `sh -c 'CARGO_TERM_QUIET=true cargo test -p nodetto-cli'`
3. `sh -c 'bun run typecheck && bun run lint:ts && bun test apps/cli/src/capture-command.test.ts apps/cli/src/ai-commands.test.ts apps/cli/src/mcp.test.ts packages/cad-kernel/src/dependency.test.ts'`
4. `sh -c 'CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity/capture.test.ts'`
5. `sh -c 'grep -q "based in part on the work of the Independent JPEG Group" THIRD_PARTY_NOTICES.md && CARGO_TERM_QUIET=true cargo test -p nodetto-capture --test encode'`

## Progress

Pending.

# ipd-16-frames-export-compare

- planId: ipd-16-frames-export-compare
- planPath: impl-plans/active/ipd-16-frames-export-compare.md
- progressPath: impl-plans/progress/ipd-16-frames-export-compare.md
- dependsOn: ipd-11-frames, ipd-13-prototype-core-cli (both edit `apps/cli/src/export-command.ts`)
- Design (binding): `design-docs/specs/design-iphone-app-design.md`, Decisions 10.1 and 10.2, D10.
- Evidence: `tmp/ipd-s772/ipd-16-frames-export-compare/`.
<!-- ownership:start -->
- writePaths:
  - `packages/core/src/frame-order.ts`
  - `packages/core/src/frame-order.test.ts`
  - `packages/core/src/compare-images.ts`
  - `packages/core/src/compare-images.test.ts`
  - `apps/cli/src/export-command.ts`
  - `apps/cli/src/compare-command.ts`
  - `apps/cli/src/cli.ts`
  - `apps/cli/src/native-engine.ts`
  - `apps/cli/src/commands.ts`
  - `apps/cli/src/local-io.ts`
  - `apps/cli/src/frames-compare.test.ts`
  - `apps/cli/native/src/engine.rs`
  - `apps/cli/native/src/files.rs`
  - `apps/cli/native/src/engine_tests.rs`
  - `impl-plans/progress/ipd-16-frames-export-compare.md`
  - `tmp/ipd-s772/ipd-16-frames-export-compare`
  - `target`
- sharedPaths:
  - `packages/core/src/index.ts`
- sharedPathNotes:
  - path: `packages/core/src/index.ts`; intendedEdit: append export lines only; re-read immediately before writing; never reorder or remove lines; verify sibling plans' new lines survive after writing
- artifactRoots:
  - `tmp/ipd-s772/ipd-16-frames-export-compare`
  - `target`
<!-- ownership:end -->

Build artifact roots: `target` (and `apps/desktop/src-tauri/binaries` where declared) are outputs of cargo, `mise run test-cli` and `mise run build-cli`. They are git-ignored and contain no authored source. Never edit files under them by hand. Cargo's lock serializes concurrent builds; `ipd-24` additionally depends on `ipd-23`, so the W9 parity builds do not overlap.

## Intent and context

D10 (part): there is no easy way to export every artboard of a page and compare it with reference images.

This plan adds:

- `export --frames --output-dir`;
- the shared core comparison module, also used by the desktop in `ipd-22`;
- the `nodetto-cli compare` command.

All of it works in the bun CLI and the Boa-hosted native CLI. Rasterization uses each host's existing PNG path. The composition is an SVG with the two PNGs embedded as data URIs, so no pixel decoding happens in JS and no Rust change is needed.

## Non-goals

- No desktop UI (`ipd-22`).
- No numeric pixel-difference metric.
- No change to existing export formats or flags, other than adding `--frames`/`--output-dir`.
- No Rust changes other than the single `listDir` host primitive below.

## File-level changes

New `packages/core/src/frame-order.ts`:

- `export function orderedTopLevelFrames(store: Store, pageId: PageId, context: ShapeContext): readonly ElementId[]`
  - Includes top-level frames (no frame parent, per `frameParents`), visible only.
  - Reading order:
    1. Sort by y, then x, then id.
    2. Group rows: a frame starts a new row when its y >= the current row's first y + half that first frame's height.
    3. Within a row, sort by x, then id.
- `export function frameFileStem(index: number, name: string): string`
  - Returns `NN-<slug>`, with NN = 2-digit 1-based (3 digits from index 100).
  - Slug: lowercase; runs of characters outside `[a-z0-9]` become `-`; trim `-`; at most 48 characters; `frame` when empty.

New `packages/core/src/compare-images.ts`:

- `export function pngInfo(bytes: Uint8Array): { readonly width: number; readonly height: number }`
  - Checks the 8-byte PNG signature and that the first chunk is `IHDR`.
  - Reads big-endian width and height.
  - Throws `Error("not a PNG: <reason>")` on failure.
- `export function leadingNumber(name: string): number | undefined`: the leading digits of the base name.
- `export function pairByLeadingNumber<T>(actual: readonly { name: string; value: T }[], reference: readonly { name: string; value: T }[]): readonly { number: number; actual: T; reference: T }[]`
  - Throws, listing the offending names, on: a missing number, a duplicate number on either side, or an unmatched number.
- `export interface ComparisonBand { readonly y0: number; readonly y1: number; readonly dy: number }`
- `export function parseBand(text: string): ComparisonBand`
  - Format `y0:y1:dy`, all finite, with `y0 < y1`.
- `export function composeComparisonSvg(options: { readonly reference: Uint8Array; readonly actual: Uint8Array; readonly scale: number; readonly bands?: readonly ComparisonBand[]; readonly grid?: number; readonly labels?: readonly [string, string, string] }): { readonly svg: string; readonly warnings: readonly string[] }`
  - **Panel size.** The reference pixel size divided by `scale` gives point dimensions W×H. Gutter 16, label band 24.
  - **Panels.** Left to right:
    1. reference image;
    2. actual image (scaled uniformly to width W when it differs, with a warning `actual is <w>x<h>, reference is <w>x<h>`);
    3. difference: for each band (default `{0, H, 0}`), a clipPath of rows y0..y1, the reference image, then the actual image translated by `-dy` in a `<g style="mix-blend-mode:difference">`.
  - **Grid.** With `grid`, n-point lines at 25% opacity over the difference panel.
  - **Labels.** Defaults `["reference","nodetto","difference"]`, 12-unit text.
  - **Images.** Embedded as `data:image/png;base64,...`. Implement base64 with a small pure-TS encoder; do not use `btoa` on binary strings unless it is available in both hosts. A pure encoder is safest.
  - **Determinism.** Identical inputs give identical bytes.

`apps/cli/src/export-command.ts`:

- `--frames` (boolean) and `--output-dir <dir>`.
- `--frames` requires `--output-dir` and a format of `png` or `svg`, and conflicts with `--element` and `--output`. Each error exits 1 with a one-line message.
- `--output-dir` must exist (`io.exists`). Otherwise exit 1 with `output directory <dir> does not exist; create it first`.
- `--page` selects the page. The default is the same default page as the plain export.
- For each frame in `orderedTopLevelFrames`, export exactly as `--element <frameId>` does, with the same scale handling and pixel snapping. Write `<dir>/<stem>.<ext>`.
- stdout: one line per file: `<stem>.<ext>\t<frame name>`.

New `apps/cli/src/compare-command.ts`:

- `export async function compareCommand(io: CommandIo, args: readonly string[], raster: { rasterize: (svg: string, scale: number, fontDir: string | undefined, fallback?: boolean) => Promise<Uint8Array> }): Promise<CommandResult>`
- Usage: `compare <actual> <reference> --output <png|dir> [--scale 2] [--band y0:y1:dy]... [--grid n]`.
- Inputs: two `.png` files, or two directories. Detection: a path ending in `.png` is a file; anything else must be a directory.
- Directory mode needs a listing host API. This is the one new native host primitive in this feature; the design permits it when a plan proves it necessary, because Decision 10.2 requires directory pairing in both CLIs.
  - `CommandIo` (`apps/cli/src/commands.ts`) gains `listDir?(path: string): readonly string[]`, returning file names only, sorted, non-recursive.
  - Bun: `apps/cli/src/local-io.ts` implements it with `readdirSync` + `statSync(...).isFile()`.
  - Native, `apps/cli/native/src/engine.rs`:
    - add host function `listDir(path)` next to `readBytes` (`:94`), returning a JSON array string of file names;
    - add it to the exposed host name list (`:226`);
    - implement it in `apps/cli/native/src/files.rs` with `fs::read_dir`: regular files only, sorted by name, non-UTF-8 names skipped.
  - Path normalization goes through the same `native.path` call as `readBytes`.
  - `apps/cli/src/native-engine.ts` adds `listDir` to `io`.
  - Add a Rust unit test in `apps/cli/native/src/engine_tests.rs` for sorted output and file-only filtering.
  - Run `CARGO_TERM_QUIET=true cargo fmt --manifest-path apps/cli/native/Cargo.toml` and `CARGO_TERM_QUIET=true cargo test -p nodetto-cli`.
- Only PNG files (`.png`, case-insensitive) are considered in a directory. Pairing uses `pairByLeadingNumber`.
- Output:
  - a single pair writes one PNG;
  - directories or multiple pairs write `<dir>/NN-compare.png`.
- Rasterize the composed SVG at scale 1 (the panels are already in pixel-equivalent points × scale). Document the exact choice in help (`ipd-25`). The test asserts the output size.

`apps/cli/src/cli.ts`: register `compare` in `ASYNC_COMMANDS`, with the bun rasterizer from `raster-backend.ts`.

`apps/cli/src/native-engine.ts`: route `compare` like `export`, with the native `png` rasterizer.

`packages/core/src/index.ts` (sharedPaths, append-only): export the frame-order and compare-images APIs.

## Patterns to imitate

- `apps/cli/src/export-command.ts` `--element` branch (`:175-189`, `:320-332`), and output writing (`:437-440`).
- `packages/core/src/zip.ts` for pure-TS binary helpers.

## Pitfalls

- `--frames` must not include the outside titles; artboard export already omits them.
- Never read the reference images' content beyond the PNG header in JS.
- mix-blend-mode support: resvg supports it. Verify with a test that the difference of identical images renders near-black: rasterize with resvg-js in a bun test and sample pixels.
- Base64 of large images: build in chunks and avoid string concatenation per byte in Boa (`edit-performance` lessons). Use a lookup table and an array join.
- `listDir` in native must not follow other access rules than `readBytes` does. Keep the same path handling, and do not list recursively.

## Tests

New `packages/core/src/compare-images.test.ts`:

- `pngInfo` on a minimal valid PNG (build bytes in the test) -> its sizes. A truncated header -> throws. A JPEG signature -> throws.
- `pairByLeadingNumber` matched -> pairs. Duplicate `01` -> throws naming both. Unmatched -> throws.
- `parseBand("0:400:47")` -> the band. `"5:1:0"` -> throws.
- `composeComparisonSvg` with two identical 4×4 PNGs at scale 2 -> three image groups, `mix-blend-mode:difference`, and deterministic output (two calls equal).

New `packages/core/src/frame-order.test.ts`:

- Six frames in two rows with slight y jitter -> row-major order.
- `frameFileStem(0, "Home / Feed")` -> `01-home-feed`. An empty name -> `01-frame`.

New `apps/cli/src/frames-compare.test.ts`:

- `export --frames --format png --output-dir <tmp>` on a 3-screen doc -> 3 files named in reading order, each byte-equal to `--element` output.
- A missing directory -> exit 1.
- `--frames` with `--element` -> exit 1.
- `compare a.png a.png --output out.png --scale 2` -> the output exists, its `pngInfo` width = 3 × refWidth/2 + 2 × 16, and the difference panel center pixel is near black (resvg-js pixels).
- Directory mode with files `01-a.png`, `02-b.png` against `01-ref.png`, `02-ref.png` -> `01-compare.png` and `02-compare.png` written. An extra `03-x.png` only on one side -> exit 1 naming it.
- `--band 0:10:2` accepted. `--band x` -> exit 1.

## Verification (evidence in `final/`)

1. `bun test packages/core/src/compare-images.test.ts packages/core/src/frame-order.test.ts apps/cli/src/frames-compare.test.ts apps/cli/src/export-command.test.ts apps/cli/src/cli-wiring.test.ts` -> exit 0, 0 fail.
2. `bun run typecheck` -> no `error TS` line in the owned files.
3. `bunx biome check` on the owned files -> exit 0.
4. `CARGO_TERM_QUIET=true cargo fmt --manifest-path apps/cli/native/Cargo.toml -- --check && CARGO_TERM_QUIET=true cargo test -p nodetto-cli` -> exit 0, with the test summary recorded.
5. Visual evidence:
   - Export frames of a 3-screen generic doc.
   - Compare frame 1 with itself, and frame 1 with frame 2.
   - Inspect `final/compare-same.png` (a black difference panel) and `final/compare-diff.png`, and record the notes.

## Done criteria

Verification passes.

## Worker rules

- Record `git hash-object` of this plan first.
- Read each file fresh before editing it, with pre and post hashes. On drift, re-read, keep the other change and record it.
- `packages/core/src/index.ts` is shared: append export lines only.
- No state-changing git commands, no emojis. Evidence files must not match Bun test patterns.

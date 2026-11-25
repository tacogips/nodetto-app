# car4-f2b-capture-assets

- planId: car4-f2b-capture-assets; wave 2; dependsOn: car4-f2a-native-assets
- planPath: impl-plans/active/car4-f2b-capture-assets.md
- progressPath: impl-plans/progress/car4-f2b-capture-assets.md
- Finding: performance-capture-repeated-attachment-svg-expansion (R4-2, high), capture
  carrier and Bun resolution part.
- Design: `design-docs/specs/design-ai-capture.md` 22.1 R4-2 (Data flow, Bun reference
  renderer, Renderer-input bound, Tests), 22.2 (f2b gate), 22.5.
- writePaths: `apps/cli/src/capture-artwork.ts`, `apps/cli/src/capture-backend.ts`,
  `apps/cli/src/capture-command.test.ts`,
  `apps/cli/src/native-parity/capture-attachment-reuse.test.ts`,
  `tmp/car4-r4/car4-f2b-capture-assets`, `impl-plans/progress/car4-f2b-capture-assets.md`,
  `target`, `tmp/cad3d`
- sharedPaths: none; artifactRoots: `target`, `tmp/cad3d`

Follow the worker rules and pinned contracts in `impl-plans/active/car4-00-overview.md`.

## Intent and context

`resolveAsset` (`capture-artwork.ts:114-134`) returns a full data URL and the exporter
writes it into every placement (`packages/core/src/svg-export/shapes.ts:189-200`):
1/8/32 placements of a 33,234-byte PNG gave 44,810 / 356,447 / 1,424,930 bytes of
renderer input. Capture must embed one payload per distinct attachment in a carrier and
reference it per placement; both real renderers read the carrier.

Non-goals: no change to `CaptureBackend` (`capture-command.ts`), `export-command.ts`,
`shapes.ts`, standalone SVG export, glyph attribution (f6b), the native renderer (f2a).

## Changes

- `capture-artwork.ts`:
  - `resolveAsset(source)`: unchanged reading, validation and `editor.assets` caching;
    keep a `Map<source, n>` and an array of data URLs in first-resolution order; return
    `https://nodetto.invalid/capture-asset/${n}`.
  - After `pixelFrame`, insert the carrier block directly after the root `<svg ...>`
    start tag (one string insertion) when the array is non-empty. `fontCoverage` and
    `backend.rasterize` both receive this SVG.
- `capture-backend.ts`:
  - Export `captureRenderInput(svg: string): { svg: string; resources:
    ReadonlyMap<string, Buffer>; mimes: ReadonlyMap<number, string> }` that regex-scans
    carriers (pattern pinned in the overview), keeps MIME per index, and decodes each
    `png`/`jpeg`/`gif` payload once into a `Buffer` keyed by its placement URL. WebP
    gets no resource. Returned `svg` is the input string unchanged.
  - `rasterize`: build `new Resvg(svg, options)` exactly as today; then for each URL in
    `new Set(resvg.imagesToResolve())` that is in `resources`, call
    `resvg.resolveImage(url, buffer)` once; then render. Unknown URLs and WebP stay
    unresolved; any `resolveImage` error propagates.

## Pitfalls

- Never reinline payloads in Bun or anywhere else.
- `resvg-js` 2.6.2 throws `Unsupported image types` for WebP in `resolveImage`; inline
  WebP renders without the image today, so leaving it unresolved keeps bytes.
- Indices must match carrier order 0, 1, 2 ... (f2a rejects out-of-order).
- The existing test `capture caches native attachment data URLs ...` (`:665`) must keep
  passing unchanged.

## Tests

- `capture-command.test.ts` (harness at `:72`):
  - 1, 8, 32 identical placements (x shifted) of one PNG attachment: one read; the fake
    backend SVG has exactly one `base64,`; every placement href is the URL;
    `len(32) - len(1) <= 31 * (len(2) - len(1) + 16)`.
  - `captureRenderInput` on those SVGs: `resources.size === 1`, returned `svg` identical,
    `svg.length + sum(buffer lengths)` obeys the same bound.
  - Parity: for meet, slice, fill and a crop of different sizes at scales 1 and 2.37,
    `captureBackend.rasterize(captureSvg)` equals `captureBackend.rasterize(inlineSvg)`
    where `inlineSvg` replaces each URL with its data URL and drops the carrier.
  - MIME parity: four placements each of PNG, JPEG, GIF, WebP literals (JPEG via
    `sips -s format jpeg apps/desktop/src-tauri/icons/32x32.png --out <tmp>`, GIF a
    hand-built 2 x 2 image, WebP via
    `cwebp -quiet -lossless apps/desktop/src-tauri/icons/32x32.png -o -`; record commands
    and hashes): capture succeeds and Bun PNG equals the inline control; for WebP
    `resources` has no entry and the SVG has one WebP payload.
- New `native-parity/capture-attachment-reuse.test.ts` (imitate the 2D cases at
  `native-parity/capture.test.ts:35-108` and `nativeTest`): document A places
  `artifacts/a.png` three times; document B places `artifacts/b1.png`, `b2.png`,
  `b3.png` (identical bytes) once each with the same geometry; native PNG and JPG
  outputs of A equal those of B; exit 0.

## Verification (each exits 0 and runs tests)

1. `bunx biome check --diagnostic-level=warn apps/cli/src/capture-artwork.ts apps/cli/src/capture-backend.ts apps/cli/src/capture-command.test.ts apps/cli/src/native-parity/capture-attachment-reuse.test.ts && bun test apps/cli/src/capture-command.test.ts`
2. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car4-f2b-capture-assets cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/car4-f2b-capture-assets/release/nodetto-cli" bun test apps/cli/src/native-parity/capture-attachment-reuse.test.ts`
   (`native-parity/capture.test.ts` is owned by f1d and is not in this gate.)

## Done criteria

- One payload and one read per distinct attachment; bounds hold at both boundaries;
  Bun and native parity hold; progress log `done`.

Implementation status: done. Focused Bun gate passed 48 tests and native PNG/JPG parity gate passed 1 test; see `impl-plans/progress/car4-f2b-capture-assets.md`. Formal review and integration follow.

Review repair: legacy embedded data URLs remain inline; embedded-only and mixed-source regressions pass. Refreshed gates: 50 Bun tests and 1 native parity test passed. Formal re-review remains pending.

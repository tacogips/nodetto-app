# M15 capture-15-desktop-ui

- Stage: wave 1 (revision 4). dependsOn: none. The dialog defines its own
  prop types from existing `@nodetto/core` types (`CaptureCameraRequest`,
  `CaptureTheme`); it does not need M14. The `App.tsx` wiring moved to M14
  (design 8.5), so this plan does not edit `apps/desktop/src/App.tsx`.
- Design: sections 13, 8.5
- Intent: the Export dialog entry "3D view image", the Current view
  conversion, and JPG for 2D artwork, usable in light and dark themes with
  existing classes and tokens only.
- Non-goals: no backend, no handler, no `App.tsx`, no new colour tokens, no
  change to STL defaults or PNG output.
- Same-dir rule: edit only the files below; read each fresh before editing
  and log `git hash-object` before and after in Progress.
- writePaths (also `impl-plans/active/capture-15-desktop-ui.md`,
  `tmp/capture/m15`): `packages/ui-solid/src/ExportDialog.tsx`,
  `packages/ui-solid/src/CadImageExportSection.tsx` (new),
  `packages/ui-solid/src/cad/capture-camera.ts` (new) and its test,
  `packages/ui-solid/src/Canvas.tsx` (one optional prop and its call),
  `packages/ui-solid/src/index.ts` (exports of the new prop type only),
  `packages/ui-solid/src/raster-export.ts` (optional output type
  parameter), `packages/ui-solid/src/inspector/AssetExportSection.tsx`,
  `packages/ui-solid/src/export-dialog-document.test.ts`,
  `packages/ui-solid/src/cad/camera3d.ts` (add `export` to `cameraAxes`,
  nothing else), `packages/ui-solid/src/test-dom/cad-image.dom.tsx` (new),
  `packages/ui-solid/src/cad/capture-image.test.ts` (new: launches the
  DOM file the way `packages/ui-solid/src/cad/mesh-io.test.ts` launches
  `cad-mesh.dom.tsx`),
  `packages/ui-solid/src/raster-export.test.ts` (new cases only)
- Pre-authorised: `packages/ui-solid/src/export-dialog-document.test.ts:8-20`
  inserts `"image3d"` after `"pdf"` in the Artwork ids. Nothing else in
  that assertion changes. `packages/ui-solid/src/test-dom/cad-mesh.dom.tsx`
  passes unmodified (STL stays the default format on a CAD page; SVG, PNG
  and PDF stay enabled).

## Contract

```ts
// ExportDialog.tsx props gain
readonly captureCadImage?: (options: { camera: CaptureCameraRequest; format: "png" | "jpg";
  theme: CaptureTheme; width: number; height: number }) => Promise<void>;
readonly cadCurrentView?: () => Camera3d | undefined;   // camera of the page shown in the dialog
readonly canvasMode?: "light" | "dark";

// Canvas.tsx (NodettoCanvas) props gain
readonly onCadCameraChange?: (pageId: PageId, camera: Camera3d) => void;

// cad/capture-camera.ts
/** Direction, up, target and visible height of the capture that shows what the viewport shows. */
export function captureRequestFromCamera(camera: Camera3d): CaptureCameraRequest;

// raster-export.ts
export async function rasterizeSvg(svg: string, scale: number, signal?: AbortSignal,
  output?: { type: "image/png" | "image/jpeg"; quality?: number }): Promise<Blob>;
```

## Behavior

- Format entry: `EXPORT_FORMAT_GROUPS` Artwork ids become `svg, png, pdf,
  image3d, artboards`; label `3D view image (PNG/JPG)...`; enabled when
  the page kind is `cad3d` and `captureCadImage` is defined; the
  description says the picture is rendered from the model, orthographic,
  with interference marked. When it is disabled on a CAD page because the
  native backend is missing (plain browser), the description reads
  `Available in the desktop app.` The default format on a CAD page stays
  STL.
- `CadImageExportSection`: a view select (Current view, Isometric, Front,
  Back, Left, Right, Top, Bottom; Current view only when `cadCurrentView`
  returns a camera, and then it is the default, else Isometric), a format
  select (PNG, JPG) and a size select (1024 x 768, 1600 x 1200, 2048 x
  1536). The Export button calls `captureCadImage` with the theme of
  `canvasMode` and disables itself while the call runs. All text uses
  existing dialog classes; no new colour.
- Current view: `captureRequestFromCamera` returns `direction = -back` of
  the viewport camera (the axes of
  `packages/ui-solid/src/cad/camera3d.ts:28-50`), `up` = the camera's up
  vector, `target` = the camera target and `viewHeight =
  cameraViewHeight(camera)` (`camera3d.ts:97-99`), so the same height of
  the model is visible. The section states `Orthographic projection`
  under the select.
- `NodettoCanvas` calls `onCadCameraChange(id, camera)` where it stores
  the camera today (`packages/ui-solid/src/Canvas.tsx:185`). The App side
  (a per-page camera map, `cadCurrentView`, `captureCadImage`,
  `canvasMode`) is M14's job; export the prop types from
  `packages/ui-solid/src/index.ts` so M14 can type it.
- 2D JPG: `ExportFormat` becomes `"svg" | "png" | "jpg" | "pdf"`; the
  format select of `AssetExportSection` offers `JPG`; it rasterizes with
  `output: { type: "image/jpeg", quality: 0.9 }`, forces an opaque
  background (the chosen background, or the default export background
  when transparent is selected, with a note), and saves with the `jpg`
  extension through the existing `save` path. `rasterizeSvg` without
  `output` behaves exactly as before.

## Tests

- `export-dialog-document.test.ts`: the pre-authorised list change.
- `capture-camera.test.ts`: the default viewport camera (yaw 45 degrees,
  pitch 30 degrees) gives a direction with negative x, y and z and an
  `up` with positive z; a top-down camera gives a direction along -z and
  a valid up; `viewHeight` equals `cameraViewHeight` and halves with the
  camera distance; the result passed to `captureCamera` yields an
  orthonormal basis and that scale.
- `cad-image.dom.tsx` (DOM test in the style of `cad-mesh.dom.tsx`): on a
  CAD page with a fake `captureCadImage` the entry is enabled; choosing
  it shows the three selects; Export calls the fake once with the chosen
  view, format, size and the theme of the canvas mode; Current view is
  absent without a camera and default with one; on a freeform page the
  entry is disabled; without `captureCadImage` on a CAD page it is
  disabled with the desktop note; STL is still the default format.
- `raster-export.test.ts`: `rasterizeSvg` passes the output type and
  quality to `toBlob` and defaults to PNG.
- Existing: `cad-mesh.dom.tsx`, `export-dialog-artboards.test.ts`,
  `raster-lifecycle.test.ts` and
  `apps/desktop/src/styles/theme-tokens.test.ts` pass unmodified.

## Acceptance criteria

- On a CAD page the desktop Export dialog saves the same picture the CLI
  writes for the same view, format, size and theme.
- 2D artwork can be saved as JPG; PNG export is unchanged.

- Dark theme: the DOM test renders the section once with the dark canvas
  mode and asserts it uses only existing dialog classes (no inline colour).

## Verification (each must exit 0)

1. `sh -c 'bun run typecheck && bunx biome check packages/ui-solid/src && bun test packages/ui-solid/src/export-dialog-document.test.ts packages/ui-solid/src/export-dialog-artboards.test.ts packages/ui-solid/src/cad/capture-camera.test.ts packages/ui-solid/src/raster-export.test.ts packages/ui-solid/src/raster-lifecycle.test.ts'`
2. `sh -c 'bun test packages/ui-solid/src/cad/capture-image.test.ts packages/ui-solid/src/cad/mesh-io.test.ts apps/desktop/src/styles/theme-tokens.test.ts apps/desktop/src/shell/export-handlers.test.ts'`
3. `sh -c 'bun --cwd=apps/desktop run build --outDir ../../target/capture-m15/dist && bun test packages/ui-solid/src/export-dialog-document.test.ts'`

## Amendment 2026-11-23 (integration-paths-outside-writePaths, round 1)

Finding INT-M15-VERIFY3-ARTIFACT-ROOT (mid). The old gate 3 ran
`vite build` with its default output, `apps/desktop/dist`. That path is
outside the artifact root `target` and outside writePaths, so the worker
rightly refused to run it. Gate 3 now passes `--outDir
../../target/capture-m15/dist`, relative to `apps/desktop`, and keeps
both the build and the document test. `apps/desktop/dist` is not added to
artifactRoots. M15 sources need no edit unless review finds a defect.
Rerun gates 1 to 3 and keep complete logs ending in `exit=0` under
`tmp/capture-s868/capture-15-desktop-ui/`.

The manifest `impl-plans/active/capture-s868-dispatch.json` appears in
this plan's writePaths only so that the plan author's amendment has an
owner. The M15 worker must not edit it.

## Progress

Implementation complete for revision 4; App wiring remains M14. CAD image controls, camera reporting and conversion, and JPEG artwork encoding are implemented. The amended shared-tree verification gates passed: 19, 26 and 2 tests respectively, with complete logs `tmp/capture-s868/capture-15-desktop-ui/amended-gate1.log` through `amended-gate3.log`. Gate 3 builds under `target/capture-m15/dist`. Formal reviews and integration remain downstream.

Per-file initial and final git blob hashes (empty blob means a new file):
  - `packages/ui-solid/src/Canvas.tsx`: `eaf0074a1608e25742399d922e88d5257a692667` -> `a7a8e06b4ec440971c140a6991d59d13beaeb5f0`
  - `packages/ui-solid/src/ExportDialog.tsx`: `7de2463ebb6da75f6e3b5dcdadeda26e5ac05150` -> `9da6e6fb24f65614266699ba7e5d38f91dec87c7`
  - `packages/ui-solid/src/cad/camera3d.ts`: `1ea0bfb84b17f17ea11a510760e64d6980658e54` -> `4c70f632198fad5472b5d551eef82231c0e79285`
  - `packages/ui-solid/src/cad/capture-camera.ts`: `e69de29bb2d1d6434b8b29ae775ad8c2e48c5391` -> `5f9bce372d18232d4ff9012ce98ad54a0dfb39ef`
  - `packages/ui-solid/src/cad/capture-camera.test.ts`: `e69de29bb2d1d6434b8b29ae775ad8c2e48c5391` -> `3d916bff675289cfff73f46e1b7839d9df4fa7e1`
  - `packages/ui-solid/src/cad/capture-image.test.ts`: `e69de29bb2d1d6434b8b29ae775ad8c2e48c5391` -> `719b021e82235c1427ac1da58fa24c6a2e5a6442`
  - `packages/ui-solid/src/CadImageExportSection.tsx`: `e69de29bb2d1d6434b8b29ae775ad8c2e48c5391` -> `0692c80b318d1c8d7cac5d003cc659dade845729`
  - `packages/ui-solid/src/test-dom/cad-image.dom.tsx`: `e69de29bb2d1d6434b8b29ae775ad8c2e48c5391` -> `ecfbc1477ea33d3dee395ae6bfeed39d4addcbe3`
  - `packages/ui-solid/src/export-dialog-document.test.ts`: `ab62bf7b55d19a0ab5a8c1714adb6576b6c3aef5` -> `29627247b4e3d49705232e0c5d5a9f76354983b2`
  - `packages/ui-solid/src/index.ts`: `c3d38d2160e208b94790ae12e3d98bbdb3c80a16` -> `8de9dc3eec0122b3051d07cc6fd7d873162d2e93`
  - `packages/ui-solid/src/inspector/AssetExportSection.tsx`: `de1507c087e0403c8f7dcc8729901f5cdaf28b3a` -> `e0082a045f476d718470f3c78c2f11914ce6bf1b`
  - `packages/ui-solid/src/raster-export.ts`: `e7ae65c8aa40ed6c45eb9d27178652776b5febd6` -> `3bcae7c99530c2ed9bc929cd1f51d050bdfa5dd0`
  - `packages/ui-solid/src/raster-export.test.ts`: `b7a6dbac7ec702e2c3f33fadaba0fc3b82dc8544` -> `525d78b67d3de7160e15128daad6d4b3979bce72`

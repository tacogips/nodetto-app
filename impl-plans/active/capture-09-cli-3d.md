# M9 capture-09-cli-3d

- dependsOn: M8 (`render_scene`, report JSON); uses M4 (crate linked into
  the CLI), M5 and M6 (model, camera, scene writer), M19 (theme)
- Design: sections 4.1, 4.2, 6.1, 6.2, 6.7, 8.2, 10.2, 12
- writePaths: `packages/core/src/capture/cad-request.ts` (new) and its
  test, `packages/core/src/capture/report.ts` (new) and its test,
  `packages/core/src/capture/index.ts`, `apps/cli/native/src/engine.rs`
  (operation `captureSolid`), `apps/cli/native/src/engine_tests.rs` (new
  tests only), `apps/cli/src/native-engine.ts`,
  `apps/cli/src/capture-command.ts` and its test,
  `apps/cli/src/capture-cad.ts` (new: the CAD branch) and its test,
  `apps/cli/src/capture-help/cad.ts` (the part M3 left empty),
  `apps/cli/src/__fixtures__/capture-plate.jsonl` (new, generated from
  `packages/core/src/capture/testing/plate.ts` and committed),
  `apps/cli/src/__fixtures__/capture-plate-default.ncs1` (new, generated),
  `apps/cli/src/native-parity/capture.test.ts`
- Pre-authorised: none.

## Contract

```ts
// packages/core/src/capture/cad-request.ts: shared by the CLI and the desktop
export interface CadCaptureRequest { readonly camera: CaptureCameraRequest; readonly width: number;
  readonly height: number; readonly theme: CaptureTheme }
export interface PreparedCadCapture { readonly scene: Uint8Array; readonly model: CadCaptureModel;
  readonly camera: CaptureCamera; readonly frame: "complete" | "cropped" }
export class CaptureInputError extends Error {}          // message is for the user
export function prepareCadCapture(elements: readonly Element[], pageId: PageId,
  request: CadCaptureRequest): PreparedCadCapture;

// packages/core/src/capture/report.ts
export interface SolidReport { readonly width: number; readonly height: number;
  readonly bodies: readonly { state: "drawn" | "hidden" | "absent" | "outside" | "empty" | "unknown";
    emptiedByStep: number; open: boolean }[];
  readonly analysis: { cell: number; candidates: number; checked: number;
    unchecked: readonly (readonly [number, number])[]; uncheckedCount: number } | null;
  readonly pairs: readonly { a: number; b: number; volume: number; min: Vec3; max: Vec3;
    source: "analysis" | "view"; capped: boolean }[] }
/** Validates the shape; throws on anything else. */
export function parseSolidReport(json: string): SolidReport;

// apps/cli/src/capture-command.ts: CaptureBackend gains
renderSolid?(scene: Uint8Array, format: "png" | "jpg", quality: number): { image: Uint8Array; report: string };
```

Native host operation `captureSolid(scene, format, quality)` returns one
`Uint8Array`: `u32` little-endian length of the report, the report JSON,
the image bytes. New options: `--view`, `--direction`, `--eye`,
`--target`, `--up`, `--zoom`, and `--size <W>x<H>` for CAD pages.

## Behavior

- `prepareCadCapture`: `buildCadCaptureModel`; no body throws
  `CaptureInputError` with the text of design section 12 (sketch count,
  failed feature count, what to do); `captureCamera` with the model
  bounds (its `RangeError` becomes a `CaptureInputError`);
  `captureFrame` over the body boxes; `writeCaptureScene` with
  supersample 2, `CAPTURE_THEMES[theme]`, reference opacity 0.45 and
  `interference: null` (M20 turns it on). The function fixes every
  default, so two hosts that pass equal requests get equal scene bytes.
- CLI: a `cad3d` page takes the CAD branch before any SVG call (design
  section 5); the interim M3 message is removed. 2D-only options
  (`--element`, `--padding`, `--background`, `--scale`, `--font-dir`) on a
  CAD page, and camera options on a 2D page, are usage errors that name
  the page kind.
- Vectors are three comma-separated finite numbers; `--view` excludes
  `--direction` and `--eye`; `--direction` excludes `--eye`; `--target`
  and `--up` combine with any of them. `--zoom` is 0.01 to 1000. `--size`
  default 1024x768, each side 64 to 2048.
- `backend.renderSolid` (native: `captureSolid`, split by the length
  prefix) and `parseSolidReport`; a backend without it (Bun) fails with
  `3D CAD capture needs the native nodetto-cli.` A `CaptureInputError`
  is exit 2 with its message, followed by the error lines.
- Target and write: the code path of M3 (digest name, exclusive write,
  `--force`, absolute path).
- Stdout after the common lines (design 4.2): `camera: view=<name>
  direction=<x,y,z> up=<x,y,z> centre=<x,y,z> scale=<n> mm/px` (vectors
  with five decimals at most, trailing zeros removed, scale with four
  significant digits), `frame: complete|cropped`, `bodies: <n> (<names>)`
  (the first eight, then `...`; state notes `[hidden behind other
  bodies]` and `[not in the picture]` for `absent`, refined by M18),
  `errors: <n>` and one indented `<short id> <code>` line each. `--json`
  carries the same values with full ids and the camera's `right`.
- Native: `engine.rs` calls `nodetto_capture::render_scene(scene, format,
  0)` and maps `CaptureError` to a host error.
- Help part `cad.ts`: the camera options with the view table, that the
  picture is orthographic and Z is up, that `iso` looks from +X +Y +Z and
  so shows the top, back and right faces (use `--direction 1,1,-1` for
  the front-left-top corner), the default size, `centre` and `frame`,
  what `errors` means, one CAD example.

## Tests

- `cad-request.test.ts`: header carries size and supersample; each view
  and vector option reaches the camera block; equal requests give equal
  bytes; no-body message contains the sketch count; bad camera message.
- `report.test.ts`: parses the report a fake returns; rejects a missing
  key, a wrong type and an unknown state.
- `capture-cad.test.ts` (fake backend that records the scene and returns
  a fixed image and report): exclusions and bad vectors are usage errors;
  2D option on a CAD page; text and JSON output including `centre`,
  `frame: cropped` with `--zoom 3`, a failed feature, a hidden body; Bun
  backend message. The scene the command writes for
  `capture-plate.jsonl` with default options equals the committed
  `capture-plate-default.ncs1` (`UPDATE_CAPTURE_FIXTURES=1` rewrites it).
- `capture-command.test.ts`: the kind dispatch never calls `rasterize`
  for a CAD page (guards the merge with cad3d M18).
- `engine_tests.rs`:
  - `nodettoRun(["capture", <capture-plate.jsonl>, "--output", <png>])`
    writes a 1024 x 768 PNG and prints `bodies: 3`;
  - Boa against Bun: the bytes of that PNG equal
    `nodetto_capture::render_scene(<capture-plate-default.ncs1>, Png, 0)`,
    where the fixture was written by the Bun test above. A scene written
    under Boa that differed in one bit from the Bun one would change the
    picture or fail this comparison of whole files.
- `native-parity/capture.test.ts` (native binary):
  - default capture of `capture-plate.jsonl`: exit 0, PNG of 1024 x 768,
    stdout lines as specified, absolute path;
  - two runs give equal bytes; `--view top` and `--view front` differ
    from `iso` and from each other; `--direction -1,-1,-1` equals `iso`;
    `--direction 0,0,1` equals `--view bottom`; `--eye 1,1,1 --target
    0,0,0` equals `--direction -1,-1,-1 --target 0,0,0`;
  - decoded pixels (the test's own decoder gains an RGB branch; the
    shared harness is not edited): from `top` the centre of a hole has
    the background colour and a point on the plate does not; from
    `--direction 0,1,-0.15` the top face is mostly body shade;
  - a document built in the test with `loops: [C1, C2]` and `loops: [R,
    C2]` extrudes shows the disc and the slab without a hole;
  - `--format jpg` writes a JPEG; `--theme dark` changes the background
    pixel to `#15191b`;
  - budget: wall time of the default capture under 5,000 ms, measured
    three times, the values written to `tmp/capture/m09/timing.json`;
  - the Bun host exits 2 with the message.

## Acceptance criteria

- `nodetto-cli capture <cad doc>` writes a shaded picture of the solids
  with a chosen camera, deterministically, inside the stated budget.
- Statuses in the text equal `cad check` for the same page.
- The scene for equal options is the same under Boa and Bun.

## Verification (each must exit 0)

1. `sh -c 'bun run typecheck && bun run lint:ts && bun test packages/core/src/capture apps/cli/src/capture-command.test.ts apps/cli/src/capture-cad.test.ts apps/cli/src/ai-commands.test.ts apps/cli/src/mcp.test.ts'`
2. `sh -c 'mkdir -p tmp/capture/m09; bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess > tmp/capture/m09/strict.log 2>&1; ! grep -E "^packages/(core|ir)/src/" tmp/capture/m09/strict.log | grep -vqE "\.test\.tsx?\(" && bun test packages/core/src/capture/cad-request.test.ts'`
3. `sh -c 'CARGO_TERM_QUIET=true cargo fmt --all -- --check && CARGO_TERM_QUIET=true cargo clippy -p nodetto-cli --all-targets -- -D warnings && CARGO_TERM_QUIET=true cargo test -p nodetto-cli'`
4. `sh -c 'mkdir -p tmp/capture/m09 && CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity/capture.test.ts'`

## Progress

Implemented, round 1. Native CLI CAD capture supports orthographic camera
options, PNG and JPG, and camera, frame, body and error metadata. The
shared request receives the whole document, including external PCB page
elements. Output writes use the existing capture writer. The Bun CLI
reports the native requirement.

- Write-path deviation for CAP-M6-01, CAP-M7-03 and CAP-M8-01:
  added regressions to `scene-binary.test.ts` and the crate's
  `tests/{scene,intervals,render}.rs`. These paths remain disjoint from
  M10. M9 covers CAP-M8-01's output formats, state words and shallow
  edge. Its chord cases are due in M11. The shared-cap case is due in
  M10 and rechecked in M17.
- The Boa test observes the exact NCS1 view passed to the real host and
  compares those bytes as well as the PNG with the Bun fixture. Its
  additional encoder test checks PNG passthrough and distinct RGB
  channels for JPG (CAP-M4-01).
- Passed all four plan commands with 199, 12, 29 and 5 tests.
  The default 1024x768 reference capture took 746, 664 and 670 ms
  end to end (limit 5,000 ms). Logs: `tmp/capture/m09/v[1-4]-complete.log`,
  `strict.log` and `timing.json` in the same directory.
- Capture crate tests passed (52 passed, two release-only cases ignored).
  Eleven isolated mutations were caught by the new threshold,
  occupancy, face ID and state-word tests. Logs: `rust-crate.log`
  and `mutations.log`.
- Inspected native 1024x768 light and dark Plate images. The holes,
  pocket, boss, clipped puck and foreground block are visible.
  Evidence: `tmp/capture/m09/preview-complete.log` and the two PNGs.
- Workspace check, lint and the unfiltered Bun suite passed (4,682
  passed, 82 skipped, 738 files). The workspace Rust test pass stopped
  at the same 17 unchanged desktop Foundation atomic-write permission
  failures seen under the worktree-only guard in M8. Logs:
  `tmp/capture/m09/repository-verify-complete.log`.

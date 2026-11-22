# M6 capture-06-scene-binary

- dependsOn: M4 (crate `nodetto-capture`), M5 (`CadCaptureModel`,
  `CaptureCamera`); uses `CAPTURE_THEMES` of M19
- Design: sections 6.3, 8.1, 11 (scene bytes)
- writePaths: `packages/core/src/capture/scene-binary.ts` (new) and its
  test, `packages/core/src/capture/index.ts`,
  `packages/core/src/capture/testing/plate.ts` and
  `packages/core/src/capture/testing/selected-loops.ts` (new,
  self-authored fixture document builders shared by tests),
  `crates/capture/src/scene.rs` (new), `crates/capture/src/lib.rs`,
  `crates/capture/tests/scene.rs` (new),
  `crates/capture/tests/fixtures/plate-iso.ncs1` and
  `selected-loops-top.ncs1` (new, generated)
- Pre-authorised: none.

## Contract

```ts
// scene-binary.ts: imports types only
export interface CaptureSceneOptions { readonly width: number; readonly height: number;
  readonly supersample: 1 | 2 | 3; readonly camera: CaptureCamera;
  readonly colours: { background: string; body: string; edge: string; interference: string };
  readonly referenceOpacity: number;            // 0..1, written as a byte
  readonly interference: { readonly cellMm: number; readonly budgetMillionRays: number;
    readonly toleranceMm: number; readonly draw: boolean;
    /** Indices of the bodies that take part; undefined means all. */
    readonly bodies?: readonly number[] } | null }
export interface CaptureMeshTool { readonly kind: "mesh"; readonly feature: ElementId;
  readonly positions: Float64Array; readonly triangles: Uint32Array }
/** Throws RangeError when a count or size is outside the reader's limits. */
export function writeCaptureScene(model: { readonly tools: readonly (CaptureTool | CaptureMeshTool)[];
  readonly bodies: readonly CaptureBody[] }, options: CaptureSceneOptions): Uint8Array;
```

```rust
// crates/capture/src/scene.rs
pub struct Scene { pub width: u32, pub height: u32, pub supersample: u32, pub camera: Camera,
  pub colours: Colours, pub reference_opacity: u8, pub analyse: bool, pub draw_interference: bool,
  pub budget_million_rays: u32, pub tolerance: f64, pub target_cell: f64,
  pub tools: Vec<Tool>, pub bodies: Vec<Body> }
pub enum Tool { Prism(Prism), Mesh(Mesh) }
pub struct Prism { pub o: [f64; 3], pub u: [f64; 3], pub v: [f64; 3], pub n: [f64; 3],
  pub t0: f64, pub t1: f64, pub loops: Vec<Loop> }
pub struct Loop { pub points: Vec<f64>, pub faces: Vec<u32> }
pub struct Mesh { pub positions: Vec<f64>, pub triangles: Vec<u32> }
pub struct Body { pub reference: bool, pub analysed: bool, pub steps: Vec<Step> }
pub struct Step { pub op: Op, pub tool: u32 }   // Op::{Union, Difference, Intersection}
pub fn parse_scene(bytes: &[u8]) -> Result<Scene, CaptureError>;
```

## Behavior

- Layout: the table of design section 6.3, byte for byte: 40-byte header
  (options at 28, budget at 32), 104-byte camera, tolerance at 144,
  target cell at 152, 16 bytes of colours at 160, tools from 176, then
  bodies. The writer asserts that every array starts on a multiple of 4
  and every double array on a multiple of 8.
- Writer: computes the total length first, allocates once, writes
  integers through one `DataView` and copies every `Float64Array` and
  `Uint32Array` with `Uint8Array.set` on the array's bytes (no per-number
  call for geometry). It first checks that the platform is little endian
  (`new Uint8Array(new Uint16Array([1]).buffer)[0] === 1`) and throws
  otherwise. Colours are parsed from `#rrggbb`. With `interference: null`
  the two option bits and the budget are 0, the cell is written as 0.25
  and no body has the analysed bit. Otherwise bit 0 is set, bit 1 follows
  `draw`, and the analysed bit is set for the listed bodies or for all.
- Reader, every rule a test: wrong magic, version or flags; non-zero
  padding or unknown option or body flag bits; any count that would need
  more bytes than remain (checked before allocating); `width` or `height`
  outside 64..2048; `supersample` outside 1..3; with the analyse bit a
  budget outside 1..256, without it a budget other than 0; target cell
  outside 0.01..10; tolerance outside 1e-6..1; more than 20,000 tools or
  bodies; a loop with fewer than 3 or more than 20,000 points; more than
  4,000,000 points in total; more than 2,000,000 triangles in a mesh; a
  triangle index at or above the vertex count; a step whose tool index is
  out of range or whose op is not 0, 1 or 2; a body without steps or
  whose first step is not a union; any real that is not finite or whose
  magnitude exceeds 1e7 (camera scale: positive and at most 1e7); camera
  vectors that are not unit length and mutually perpendicular within
  1e-9; `t0 == t1`; trailing bytes. Every failure is a `CaptureError`
  with a short reason; nothing panics.
- Fixture document `testing/plate.ts` (self-authored): a page "Plate"
  with a 100 x 60 x 5 plate, a sketch on its end face with a 10 x 6 grid
  of circles of radius 2 cut through, a 20 x 16 pocket 2 deep, a hollow
  boss added on top, a second body "Block" (25 x 25 x 12 at 85,45,2) that
  overlaps the plate corner, a third body "Puck" (a box intersected with
  a cylinder) clear of the others. Exported for later milestones.
- Fixture document `testing/selected-loops.ts`: one sketch with a
  rectangle R (60 x 40), a circle C1 of radius 10 inside it and a
  concentric circle C2 of radius 4; body "Disc" from an extrude with
  `loops: [C1, C2]`, and, 80 mm to the side from a copy of the sketch,
  body "Slab" from an extrude with `loops: [R, C2]`.
- Fixture bytes: `plate-iso.ncs1` is `writeCaptureScene` of the Plate
  model with the `iso` camera fitted to 1024 x 768, supersample 2, light
  theme, interference on (cell 0.25, budget 24, tolerance 0.001, draw
  on). `selected-loops-top.ncs1` is the second model from `top` at 640 x
  480, supersample 2, interference off.

## Tests

- `scene-binary.test.ts`: header fields at their offsets; a one-loop
  model's bytes equal a hand-built expectation; odd point count is
  padded; `bodies: [1]` sets the analysed bit only on body 1; both
  committed fixtures equal the writer's output (with
  `UPDATE_CAPTURE_FIXTURES=1` the test rewrites the files instead; the
  commit includes the generated files); the second fixture has one loop
  per tool after normalisation; limits throw; writing the Plate fixture
  takes under 100 ms in Bun.
- `tests/scene.rs`: both fixtures parse; tool, body and step counts and
  the camera equal the values printed by the TypeScript test
  (hard-coded); each reader rule above with a mutated copy of the Plate
  fixture; every truncation of it at 64 evenly spaced lengths is an
  error; 2,000 single-byte mutations at deterministic positions never
  panic (errors or a parsed scene are both acceptable).

## Acceptance criteria

- Both ends agree on the committed bytes, so a change on one side fails a
  test on the other.
- The reader accepts no scene outside the limits of design section 11.

## Verification (each must exit 0)

1. `sh -c 'bun run typecheck && bun test packages/core/src/capture'`
2. `sh -c 'mkdir -p tmp/capture/m06; bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess > tmp/capture/m06/strict.log 2>&1; ! grep -E "^packages/(core|ir)/src/" tmp/capture/m06/strict.log | grep -vqE "\.test\.tsx?\(" && bun test packages/core/src/capture/scene-binary.test.ts'`
3. `sh -c 'CARGO_TERM_QUIET=true cargo fmt --all -- --check && CARGO_TERM_QUIET=true cargo clippy -p nodetto-capture --all-targets -- -D warnings && CARGO_TERM_QUIET=true cargo test -p nodetto-capture'`
4. `sh -c 'bun run lint:ts && bun test packages/core/src/capture/scene-binary.test.ts'`

## Progress

Implemented. Adversarial review is pending.

- All four verification commands passed with 78, 6, 17, and 6 tests.
  See `tmp/capture/m06/v1-final.log` through `v4-final.log` and
  `strict.log`. The unfiltered Bun suite passed with 4,634 passes and
  79 skips across 735 files. Workspace check, Clippy, and both formatting
  checks passed.
- The writer and reader agree on the Plate and selected-loop fixtures.
  The reader rejects invalid headers, padding, counts, indices, and
  camera data. Tests exercise 64 truncations and 2,000 byte changes.
- Write-path deviation for CAP-M4-01: added tests in `flatten.rs` and
  `tests/encode.rs` for exact alpha rounding, fixed Huffman tables,
  animated PNG rejection, and byte-identical RGBA PNG passthrough.
  All four corresponding mutations fail their targeted tests
  (`tmp/capture/m06/encoder-mutations.log`). The native host colour
  order and PNG branch remain for the M9 engine tests.
- Supplemental workspace Rust tests stopped after 49 passes and 17
  Foundation file-write denials in existing desktop tests under the
  worktree-only write guard. See `tmp/capture/m06/repository-rust.log`.
  The capture crate's 17 tests all passed independently.

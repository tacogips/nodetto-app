# M8 capture-08-shaded-image

- dependsOn: M7 (`PrismView`, `combine`)
- Design: sections 6.3 (reply), 6.5, 7 (3D determinism), 10
- writePaths: `crates/capture/src/raster.rs` (new),
  `crates/capture/src/shade.rs` (new), `crates/capture/src/report.rs`
  (new), `crates/capture/src/lib.rs`, `crates/capture/tests/render.rs`
  (new), `crates/capture/tests/support/mod.rs` (new: probes and the pixel
  digest used by later milestones)
- Pre-authorised: none.

## Contract

```rust
// lib.rs
pub struct CaptureOutput { pub image: Vec<u8>, pub report: String }   // report: JSON text
/// threads: 0 means min(available_parallelism, 8).
pub fn render_scene(scene: &[u8], format: ImageFormat, threads: usize) -> Result<CaptureOutput, CaptureError>;
/// The same without encoding: 8-bit RGB, row-major, for tests and other hosts.
pub fn render_rgb(scene: &Scene, threads: usize) -> Result<(Vec<u8>, Report), CaptureError>;

// report.rs
pub enum BodyState { Drawn, Hidden, Absent, Outside, Empty, Unknown }
pub struct BodyReport { pub state: BodyState, pub emptied_by_step: i32, pub open: bool }
pub struct Analysis { pub cell: f64, pub candidates: u32, pub checked: u32,
  pub unchecked: Vec<(u32, u32)>, pub unchecked_count: u32 }
pub struct PairReport { pub a: u32, pub b: u32, pub volume: f64, pub min: [f64; 3], pub max: [f64; 3],
  pub from_view: bool, pub capped: bool }
pub struct Report { pub width: u32, pub height: u32, pub bodies: Vec<BodyReport>,
  pub analysis: Option<Analysis>, pub pairs: Vec<PairReport> }
impl Report { pub fn to_json(&self) -> String }
```

## Behavior

- Samples: `W = width * supersample`, `H = height * supersample`; the ray
  of sample `(x, y)` starts at `centre + right * ((x + 0.5 - W/2) * step) +
  up * ((H/2 - (y + 0.5)) * step)` with `step = mmPerPixel / supersample`.
- Per sample: fold every body (skip a step whose tool's screen rectangle
  does not contain the sample, except intersection steps, which then
  empty the body). Nearest body: visit bodies in order; a body replaces
  the current nearest only when its first boundary is nearer by more than
  `MERGE_EPS`, so equal depths go to the earlier body. The nearest
  boundary gives depth, body, tool and face.
- Body state in this milestone: `Drawn` when the body is nearest on some
  sample, `Hidden` when it has an interval on some sample but is never
  nearest, `Absent` when it has no interval on any sample. (M18 resolves
  `Absent` into `Outside`, `Empty` or `Unknown`.) `emptied_by_step` is
  -1, `open` false, `analysis` `None`, `pairs` empty.
- Shading (design 6.5): normal of a cap is `n`, of a side face the
  perpendicular of its edge in the sketch plane mapped through `u`, `v`;
  turn it toward the viewer; `l = normalize(0.8*forward + 0.3*right -
  0.5*up)`; `k = 0.42 + 0.58 * max(0, -(normal . l))`; colour = body
  colour * `k`. Background samples take the background colour.
- Edges (design 6.5): between a sample and its right or lower neighbour,
  - different body, tool or face id (background counts as a body): edge;
  - same ids: let `na`, `nb` be the two viewer-facing normals and `c` the
    vector between the two surface points (`lateral * step + forward *
    (depth_b - depth_a)`); edge when `na . nb < 0.8660254037844386`, or
    `(c . na)^2 > 0.25 * (c . c)`, or `(c . nb)^2 > 0.25 * (c . c)`.
  There is no absolute depth threshold. The edge sample takes the edge
  colour.
- Downsample: the mean of the `supersample^2` samples per channel, in
  `f32` sums of exactly representable values, rounded half up.
- Bands and threads: rows are processed in bands of 32 pixel rows; each
  band computes its samples plus one extra sample row below for the edge
  test; bands are distributed over `threads` scoped threads
  (`std::thread::scope`); every band writes only its own rows of the
  output and its own body flags, which are combined with OR afterwards.
  Memory is bounded by `threads * band` samples, not by the picture.
- Reference bodies, meshes and interference are not drawn here.
- `to_json`: keys in the order of design 6.3; integers as written; reals
  with `{:.3}`; states as lower-case words; no whitespace.
  `render_scene` returns the image encoded through `encode` and `report`
  = `to_json`.
- Errors: a scene the reader rejects; nothing else can fail.

## Tests (`tests/render.rs`, on the two M6 fixtures and small scenes built in code)

- Probes at pixels computed from the camera (helper `project(point) ->
  (x, y)`): a point on the plate top is lit body colour; the centre of a
  through hole seen from `top` is the background colour (cut shows
  through); the pocket floor is body colour and its rim has edge pixels;
  the puck's outline is round where the cylinder limits it and straight
  where the box does (intersect); a block in front of the plate hides it
  (hidden surfaces): the pixel shows the block's face shade, not the
  plate's, and a body fully behind another is `Hidden`, not `Absent`.
- Loop rule: in `selected-loops-top.ncs1` the ring between the circles
  of "Disc" is background and its centre is body colour; the centre of
  "Slab" is body colour (no hole).
- Grazing views (the rule that replaced the depth step): the Plate scene
  from directions `(0, 1, -0.15)` (8.5 degrees above the top face),
  `(0.3, 1, -0.09)` and `(0, 1, -0.05)`: at most 10% of the body samples
  are edge samples, the interior of the top face is the lit body shade,
  and hole pixels (background colour) exist inside the face's outline.
  The spike measured 3.4% and 3.9% against 44.7% and 31.1% for the old
  rule.
- A boss sketched on a face and a cut starting on a face show no speckle:
  inside the cut footprint from `top`, every pixel away from the rim is
  one of two flat colours. Two bodies with a common face plane built
  from different frames (one sketched on `xy` at offset 5, one on a face
  at height 5) show one body per side of their contact outline, with no
  isolated pixels of the other.
- The three visible faces of a cube in `iso` have three different
  shades; edge pixels exist between them; a cylinder side has no edge
  pixels between its facets. The edge predicate itself (a pure function
  in `shade.rs` over two samples) is tested directly: equal ids on one
  plane at any viewing angle is no edge; equal ids, parallel normals and
  a chord along the view direction is an edge (an occluding contour
  inside one face id, which prisms cannot produce and meshes can, M11);
  normals 31 degrees apart is an edge and 29 degrees is not.
- Determinism: `render_rgb` with 1, 2 and 5 threads gives equal buffers
  and equal reports; two calls give equal buffers; the FNV-1a digest of
  the Plate fixture's RGB buffer equals a committed constant (the test
  prints the new value on mismatch so an intended change is one line);
  `render_scene` twice gives equal PNG bytes and equal JPG bytes.
- Release only (`#[cfg_attr(debug_assertions, ignore = "release only")]`):
  the fixture renders on one thread in under 2,000 ms, value printed;
  2048 x 2048 renders without exceeding the band memory bound.
- Supersample 1 and 3 render; 64 x 64 renders.

## Acceptance criteria

- The fixture picture shows the cut holes, the pocket, the added boss and
  the intersect body as solids with hidden surfaces removed, proven by
  pixel probes, also from grazing directions.
- Equal bytes for any thread count, pinned by a digest.

## Verification (each must exit 0)

1. `sh -c 'CARGO_TERM_QUIET=true cargo fmt --all -- --check && CARGO_TERM_QUIET=true cargo clippy -p nodetto-capture --all-targets -- -D warnings && CARGO_TERM_QUIET=true cargo test -p nodetto-capture'`
2. `sh -c 'mkdir -p tmp/capture/m08 && CARGO_TERM_QUIET=true cargo test --release -p nodetto-capture --test render -- --nocapture > tmp/capture/m08/render.txt 2>&1 && grep -Eq "test result: ok\. [1-9][0-9]* passed; 0 failed; 0 ignored" tmp/capture/m08/render.txt'`
3. `sh -c '! grep -rnE "mul_add|\.sin\(|\.cos\(|\.tan\(|powf|powi" crates/capture/src && CARGO_TERM_QUIET=true cargo test -p nodetto-capture --test render'`

## Progress

Implemented, awaiting review. Shaded orthographic prism renders now produce
row-major RGB or PNG/JPG, with a deterministic body report. The Plate RGB
digest is `29c64b3e156d0941`; worker counts 0, 1, 2 and 5 agree.

- CAP-M7-01: for neighbours in the same body, a change in tool or face id
  does not draw an edge if the normals agree within 1e-9 and each tangent
  plane contains the chord within 1e-7 mm. This preserves depth and interval
  provenance. The rotated decimal trim matches the untrimmed plate byte for
  byte. Document the edge rule in design 6.5 by M16.
- CAP-M6-02: an orthonormal left-handed camera mirrors the view. The renderer
  uses bounded facet indices to recover normals and compares the original
  face ids as opaque values. `prism.rs` and `view.rs` are additional write
  paths for facet access and the vector cross product. Analysis flags remain
  for M10 and M17.
- A worker advances through each 32-row band with a rolling window of one
  output row's samples plus one neighbour. This uses at most 24,576 hit slots
  per worker at 2048 pixels and 3x sampling. It repeats the halo at the start
  of the next band. Workers cap at eight, including explicit requests.
- The three grazing views use the original fixture for edge coverage. A thin
  copy tests background through a hole at the lowest angle, where the
  original 5 mm plate's walls occlude the through-holes. A directly lit face
  was checked in both palettes. The isometric previews are in `tmp/capture/m08/`.
- The pre-commit release check rendered the fixture on one thread in 277 ms.
  Verification logs are `tmp/capture/m08/v1.log`, `v2.log`, `render.txt` and
  `v3.log` in the same directory.

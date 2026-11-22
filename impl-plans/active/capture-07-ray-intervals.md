# M7 capture-07-ray-intervals

- dependsOn: M6 (`Scene`, the fixture)
- Design: sections 3.3, 6.4
- writePaths: `crates/capture/src/interval.rs` (new),
  `crates/capture/src/prism.rs` (new), `crates/capture/src/view.rs` (new),
  `crates/capture/src/lib.rs`, `crates/capture/tests/intervals.rs` (new)
- Pre-authorised: none.

## Contract

```rust
// interval.rs
pub const MERGE_EPS: f64 = 1e-7;                    // mm along the ray
#[derive(Clone, Copy, PartialEq, Debug)]
pub struct Boundary { pub s: f64, pub tool: u32, pub face: u32 }
/// Sorted boundaries, even count: [enter, leave, enter, leave, ...].
pub type Intervals = Vec<Boundary>;
pub fn combine(a: &[Boundary], b: &[Boundary], op: Op, out: &mut Intervals);
/// First start and total length of the stretches where both are solid for more than `tolerance`.
pub fn overlap(a: &[Boundary], b: &[Boundary], tolerance: f64) -> Option<(f64, f64, f64)>; // (first start, last end, total length)

// view.rs: a family of parallel rays
pub struct RayFamily { pub forward: [f64; 3] }
pub struct Ray { pub origin: [f64; 3] }             // direction is the family's

// prism.rs
pub struct PrismView { /* per prism and ray family: projected direction, edge offsets, buckets */ }
impl PrismView {
  pub fn new(prism: &Prism, tool: u32, family: &RayFamily) -> PrismView;
  /// Appends the prism's intervals along the ray to `out` (cleared first). `scratch` is reused.
  pub fn intervals(&self, ray: &Ray, scratch: &mut Vec<Boundary>, out: &mut Intervals);
  /// Axis-aligned box of the prism in world coordinates.
  pub fn bounds(&self) -> ([f64; 3], [f64; 3]);
}
```

## Behavior

- `PrismView::new`: `dx = forward . u`, `dy = forward . v`, `dz = forward
  . n`. If `dx*dx + dy*dy < 1e-18` the view is along the extrusion: use
  the substitute direction `(1, 0)` in the sketch plane and remember
  `parallel`. For every loop edge store its end points, its face id and
  the offsets `ca = dx*ay - dy*ax`, `cb = dx*by - dy*bx`. Bucket the edges
  by offset range into equal bins over `[lo, hi]`; an edge is listed in
  every bin its range touches. The bin count starts at
  `min(max(1, edges), 4096)` and is halved (down to 1) until the total
  number of listings is at most `4 * edges + 4096` (design 6.4). The
  view exposes `average_occupancy()`: listings divided by non-empty bins,
  at least 1 (used by the work estimate of M12).
- `intervals`: the three steps of design section 6.4.
  - Slab from `dz` and `z0 = (origin - o) . n` with the threshold
    `|dz| <= 1e-12`; the entering boundary carries face 0 or 1 according
    to which cap is nearer along the ray.
  - `c0 = dx*y0 - dy*x0`; outside `[lo, hi]` gives no interval. In the
    bin of `c0`, an edge is crossed when `(ca > c0) != (cb > c0)`; the
    crossing parameter is `((qx - x0)*dx + (qy - y0)*dy) / (dx*dx + dy*dy)`
    with `q = a + (c0 - ca)/(cb - ca) * (b - a)`.
  - Not parallel: sort crossings by `s` (ties keep insertion order), pair
    them, clip each pair to the slab (a clipped end takes the cap's face
    id), drop pairs shorter than `MERGE_EPS`.
  - Parallel: the ray is inside when the number of crossings with
    positive parameter is odd; then the result is the slab interval.
  - An odd crossing count cannot happen for closed loops with the
    half-open test; if it does (non-finite input slipped through), the
    last crossing is dropped rather than panicking.
- `combine`: one sweep over both lists by `s` (on equal `s` the boundary
  of `a` first); the state is `in_a`, `in_b`; the result is inside when
  `in_a || in_b` (union), `in_a && !in_b` (difference), `in_a && in_b`
  (intersection). A change of the result state emits the causing boundary
  with its own tool and face; if the previous emitted boundary is within
  `MERGE_EPS`, both are removed instead (no zero-length interval, no
  zero-length gap).
- `overlap`: two-pointer walk; a stretch counts when its length exceeds
  `tolerance`.
- Only `+ - * /`, comparisons and `sqrt`; no `mul_add`. No allocation per
  ray beyond growth of the reused vectors.

## Tests (`tests/intervals.rs`, rays through the M6 fixture and small hand-made prisms)

- A box prism: a ray along +Z through the middle gives `[t0, t1]` with
  faces 0 and 1; a ray along +X gives the two side faces; a ray that
  misses gives nothing; a ray through a vertex and one along an edge line
  give an even count.
- A loop with a hole (boss of the fixture): four boundaries across the
  ring, two beside the hole.
- `selected-loops-top.ncs1`: a ray through the ring between the two
  circles of "Disc" gives nothing and one through its centre gives the
  slab; a ray through the centre circle of "Slab" gives the slab (the
  loop rule of design 6.1 arrives here already normalised).
- Bucket bound: a loop of 2,000 edges that all span the whole offset
  range has at most `4 * 2000 + 4096` listings and still returns the same
  intervals as a one-bin view.
- The parallel case equals the same ray tilted by 1e-9 within 1e-6.
- `combine`: union of touching intervals merges into one; difference of
  equal intervals is empty; difference of a prefix leaves the rest with
  the cut tool's face at the new boundary; intersection of disjoint
  intervals is empty; noise of 1e-12 on a shared boundary leaves no
  sliver; random interval lists (deterministic generator) satisfy
  `|A or B| + |A and B| = |A| + |B|` and `|A - B| = |A| - |A and B|`
  within 1e-9.
- Fixture bodies folded along chosen rays: through a hole of the plate
  from the top gives no interval; beside it `[0, 5]` in model height;
  through the pocket `[0, 3]`; through the boss ring `[0, 11]`; through
  the puck inside the cylinder gives the box height and outside the
  cylinder nothing.
- `overlap` on the plate and block along +Z at (90, 50) reports a stretch
  of length 3 and none at (20, 20).

## Acceptance criteria

- Intervals of cut and intersect results are correct on the fixture,
  including coincident faces.
- No panic for any finite input.

## Verification (each must exit 0)

1. `sh -c 'CARGO_TERM_QUIET=true cargo fmt --all -- --check && CARGO_TERM_QUIET=true cargo clippy -p nodetto-capture --all-targets -- -D warnings && CARGO_TERM_QUIET=true cargo test -p nodetto-capture'`
2. `sh -c '! grep -rnE "mul_add|\.sin\(|\.cos\(|\.tan\(|powf|powi" crates/capture/src && grep -q "forbid(unsafe_code)" crates/capture/src/lib.rs && CARGO_TERM_QUIET=true cargo test -p nodetto-capture --test intervals'`

## Progress

Implemented. Adversarial review is pending.

- Both milestone commands passed with 29 and 11 tests. Logs are in
  `tmp/capture/m07/v1-final.log` and `v2-final.log`.
- Workspace formatting, check, and Clippy passed
  (`tmp/capture/m07/repository-static.log`). The supplemental workspace
  test stopped after 49 passes and 17 Foundation write denials in
  unchanged desktop tests under the worktree-only write guard
  (`tmp/capture/m07/repository-rust.log`).
- Biome and TypeScript passed. The final unfiltered Bun run passed
  with 4,634 passes and 79 skips across 735 files
  (`tmp/capture/m07/repository-bun-settled.log`).
- Fixture correction: the boss ring extends to 13 mm (the 5 mm plate
  plus the 8 mm add), so the test expects `[0, 13]` through the ring.
- CAP-M6-02 (M7 portion): a parsed prism with a degenerate or
  non-orthonormal frame contributes no intervals. Face IDs are opaque,
  including `u32::MAX`. Camera handedness remains for M8, and analysis
  flag consistency remains for M10 and M17.

# car12-p1-mesh-volume-ownership

- planId: car12-p1-mesh-volume-ownership; wave 1; dependsOn: none
- progressPath: impl-plans/progress/car12-p1-mesh-volume-ownership.md
- Finding: `function-capture-mesh-prism-touching-face` (high).
- Design: `design-docs/specs/design-ai-capture.md` 29.1 R12-1. Follow the
  worker rules in `car12-00-overview.md`. Evidence:
  `tmp/car12-r12/car12-p1-mesh-volume-ownership/`.

## Intent and context

When a ray lies exactly on a projected mesh triangle edge, `MeshView` decides
membership with the view-dependent top-left rule `inclusive`
(`crates/capture/src/mesh.rs:110-112`, used at `:286`). Volume queries share
that rule. In the back view (forward `[0,-1,0]`), a mesh box under an
extrusion therefore owns the contact-plane ray, and so does the prism's
world-space cap rule (`crates/capture/src/prism.rs:226-243`). The result is a
false picture pair and exit 1.

Volume queries must use the prism's world-space ownership instead. Shading
keeps today's rule bit for bit.

Non-goals:
- Do not change `raster.rs`, `interference.rs`, `lattice.rs`, the NCS1 format,
  the CLI or the report types.
- Do not change `closed_by` or `is_closed` (that is p6b).
- Do not change the facet (shading) path output.
- No native parity test here (that is p7).

## Changes

- `crates/capture/src/prism.rs`: make `increases_in_world` `pub(crate)`.
  Change nothing else in the file.
- `crates/capture/src/mesh.rs`:
  - Volume membership. In `hits_impl::<false>`, used by `hits`, `intervals`
    and `first_hit`, add a separate per-triangle test, for example
    `fn volume_contains(&self, i: u32, q: [f64; 2]) -> bool`. Keep the
    triangle setup unchanged: the zero-area skip and the counter-clockwise
    `order`. For each oriented edge `(a, b)`:
    - Canonical value. `c0`, `c1` are the edge's vertex indices, lower first.
      `e' = edge(proj[c0], proj[c1], q)`, and `e = e'` when `a` is `c0`,
      else `e = -e'`.
    - Band. `err = 8 * f64::EPSILON * (|dx| + |dy|) * S`, with
      `(dx, dy) = proj[c1] - proj[c0]` and `S` the sum of the absolute
      projected coordinates of `c0`, `c1` and `q`.
    - Decision. If `e > err` the edge admits; if `e < -err` it rejects.
      Otherwise it admits only when `increases_in_world(g)`, where
      `g[k] = -(b.y - a.y) * u[k] + (b.x - a.x) * v[k]`, using this
      orientation's projected endpoints and `self.basis = [u, v]`.
  - Keep `facet_depth`'s current inside test for `FACETS = true` exactly as it
    is. Split the code so that the depth `s` computation is shared; do not
    change how `s` is computed.
  - Sensitivity. `surface_intervals` returns `true` only when `self.closed`
    and some listed triangle has an edge with `|e| <= err` (using the facet
    value of `e`) and its volume membership differs from its facet
    membership. Otherwise it returns `false`, as today. Compute the volume
    membership only for triangles with such a near-tie edge, so ordinary
    pixels cost nothing extra.
  - Update the comment above `surface_intervals`, which says the two paths
    never differ in ownership.

Pitfalls:
- Do not apply the new rule to `first_surface_hit` or `hits_impl::<true>`.
  That would change shading and goldens.
- The band must use the canonical value. Using the per-triangle facet value
  in the volume path breaks watertightness between adjacent triangles.
- Do not use `total_cmp` or `-0.0` tricks for the tie.
  `increases_in_world` already returns false for a zero gradient.
- Raster rechecks happen only when a flag is raised
  (`raster.rs:225-241`, `raster/reference.rs:81-85`). Do not edit those
  files.

## Tests

`mesh.rs` unit tests:
- New `contact_plane_rays_follow_prism_ownership`.
  - Lower box: `cube()` shifted to z in [-1, 0]. Upper box: `cube()` at
    z in [0, 1].
  - Rays lie in the plane z = 0 at x = 0.25. Back view: forward `[0,-1,0]`,
    origin y = 3. Front view: forward `[0,1,0]`, origin y = -2.
  - Lower box -> `intervals` empty in both views (the back view fails before
    the fix). `surface_intervals` gives 2 boundaries and `true` (back), and
    0 boundaries and `false` (front).
  - Upper box -> `intervals` has 2 boundaries, 1.0 apart, in both views.
    `surface_intervals` is flagged in the back view only.
- New `volume_ties_are_watertight_for_oblique_rays`.
  - The cube with forward `normalize([1,2,3])`.
  - Rays through a point of the bottom face's diagonal, offset along the
    view-plane normal of that diagonal by `k * 1e-15` mm for k in -4..=4,
    plus rays through the projected corner vertices.
  - Each ray -> an even hit count, and exactly 2 for interior rays.
  - Each boundary depth equals that same ray's analytic slab `t_enter` /
    `t_exit` for the unit cube, within 1e-12 mm. Never compare depths
    across rays.
- Rename `cube_surface_casts_are_not_ownership_sensitive` to
  `cube_surface_and_volume_casts_differ_only_at_ownership_ties`. Keep all
  five points:
  - Points `[0.25,0.25]`, `[0.5,0.5]`, `[0.75,0.25]` and `[1.5,0.5]` keep the
    equal-depth assertion and the `false` flag.
  - Point `[0,0]` -> facet output empty, flag `true`, volume depths
    `[1.0, 2.0]`.

`raster/reference.rs` fixtures module: add
`pub(in crate::raster) fn mesh_under_prism(back: bool, overlap: f64) -> Scene`.
- Copy `stacked_caps(overlap)`, but replace tool 0 with a closed 12-triangle
  outward mesh box of the same extent (origin 0, 16 x 8 x 0.9375).
- With `back`: camera forward `[0,-1,0]`, right `[-1,0,0]`, up `[0,0,1]`,
  and centre y = 12 instead of -4. Other centre components are as in
  `stacked_caps`.

`raster/tests.rs`:
- New `production_touching_mesh_caps`: call `production_touching` on
  `mesh_under_prism(false, 0.0)` and `mesh_under_prism(true, 0.0)`. The back
  variant fails before the fix.
- In `production_overlap_witness`, add `mesh_under_prism(true, 0.01)` and
  `mesh_under_prism(false, 0.01)` to the loop, each with 1 pair.

## Verification (each command exits 0 and runs tests)

1. `CARGO_TERM_QUIET=true cargo fmt -p nodetto-capture -- --check`
2. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car12-p1 cargo clippy -p nodetto-capture --all-targets -- -D warnings`
3. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car12-p1 cargo test -p nodetto-capture`
   - The log shows the three new or renamed `mesh.rs` tests and
     `production_touching_mesh_caps` passing, and every existing capture
     test passing, goldens included.
   - Before that, add the new tests first and run them before changing
     `mesh.rs`, to record the fail-before log
     (`tmp/car12-r12/car12-p1-mesh-volume-ownership/fail-before.log`).

If an existing exact work or census count changes only because of a recast,
record both values and the tie in the progress log and stop as `blocked`.
Never edit the bound.

## Done criteria

- Commands 1-3 exit 0 with the logs saved.
- `git diff --name-only` stays inside writePaths.
- `facet_depth`'s shading path is unchanged; the diff review shows only the
  new volume test, the flag and the shared depth helper.
- The progress log reads `done`.

## Implementation progress

Implementation and focused verification complete; see
`impl-plans/progress/car12-p1-mesh-volume-ownership.md`. Formal review and
integration remain downstream.

# car3-g1a-cast-flag

- planId: car3-g1a-cast-flag; planPath: impl-plans/active/car3-g1a-cast-flag.md
- progressPath: impl-plans/progress/car3-g1a-cast-flag.md
- wave: 1; dependsOn: none
- Finding: function-capture-touching-cap-interference (R3-1, high), contract C1.
- Design: `design-docs/specs/design-ai-capture.md` 21.1 R3-1 (first bullet), 21.5 C1.
- writePaths: `crates/capture/src/prism.rs`, `crates/capture/src/mesh.rs`,
  `crates/capture/src/tool_view.rs`, `tmp/car3-r3b/car3-g1a-cast-flag`,
  `impl-plans/progress/car3-g1a-cast-flag.md`, `target`, `tmp/cad3d`
- sharedPaths: none; artifactRoots: `target`, `tmp/cad3d`

Follow the worker rules in `impl-plans/active/car3-00-overview.md` (section car3-r3b).

## Intent

Shading casts (`FACETS = true`) and volume casts (`FACETS = false`) differ only inside
the volume-mode ownership band. Plan g1c needs to know, per cast, whether the ray fell
in that band, so it can recast a volume interval for the interference witness only
on those rays. This plan adds that flag. Intervals and shading do not change.

## Contract C1 (consumed by car3-g1c)

```rust
pub(crate) fn surface_intervals(&self, ray: &Ray, scratch: &mut Vec<Boundary>, out: &mut Intervals) -> bool
```
on `PrismView` (`prism.rs:253`), `MeshView` (`mesh.rs:322`) and `ToolView`
(`tool_view.rs:45`, forwards the inner value). `true` = ownership-sensitive. The
intervals written to `out` stay bit-identical to today.

## Changes

- `prism.rs`:
  - `cast::<FACETS>` returns `bool`. `intervals` ignores it, and `FACETS = false`
    always returns `false`.
  - Move the cap-band error formula of `slab::<false>` (`prism.rs:228-231`) into one
    private helper, for example `fn cap_error(&self, offset: [f64; 3], lo: f64, hi: f64) -> f64`.
    Call it from both `slab::<false>` and the flag, so the band is bit-identical.
  - In `FACETS = true`, compute the volume terms exactly as lines 299-304 do for
    `FACETS = false`: `error_v = 8 * EPSILON * sum|offset|`,
    `c_error_v = (|dx| + |dy|) * error_v`. The flag is true when any of these holds:
    1. `dz.abs() <= 1e-12`, `z` is finite, and `min(|z - lo|, |z - hi|) <= cap_error`;
    2. for any edge in `buckets.at(c)`, `|ca - c| <= c_error_v` or `|cb - c| <= c_error_v`.
       Test this before the `after_ray` skip, because volume mode can keep an edge that
       facet mode skips;
    3. `parallel`, and a crossing edge has `|qx - x| <= error_v`.
  - Return the cap-band flag when `slab` returns `None`, including rays just outside a cap.
  - Leave every existing statement that produces `out` and `scratch` unchanged.
- `mesh.rs` `MeshView::surface_intervals`: return `false` always. Add a doc comment:
  `hits_impl::<false>` and `::<true>` differ only in `face` (mesh.rs:313), so a mesh
  has no ownership-sensitive case.
- `tool_view.rs` `ToolView::surface_intervals`: return the inner `bool`.

## Pitfalls

- Do not change `slab`, the `after_ray`, `fraction` or `side` results in either mode.
  Shading pixels must stay identical. Existing goldens are the guard.
- Do not add `#[must_use]`. The callers `raster.rs:186`, `raster/reference.rs:72` and
  `mesh.rs:549,565` ignore the value and must still compile untouched (no edits there).
- Do not touch `raster.rs`, `raster/*`, `interference.rs` or `overlay.rs`.
- Compute the flag without allocation, and without extra passes beyond the existing
  bucket loop.

## Tests (inline `#[cfg(test)] mod tests` in prism.rs and mesh.rs)

Use a box prism: `u = x`, `v = y`, `n = z`, rectangle profile, `faces [2, 3, 4, u32::MAX]`
(as in `raster/tests.rs:box_tool`), 16 x 8 mm, z from 0 to 0.9375.
- Front family `forward [0, 1, 0]`, ray origin z = 0.9375 (top cap plane) -> `true`.
  z = 0 -> `true`. z = 0.5 with x = 4 -> `false`, and `surface_intervals` `s` values
  equal the `intervals` `s` values.
- Top family `forward [0, 0, -1]`. Box with `o [8, 8, 0]`, `u [-1, 0, 0]`,
  `v [0, -1, 0]` (opposed frame, world x 0..8). Ray at x = 8 -> `true`. Ray at x = 4,
  y = 4 -> `false` with equal `s`.
- Side family `forward [1, 0, 0]`, ray at local y = 0 (a profile vertex row),
  z = 0.5 -> `true` (endpoint band). y = 4 -> `false`.
- Oblique family (normalized `[0.3, 0.4, -0.866]`) through the box middle -> `false`,
  with equal `s` lists.
- `mesh.rs`: the closed `cube()` (mesh.rs:381) -> `surface_intervals` returns `false`
  for five rays, including one through a vertex, with `s` equal to `intervals`.

Fail-before: these tests do not compile before the change because the methods
return `()`. Record that compile failure as the before-state in the progress log.

## Verification (exit 0, runs tests)

1. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car3-g1a-cast-flag cargo clippy -p nodetto-capture --all-targets -- -D warnings && CARGO_TERM_QUIET=true cargo fmt -p nodetto-capture --check && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car3-g1a-cast-flag cargo test --release -p nodetto-capture`
   -> all crate tests pass, including the new flag tests and every existing golden
   in `crates/capture/tests`. Record the pass count.

## Done criteria

- All three `surface_intervals` return `bool` with the C1 semantics. No other file edited.
- The new tests exist and pass, and the existing crate tests pass unedited.
- Progress log `done`, with pre/post sha256, commands, exit codes and log paths under
  `target/car3-g1a-cast-flag/logs/`.

## Implementation status

Done: C1 source and tests implemented; the amended crate gate passed with 168
tests and the per-plan stray delta is empty. See the progress log. Formal reviews
and the absolute integration scan remain downstream.

## Amendment 2026-11-25 (blocked-wave-scope-or-contract, round 1)

- Blocker: the absolute stray-test scan found 753 inventoried round-1 copies under
  `tmp/car1-r1/`. This plan does not own them, and it still must not write
  `tmp/car1-r1/*`.
- Decision: the per-plan stray condition is the plan-delta scan, which is the last
  `verification` entry in the manifest and overview rule 9. It writes
  `tmp/car3-r3b/car3-g1a-cast-flag/stray-delta.txt`. It must exit 0, and that file
  must be empty.
- Resume (no new code): (1) Rerun the crate gate in a fresh read; if `git diff`
  shows a sibling's in-progress file, follow rule 10. (2) Run the delta scan.
  (3) In the progress log, record the gate command, exit code, test count and log
  path, the delta-scan command, exit code and the empty `stray-delta.txt`, and
  post-gate sha256 of `prism.rs`, `mesh.rs`, `tool_view.rs`. (4) Set the status to
  `done`.
- The absolute scan remains an integration gate owned by the checkpoint operator.
  Do not report it as this plan's blocker.

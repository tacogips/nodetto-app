# car5-f3-lattice-scan

- planId: car5-f3-lattice-scan; wave 1; dependsOn: none
- planPath: impl-plans/active/car5-f3-lattice-scan.md
- progressPath: impl-plans/progress/car5-f3-lattice-scan.md
- Finding: performance-interference-mesh-triangle-scans (R5-3, high).
- Design: `design-docs/specs/design-ai-capture.md` 23.1 R5-3, 23.3, 23.5.
- writePaths: `crates/capture/src/lattice.rs`, `crates/capture/src/tool_view.rs`,
  `crates/capture/tests/interference.rs`, `tmp/car5-r5/car5-f3-lattice-scan`,
  `impl-plans/progress/car5-f3-lattice-scan.md`, `target`, `tmp/cad3d`
- sharedPaths: none; artifactRoots: `target`, `tmp/cad3d`

Follow the worker rules in `impl-plans/active/car5-00-overview.md`.

## Intent and context

`AxisFold::cast` (`lattice.rs:244-266`, pair sampler) and the census cast in
`sample_body_axis_with` (`lattice.rs:725-745`) call `ToolView::intervals` before any
charge; `BoundaryBudget::charge(current.len())` is zero for the first step of a body, so
a dense mesh bin (`mesh.rs:278`) is scanned unbounded (>1.31e9 visits for stacked
plates). Charge the projected scan cost before each scan.

Non-goals: no edit to `mesh.rs` (owned by f4), `census.rs`, `interference.rs`, `lib.rs`,
`report.rs`, `raster*`, `prism.rs`; no new public field on `AxisSample`; no report change.

## Changes

`lattice.rs`:
- `const SCAN_ENTRIES_PER_WEIGHTED_RAY: u64 = 1_024;`
- `BoundaryBudget` gains `scans: u64` and
  `fn charge_scan(&mut self, count: usize) -> bool`: allowance
  `SCAN_ENTRIES_PER_WEIGHTED_RAY * weight * (rays + 16)` with saturating ops (imitate
  `BoundaryBudget::charge`, `lattice.rs:29-41`); over -> `exhausted = true`, return false.
- In both casts, for every view that passed the bounds test: call
  `view.scan_cost(&ray)` and `charge_scan` immediately before `intervals` (including
  scans whose intervals turn out empty). On false take the existing exhaustion exit:
  `return Stretch::default()` in `AxisFold::cast`; `return (false, false, true)` in the
  census closure.
- New `#[cfg(test)] mod scan_tests` at the end of `lattice.rs`.

`tool_view.rs`:
- `#[cfg(test)]` thread-local `Cell<u64>` counter plus `pub(crate)` test helpers to
  reset/read it; `ToolView::intervals` (`tool_view.rs:75`) adds `self.scan_cost(ray)`
  under `#[cfg(test)]` only. Production code unchanged.

## Pitfalls

- Reuse the `exhausted` flag; do not add a new exhaustion path. Propagation to
  `capped` / `cappedWithoutHit` / census `unknown` already exists
  (`interference.rs:257-281`, `census.rs:86-104`).
- Charging must not depend on thread scheduling: it is per pair / per body-axis in ray
  order.
- If an existing crate test changes output, stop and report `blocked`; never edit that
  test and never raise the constant to where the new regression stops failing before.
- Do not touch `raster.rs` scan budget (`raster.rs:29`).

## Tests

Step 1 (before any production edit): add the admitted pin test in `tests/interference.rs`
and record its literals on the unmodified tree (log the run). Scene: two overlapping
`support::cube_mesh`-style 12-triangle meshes, analysed (imitate `two()` at
`tests/interference.rs:33`). Pin: pair volume (exact as printed), the complete
`render_parsed` report JSON string, and `support::digest` of the RGB (or of the PNG
bytes). After the change, 1 and 5 threads give exactly those literals.

`lattice.rs` `scan_tests` (test thread, counter reset before each call):
- Fixture: two closed mesh tools, each a stack of 2,048 coincident 10 x 10 mm boxes
  0.01 mm thick (every Z-axis bin >= 8,192 entries), sized so the unbounded scan would
  exceed 10x the bound.
- `sample_pair` on the two bodies (build `loops`, `tools`, `ViewCache` as
  `sample_axis` does at `lattice.rs:595-610`) -> visited entries
  <= `1_024 * weight * (rays + 16)` and < 1,000,000; some axis `capped`. Fails before.
- `sample_body_axis_with` on one stacked body -> same bound; `capped`. Fails before.
- Two overlapping cube meshes -> not capped; volume and bounds equal the expected box
  within the existing interference tolerance.

`tests/interference.rs` multi-pair (worker path needs >= 2 checked pairs and threads > 1,
`interference.rs:342`): dense stacked-plate pair plus a separate overlapping cube-mesh
pair.
- `render_parsed` with 1 and 5 threads -> identical report JSON and image bytes.
- dense pair capped (`cappedCount >= 1`, dense pair in `cappedWithoutHit` or a capped
  pair entry); cube pair not capped.

## Verification (each exits 0 and runs tests)

1. `rustfmt --edition 2021 crates/capture/src/lattice.rs crates/capture/src/tool_view.rs crates/capture/tests/interference.rs && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car5-f3-lattice-scan cargo clippy -p nodetto-capture --all-targets -- -D warnings && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car5-f3-lattice-scan cargo test --release -p nodetto-capture`
   - evidence: pinned literals recorded before; scan_tests fail before (log) and pass
     after; full crate suite including goldens and determinism passes.

`crates/capture/Cargo.toml` sets edition 2021. A compile failure from f4's in-progress `mesh.rs` edit is
rerun after f4 is `done`.

## Done criteria

- Bounds hold with recorded counts; pins equal at 1 and 5 threads; crate suite green;
  progress log `done`.

## Implementation status

- Scan charging, bounded regression, pre-change pins, and multi-pair determinism are implemented.
- The full release suite passes serially. The exact default-parallel gate remains open:
  the existing `tiles::tests::many_tools_exceed_limit_within_budget` deadline failed
  three times and passed in isolation. See the plan-local progress log for evidence.

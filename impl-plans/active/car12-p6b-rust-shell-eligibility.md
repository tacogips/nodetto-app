# car12-p6b-rust-shell-eligibility

- planId: car12-p6b-rust-shell-eligibility; wave 2; dependsOn:
  car12-p1-mesh-volume-ownership (shared `crates/capture/src/mesh.rs`)
- progressPath: impl-plans/progress/car12-p6b-rust-shell-eligibility.md
- Finding: `maintainability-capture-touching-shell-mesh-eligibility` (high),
  the Rust closure and decoder.
- Design: `design-docs/specs/design-ai-capture.md` 29.1 R12-6, the same
  contact path as p6a, implemented independently in Rust. Follow the worker
  rules in `car12-00-overview.md`. Evidence:
  `tmp/car12-r12/car12-p6b-rust-shell-eligibility/`.

## Intent and context

`closed_by` (`crates/capture/src/mesh.rs:22-68`) rejects any edge with three
or more uses. It drives the picture closure (`is_closed`, through
`tool_view.rs:123`) and step 1 of `target_eligible`
(`crates/capture/src/nmesh.rs:229-288`). Implement the same contact path as
p6a, independently. Keep the fast path unchanged.

Non-goals:
- Do not change the p1 volume rule in `mesh.rs`. Re-read the file fresh:
  p1 has edited it.
- No change to `tool_view.rs`, `scene.rs`, NCS1 or `closure_count.rs`.
- Do not copy the TypeScript code; follow the design steps.

## Changes

`crates/capture/src/mesh.rs`, `closed_by`:
- Fast path. If no edge has three or more uses, behave exactly as today
  (two uses each, no direction or duplicate check).
- Contact path (a separate private function), returning false at the first
  failure:
  - Integer domain: for every coordinate `v` of every vertex referenced by a
    triangle, `k = (v * UNITS_PER_MILLIMETRE).round()` must be finite,
    within the NMESH coordinate limit, and
    `(k as f64 / UNITS_PER_MILLIMETRE).to_bits() == v.to_bits()`. Reuse the
    decoder's constant; import it from `nmesh.rs`, or move it into a shared
    place inside this crate if needed.
  - Then run, in `i128`, the same steps as p6a: C1 balance; zero normal ->
    false before the gcd; plane key and side; patches; matching with the
    at-least-4-uses boundary rule; Attachment (exactly two opposite
    remaining uses on every cancelled boundary edge); no remaining repeated
    triple; C3 shells; C4 per-shell use and same-sign non-zero volume; C5
    disjoint integer boxes.
  - Count `CLOSURE_EVALUATIONS` once per call, as today.

`crates/capture/src/nmesh.rs`, `target_eligible`:
- It keeps calling `closed_by` first.
- On the contact path, replace today's pairwise-direction check with C1's
  two-use direction rule, and today's duplicate-face rejection with nothing,
  because `closed_by` already enforces the duplicate rule there. Then apply
  emptiness (d) unchanged.
- The fast path is byte-for-byte today's logic and `AllocStats` counting.

Pitfalls:
- `closed_by` also sees raw NCS1 meshes. Never use the plane arithmetic
  before the Integer domain check passes.
- Never divide by a zero gcd.
- Do not panic on any input: no `unwrap` on arithmetic. Use `checked_*` or
  `i128`, which is wide enough for 2^31 coordinates.

## Tests

`crates/capture/tests/mesh.rs`:
- Use the p6a fixture coordinates (in millimetres), built as raw
  index and position arrays.
- `closed_by` is true for edge contact, face contact, crossed-diagonal face
  contact and separated shells.
- `closed_by` is false for open triangle, unbalanced, welded overlap,
  double-sided fin and coincident shells.
- Off-grid raw `Mesh`: two closed boxes 0.0004 mm wide sharing a vertical
  edge, with triangles like (0,0,0), (0,0.0004,0), (0.0004,0,0) ->
  `is_closed` and `closed_by` are false, with no panic.

`nmesh.rs` unit tests: imitate the existing decoder tests near `:520-540`.
Encode the nine p6a meshes as NMESH and assert that `target_eligible`'s
booleans, through `decode_inline_with` or the existing test seam, equal the
TypeScript results: true for edge, face, crossed-diagonal and separated;
false for the others.

## Verification (each command exits 0 and runs tests)

1. `CARGO_TERM_QUIET=true cargo fmt -p nodetto-capture -- --check`
2. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car12-p6b cargo clippy -p nodetto-capture --all-targets -- -D warnings`
3. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car12-p6b cargo test -p nodetto-capture`
   - The new tests pass, along with all existing capture tests, p1's tests
     and `closure_count.rs`.
   - Also save a fail-before log of the new contact tests
     (`tmp/car12-r12/car12-p6b-rust-shell-eligibility/fail-before.log`).

## Done criteria

- Commands 1-3 exit 0.
- `git diff --name-only` stays inside writePaths, and the progress log
  reads `done`.

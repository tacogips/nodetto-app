# car14-p2a-rust-attachment-sides

- planId: car14-p2a-rust-attachment-sides; wave 1; dependsOn: none
- progressPath: impl-plans/progress/car14-p2a-rust-attachment-sides.md
- Finding: `maintainability-capture-face-contact-hides-shell-overlap`
  (high), Rust half.
- Design: `design-docs/specs/design-ai-capture.md` 31.1 R14-2 (step C2b
  and its fixtures), plus 29.1 R12-6 C1 to C6.
- Worker rules: `car14-00-overview.md`.
- Evidence: `tmp/car14-r14/car14-p2a-rust-attachment-sides/`.

## Intent and context

`contact_checked` (`crates/capture/src/mesh_contact.rs:80`) cancels
matched face patches (`:214-243`), records their rim edges in
`attachment` (`:232`), then joins every edge with two remaining uses
(`:269-274`). The rim edges of a cancelled face have exactly two
remaining uses, so a bracket and a block that touch at X = 10 merge into
one shell. C5 (`:310-333`) then never compares them, even though they
also overlap elsewhere.

Add C2b: before the rim edges are joined, each attachment edge's two
sides must be different components whose integer boxes have disjoint
interiors.

Non-goals:
- Do not touch `mesh.rs`, `tool_view.rs`, `lib.rs`, the TypeScript
  decoder, the fast path, C1, C2, the Attachment check, C4, C5 or C6.
- Do not change `nmesh.rs` production code. `target_eligible` inherits
  the result through `closed_by`; only unit tests are added.
- Share no code with TypeScript. Expected booleans are written literally.

## Changes

1. `mesh_contact.rs`, in `contact_checked`. After the duplicate-face loop
   (`:259-268`) and the `parent` reset (`:269`), replace the single join
   loop with three steps:
   1. Join across every `remaining` edge with exactly two uses whose key
      is not in `attachment`.
   2. C2b:
      - For each non-cancelled triangle, fold its three integer points
        (`points`) into a per-root box. Use a `BTreeMap<usize, (Point, Point)>`
        keyed by `find(&mut parent, i)`.
      - For each edge in `attachment`, take its two remaining uses `u0`
        and `u1` (the Attachment check already guarantees exactly two),
        then `x = find(u0.0)` and `y = find(u1.0)`.
      - Return `Some(false)` if `x == y`.
      - Return `Some(false)` if `!(0..3).any(|k| bx.max[k] <= by.min[k] || by.max[k] <= bx.min[k])`
        (the C5 expression).
   3. Join across the attachment edges (two uses each). The union-find is
      then identical to today's, so C3 to C5 run unchanged.

   Allocations happen only on this contact path. Use checked arithmetic
   only where it already applies; box comparisons need no arithmetic.
2. `mesh_contact.rs` tests module:
   - Add a `prism(&mut self, outline: &[[f64; 2]], tops: &[[usize; 3]], z0: f64, z1: f64)`
     method to `Mesh`, with this layout:
     - outline vertex i at `z0` and at `z1`;
     - each top triangle `[a, b, c]` at `z1` as listed;
     - at `z0`, the same triangles with reversed winding;
     - each outline edge `a -> b` (cyclic) gives the side triangles
       `(a0, b0, b1)` and `(a0, b1, a1)`.
   - Add the fixtures below and the unit tests listed under Tests.
3. `crates/capture/tests/mesh.rs`: add the same `prism` method to its
   `ContactFixture` (`:271`). Add a test `bracket_contact_with_overlap_is_not_closed`
   that calls `assert_closed(false, ...)` for both triangulations. That
   covers `closed_by` and `is_closed`; check that `assert_closed` calls
   both, and if it does not, call both explicitly.
4. `crates/capture/src/nmesh.rs` tests module, on `ContactFixture`
   (integer units of 1000 per mm, `:476`):
   - add `prism`;
   - add a test `bracket_contact_is_not_a_target` that encodes each
     bracket triangulation like `contact_decoder_target_eligibility`
     does (`:689`) and asserts `boolean_target == Some(false)`.
   Leave `contact_fixtures()` unedited.

## Fixtures (mm; write the data literally in each file)

- Bracket outline, counter-clockwise, with area 74:
  P0 (0,0), P1 (10,0), P2 (10,2), P3 (2,2), P4 (2,5), P5 (15,5),
  P6 (15,1), P7 (18,1), P8 (18,7), P9 (0,7).
  - Top triangles: (0,1,2), (0,2,3), (0,3,4), (0,4,9), (9,4,5), (9,5,8),
    (5,6,7), (5,7,8). All are counter-clockwise, and their areas sum
    to 74.
  - Z 0..5. That gives 36 triangles.
- Block: the 12-triangle outward box [10,20] x [0,2] x [0,5]. In total,
  48 triangles.
- The bracket side split above gives the X = 10 face the diagonal
  (10,0,0)-(10,2,5).
  - Triangulation A: the block's X = 10 face uses the same diagonal.
  - Triangulation B: the other diagonal, (10,2,0)-(10,0,5).
  - Choose the `cube` `crossed` flag that produces each diagonal, and
    assert it in a comment.
- Slit ring outline, as a vertex sequence:
  Q0 (0,0), Q1 (10,0), Q2 (10,10), Q3 (0,10), Q4 (0,5), Q5 (3,5),
  Q6 (3,7), Q7 (7,7), Q8 (7,3), Q9 (3,3), then Q5 and Q4 again. That is
  12 outline edges, including Q4->Q5 and Q5->Q4.
  - Top triangles: (0,1,8), (0,8,9), (1,2,7), (1,7,8), (2,3,6),
    (2,6,7), (3,4,5), (3,5,6), (4,0,9), (4,9,5). The area is 84.
  - Z 0..5, giving 44 triangles. The `prism` helper must take the
    outline as an index sequence, so repeated vertices stay welded.
- Guard: the bracket plus a block at [20,30] x [0,2] x [0,5], sharing no
  vertex.

## Tests

- Bracket, triangulations A and B: `contact_closed` is false;
  `closed_by` and `is_closed` are false; `boolean_target` is
  `Some(false)`.
- Slit ring: `contact_closed` is false.
- Guard: `contact_closed` is true.
- Unedited and passing:
  - the nine R12-6 classifications (`tests/mesh.rs:351`, the
    `mesh_contact.rs` unit tests);
  - `contact_decoder_target_eligibility`;
  - `welded_edge_contact_is_closed`;
  - `strip_contact_is_near_linear`;
  - `closure_count.rs`.
- Fail-before:
  - Before change 1, the bracket and slit-ring tests must fail, because
    each classifies as true. Save the log as `fail-before.log`.
  - If the slit ring is false before the fix, the fixture is wrong
    (check the winding and side quads); fix the fixture.

Pitfall: do not decide by the box of the merged final shell. Decide by
the components built without the attachment edges.

## Verification (each exits 0)

1. `CARGO_TERM_QUIET=true cargo fmt -p nodetto-capture -- --check`
2. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car14-p2a cargo clippy -p nodetto-capture --all-targets -- -D warnings`
3. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car14-p2a cargo test -p nodetto-capture --lib -- mesh_contact:: nmesh:: mesh::`
4. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car14-p2a cargo test -p nodetto-capture --test mesh --test closure_count`

## Done criteria

- Commands 1-4 exit 0, and the new tests are listed as passed.
- `fail-before.log` is saved.
- The diff touches only `mesh_contact.rs`, the `nmesh.rs` tests module,
  `tests/mesh.rs`, and this plan's progress and evidence files.
- The progress log reads `done`.

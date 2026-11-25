# car13-p4a-contact-module

- planId: car13-p4a-contact-module; wave 1; dependsOn: none
- progressPath: impl-plans/progress/car13-p4a-contact-module.md
- Finding: `maintainability-capture-touching-shell-mesh-eligibility`
  (high), module part.
- Design: `design-docs/specs/design-ai-capture.md`:
  - 30.1 R13-4 rule 1 (module and staging);
  - 29.1 R12-6 C1 to C5 and the grid-domain sub-step, which define the
    algorithm.
- Worker rules: `car13-00-overview.md`.
- Evidence: `tmp/car13-r13/car13-p4a-contact-module/`.

## Intent and context

Add the Rust contact-closure algorithm as a standalone module, compiled
only for tests in this plan. car13-p4b wires it into `closed_by` and
registers it for production.

The independent TypeScript implementation (`packages/io/src/nmesh/capture-decoder.ts`,
contact path landed by car12-p6a) shows the step order. Re-implement it;
do not translate shared helpers or import anything from TS.

Non-goals:
- No change to `mesh.rs`, `closed_by`, `target_eligible` or any production
  caller.
- No production registration in `lib.rs`.

## Changes

1. New `crates/capture/src/mesh_contact.rs`:
   - Entry point:
     `pub(crate) fn contact_closed(vertex_count: usize, triangles: &[u32], position: impl Fn(usize) -> [f64; 3]) -> bool`.
   - It returns false at the first failed step, in this order:
     1. Basic: `triangles` non-empty, a multiple of 3, and indices below
        `vertex_count`.
     2. Grid domain:
        - for every coordinate `v` of each referenced vertex,
          `k = (v * UNITS_PER_MILLIMETRE).round()`;
        - require `k` finite and `k.abs() <= COORDINATE_LIMIT as f64`;
        - require `(k as i64) as f64 / UNITS_PER_MILLIMETRE == v` bit for
          bit.
        - Keep the integer `i64` triples.
     3. C1: every undirected edge has an even use count. An edge with three
        or more uses has equal `(u, v)` and `(v, u)` counts.
     4. C2:
        - integer normal `(b - a) x (c - a)` in i128 with `checked_*`; a zero
          normal returns false;
        - reduce by the gcd of the components;
        - the plane key is the reduced normal with its first non-zero
          component positive, plus the offset `n . a`; record the side as
          +1 or -1;
        - patches: union-find within (key, side) across edges used exactly
          twice, in opposite directions, inside the group;
        - boundary: the multiset of directed edges not cancelled inside the
          patch;
        - match opposite-side patches of the same key whose boundaries are
          exact reverses, using a sorted canonical key, each patch at most
          once, in patch order;
        - cancel a pair only if every boundary edge has at least 4 input
          uses; a matched pair with any 2-use boundary edge returns false;
        - Attachment: after all cancellations, each boundary edge of every
          cancelled patch must have exactly 2 remaining uses, one per
          direction;
        - a remaining duplicate vertex triple returns false.
     5. C3: shells are union-find components of the remaining triangles,
        joined across edges with exactly 2 remaining uses.
     6. C4: at every contact edge (4 or more remaining uses), each shell
        using it uses it exactly once per direction. Every shell's integer
        signed volume (the sum of `a . (b x c)` in i128) is non-zero, and
        all shells have the same sign.
     7. C5: for every contact edge and every two distinct shells on it,
        their integer vertex boxes have disjoint interiors on at least one
        axis (`maxA <= minB || maxB <= minA`).
   - Any `checked_*` overflow returns false. There is no `unwrap` or panic
     path.
   - Allocation happens only inside this function.
2. `crates/capture/src/lib.rs`: add `#[cfg(test)] mod mesh_contact;`. This
   staging keeps the non-test library free of dead code under clippy
   `-D warnings`. car13-p4b changes it to `mod mesh_contact;`.
3. `crates/capture/src/nmesh.rs`: make `UNITS_PER_MILLIMETRE` (`:11`) and
   `COORDINATE_LIMIT` (`:10`) `pub(crate)`. Do not change their values and
   make no other edit.

Pitfalls:
- Do not compare floats in C2 to C5; use only the integer triples.
- Coincident opposite cubes cancel face by face. The Attachment check must
  then reject them even when a third disjoint cube survives.
- A double-sided fin matches but has 2-use boundary edges, so it must
  return false.
- The welded overlap passes C1 to C4 and must fail only at C5.

## Tests (`#[cfg(test)] mod tests` inside `mesh_contact.rs`)

Build welded fixtures with a small test helper that deduplicates vertices
by exact coordinates. Box geometry is in design 29.1 R12-6 "Fixtures"; use
12 outward triangles per box from one shared corner order.

- Edge contact: A [0,10]x[0,10]x[0,5], B [10,20]x[10,20]x[0,5] -> true.
- Face contact: B at [10,20]x[0,10]x[0,5] -> true.
- Crossed-diagonal face contact: B's shared face split along the other
  diagonal -> true.
- Welded overlap: [0,10]^2 x [0,5] and [0,6]^2 x [0,5] sharing the edge at
  x = 0, y = 0 -> false.
- Coincident shells: a unit cube, its reversed copy and a disjoint cube at
  x 2..3 -> false.
- Zero-normal integer triangle, on the grid:
  - Start from the edge-contact fixture. Append three collinear vertices
    p = (30,0,0), q = (31,0,0), r = (32,0,0) mm and the two triangles
    (p,q,r) and (p,r,q).
  - Each new edge then has exactly two uses, in opposite directions, so
    the grid check and C1 pass.
  - Call `contact_closed` directly (closed_by's float area check would
    reject it earlier) -> false at C2's zero-normal check, before any gcd,
    with no panic.
  - An off-grid input is not a zero-normal test, because the grid-domain
    step rejects it first. The 0.0004 mm off-grid control belongs to
    car13-p4b (`tests/mesh.rs`).
- Grid domain: the edge-contact fixture with one coordinate shifted by
  0.0004 mm -> false.
- Overflow scale: coordinates near `COORDINATE_LIMIT / 1000` mm on a contact
  mesh -> no panic (either result is allowed; assert it completes).

## Verification (each exits 0)

1. `CARGO_TERM_QUIET=true cargo fmt -p nodetto-capture -- --check`
2. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car13-p4a cargo clippy -p nodetto-capture --all-targets -- -D warnings`
3. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car13-p4a cargo test -p nodetto-capture --lib mesh_contact`
   - The 8 tests are listed as passed.
   - Use `--lib` because `welded_edge_contact_is_closed` fails until p4b.

## Done criteria

- Commands 1-3 exit 0.
- `lib.rs` has only the `#[cfg(test)]` declaration.
- `nmesh.rs` changed only those two visibilities.
- The diff stays inside writePaths.
- The progress log reads `done`.

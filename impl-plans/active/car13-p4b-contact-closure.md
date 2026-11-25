# car13-p4b-contact-closure

- Implementation status: done; formal review pending.

- planId: car13-p4b-contact-closure; wave 2; dependsOn:
  car13-p4a-contact-module
- progressPath: impl-plans/progress/car13-p4b-contact-closure.md
- Finding: `maintainability-capture-touching-shell-mesh-eligibility`
  (high), closure part.
- Design: `design-docs/specs/design-ai-capture.md` 30.1 R13-4 rules 1-2
  and R12-6.
- Worker rules: `car13-00-overview.md`.
- Evidence: `tmp/car13-r13/car13-p4b-contact-closure/`.

## Intent and context

`closed_by` (`crates/capture/src/mesh.rs:22-67`) returns false at any
third use of an edge (`:59-63`). Route meshes that have an edge with three
or more uses to `mesh_contact::contact_closed`, and register the module for
production in the same change.

`is_closed` (`:10-20`) gains the path through `closed_by`.

Non-goals:
- No change to the volume and facet rules of car12-p1 in `mesh.rs`.
- No change to `target_eligible`; that is car13-p4c.
- No change to `tool_view.rs` or `scene.rs`.
- Do not edit `welded_edge_contact_is_closed` or `closure_count.rs`.

## Changes

1. `crates/capture/src/lib.rs`: replace `#[cfg(test)] mod mesh_contact;`
   with `mod mesh_contact;`. Re-read the file fresh first; p4a wrote it.
2. `crates/capture/src/mesh.rs`, in `closed_by`'s sorted-edge loop:
   - When `edges[i] == edges[i + 2]` (a third use), return
     `crate::mesh_contact::contact_closed(vertex_count, triangles, &position)`.
     Pass by reference so `position` is not moved.
   - Every other early `return false` and the fast path stay byte-for-byte
     as they are.
   - `CLOSURE_EVALUATIONS` is still incremented exactly once per call. The
     contact path must not call `closed_by` again.

Pitfalls:
- Do not add allocations or a pre-scan to the fast path.
- A group of 3 uses must go to the contact path; C1 rejects it there.
  Do not special-case it in `mesh.rs`.

## Tests (`crates/capture/tests/mesh.rs`)

Public API only: `nodetto_capture::mesh::{closed_by, is_closed}` and
`nodetto_capture::scene::Mesh`. Build welded fixtures as raw position and
index arrays, with the same nine meshes as design 29.1 R12-6 "Fixtures".
Add a local dedup helper.

- `closed_by` and `is_closed` are true for edge contact, face contact,
  crossed-diagonal face contact and the separated control (box B at
  x 12..22). Each accept case except separated fails before the fix.
- Both are false for:
  - the open triangle (box A plus one extra triangle on an edge of A);
  - the unbalanced edge (one B triangle at the shared edge reversed);
  - the welded overlap;
  - the double-sided fin (corners (10,10,0), (10,10,5), (13,7,5),
    (13,7,0); the two sides use different diagonals and opposite winding);
  - the coincident shells.
- Off-grid raw mesh: two closed boxes 0.0004 mm wide sharing a vertical
  edge, as a raw `Mesh`. `is_closed` and `closed_by` return false with no
  panic.
- The existing `welded_edge_contact_is_closed` passes unedited.

## Verification (each exits 0)

1. `CARGO_TERM_QUIET=true cargo fmt -p nodetto-capture -- --check`
2. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car13-p4b cargo clippy -p nodetto-capture --all-targets -- -D warnings`
3. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car13-p4b cargo test -p nodetto-capture`
   - This is the full crate, including `tests/mesh.rs`,
     `closure_count.rs`, car13-p1's tests and car13-p4a's module tests.

## Done criteria

- Commands 1-3 exit 0.
- The fail-before log is saved.
- The diff stays inside writePaths.
- The progress log reads `done`.

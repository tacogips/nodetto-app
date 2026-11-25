# car13-p4c-contact-eligibility

- Implementation status: done; formal review pending.

- planId: car13-p4c-contact-eligibility; wave 3; dependsOn:
  car13-p4b-contact-closure
- progressPath: impl-plans/progress/car13-p4c-contact-eligibility.md
- Finding: `maintainability-capture-touching-shell-mesh-eligibility`
  (high), native eligibility part.
- Design: `design-docs/specs/design-ai-capture.md` 30.1 R13-4 rule 3 and
  R12-6 C6.
- Worker rules: `car13-00-overview.md`.
- Evidence: `tmp/car13-r13/car13-p4c-contact-eligibility/`.

## Intent and context

`target_eligible` (`crates/capture/src/nmesh.rs:231-288`) calls `closed_by`
first. It then rejects any sorted edge pair that is not a matching pair
with opposite directions (`:257-263`) and any duplicate vertex triple
(`:266-268`). After p4b, `closed_by` accepts welded contacts, but these
checks still reject them. The native decoder's `boolean_target` therefore
stays false, and native capture skips the cut (`cad.body.missing`).

Non-goals:
- No change to `closed_by`, `mesh_contact.rs`, the decoder format,
  `AllocStats` semantics, or the emptiness test (d) at `:270-287`.
- No TypeScript edits.

## Changes (`crates/capture/src/nmesh.rs`)

1. After `closed_by` succeeds, walk the sorted `(min, max, a < b)` edges in
   groups of equal `(min, max)`:
   - a group of size 2: today's rule (opposite directions);
   - a group of size 4 or more: accept, because `closed_by` proved C1
     balance and C4;
   - any other size: return false.
2. Run the vertex-triple duplicate check (`:265-268`) only when every group
   had size 2. On the contact path, `closed_by` already applied C2's
   post-cancellation duplicate rule.
3. Then run (d) unchanged on the original triangles (C6).
4. The fast path (all groups of size 2) must keep today's decisions and
   today's `stats.target` increments. Do not allocate anything extra on it.
5. Test-only NMESH encoder.
   - No Rust NMESH encoder exists. The existing test module loads
     `include_str!` fixture files (`nmesh.rs:470-500`).
   - Add a helper inside this file's `#[cfg(test)] mod tests`, for example
     `fn encode_text(q: &[[i64; 3]], triangles: &[u32]) -> String`. It is
     the inverse of `decode_budgeted` (`nmesh.rs:101-224`); where any rule
     below disagrees with `decode_budgeted`, the decoder wins, and you
     record that in the progress log.
   - Format rules:
     - Header bytes `[b'N', b'M', b'S', b'H', 1, 0, 3, 0]`.
     - Varints are minimal LEB128: 7 bits per byte, high bit for
       continuation, at most 5 bytes, no trailing zero continuation byte.
     - Write `vertexCount`, `triangleCount` and `groupCount = 1`, then one
       group (face 0, count = triangleCount).
     - Renumber vertices in first-use order over the triangle corners and
       drop unreferenced vertices.
     - Positions: per axis, the delta from the previous vertex (starting
       at 0), zigzag-encoded (`d >= 0 -> 2d`, `d < 0 -> -2d - 1`).
     - Triangle corners: code 0 introduces the next new vertex
       (`used += 1`); otherwise `code = used - newIndex`.
     - Trailer: the CRC32 of all preceding bytes, as 4 little-endian bytes,
       using the module's `crc32`.
     - Armor: standard base64 with `=` padding and the prefix `nmesh1:`.
   - Round-trip guard: for each fixture, `decode_inline(&text)` returns the
     renumbered positions (q / 1000) and triangles. Assert this before
     comparing `boolean_target`, so a false result cannot come from a
     decode failure.
   - Add no fixture files under `crates/capture/tests/fixtures/`, which is
     outside this plan's writePaths.
6. Nine-fixture eligibility test, in the same module:
   - Compare
     `decode_inline_with(&text, DecodeOptions { max_vertices: u64::MAX, need_target: true }).unwrap().boolean_target == Some(expected)`.
   - Literal table: true for edge, face, crossed-diagonal and separated;
     false for open triangle, unbalanced, welded overlap, double-sided fin
     and coincident shells. This is the same table as
     `packages/io/src/nmesh/capture-decoder.test.ts`, written literally.
   - Geometry is in design 29.1 R12-6 "Fixtures". Use integer millimetre
     coordinates times 1000 for `q`.
   - Do not call `target_eligible` directly as a substitute.
   - The three contact cases fail before the `target_eligible` change; save
     that log.
7. The `:532` replacement, in the existing fixture-loop test:
   - Add a third tuple element `closed: bool`, separate from the
     boolean_target `expected`, with these literals:
     - tetrahedron true; tetrahedron-reversed true; tetrahedron-mixed
       true;
     - triangle false;
     - double-sided-triangle true; coplanar-tetrahedron true; thin-bar
       true; translated-flat-shell true; translated-thin-bar true.
   - Replace only the `:532` assertion with
     `assert_eq!(crate::mesh::is_closed(&mesh), closed)`.
   - Remove only the locals that become unused, such as the quantized
     `closed_by` input. Leave every other assertion unchanged. This is the
     only permitted assertion replacement.

Pitfalls:
- Do not drop the 2-use direction check on the contact path.
- Do not skip the duplicate check on the fast path.
- Closure is not eligibility. `closed_by` ignores direction and volume, so
  four existing fixtures are closed but not targets.
  - Never reuse `expected` as the closed value.
  - If a measured value differs from the `closed` table, stop and report
    it. Never edit the table to match the code.
- Do not compute the `closed` literal by calling `closed_by` or
  `is_closed` in the test.

## Verification (each exits 0)

1. `CARGO_TERM_QUIET=true cargo fmt -p nodetto-capture -- --check`
2. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car13-p4c cargo clippy -p nodetto-capture --all-targets -- -D warnings`
3. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car13-p4c cargo test -p nodetto-capture`
   - The log lists the round-trip test, the nine-fixture test and the
     updated fixture-loop test as passed.
4. `bun test packages/io/src/nmesh/capture-decoder.test.ts packages/io/src/nmesh/capture-decoder-budget.test.ts`
   - Run as a cross-language guard; these files are not edited.

## Done criteria

- Commands 1-4 exit 0.
- The fail-before log is saved.
- The diff touches only `nmesh.rs` plus this plan's own files.
- The progress log reads `done`.

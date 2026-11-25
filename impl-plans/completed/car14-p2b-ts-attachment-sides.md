# car14-p2b-ts-attachment-sides

- planId: car14-p2b-ts-attachment-sides; wave 1; dependsOn: none
- progressPath: impl-plans/progress/car14-p2b-ts-attachment-sides.md
- Finding: `maintainability-capture-face-contact-hides-shell-overlap`
  (high), TypeScript half.
- Design: `design-docs/specs/design-ai-capture.md` 31.1 R14-2 (step
  C2b), 29.1 R12-6.
- Worker rules: `car14-00-overview.md`.
- Evidence: `tmp/car14-r14/car14-p2b-ts-attachment-sides/`.
- This plan owns the fail-before evidence that car14-p2c cites.

## Intent and context

`contactEligible` (`packages/io/src/nmesh/capture-decoder.ts:46`) cancels
matched patches and collects their rim keys in `attachment` (`:186-212`).
It then resets `parent` in the duplicate-face loop (`:226-235`) and joins
every remaining edge with two uses (`:236-238`). This merges a bracket
and a block that touch face to face, so their second overlap is never
checked.

Add C2b independently of the Rust code: the same rule, decided with the
same integer values.

Non-goals:
- Do not change `eligible` (the fast path), `decodeCaptureMesh*`
  signatures, NMESH parsing, or the C1, C2, Attachment, C4, C5 and C6
  logic.
- Do not import `@nodetto/core` or any Rust-derived code.
- Do not edit the existing test "touching shell eligibility preserves
  invalid mesh rejection" (`capture-decoder.test.ts:235`).

## Changes

1. `capture-decoder.ts`, in `contactEligible`. After the duplicate-face
   loop, replace the single join loop with three steps:
   1. Join across every `remaining` entry with exactly two uses whose key
      is not in `attachment`.
   2. C2b:
      - Fold each non-cancelled triangle's quantized vertices
        (`q[vertex * 3 + axis]`, as at `:263-268`) into a per-root
        min/max box: `Map<number, { min: number[]; max: number[] }>`.
      - For each key in `attachment`, its two remaining uses give the
        roots `x` and `y` (via `find`).
      - Return false if `x === y`.
      - Return false if no axis satisfies `ax.max <= by.min ||
        by.max <= ax.min` (the C5 expression at `:291-299`).
   3. Join across the attachment keys. The final union-find then equals
      today's, and the shell, volume and C5 code runs unchanged.

   Use `as number` / `?? ` guards that satisfy `noUncheckedIndexedAccess`,
   as the surrounding code does. Biome requires one variable per
   declaration.
2. `capture-decoder.test.ts`: add a test
   `face contact with a second overlap and self-touching shells are not targets`.
   - Imitate the `:235` test: dynamic imports of `readStl`,
     `writeBinaryStl` and `decodeCaptureMeshWith`, then
     `canonicalize`, `encodeNmesh` and `toInline`.
   - Add a local `prism(outline, sequence, tops, z0, z1)` builder that
     returns `{ positions, triangles }` with outward winding:
     - top triangles as listed at `z1`;
     - bottom triangles reversed at `z0`;
     - side triangles `(a0, b0, b1)` and `(a0, b1, a1)` for each cyclic
       outline edge `a -> b`.

## Fixtures (mm; the same data as car14-p2a, written literally here)

- Bracket: P0 (0,0), P1 (10,0), P2 (10,2), P3 (2,2), P4 (2,5),
  P5 (15,5), P6 (15,1), P7 (18,1), P8 (18,7), P9 (0,7).
  - Top triangles: (0,1,2), (0,2,3), (0,3,4), (0,4,9), (9,4,5),
    (9,5,8), (5,6,7), (5,7,8).
  - Z 0..5.
- Block: the 12-triangle box [10,20] x [0,2] x [0,5], built with the
  `box` pattern of the `:235` test (copy that local helper into the new
  test).
  - Triangulation A: the block's X = 10 face uses the bracket's diagonal
    (10,0,0)-(10,2,5). In the `:235` helper that is `crossed = true`
    (`[3,0,7, 0,4,7]`); verify this in a comment.
  - Triangulation B: the other diagonal.
- Slit ring: the outline sequence Q0 (0,0), Q1 (10,0), Q2 (10,10),
  Q3 (0,10), Q4 (0,5), Q5 (3,5), Q6 (3,7), Q7 (7,7), Q8 (7,3), Q9 (3,3),
  Q5, Q4.
  - Top triangles: (0,1,8), (0,8,9), (1,2,7), (1,7,8), (2,3,6), (2,6,7),
    (3,4,5), (3,5,6), (4,0,9), (4,9,5).
  - Z 0..5.

## Tests

- Bracket plus block, A -> `booleanTarget === false`; B -> `false`.
- Slit ring -> `false`.
- Guard: the bracket plus a block at [20,30] x [0,2] -> `true`.
- Guard: the bracket alone -> `true`.
- The `:235` table (nine cases) and `capture-decoder-budget.test.ts` pass
  unedited.
- Fail-before: before change 1, A, B and the slit ring return `true`.
  Save the log as `fail-before.log`; car14-p2c cites it. If the slit ring
  is `false` before the fix, fix the fixture.

## Verification (each exits 0)

1. `bunx biome check packages/io/src/nmesh/capture-decoder.ts packages/io/src/nmesh/capture-decoder.test.ts`
2. `bun test packages/io/src/nmesh/capture-decoder.test.ts packages/io/src/nmesh/capture-decoder-budget.test.ts`

## Done criteria

- Commands 1-2 exit 0, and the new test is listed as passed.
- `fail-before.log` is saved.
- The diff stays inside writePaths.
- The progress log reads `done`.

## Implementation status

Done for implementation: C2b and the five regression cases are in place;
`fail-before.log`, `pass-after.log`, `regression-final.log` and
`biome-final.log` are in the plan evidence directory. Formal review and
workspace-wide integration checks remain downstream.

# Progress: kicad-pcb-07-core-export

## Intent snapshot (before source edits)

Implement `packages/core/src/pcb-board/export.ts` as the plan-owned PCB page to Gerber/Excellon exporter and stored ZIP encoder. Preserve the pinned Edge.Cuts frame, copper/mask/silkscreen/outline/drill mapping, warning and note strings, archive order, and deterministic geometry rules. Add plan-owned read-back tests for required edge cases. Do not edit `packages/core/src/pcb/` or downstream public barrels. The mandated pre-edit source inventory is `tmp/kicad-pcb-s534/kicad-pcb-07-core-export/pcb-sha256-start.txt`.

## Initial source identity

- `packages/core/src/pcb-board/export.ts`: absent before implementation.
- `packages/core/src/pcb-board/export.test.ts`: absent before implementation.
- Pre-edit owned-path checksums: files absent; the `packages/core/src/pcb/*` baseline is recorded in the start inventory above.

## Edit intentions

- `export.ts` initial implementation: add typed board/page extraction, Edge.Cuts bounds and a single board-to-Gerber transform; emit deterministic copper, mask, silkscreen, outline, plated/non-plated drill outputs and stored ZIP in the pinned order.
- `export.ts` follow-up correction: preserve the footprint association for reference/value text, render unsupported font characters by omission while warning, and keep legends as direct Gerber layer values rather than mutating readonly graphic arrays.
- `export.ts` cleanup: remove the now-unused shape point helper detected by the first typecheck; no behavior change.
- `export.test.ts` assertion correction: align read-back expectations with the specified single frame mapping and footprint-relative slot axis; the implementation output was consistent with the board-frame transform.
- Exporter correctness/test expansion: issue unsupported-character warnings for the resolved silkscreen string (including footprint reference/value), and add tests for upright/mirrored text, arc read-back direction, filled zones, circle outline, and mask behavior.
- `export.test.ts` reader assertion correction: assert the reader's literal Gerber attribute key `TF.FilePolarity` (the negative mask layer itself is present as designed).
- `export.test.ts` final mask assertion correction: validate the writer's exact `TF.FilePolarity` header text because the current read-back parser stores that attribute under a leading-dot key (outside the export contract).
- Oracle coverage: exercise the independently implemented parser over each generated Gerber and Excellon entry, including optional GBO and NPTH files.
- Circular pad regions: emit true two-arc Gerber contours for circle outlines returned by the pad geometry helper (needed for custom pads whose base outline is circular), avoiding a four-chord approximation.
- `export.test.ts` regression: assert custom circular pad outlines round-trip as Gerber arc segments.
- Warning cardinality: retain one silkscreen warning per offending text element, including identical labels; keep the inner-layer warning explicitly single-instance.
- Lint correction: apply the five plan-file style fixes reported by the exact Biome gate (`sy` const and namespaced infinities), preserving behavior.
- Acceptance precision coverage: compare all rotated rectangular pad region corners against `pcbRotate` at 1e-6 mm, and assert inner-layer track geometry is omitted from both exported copper images.

## Final verification (current source)

- `bun test packages/core/src/pcb-board/export.test.ts packages/core/src/pcb` -> exit 0; 104 passed, 0 failed. Log: `tmp/kicad-pcb-s534/kicad-pcb-07-core-export/bun-test-plan-final.log`.
- `bun run typecheck` -> exit 0. Log: `tmp/kicad-pcb-s534/kicad-pcb-07-core-export/typecheck-final2.log`.
- `bunx biome check packages/core/src/pcb-board/export.ts packages/core/src/pcb-board/export.test.ts --diagnostic-level=warn` -> exit 0. Log: `tmp/kicad-pcb-s534/kicad-pcb-07-core-export/biome-check-final.log`.
- `! grep -nE 'Math\.(hypot|atan2|sin|cos)' packages/core/src/pcb-board/export.ts` -> exit 0 (no matches). Log: `tmp/kicad-pcb-s534/kicad-pcb-07-core-export/forbidden-math.log`.
- `shasum -a 256 packages/core/src/pcb/*` to start/end inventories and `cmp tmp/kicad-pcb-s534/kicad-pcb-07-core-export/pcb-sha256-start.txt tmp/kicad-pcb-s534/kicad-pcb-07-core-export/pcb-sha256-end.txt` -> exit 0; 25 entries match. Compare log: `tmp/kicad-pcb-s534/kicad-pcb-07-core-export/pcb-sha256-compare.log`.
- `bun test packages/core/src/breadboard/export-golden.test.ts` -> exit 0; 6 passed, 0 failed. Log: `tmp/kicad-pcb-s534/kicad-pcb-07-core-export/breadboard-golden.log`.
- Standalone `bun test packages/core/src/pcb-board/export.test.ts` -> exit 0; 8 passed, 0 failed. Log: `tmp/kicad-pcb-s534/kicad-pcb-07-core-export/export-test-acceptance.log`.

### PCB writer source SHA-256 at plan start

```text
c16f62eab48c55568963c592bbe564377e06a24640284a804fb6cfa051b01d69  packages/core/src/pcb/boundary.test.ts
d1a8decfc8ffeed65a327d51d37b0109c2ae9d6d0ef18197fd2611870299e2ba  packages/core/src/pcb/excellon-read.test.ts
ee732b529137f31c2056b90a1e215cd830e586994e1e8650abb86bce4ea86718  packages/core/src/pcb/excellon-read.ts
b7f88df7af229494d56e3c930decaa53523fc7eb836b3c38d19a609878a41eb9  packages/core/src/pcb/excellon.ts
1a8afdef2f54bef949fed9d522dbff72a6e38db9fec80a55adb3434ba3cd5411  packages/core/src/pcb/fabrication.test.ts
5b1530c0193356da1033aad7168c38028586834ce41bdca96d060d139b445e7c  packages/core/src/pcb/fabrication.ts
8b85540208c240b9484f6b76c876482a07d8811a33ab97cd4a47eac1bb1dd387  packages/core/src/pcb/font.test.ts
1bf5d919033c1e8165cd73f69fe15c6825f1eec15377be3462a6502e1e925185  packages/core/src/pcb/font.ts
7fb6be5d79cbed470b5f0393ec78b86bac44fe28c1b048ff9def9b6068965d75  packages/core/src/pcb/gerber-outline.test.ts
337e226e2ea9e1da4b24a1a0786b03792cb28c0f9588b5da3834df708399e74e  packages/core/src/pcb/gerber-outline.ts
cdb395e65f144df7c02d849ef36b1e168e8a3c15d6237eaa100a6ba8684db11e  packages/core/src/pcb/gerber-read.test.ts
3ed3c6a5cf60fda631519c8be3d8161254bb6bcf5856ce88f04a94965a31049b  packages/core/src/pcb/gerber-read.ts
7f3f4f056c611fa75809597d8c78ac165eeb9cacef40bdb1cb859ae2b8ee1977  packages/core/src/pcb/gerber.ts
2ec2e33fafb18f2057aa62d5616c0abb8656537af82ebfc2b6ad7bed082ecf80  packages/core/src/pcb/index.ts
668218e7fc26f690c753e792ed1dc1535faa7b27ae0a744d1419972de6511cb3  packages/core/src/pcb/layers.test.ts
7737d910fad5db55722f43555b82c95953093edf6d892765f8d84e5bcef50519  packages/core/src/pcb/layers.ts
e5892a1d93b8ebc9d18bb77a13df266c768581fe4aa30bd2ca54c823bd81ac07  packages/core/src/pcb/legend.test.ts
0c98a404a57945fdfbebe046bc199bca2491789ea5851d16e2d1ff36eafde51c  packages/core/src/pcb/legend.ts
21ea81b4982c17677e376e9498c1f919090ee71871e2c23bd0e857593b9dd323  packages/core/src/pcb/model.ts
21d1470ab73ab37d1bb1a7bfa51fca4e2b73c627fa72e4a9cda03eae06a838ab  packages/core/src/pcb/oracle.test-support.ts
32dab503bd7c43b52bfc627046d7c0fa7819f5981c7aefbcf6f81097431e2220  packages/core/src/pcb/trim.test.ts
f4bd81ce71c1dedb7ca2ad6b16aeaebb76dd5f6ee1e59dc746df7c740accbf0e  packages/core/src/pcb/trim.ts
aa7d43e5aeb38c967b9f237b3f858e1bd42ac4c14906a2e6d3f9f4c0c625afab  packages/core/src/pcb/validate.test.ts
75b7a80d5b1df8b84ed0b12d4a631d0942a07508550234fb432c55e0ad37f8d2  packages/core/src/pcb/validate.ts
ee35d7305b7cf4a02d51998cf49597d3fe176fe9cb0774c6489c7b0d4ef6c9ef  packages/core/src/pcb/writer-additions.test.ts
```

### PCB writer source SHA-256 at plan end

```text
c16f62eab48c55568963c592bbe564377e06a24640284a804fb6cfa051b01d69  packages/core/src/pcb/boundary.test.ts
d1a8decfc8ffeed65a327d51d37b0109c2ae9d6d0ef18197fd2611870299e2ba  packages/core/src/pcb/excellon-read.test.ts
ee732b529137f31c2056b90a1e215cd830e586994e1e8650abb86bce4ea86718  packages/core/src/pcb/excellon-read.ts
b7f88df7af229494d56e3c930decaa53523fc7eb836b3c38d19a609878a41eb9  packages/core/src/pcb/excellon.ts
1a8afdef2f54bef949fed9d522dbff72a6e38db9fec80a55adb3434ba3cd5411  packages/core/src/pcb/fabrication.test.ts
5b1530c0193356da1033aad7168c38028586834ce41bdca96d060d139b445e7c  packages/core/src/pcb/fabrication.ts
8b85540208c240b9484f6b76c876482a07d8811a33ab97cd4a47eac1bb1dd387  packages/core/src/pcb/font.test.ts
1bf5d919033c1e8165cd73f69fe15c6825f1eec15377be3462a6502e1e925185  packages/core/src/pcb/font.ts
7fb6be5d79cbed470b5f0393ec78b86bac44fe28c1b048ff9def9b6068965d75  packages/core/src/pcb/gerber-outline.test.ts
337e226e2ea9e1da4b24a1a0786b03792cb28c0f9588b5da3834df708399e74e  packages/core/src/pcb/gerber-outline.ts
cdb395e65f144df7c02d849ef36b1e168e8a3c15d6237eaa100a6ba8684db11e  packages/core/src/pcb/gerber-read.test.ts
3ed3c6a5cf60fda631519c8be3d8161254bb6bcf5856ce88f04a94965a31049b  packages/core/src/pcb/gerber-read.ts
7f3f4f056c611fa75809597d8c78ac165eeb9cacef40bdb1cb859ae2b8ee1977  packages/core/src/pcb/gerber.ts
2ec2e33fafb18f2057aa62d5616c0abb8656537af82ebfc2b6ad7bed082ecf80  packages/core/src/pcb/index.ts
668218e7fc26f690c753e792ed1dc1535faa7b27ae0a744d1419972de6511cb3  packages/core/src/pcb/layers.test.ts
7737d910fad5db55722f43555b82c95953093edf6d892765f8d84e5bcef50519  packages/core/src/pcb/layers.ts
e5892a1d93b8ebc9d18bb77a13df266c768581fe4aa30bd2ca54c823bd81ac07  packages/core/src/pcb/legend.test.ts
0c98a404a57945fdfbebe046bc199bca2491789ea5851d16e2d1ff36eafde51c  packages/core/src/pcb/legend.ts
21ea81b4982c17677e376e9498c1f919090ee71871e2c23bd0e857593b9dd323  packages/core/src/pcb/model.ts
21d1470ab73ab37d1bb1a7bfa51fca4e2b73c627fa72e4a9cda03eae06a838ab  packages/core/src/pcb/oracle.test-support.ts
32dab503bd7c43b52bfc627046d7c0fa7819f5981c7aefbcf6f81097431e2220  packages/core/src/pcb/trim.test.ts
f4bd81ce71c1dedb7ca2ad6b16aeaebb76dd5f6ee1e59dc746df7c740accbf0e  packages/core/src/pcb/trim.ts
aa7d43e5aeb38c967b9f237b3f858e1bd42ac4c14906a2e6d3f9f4c0c625afab  packages/core/src/pcb/validate.test.ts
75b7a80d5b1df8b84ed0b12d4a631d0942a07508550234fb432c55e0ad37f8d2  packages/core/src/pcb/validate.ts
ee35d7305b7cf4a02d51998cf49597d3fe176fe9cb0774c6489c7b0d4ef6c9ef  packages/core/src/pcb/writer-additions.test.ts
```

## Prior attempts (superseded by current-source passes)
- Initial typecheck showed the then-current own unused helper and in-progress sibling plan diagnostics; full logs: `typecheck-initial.log`, `typecheck-initial-retry.log`. The current-source typecheck above passes.
- Initial and expanded test attempts exposed incorrect expected frame coordinates and a reader attribute key assumption; logs: `bun-test.log`, `bun-test-rerun.log`, `bun-test-expanded.log`, `export-test.log`, `export-test-oracle.log`. Corrected assertions are covered by current-source passing gates above.
- Initial Biome check found five plan-file style diagnostics; corrected and reran successfully. Log: `biome-check.log`.
## Completion criteria

Plan 07 source, acceptance tests, progress evidence, exact targeted test gate, typecheck, scoped Biome gate, deterministic archive/read-back/oracle checks, forbidden-math check, and unchanged writer hashes are complete. Formal integration review and downstream wiring remain owned by later workflow steps.
- Final plan assertion coverage: pin the complete archive order when both optional files exist and verify caller-provided board names use the breadboard export sanitizing rule with the `pcb` fallback.
- Progress-log cleanup intention: replace the accidental literal `\\n` before the completion heading with a real paragraph break, then record the latest-source final test, typecheck and lint evidence.


## Current-source revalidation after final archive assertions

- `bun test packages/core/src/pcb-board/export.test.ts packages/core/src/pcb` -> exit 0; 104 passed, 0 failed. Log: `tmp/kicad-pcb-s534/kicad-pcb-07-core-export/bun-test-plan-final2.log`.
- `bun run typecheck` -> exit 0. Log: `tmp/kicad-pcb-s534/kicad-pcb-07-core-export/typecheck-final-rerun.log`.
- `bunx biome check packages/core/src/pcb-board/export.ts packages/core/src/pcb-board/export.test.ts --diagnostic-level=warn` -> exit 0. Log: `tmp/kicad-pcb-s534/kicad-pcb-07-core-export/biome-check-final2.log`.
- `bun test packages/core/src/breadboard/export-golden.test.ts` -> exit 0; 6 passed, 0 failed. Log: `tmp/kicad-pcb-s534/kicad-pcb-07-core-export/breadboard-golden.log`.

## Test-integrity repairs (comm-009917)

- TI-07-1: the unmirrored T test now asserts a horizontal bar at Gerber y=5.5 and stem bottom y=4.5, including `bar.y > stemBottom`; mirrored text also asserts the same upright y coordinates. Existing mirror x-order and mask checks remain.
- TI-07-2: the minimal-board read-back now asserts the GTL straight track `(1,8)->(6,3)` to 1e-6 and via circle diameter 1 at `(5,4)` on GTL and GBL. Existing pad and drill checks remain.
- TI-07-3: the rotated slot test now sorts and asserts absolute y endpoints 8.25 and 10.25 to 0.001 mm, retaining diameter, x, and length assertions.
- The upright-text mutation control transformed `export.ts` in memory to remove the y negation; the upright assertion failed as expected (bar y=4.5, stem bottom y=4.5). Log: `tmp/kicad-pcb-s534/kicad-pcb-07-core-export/mutation-text-yflip.log`.
- The drill-offset mutation control transformed `export.ts` in memory to drop the offset; absolute endpoint assertion failed as expected with `[8,10]` instead of `[8.25,10.25]`. Log: `tmp/kicad-pcb-s534/kicad-pcb-07-core-export/mutation-drill-offset.log`. Neither mutation wrote to the repository.
- Current-source `bun test packages/core/src/pcb-board/export.test.ts packages/core/src/pcb` -> exit 0, 104 passed, 0 failed. Log: `tmp/kicad-pcb-s534/kicad-pcb-07-core-export/review-targeted-test.log`.
- Current-source `bun run typecheck` -> exit 0. Log: `tmp/kicad-pcb-s534/kicad-pcb-07-core-export/review-typecheck.log`.
- Current-source scoped Biome check -> exit 0. Log: `tmp/kicad-pcb-s534/kicad-pcb-07-core-export/review-biome.log`.
- Final `packages/core/src/pcb/*` inventory matches the start inventory. Compare log: `tmp/kicad-pcb-s534/kicad-pcb-07-core-export/review-hash-compare.log`.

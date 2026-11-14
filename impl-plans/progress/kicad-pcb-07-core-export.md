# kicad-pcb-07-core-export progress (session 535 rework)

## Scope and design alignment

Implemented the assigned plan against design revision 2, sections 3.2, 6.3 and 7.3. The dispatched `fanoutItem.dependsOn` is empty; dispatch history records the prior plans committed in `6865464` and `cf0c4d7`. No review findings or direct inbox repair requests were supplied. The plan's files and tests were the only authored write paths.

## Implementation

- Added `padShapeCenter(fp, pad)` as anchor plus `pcbRotate(drill.offset, fp.rotation + pad.rotation)` without rounding.
- `padCopperOutline` and `padPrimitiveOutlines` now use the shape center, so bounds, follow and connectivity consume the corrected pad shape while anchor-based contacts remain unchanged.
- Gerber copper and mask flashes use the shape center. Excellon drill hits and slot centers remain at the footprint-transformed pad anchor; slot axis and dimensions are unchanged.
- Corrected the slot test to expect Gerber y 8 and 10. Added offset geometry, follow, connectivity, flash, mask, region and drill assertions. Updated only the drill-offset sentence in `docs/pcb/kicad-pcb.md`.
- No changes under `packages/core/src/pcb/`; sibling implementation files `follow.ts`, `connectivity.ts`, `edit.ts` and `shapes/pcb.ts` remain unchanged from `cf0c4d7`.

## Final-source verification

All logs below are complete and under `tmp/kicad-pcb-s534/kicad-pcb-07-core-export/`.

| Command | Exit | Tests | Failures | Log |
| --- | ---: | ---: | ---: | --- |
| `bun test packages/core/src/pcb-board packages/core/src/pcb packages/core/src/shapes/pcb.test.ts` | 0 | 114 | 0 | `s535-final-bun-test.log` |
| `bun run typecheck` | 0 | 0 | 0 | `s535-final-typecheck.log` |
| `bunx biome check packages/core/src/pcb-board/export.ts packages/core/src/pcb-board/export.test.ts packages/core/src/pcb-board/geometry.ts packages/core/src/pcb-board/geometry.test.ts packages/core/src/pcb-board/follow.test.ts packages/core/src/pcb-board/connectivity.test.ts --diagnostic-level=warn` | 0 | 0 | 0 | `s535-final-biome.log` |
| `bun test packages/core/src/breadboard/export-golden.test.ts` | 0 | 6 | 0 | `s535-breadboard-golden.log` |
| `git diff --quiet cf0c4d7 -- packages/core/src/pcb-board/follow.ts packages/core/src/pcb-board/connectivity.ts packages/core/src/pcb-board/edit.ts packages/core/src/shapes/pcb.ts` | 0 | 0 | 0 | `s535-sibling-diff.log` |
| `! grep -nE 'Math\.(hypot|atan2|sin|cos)' packages/core/src/pcb-board/export.ts packages/core/src/pcb-board/geometry.ts` | 0 | 0 | 0 | `s535-forbidden-math.log` |
| `shasum -a 256 packages/core/src/pcb/*` then `cmp` start and end lists | 0 | 0 | 0 | `s535-pcb-hash-compare.log` |
| `git diff --check` | 0 | 0 | 0 | `s535-final-diff-check.log` |
| `test -s impl-plans/progress/kicad-pcb-07-core-export.md` | 0 | 0 | 0 | `s535-progress-presence.log` |
| `mkdir -p tmp/kicad-pcb-s534/kicad-pcb-07-core-export` | 0 | 0 | 0 | `s535-evidence-dir.log` |
| `test -s tmp/kicad-pcb-s534/kicad-pcb-07-core-export/pcb-sha256-start.txt` | 0 | 0 | 0 | `s535-start-hash-presence.log` |

## Mutation controls (expected failures)

- Add the rotated offset back to DRL coordinates; export assertions failed as expected on slot y 8 (observed 8.25) and the offset hole anchor. `bun test packages/core/src/pcb-board/export.test.ts`; exit 1, 9 tests, 2 failures; `s535-mutation1.log`. Exact source restored and byte-compared.
- Drop the offset from `padCopperOutline`; geometry, follow, connectivity and export offset assertions failed. `bun test packages/core/src/pcb-board/geometry.test.ts packages/core/src/pcb-board/follow.test.ts packages/core/src/pcb-board/connectivity.test.ts packages/core/src/pcb-board/export.test.ts`; exit 1, 33 tests, 4 failures; `s535-mutation2.log`. Exact source restored and byte-compared.
- Flash at anchor A; copper flash location assertion failed. `bun test packages/core/src/pcb-board/export.test.ts`; exit 1, 9 tests, 1 failure; `s535-mutation3.log`. Exact source restored and byte-compared.

## Superseded attempts

- Initial focused suite exposed three newly authored fixture expectation errors (111 pass, 3 fail); corrected the footprint rotation, circle radius and local pad anchor. Full output: `s535-bun-test-final.log`.
- Initial scoped Biome check found formatting-only diagnostics; formatted the six owned TypeScript files and reran the final scoped check. Full output: `s535-biome.log`; formatter log: `s535-biome-format.log`.
- Initial doc patch context did not match a line-wrapped sentence and made no change; the retry changed only that sentence.

## SHA-256 of every `packages/core/src/pcb/*` file

Start list recorded before source edits in `pcb-sha256-start.txt`:
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
End list recorded after source edits in `pcb-sha256-end.txt`:
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

The start and end lists compare equal. Plan implementation and required behavioral verification are complete; integration review and workflow finalization are downstream.

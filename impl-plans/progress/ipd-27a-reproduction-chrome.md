# ipd-27a reproduction progress

Status: incomplete. The accepted design uses the round-18 device layout and two-band comparisons.

- The required native sidecar build completed successfully; log: `tmp/ipd-s772/ipd-27a-reproduction-chrome/build-cli-final.log`.
- Existing exploratory draft evidence is not acceptance evidence: it used a different CLI path, produced 399 lint findings, and its inspected comparisons failed visual criteria.
- A cumulative draft and operation files for 01, 02, and 03 were created through the built sidecar. The draft validates and has three 390x844 frames. Each frame was exported at scale 2 and compared in two bands.
- The latest draft has 66 lint findings. Fixed text sizing and adjusted bottom chrome, but the latest visual inspection and lint gate still fail. Zero findings remains required.
- Inspected comparisons remain outside acceptance. Precise maximum drift and missing-element counts have not been measured; the table does not claim a pass.

| Screen | Drift | Icons | Colors | Weight | Missing |
| --- | --- | --- | --- | --- | --- |
| 01 | >4 | no | unverified | unverified | unverified |
| 02 | >4 | no | unverified | unverified | unverified |
| 03 | >4 | no | no | unverified | unverified |

- A generic four-item tab-bar with a badge produces five lint findings, including two off-grid icons. Owner: `ipd-27a-reproduction-chrome`. Generic operations and lint evidence are under `tmp/ipd-s772/ipd-27a-reproduction-chrome/kit-generic-*`.
- The floating action button shadow is centered. A new tab-bar regression covers counts 2 through 5 with and without badges; its first run fails on a fractional child coordinate (85.5). Fix the slot descendants and rerun the full regression before rebuilding the sidecar and document.
- Correct the visible differences and lint findings, then rerun the full part gates and inspect the regenerated comparisons.
- Prototype links, flow start, final copy, and the complete-document gate belong to the downstream reproduction plan.

## Current handoff

- Plan hash: `b1aa2ac5ae459bb512ad4002334d4a48be9f44ca`. The accepted design specifies device layout and two-band comparison.
- The updated sidecar build exited 0 (`tmp/ipd-s772/ipd-27a-reproduction-chrome/build-current.log`). The kit regression exited 0, 46 pass and 0 fail (`tmp/ipd-s772/ipd-27a-reproduction-chrome/kit-current-final.log`). Native parity exited 0, 7 pass and 0 fail (`tmp/ipd-s772/ipd-27a-reproduction-chrome/parity-current.log`).
- The preserved document has 66 findings: 46 app-misaligned, 11 note-overflow, 3 app-text-overflow and 6 app-off-grid. The round-19 gate fails. Evidence: `tmp/ipd-s772/ipd-27a-reproduction-chrome/lint-current.json`.
- Screen 01 comparison was inspected and remains outside visual acceptance. The other two screens require fresh inspection after rebuilding. Do not treat old comparison files as final evidence.
- Correction batches refer to generated identifiers from the earlier document; a rebuild requires remapping those references or incorporating the corrections into replayable operations. The existing document and operations were preserved.
- Native parity used a temporary directory under `tmp/ipd-s772/ipd-26-example-sample/`, outside this plan's artifact roots. Reconcile its scratch location before rerunning under the shared-write protocol.
- Remaining work: rebuild from operations on the fixed kit; resolve disallowed lint and each visual difference; regenerate and inspect all three comparisons; record per-screen counts and run every final gate. The prior kit-failure note above is superseded by the accepted `ipd-27k-kit-grid` dependency and the current passing kit regression.

## Round 22 rebuild handoff

- Plan hash: `79cb4bcef81ba1dff1f28ff83b3f514ae5248a89`. The accepted design retains the device layout and two-band comparison.
- `CARGO_TERM_QUIET=true mise run build-cli` exited 0; `tmp/ipd-s772/ipd-27a-reproduction-chrome/build-cli.log`.
- The read-only kit and example regression exited 0: 46 tests passed, 0 failed; `tmp/ipd-s772/ipd-27a-reproduction-chrome/kit-regression-s812.log`.
- `gen/build.ts` and `gen/ops/` do not yet exist. The preserved document and operations predate the accepted kit fix and cannot be used as final evidence. The fresh rebuild, literal-id check, lint, frame exports, comparisons, visual inspection and privacy gate remain outstanding.
- Prior native parity and kit ownership notes are superseded by operator round 22 and the accepted `ipd-27k-kit-grid` dependency. Formal review and final delivery remain downstream.

## Rebuild continuation 1

- The generator `tmp/ipd-s772/ipd-27-reproduction/gen/build.ts` rebuilds screens 01-03 from an empty seed through four compact operation files. `bun tmp/ipd-s772/ipd-27-reproduction/gen/build.ts --through 03` exited 0; log `tmp/ipd-s772/ipd-27a-reproduction-chrome/generator-06.log`.
- The generated document validates, the literal-id gate checks four operation files, and the three-frame gate passes. The round-19 lint gate exits 0 with 0 errors and 32 `app-misaligned` warnings: provisional counts 01: 6, 02: 6, 03: 20. These warnings have not yet been individually justified against the references.
- The three scale-2 images and comparisons were generated and inspected. The visual gate remains incomplete: shared chrome icon proportions and several button, border and text details differ. Maximum drift and missing counts have not been established, and no visual pass is claimed. Further correction and inspection are required before justifying the warnings.
- The read-only kit regression exited 0 with 46 pass and 0 fail; repository typecheck exited 0. Logs are under `tmp/ipd-s772/ipd-27a-reproduction-chrome/`.
- The generator currently supports `--through 03` only. Later parts extend it for their screens; prototype links and the final copy remain downstream.

## Rebuild continuation 2

- Updated batch-local tab icon geometry, standalone icon strokes, overlay controls, the first screen accent and a shorter visible button with a 44-point target. The generator rebuild exited 0; `tmp/ipd-s772/ipd-27a-reproduction-chrome/generator-08.log`.
- Validation, the literal-id gate, the three-frame count and the round-19 lint gate exited 0. Current lint contains 0 errors and 32 `app-misaligned` findings, provisionally 01: 3, 02: 6, 03: 23. These findings remain unverified individually against the reference.
- Scale-2 exports and all three comparisons were regenerated and inspected. Visible differences in shared chrome and text remain; maximum drift, exact icon and color agreement and missing-element counts have not been established. The table above therefore remains an incomplete assessment, not acceptance evidence.
- Kit regression: 46 pass, 0 fail. Repository typecheck exited 0. Current logs are under `tmp/ipd-s772/ipd-27a-reproduction-chrome/`.
- Remaining work: resolve visible differences, measure each screen against the four-point limit, and justify each allowed lint finding. No private content was copied to this log.

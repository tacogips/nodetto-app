# kicad-pcb-01-ir-core-contracts progress

## Intent snapshot

Implemented the accepted plan 01 IR contract and its seam for later plans. Added PCB semantic interfaces and exact rotation/rounding helpers; registered six structural PCB node types with pinned key order (without coordinate rounding); added PCB geometry, deterministic page/document creation and test support; added the CLI's typical PCB types. Did not change SCHEMA_VERSION/migrations, `packages/core/src/index.ts`, or downstream reader/editor/connectivity/export/UI work.

Source before-edit hashes are recorded in `tmp/kicad-pcb-s530/kicad-pcb-01-ir-core-contracts/pre-edit-sha256.txt`. Exact per-edit intentions and fresh source snapshots are in `tmp/kicad-pcb-s530/kicad-pcb-01-ir-core-contracts/edit-intents.md` and `snapshots/`.

## Current source hashes

See `tmp/kicad-pcb-s530/kicad-pcb-01-ir-core-contracts/final-sha256.txt` for final hashes of the plan-owned source and test files.

## Final verification

- `bun test packages/ir/src packages/core/src/pcb-board` — exit 0; 139 pass, 0 fail; KP01-AR-1 final-source log: `tmp/kicad-pcb-s530/kicad-pcb-01-ir-core-contracts/kp01-ar-1-focused-tests.log`.
- `bun run typecheck` — exit 0; KP01-AR-1 final-source log: `tmp/kicad-pcb-s530/kicad-pcb-01-ir-core-contracts/kp01-ar-1-typecheck.log`.
- `bunx biome check packages/core/src/pcb-board --diagnostic-level=warn` — exit 0; 5 files checked; log: `tmp/kicad-pcb-s530/kicad-pcb-01-ir-core-contracts/kp01-ar-1-biome.log`.
- `! grep -nE 'Math\.(hypot|atan2|sin|cos)' packages/core/src/pcb-board/geometry.ts` — exit 0, no matches; log: `tmp/kicad-pcb-s530/kicad-pcb-01-ir-core-contracts/kp01-ar-1-geometry-restriction.log`.
- `bun test packages/io/src/jsonl apps/cli/src/commands.test.ts` — exit 0; 145 pass, 0 fail; log: `tmp/kicad-pcb-s530/kicad-pcb-01-ir-core-contracts/kp01-ar-1-jsonl-cli-tests.log`.
- Reproduction probe — exit 0; bounds are `{minX:-0.5,minY:-1.5,maxX:0.5,maxY:1.5}`, required containment points and the 45-degree transformed point are true, exterior points are false; log: `tmp/kicad-pcb-s530/kicad-pcb-01-ir-core-contracts/kp01-ar-1-probe-after.log`.
- Before hashes: `tmp/kicad-pcb-s530/kicad-pcb-01-ir-core-contracts/kp01-ar-1-before-sha256.txt`. After hashes: `tmp/kicad-pcb-s530/kicad-pcb-01-ir-core-contracts/kp01-ar-1-after-sha256.txt`. The refreshed 13-file manifest is `tmp/kicad-pcb-s530/kicad-pcb-01-ir-core-contracts/final-sha256.txt`.
- `shasum -a 256 -c tmp/kicad-pcb-s530/kicad-pcb-01-ir-core-contracts/final-sha256.txt` — exit 0; all 13 plan-owned source/test hashes match; repair log: `tmp/kicad-pcb-s530/kicad-pcb-01-ir-core-contracts/kp01-ar-1-source-hash-validation.log`.

## Shared-tree ownership note

The JSONL/CLI regression gate now passes on the shared working tree. The passing coverage update is present in `packages/io/src/jsonl/golden.test.ts` and `packages/io/src/__fixtures__/pcb.jsonl`, both outside plan 01 `writePaths`; plan 01 did not author or modify these paths. Keep their authorship and integration ownership for serial reconciliation. No plan 01 code change was needed.

## Earlier attempts and resolved findings

- KP01-AR-1: the vertical oval top-cap arc was incorrectly marked counterclockwise. Set its `clockwise` flag to true and added a regression for bounds, six inside/outside checks, and the transformed point at 45 degrees. Before hashes: geometry.ts `48c5c963fb8f40457dea4d9f1ce8c5c372d76b856654bc4ea14420b0e74dbb05`, geometry.test.ts `10180038a8d8998a67415be8253722654a39f67b36786cb79e44c6ddd5c1d94e`; after hashes: geometry.ts `cd92958f2df105290f0da8be7dac3b4f75e53377cef43d7e176cdcabc9aa0898`, geometry.test.ts `6ae0798ddcd939d80d59eb8cdb541366ed0d72a197c5eacda3d4a23ced4b1e91`. Full values are in `tmp/kicad-pcb-s530/kicad-pcb-01-ir-core-contracts/kp01-ar-1-before-sha256.txt` and `kp01-ar-1-after-sha256.txt`.
- The read-only plan audit noted generic rotations used raw degrees after angle normalization. `pcbRotate` now computes radians from normalized `angle`, and `pcb.test.ts` checks that 390 degrees equals 30 degrees. Final-source focused tests, typecheck, and Biome pass.

- The earlier `bun test packages/io/src/jsonl apps/cli/src/commands.test.ts` attempt exited 1 with 141 pass and 1 fail because the six PCB types lacked golden coverage; full log: `tmp/kicad-pcb-s530/kicad-pcb-01-ir-core-contracts/jsonl-cli-tests.log`. The later current-source rerun above passes after the shared fixture/test update became available.

- Initial test attempt surfaced exact quarter-turn `-0` and accidentally discovered evidence snapshots named `*.test.ts`; the helper now normalizes signed zero and evidence copies have `.source` suffixes. The final focused suite above passes.
- Initial typecheck caught two extra `strokeTextWidth` arguments and an unused registry constant; corrected, with final typecheck above passing.
- Initial Biome check surfaced formatting/import-style and one `forEach` lint issue; formatted only plan-owned TypeScript paths and fixed the lint issue. Final Biome check above passes.
- Mechanical done-criteria command `test "$(grep -c '"pcb"' packages/ir/src/types.ts)" -ge 1 && test "$(grep -c 'pcb\\.' packages/ir/src/registry.test.ts)" -ge 6 && test -s impl-plans/progress/kicad-pcb-01-ir-core-contracts.md` — exit 0; complete log: `tmp/kicad-pcb-s530/kicad-pcb-01-ir-core-contracts/done-criteria.log`.

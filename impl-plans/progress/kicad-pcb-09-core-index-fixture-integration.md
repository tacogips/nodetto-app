# kicad-pcb-09-core-index-fixture-integration progress

## Readiness and intent

The dispatched implementation item has `dependsOn: []`; the committed manifest lists the five plan dependencies (04-08) in `acceptedDependencies`, matching the plan's dependency note. All assigned write paths are local to plan 09. Review feedback contains no findings.

Before edits, I recorded the plan-local source intent in `tmp/kicad-pcb-s536/kicad-pcb-09-core-index-fixture-integration/intent-001.md` and captured initial hashes:

- `packages/core/src/index.ts`: 38bc50166a8ce6498d87cf3d7d458c347413357fce5a02d184482707ff2cd324
- `packages/core/src/pcb-board/geometry.ts`: cb2883cac58339149332836f1c57fa95f532a634d9e953b800e8b4f940b54aa3
- `packages/core/src/pcb-board/page.ts`: faa1ab1c4f8473903bcd431f00c4b2295d973203cc21c04d7c9b0c0abaf88038
- `packages/core/src/pcb-board/edit.ts`: f6d69980e479a780037bd62ca0abd8f58273ce8c30efc9822f50951fd81ffc26
- `packages/core/src/pcb-board/follow.ts`: 3d5c7ced231fef07aa8b9a38fd0ba211b17c70126751517c88b38df68878fe80
- `packages/core/src/pcb-board/connectivity.ts`: d8def7dcace54e042bab072ad59f631107b6cdec0ce06a951827cf2b4e3a90a1
- `packages/core/src/pcb-board/ratsnest.ts`: d2dffde28491d9deaecc72c543f5e94f6a7eaa73e0ce8ea121a397dec5d70356
- `packages/core/src/pcb-board/export.ts`: 965b2f674f4b19abc0e3c7b3e2db2a0e1d94936b1ca2f7ee062801948431c160
- `packages/io/src/kicad/pcb.ts`: 4938761c6c9fff711276b0d8f49c4d78137461b8d96d1085de50a203d04a68ac

## Implementation

Completed plan 09 within its assigned write paths:

- Added `packages/core/src/pcb-board/index.ts` with explicit named exports, including `padShapeCenter`, `pcbOutlineBounds`, and the stroke font helpers; `test-builder.ts` and `follow.ts` remain internal.
- Added exactly one `export * from "./pcb-board/index.ts";` beside the breadboard barrel export in `packages/core/src/index.ts`.
- Added `packages/core/src/pcb-board/fixture.test.ts` on the self-authored `two-layer.kicad_pcb` fixture. It checks import diagnostics and all planned semantic items/nets, lossless JSONL before and after editor changes, J1 attached track endpoint local offsets after a move, ratsnest 0 -> 1 -> 0 after delete/undo, independently computed GND membership, deterministic export, Gerber read-back of copper pads/tracks/arcs/zone/outline within 1e-6 mm, and Excellon read-back of via/pad holes, H1 NPTH and U1 offset slot within 0.0005 mm. U1 slot center is checked at (40, 10); copper region center is checked at `padShapeCenter`.
- Did not change wave-2 modules. The final comparison against `8181d51` for the plan-pinned wave-2 files is clean.

Final source hashes:

- `packages/core/src/index.ts`: f7f325a4a3d87004c5cfefc138a07ec6847e54bcacf5e80ac84a406af4448cf4
- `packages/core/src/pcb-board/index.ts`: 94ce1bb833cb5b4552b5a849219ad2c829b0a7e9580f180eae968ebeb6a24dd8
- `packages/core/src/pcb-board/fixture.test.ts`: 8b5abd8eceeae291d3d589fd682336fe1dd9f29f8a155ba86a846f7081ac86d6

Progress log pre-edit hash: 3952faf2d0d020b4621b28c49da2e26d02a61db4a67e7cab98287a3c31e952ae.

## Verification

Final-source gates (complete logs under `tmp/kicad-pcb-s536/kicad-pcb-09-core-index-fixture-integration/`):

- `bun test packages/core/src/pcb-board packages/core/src/pcb packages/io/src/kicad packages/ir/src` — exit 0; 269 passed, 0 failed; `bun-test.log`.
- `bun run typecheck` — exit 0; `typecheck.log`.
- `bunx biome check packages/core/src/pcb-board/index.ts packages/core/src/index.ts packages/core/src/pcb-board/fixture.test.ts --diagnostic-level=warn` — exit 0; `biome.log`.
- `bun test packages/core/src/breadboard/export-golden.test.ts` — exit 0; 6 passed, 0 failed; `breadboard-golden.log`.
- `test "$(grep -c 'pcb-board/index.ts' packages/core/src/index.ts)" -eq 1` — exit 0.
- `! grep -n 'export \\*' packages/core/src/pcb-board/index.ts` — exit 0.
- `git diff --quiet 8181d51 -- packages/core/src/pcb-board/geometry.ts packages/core/src/pcb-board/page.ts packages/core/src/pcb-board/edit.ts packages/core/src/pcb-board/follow.ts packages/core/src/pcb-board/connectivity.ts packages/core/src/pcb-board/ratsnest.ts packages/core/src/pcb-board/export.ts packages/io/src/kicad/pcb.ts` — exit 0.
- `test -s impl-plans/progress/kicad-pcb-09-core-index-fixture-integration.md` — exit 0; `progress-nonempty.log`.

Superseded attempts retained separately: the first fixture run had two assertion assumptions corrected (JSONL canonical element ordering; oval copper read-back as a region); the first strict typecheck exposed readonly expected arrays; a later typecheck exposed an optional arc-center result. All were corrected in the assigned test file. Final-source reruns above pass; their earlier logs are not positive verification evidence.

## Completion criteria

- [x] Explicit PCB board barrel and exactly one core index export.
- [x] Fixture acceptance behavior passes; no wave-2 defect was found.
- [x] All plan 09 verification commands recorded with exit status, test counts where reported, and complete log path.
- [x] No wave-2 module changed.

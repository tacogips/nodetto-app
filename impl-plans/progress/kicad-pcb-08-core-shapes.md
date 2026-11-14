# kicad-pcb-08-core-shapes progress

## Intent snapshot

Implemented one non-resizable shape util for each `pcb.*` IR type. Bounds and
hit tests use semantic millimetre geometry and `PCB_PAGE_SCALE`; PCB visual
geometry is never read. The zone picker targets only the outline. Default
semantics validate against the IR and visuals are empty. Registered the utils
in the existing core registry and added focused coverage.

## Write-path snapshots

| File | Before | After |
| --- | --- | --- |
| `packages/core/src/shapes/index.ts` | `123c9168f8d7b4ade22472c58511bf1ad74534bf9b4f06063a590fe22876fd1c` | `cb34e363ff49008a5dcefad425d98871164b973052036b3cf75e3c1a24d4998c` |
| `packages/core/src/shapes/pcb.ts` | absent | refreshed after exact arc hit testing; latest hash is recorded in `tmp/kicad-pcb-s534/kicad-pcb-08-core-shapes/write-path-hashes.txt` |
| `packages/core/src/shapes/pcb.test.ts` | absent | refreshed with the graphic arc regression; latest hash is recorded in `tmp/kicad-pcb-s534/kicad-pcb-08-core-shapes/write-path-hashes.txt` |
| `impl-plans/progress/kicad-pcb-08-core-shapes.md` | absent | latest hash is recorded in `tmp/kicad-pcb-s534/kicad-pcb-08-core-shapes/write-path-hashes.txt` |

Initial exact behavior intent is preserved in
`tmp/kicad-pcb-s534/kicad-pcb-08-core-shapes/intent-001.txt`; additional
per-edit intents and pre-edit snapshots are in the same evidence directory.

## Verification

| Command | Exit | Result |
| --- | ---: | --- |
| `bun test packages/core/src/shapes/pcb.test.ts` | 0 | 6 passed, 0 failed; complete log: `tmp/kicad-pcb-s534/kicad-pcb-08-core-shapes/pcb-test.log`. |
| `bun test packages/core/src/shapes` | 0 | 63 passed, 0 failed; complete log: `tmp/kicad-pcb-s534/kicad-pcb-08-core-shapes/bun-test-final.log`. |
| `bun run typecheck` | 0 | `tsc --noEmit` passed; complete log: `tmp/kicad-pcb-s534/kicad-pcb-08-core-shapes/typecheck.log`. |
| `bunx biome check packages/core/src/shapes/pcb.ts packages/core/src/shapes/pcb.test.ts packages/core/src/shapes/index.ts --diagnostic-level=warn` | 0 | Three final-source files checked; complete log: `tmp/kicad-pcb-s534/kicad-pcb-08-core-shapes/biome.log`. |
| `bun -e 'import { pcbShapeUtils } from "./packages/core/src/shapes/pcb.ts"; const util = pcbShapeUtils.find((item) => item.type === "pcb.graphic"); const graphic = { id: "arc", page: "p", type: "pcb.graphic", index: "a1", visual: {}, semantic: { layer: "Edge.Cuts", width: 0.1, fill: false, shape: { kind: "arc", start: [10, 0], mid: [Math.SQRT1_2 * 10, Math.SQRT1_2 * 10], end: [0, 10] } } }; if (!util?.hitTest(graphic, { x: 92.388, y: 38.268 }, {})) throw new Error("arc hit missed"); console.log("1 arc assertion passed");'` | 0 | One direct current-source arc-hit assertion passed; complete log: `tmp/kicad-pcb-s534/kicad-pcb-08-core-shapes/arc-smoke.log`. |
| `mkdir -p tmp/kicad-pcb-s534/kicad-pcb-08-core-shapes && test "$(grep -c 'pcbShapeUtils' packages/core/src/shapes/index.ts)" -ge 1 && test -s impl-plans/progress/kicad-pcb-08-core-shapes.md` | 0 | Required output directory, registry reference, and progress record exist; log: `tmp/kicad-pcb-s534/kicad-pcb-08-core-shapes/registry-check.log`. |

All plan 08 source and verification gates pass on the current shared tree.
Earlier runs failed while plan 05's `edit.ts` was in progress; the missing
`pcbAnchor` export was added before the passing current-source reruns. Those
superseded logs remain in this evidence directory. Plan 09 owns the core PCB
barrel/index integration. Review, shared documentation/index reconciliation,
staging, commit and push belong to later workflow steps.

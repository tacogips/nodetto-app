# car9-p2-scene-edge-index progress

Status: done (implementation; formal review and integration pending).

- `packages/core/src/capture/scene.ts`: pre `d6bc1bbe1a888060e0144933ee107cb423ad03e8ecdde7456b72f8cec771e2d1`; post `9b2251b08d9ac4170edaab84eff51b3fcc3102877dab1d0e7448e86cdfdba101`. Lazily cache each entry's edge index after bounds checks and preserve the crossing predicate.
- `packages/core/src/capture/scene.test.ts`: pre `1b0ec9496439535cdaeccbdda3099a2cbe4558ff455d1910720cd947705ccce1`; post `eef7ef9649800013cd174f30b6ce688824e5f2e74d7000094865a1b294bbd134`. Append detailed-rim oracle, byte equality and work-count regression; existing tests unchanged.
- `impl-plans/active/car9-p2-scene-edge-index.md`: pre `87473a1b8e154dd16037be49a99e4d12115bde7271fbd63354b5cb3de37949f8`; status appended.
- `impl-plans/progress/car9-p2-scene-edge-index.md`: newly created.

Negative control: `bun test packages/core/src/capture/scene.test.ts -t 'normalisation queries the detailed rim through one edge index'` exited 1 as expected on pre-fix production code; 1 test failed at builds=0. Log: `tmp/car9-r9/car9-p2-scene-edge-index/pre-fix.log`.

Initial focused gate exited 1 on Biome noAssignInExpressions, fixed before the final gate; log `tmp/car9-r9/car9-p2-scene-edge-index/prior-gate.log`.

Final: `bunx biome check packages/core/src/capture/scene.ts packages/core/src/capture/scene.test.ts && bun test packages/core/src/capture/scene.test.ts` exited 0; 34 passed, 0 failed. Log `tmp/car9-r9/car9-p2-scene-edge-index/gate.log`.

H=256/512/1024: builds 259/515/1027; visits 5376/11776/25600; inspections 512/1024/2048. Before the fix all counters were zero at H=256. Scene bytes and oracle loop identities match. Workspace typecheck, lint and verification are integration-owned as specified in the overview.

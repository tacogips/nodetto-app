# car9-p1-edge-index-loops progress

Status: done (implementation; formal review and integration remain downstream).

- `packages/core/src/cad/loops.test.ts`: before `d25e3a0bb8006120913263fb3180d10a41d4826fedf310562d843fe40c109683`; after `849f89a776018ad51d029087e8cb129c2e38613c72032186e80ac541c9b67760`. Added detailed-rim regression; existing tests unchanged.
- `packages/core/src/cad/loops.ts`: before `4f0407872a3008d84d0981cb94ae3550185d6eb337696d3dd877e44d7ce74597`; after `3d5b101c62de1bdd35b3d44bac0e67d381cb058b55dfe212caf8158252befea1`. Preserve bounds and exact predicate, cache lazy indexes.
- `packages/core/src/cad/edge-y-index.ts`: absent before; after `d7c9cdf070d2b64e44c8559b53965177182286357c522c2d62fbee03b3b5bc1b`. Added internal closed Y-interval index.
- Per-edit source snapshots and intentions: `tmp/car9-r9/car9-p1-edge-index-loops/`.
- Pre-fix `bun test packages/core/src/cad/loops.test.ts -t 'a detailed rim with many holes queries the perimeter through one edge index'`: exit 1, one expected failure (zero builds), `tmp/car9-r9/car9-p1-edge-index-loops/pre-fix.log`.
- Final `bunx biome check packages/core/src/cad/edge-y-index.ts packages/core/src/cad/loops.ts packages/core/src/cad/loops.test.ts && bun test packages/core/src/cad/loops.test.ts packages/core/src/cad/pcb-outline.test.ts`: exit 0, 21 passed, `tmp/car9-r9/car9-p1-edge-index-loops/gate.log`.
- Edge counts (builds, visits, inspections): H=256 (259, 5376, 512), H=512 (515, 11776, 1024), H=1024 (1027, 25600, 2048). Totals 6147, 13315, 28675; ratios 2.166 and 2.154.
- Index exports exactly the four planned symbols and is not re-exported; profile containment preserves its grid predicate and builds no index before the bounds check. No caller changed. Per-plan scope verified against current diff; sibling changes are separately owned.
- Workspace typecheck, lint, verify, native parity and downstream scene wiring are integration or dependent-plan work per the dispatch and overview.

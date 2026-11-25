# car8-f1-loops-box-query progress

Status: done (implementation; independent reviews and integration gates pending).

- `packages/core/src/cad/loops.ts`: SHA256 before `a737c35ee58499de3daab0a3b7db8c3681bce604d7e490c73525b48f5d861c15`, after `4f0407872a3008d84d0981cb94ae3550185d6eb337696d3dd877e44d7ce74597`. Replaced one-axis scan with X sweep and max-maxY tree.
- `packages/core/src/cad/loops.test.ts`: SHA256 before `db75d446c70c5518749ab65ac9ba28088c96270639f849d28c3316ad34709637`, after `d25e3a0bb8006120913263fb3180d10a41d4826fedf310562d843fe40c109683`. Added perpendicular rows and tangent regression; existing tests unchanged.
- Negative control: `bun test packages/core/src/cad/loops.test.ts --test-name-pattern 'holes along two perpendicular edges'`, exit 1, 1 failed test, `tmp/car8-r8/car8-f1-loops-box-query/baseline-2.log`. Before counts: segment 388869, 1531397, 6077445; containment 2144, 8384, 33152.
- Final focused gate: `bunx biome check packages/core/src/cad/loops.ts packages/core/src/cad/loops.test.ts && bun test packages/core/src/cad/loops.test.ts`, exit 0, 12 passed, `tmp/car8-r8/car8-f1-loops-box-query/final-gate.log`. After counts: segment 112954, 241980, 516158 (ratios 2.142, 2.133); containment 2239, 5229, 11311 (ratios 2.335, 2.163).
- Repository typecheck, lint, verify and native determinism gate are assigned to integration on the stable shared tree. Review, staging and commit are downstream.

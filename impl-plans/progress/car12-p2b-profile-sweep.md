# car12-p2b-profile-sweep progress

Status: done (implementation; formal review pending).

The accepted p2a module is integrated only beyond the existing threshold. An
unproved result preserves the exhaustive first-error search. The touching
callback uses the existing exact intersection rule and the sweep enforces the
closed-box precondition. Adjacent edges are exempt only when their boxes
intersect at a shared endpoint; crossing and interior contacts remain visible.
The crossing regression uses nanometre integer coordinates and BigInt arithmetic.

Measured `segmentPairs / segmentTests / segmentFallbacks`:
- Ordinary: 707500 / 164000 / 0; sweep counters zero.
- 64 strips: 574 / 574 / 1; sweep events 768, steps 10038, tests 574.
- 128 strips: 1150 / 1150 / 1; sweep events 1536, steps 24175, tests 1150.
- 256 strips: 2302 / 2302 / 1; sweep events 3072, steps 54570, tests 2302.

The switch remains eight candidate overlaps per box. Before integration the
strip regression failed with work 51156 to 201130, while the ordinary measured
exact-call baseline was 164000 (`fail-before.log`). The original tests remain
unedited; new tests cover oracle loops, crossing, repeated vertices and ordinary
work. Intent and pre/post hashes are under `tmp/car12-r12/car12-p2b-profile-sweep/`.

- `bunx biome check packages/core/src/cad/loops.ts packages/core/src/cad/loops.test.ts`: exit 0, `biome-final-02.log`.
- `bun test packages/core/src/cad/loops.test.ts packages/core/src/cad/segment-sweep.test.ts packages/core/src/cad/pcb-outline.test.ts packages/core/src/cad/loop-forest.test.ts`: exit 0, 35 passed, `test-final-02.log`.
- Workspace typecheck, lint and verify are assigned to serial integration.

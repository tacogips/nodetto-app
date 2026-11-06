# crl-08-repair-labels progress

Status: incomplete. Plan hash: `d55bfe3c1985cbe17beea557a0d47146783753f5`. The plan matches the accepted design and has no dependencies.

The initial fixture probe (`tmp/crl-s753/crl-08-repair-labels/before-probe.log`) measured input crossings/label overlaps/segment overlaps 604/104/332, and after layered then route 169/2/3. It records each overlapping route pair, label hit, and gap; maximum gap was 54.698. The pairs are edge-10/edge-21 (1) and edge-14/edge-27 (2).

Nearest-gap offset sorting and test seams are implemented. After that partial change, `after-label-probe.log` measures 169/1/3, maximum gap 24.990; edge-20 hits edge-21. Route repair has not been implemented, and this is not the final measurement. The measured remaining label overlap permits further rings if still present after route repair; do not add them before remeasuring repair.

Rebaseline: the blocked-offset test no longer requires a negative Y offset because R4 chooses the closest free offset; it still checks a nonzero integral Y offset. The original on-route and BPMN behavior assertions remain.

Source hashes: label module pre `b3cf51f074816b871c9c9b0678813a8cdad5dfeb`, post `890725236d5b522b3048991ca2b86a1cc6639e45`; label test pre `2535d84dfb353aa6f0a9b6fe6817fa628271bf9a`, post `bb1c47b19c2a00b222d1c3d36c125f1f839f0323`. Intermediate snapshots and intentions are in the evidence directory. No lane source edit was made.

Final-source checks so far: targeted suite 138 pass/1 fail (fixture: 3 segment overlaps), typecheck exit 0, Biome exit 0, fixture diff exit 0, unchanged assertion check exit 0. Complete logs are under `tmp/crl-s753/crl-08-repair-labels/final/`. Native build/parity and required route/label scene and distance-bound coverage remain. These are not completion evidence; rerun all gates after implementing the repair and tests. Formal reviews and downstream plans remain pending.

## Continuation: implementation ready for review

The accepted plan matches the overlap repair and nearest-free design; dependencies: none. Current plan hash `80fe7b3a3b174997d67944e3d999a729d4c4ffd0`. The earlier status above describes the preceding attempt, not the current source.

The current run's initial probe (`tmp/crl-s754/crl-08-repair-labels/before-probe.log`) reproduces 169 crossings, 1 label overlap and 3 segment overlaps. After A/B repair, `after-ab-probe.log` records 166 crossings, 1 label overlap, 0 segment overlaps; edge-20 still hits edge-21. This measured residual justified extra offset rings. The first cardinal ring cleared the overlap but produced a gap of 132, exceeding the fixture bound; `after-ring-probe.log` records that result. Intermediate diagonal offsets then produced 166 crossings, 0 label overlaps and 0 segment overlaps, with maximum gap 80 (`after-diagonal-probe.log`, and final test log). Input crossings are 604. Tier C was unnecessary. The full probe logs contain route pairs, ports, points, label hits and individual gaps.

Rebaseline, R3 repair: the fixed/custom-bend test now accepts position-only patches; the saturated lane scene checks that repair beats the best lane-only score rather than requiring the old lane. These changes reflect the newly requested repair, while retaining fixed-route and score assertions. The earlier R4 blocked-offset rebaseline remains as recorded above.

Source pre/post hashes: lane source `4b1319eb2d09532fddfc548a1464307d516d8326` / `4a6ec809ec64ec77bc434517b9e43aa31221b40c`; lane test `61b88e37388d12bfbde36ab49808d049b964e73f` / `78f2c5dc690db5d5a5f4d20cf77d6780f87d5352`; label source `890725236d5b522b3048991ca2b86a1cc6639e45` / `2ebf7298cd51e5c0672edef8218f693992bba46f`; label test `bb1c47b19c2a00b222d1c3d36c125f1f839f0323` / `a831ed87d8b0a5dca54844740768e50fa81c9c7a`; fixture test `591234f8b2ba3c283096a8781abd924afdaa5be3` / `4e750a47e8f428d80618156d2188b0ccca670946`. Per-edit snapshots and intentions are under the evidence directory.

Final verification logs under `tmp/crl-s754/crl-08-repair-labels/final/`: targeted tests exit 0 (140 passed, 0 failed); typecheck exit 0; Biome exit 0; release native build and parity/performance tests exit 0 (5 passed, 0 failed, 0 skipped); fixture diff exit 0; original overlap assertion check exit 0. No `Math.hypot` or `Math.sqrt` occurs in the lane module. Prior failed attempts remain in `attempt-1/` and `attempt-2/`. Formal review, downstream parity/end-to-end work, and final workflow gates remain pending.

Author self-check strengthened the facing-stub scene to require an actual position shift, preventing vacuous loop-reservation checks. Final lane test hash: `a7632e0b9dfb58e7fe5b9275cc4c3eeaabaadbb8`. The prior final logs are retained in `attempt-3/`; current final gates were rerun after this test change.

## Test-integrity revision

Correction: the previous claim that the original facing-stub scene prevented vacuous loop-reservation checks was incorrect. That scene shifted only `toPortPosition` on the node without the loop; its conditional from-position checks did not establish reservation or ordering. The original scene remains intact. A new scene places both connectors as movable and the loop on their shared side: the earlier connector's only patch is `fromPortPosition: 0.4`, the later connector remains unpatched, overlap is zero, and reversed input yields the same patches. Without the loop the shift is `0.25`. A separate two-connector disjoint scene asserts no patches.

Lane test hash before revision `a7632e0b9dfb58e7fe5b9275cc4c3eeaabaadbb8`, after revision `c53571d0881fe901daa3591dff698e48127243cb`. Fresh complete logs in `tmp/crl-s754/crl-08-repair-labels/final/`: targeted suite exit 0, 142 passed and 0 failed; typecheck exit 0; Biome exit 0; release native build and parity/performance suite exit 0, 5 passed, 0 failed and 0 skipped; fixture diff and assertion check each exit 0. The preceding logs are preserved in `attempt-4/`. Independent review remains pending.

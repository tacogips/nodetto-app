# crl-08-repair-labels progress

Status: incomplete. Plan hash: `d55bfe3c1985cbe17beea557a0d47146783753f5`. The plan matches the accepted design and has no dependencies.

The initial fixture probe (`tmp/crl-s753/crl-08-repair-labels/before-probe.log`) measured input crossings/label overlaps/segment overlaps 604/104/332, and after layered then route 169/2/3. It records each overlapping route pair, label hit, and gap; maximum gap was 54.698. The pairs are edge-10/edge-21 (1) and edge-14/edge-27 (2).

Nearest-gap offset sorting and test seams are implemented. After that partial change, `after-label-probe.log` measures 169/1/3, maximum gap 24.990; edge-20 hits edge-21. Route repair has not been implemented, and this is not the final measurement. The measured remaining label overlap permits further rings if still present after route repair; do not add them before remeasuring repair.

Rebaseline: the blocked-offset test no longer requires a negative Y offset because R4 chooses the closest free offset; it still checks a nonzero integral Y offset. The original on-route and BPMN behavior assertions remain.

Source hashes: label module pre `b3cf51f074816b871c9c9b0678813a8cdad5dfeb`, post `890725236d5b522b3048991ca2b86a1cc6639e45`; label test pre `2535d84dfb353aa6f0a9b6fe6817fa628271bf9a`, post `bb1c47b19c2a00b222d1c3d36c125f1f839f0323`. Intermediate snapshots and intentions are in the evidence directory. No lane source edit was made.

Final-source checks so far: targeted suite 138 pass/1 fail (fixture: 3 segment overlaps), typecheck exit 0, Biome exit 0, fixture diff exit 0, unchanged assertion check exit 0. Complete logs are under `tmp/crl-s753/crl-08-repair-labels/final/`. Native build/parity and required route/label scene and distance-bound coverage remain. These are not completion evidence; rerun all gates after implementing the repair and tests. Formal reviews and downstream plans remain pending.

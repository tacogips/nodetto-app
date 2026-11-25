# car3-g1f-layer-capacity progress

Status: done (implementation; formal review and integration pending).

Added maximum worker arena capacity telemetry and three reference comparisons at threads 0 through 8. Staggered and band-boundary cases use L=1536 and C=1728; final row uses MAX_LAYER_WINDOW=262144. No arena behavior or goldens changed.

- Release clippy, format check and crate tests: exit 0, 185 passed, `tmp/car3-r3b/car3-g1f-layer-capacity/gate-final.log`.
- Debug final-row test: exit 0, 1 passed, `tmp/car3-r3b/car3-g1f-layer-capacity/debug-final.log`.
- Stray delta scan: exit 0, empty `tmp/car3-r3b/car3-g1f-layer-capacity/stray-delta.txt`; log `tmp/car3-r3b/car3-g1f-layer-capacity/stray.log`.
- Release timing test `tiles::tests::many_tools_exceed_limit_within_budget` exceeded its 1000 ms deadline on the first two attempts (1057 ms and 3344 ms). The first terminal output was not captured to a file; the second is `tmp/car3-r3b/car3-g1f-layer-capacity/gate.log`. The third complete gate passed unchanged.

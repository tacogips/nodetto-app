# car3-g1c-production-witness progress

Implementation complete; formal review and serial integration remain pending.

The telemetry-only pre-witness run recorded reads = 53,692,800 and charged = 53,692,800 for every thread count 0 through 8 (`tmp/car3-r3b/car3-g1c-production-witness/baseline.log`, exit 0, one test). These are now literals. Before the witness edit, `production_touching` failed for stacked caps and opposed sides with one production pair versus zero reference pairs; same-frame side passed (`fail-before.log`, exit 101, 1 passed, 2 failed).

Production now folds a volume witness only when the surface cast flags ownership sensitivity, charging every recast and separate fold. The original shading fold is retained. Tests cover both contacts, same-frame control, 0.01 mm overlaps, threads 0–8, zero disjoint witness and the stacked-cap charge delta. No goldens changed.

The assigned clippy, format and release crate gate passed (exit 0, 177 tests, `gate.log`); the per-plan stray delta passed (exit 0, `delta.log`, empty `stray-delta.txt`). `diff-check.log` is empty. Paths for these logs and source hashes are under `tmp/car3-r3b/car3-g1c-production-witness/`; see `post-sha256.txt`. Sibling g1a/g1b edits were preserved. The absolute stray scan and workspace integration gates belong to integration.

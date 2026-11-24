# car1-m-stl-refusal progress

- Implemented surviving-triangle refusal before sort, conservative encoding bound, and STL opt-in; final armor guard unchanged.
- Added baseline-failing early-refusal regression, lower-bound checks, and degenerate-heavy STL byte comparison. Existing UI sphere test verifies the size message.
- Pre/post SHA-256: `tmp/car1-r1/car1-m-stl-refusal/pre-sha256.txt` and `tmp/car1-r1/car1-m-stl-refusal/post-sha256.txt`.
- Focused biome and tests: exit 0, 35 tests; `target/car1-m-stl-refusal/logs/focused.log`.
- Baseline negative control against eb7d8c9 canonical.ts: exit 1, one expected failure; `target/car1-m-stl-refusal/logs/negative-control.log`.
- `bun run typecheck && bun test packages/nmesh packages/io/src/cad-mesh.test.ts`: exit 2; concurrent `packages/core/src/cad/history.test.ts` TS2554 errors; `target/car1-m-stl-refusal/logs/typecheck-tests.log`.
- Separately ran `bun test packages/nmesh packages/io/src/cad-mesh.test.ts`: exit 1, 28 pass, one timing failure at `packages/nmesh/src/measure.test.ts:66`; `target/car1-m-stl-refusal/logs/package-tests.log`. This test writes `tmp/cad3d/m12/measure.json`, outside the authorized artifact roots. A checkpoint amendment or approved isolation is required before rerunning it; preserve that generated output for reconciliation.
- Review and integration are downstream; no commit or push performed.

- Redispatch: focused Biome and tests exit 0 (35 pass), `tmp/car1-r1/car1-m-stl-refusal/redispatch-gate1.log`; standalone `bun run typecheck` exit 0, `tmp/car1-r1/car1-m-stl-refusal/redispatch-typecheck.log`.
- The exact second gate remains blocked: `packages/nmesh/src/measure.test.ts` writes `tmp/cad3d/m12/measure.json` outside `target`. A checkpoint amendment authorizing that output is needed before rerunning the package test; its earlier timing failure remains unresolved.

- Resume: focused gate exit 0, 35 pass, 0 fail; `tmp/car1-r1/car1-m-stl-refusal/resume-gate1-complete.log`. The exact aggregate remains blocked because `packages/nmesh/src/measure.test.ts` writes `tmp/cad3d/m12/measure.json` outside `target`; its prior timing failure remains unclassified.

- Continuation: focused Biome and tests exit 0, 35 pass, 0 fail; `tmp/car1-r1/car1-m-stl-refusal/continuation-focused-complete.log`. The package gate remains blocked pending authorization for `tmp/cad3d/m12/measure.json`; the earlier timing failure remains unclassified.

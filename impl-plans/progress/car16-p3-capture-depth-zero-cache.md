# car16-p3 capture depth-zero cache

Status: done (implementation phase). Formal review and workspace integration are downstream.

## Evidence and file hashes

Per-edit intent and pre/post SHA-256 snapshots are recorded below and in `tmp/car16-r16/car16-p3-capture-depth-zero-cache/intent-01.txt` through `intent-06.txt`.

```text
scene.ts: instrument depth predicate evaluations and expose depthVisits and pendingUpdates; no admission behavior change.
pre-sha256 beea5cfa251f648c209e5984bd8ecf63269f48423b584f0307a103279fcbf3ea
post-sha256 9ab55c983885c64d2dfe172d4440df00a03db4e1b224be898207b73566b1fc24

scene.test.ts: add depth-zero work-count and oracle cases and ordinary/one-use guards.
pre-sha256 44827280f1a1fe132e28958ef6358eb6db3b0c58ba281ae49d71d4a7471f978d
post-sha256 f5fbfe594e881b82d5402cf688716caee6fda6e5c2af3243cbe3b7a365d80b45

scene.ts: charge zero-depth scans and lazily accumulate qualifying whole-profile work, preserving mixed and explicit paths.
pre-sha256 9ab55c983885c64d2dfe172d4440df00a03db4e1b224be898207b73566b1fc24
post-sha256 bb5f8d0f2c39fb93786ac85f3cbef09621de468485fbf1724facb1b29444e585

Apply Biome formatting only to both owned source files; preserve all behavior.
packages/core/src/capture/scene.ts pre-sha256 bb5f8d0f2c39fb93786ac85f3cbef09621de468485fbf1724facb1b29444e585
packages/core/src/capture/scene.test.ts pre-sha256 f5fbfe594e881b82d5402cf688716caee6fda6e5c2af3243cbe3b7a365d80b45
bb5f8d0f2c39fb93786ac85f3cbef09621de468485fbf1724facb1b29444e585  packages/core/src/capture/scene.ts
4f1bf99bdd86d4fd9fc599b59ffb6b472b0123c8ca58a5b95b76b1650ab8a572  packages/core/src/capture/scene.test.ts

Mark assigned implementation done criteria after successful focused gate and fail-before evidence.
pre-sha256 5be1d1de31f39dcad7fa6d37cd1006c4fadaa81533aee4bc9bb7df2dd24f3413
post-sha256 4f09e611bc0fa36afe2c367ddb244ea362aa192fe63cbb570317cfce9f8cafd8
```

## Verification

- `bun test packages/core/src/capture/scene.test.ts`: exit 1 (expected negative control), 44 pass, 2 fail; `tmp/car16-r16/car16-p3-capture-depth-zero-cache/fail-before.log`. The 4096 x 2 case measured 8192 visits, zero admissions and zero hits.
- `bunx biome format --write packages/core/src/capture/scene.ts packages/core/src/capture/scene.test.ts`: exit 0; `tmp/car16-r16/car16-p3-capture-depth-zero-cache/format.log`.
- `export CARGO_TARGET_DIR=target/r16-capture-depth && bunx biome check packages/core/src/capture/scene.ts packages/core/src/capture/scene.test.ts && bun test packages/core/src/capture/scene.test.ts`: exit 0, 46 pass, 0 fail; `tmp/car16-r16/car16-p3-capture-depth-zero-cache/gate.log`.

## Assertions verified

- 4096 x 2: visits 4096, admissions 1, lookups 1, hits 1; oracle bytes equal.
- 256 x 32: visits 4096, admissions 1, lookups 16, hits 16, pending updates positive; oracle bytes equal. 256 x 64: visits 4096, hits 48.
- 63 x 2: visits 126, pending updates 0, admissions 0. 64 x 2: pending updates positive, admissions 0.
- One-use 500 x 1: visits 500, max direct work 1, pending updates/lookups/admissions/hits 0.
- Ordinary 500 x 18: visits 500, pending updates/lookups/admissions/hits 0, max direct work 775, ancestry probes 5000, index entries 5500, fallback 0.
- Existing mixed-depth, explicit subset, shared PCB and oracle tests pass. No goldens changed.

Workspace typecheck, lint and verify are reserved for serial integration per the accepted plan. No deviations.

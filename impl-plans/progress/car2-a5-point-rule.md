# car2-a5-point-rule progress

Status: done (implementation; formal review and integration pending).

Design section 20.2 R2-3 and the plan align: the writer owns the shared rule; pre-allocation walking is downstream. Whole-prism charging precedes the per-loop mismatch check, the accepted tradeoff for internally inconsistent models.

SHA-256 before -> after:
- packages/core/src/capture/scene-binary.ts: 0cb565e007cebb19dd033e9b7e5a379d201a5d256e8f7fbc0a9ebf460416d9de -> b5cc610eed62a6de6fb741e735799c9caa907ad505902f9370801c53f0dbfd15
- packages/core/src/capture/scene-binary.test.ts: 390dc040ed7a70bee6f268601129fd7994eb92a49454c3b6506fff823800c3d2 -> d7106b7a0052aa3f0d4cd9689a9f9f574f6f38bbd1e72cac59b9a7cd48b0d554
- This progress file: absent before; post hash recorded in attempt-1/progress.sha256.

Baseline 3cd2401 fixture SHA-256: plate 855b169a9485379de21b4dc78aa90c6879728a6dcaed70fb6704ccf830a342c9; selected loops 365d6eb54ecd35dddcac7a0c47a0b75df86c42574ed1b156d4ce1a951b510052. New writer output tests match both.

Commands and complete logs (also mirrored under target/car2-a5-point-rule/logs/):
- Negative control: `bun test packages/core/src/capture/scene-binary.test.ts --test-name-pattern 'shared point accounting|header validation'`, exit 1 before implementation, tmp/car2-r2b/car2-a5-point-rule/attempt-1/negative.log.
- `bunx biome check --diagnostic-level=warn packages/core/src/capture/scene-binary.ts packages/core/src/capture/scene-binary.test.ts`, exit 0, tmp/car2-r2b/car2-a5-point-rule/attempt-1/biome.log.
- `bun test packages/core/src/capture/scene-binary.test.ts packages/core/src/capture/scene.test.ts packages/core/src/capture/determinism.test.ts`, exit 0, 39 passed, tmp/car2-r2b/car2-a5-point-rule/attempt-1/tests.log.
- `bunx tsc --noEmit --strict --noUncheckedIndexedAccess --skipLibCheck --target ES2022 --module ESNext --moduleResolution bundler --allowImportingTsExtensions packages/core/src/capture/scene-binary.ts`, exit 0, tmp/car2-r2b/car2-a5-point-rule/attempt-1/typecheck.log.

Workspace-wide checks and formal review are integration-owned. Existing round-1 tmp test copies remain an integration cleanup item.

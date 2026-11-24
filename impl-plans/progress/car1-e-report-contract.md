# car1-e-report-contract progress

Shared validation is used by CLI and desktop before the picker. Added individual mismatch tests and matching cancellation reports; preserved the PCB page-kind behavior and test. Formal review and integration are downstream.

## Pre-edit SHA-256

```
d9833bb9039f28ce57f4533a69aea95a38c16e22844a8d2c0be1c9bab58acc95  packages/core/src/capture/report.ts
5acbaa80eb203ce4326a578dd4e09d5bef2b05910c96254cefac580631e78be4  packages/core/src/capture/report.test.ts
ef011e7abaf58cdfeacd78299702ab05cd103d54a64afb31d05c5ce90ef8099d  apps/cli/src/capture-cad.ts
5026235da6d40f5f6cbfa7ae500bbf031f4789270004323b8a8c5e913a99b2fd  apps/cli/src/capture-cad.test.ts
9b4b28cf2375505977459b4288471b47165bcc1a1d71d2821ebfc6f3c072b158  apps/desktop/src/shell/export-handlers.ts
6bc6187a2ab782b79d7e8c99d0fddb9342584a163d109102687f75a372c14700  apps/desktop/src/shell/export-handlers.test.ts
eb26838cc8e495b016b0302c4d0355f28779555c1164695f1413242bb1e4ad8c  impl-plans/active/car1-e-report-contract.md
```

## Post-edit source SHA-256

```
0e78632530111279c2b7a7ee776456b63a1bf3cbfd58fcada2d2eb102c233217  packages/core/src/capture/report.ts
63465afdb72ab236ba365484f2aad60f0875d3b75bc6a2a1d3117f1cb1b34b7e  packages/core/src/capture/report.test.ts
59f6f1419675e04ed25f069f3c16b5207381718d1ce580998d31502f454701ba  apps/cli/src/capture-cad.ts
a81b45f74a496e1a7fd16df6dbf192054b4c2599a479c24cf2fc891803382f45  apps/cli/src/capture-cad.test.ts
34b2f3512486535cfd0dbe54b4c2722a8bef3bc2074224cd34cc512d3e29c7fa  apps/desktop/src/shell/export-handlers.ts
0780c58258e3de33789b8857f2fe4d4c5c087f5bb0a363c0b33bf1acfa74e734  apps/desktop/src/shell/export-handlers.test.ts
```

## Verification

- `PATH="$PWD/node_modules/.bin:$PATH" biome check packages/core/src/capture/report.ts packages/core/src/capture/report.test.ts apps/cli/src/capture-cad.ts apps/cli/src/capture-cad.test.ts apps/desktop/src/shell/export-handlers.ts apps/desktop/src/shell/export-handlers.test.ts && bun test packages/core/src/capture/report.test.ts apps/cli/src/capture-cad.test.ts apps/desktop/src/shell/export-handlers.test.ts`: exit 0, 58 pass; `target/car1-e-report-contract/logs/gate1-final.log`.
- `bun run typecheck && bun test apps/cli/src/capture-command.test.ts packages/ui-solid/src/cad/strict-index.test.ts`: exit 0, 44 pass; `target/car1-e-report-contract/logs/gate2-final.log`.
- Baseline negative control: `bun test target/car1-e-report-contract/negative/apps/desktop/src/shell/export-handlers.test.ts --test-name-pattern 'CAD capture rejects mismatched report'`: exit 1, all 3 mismatches fail against the eb7d8c9 desktop handler; `target/car1-e-report-contract/logs/negative-control-2.log`. The harness uses current dependencies and tests.
- Earlier negative-control attempt failed to resolve workspace packages before tests; `tmp/car1-r1/car1-e-report-contract/negative-control.log`.

## Test-integrity revision: car1-e-TI-1-negative-harness-discovered

Renamed the plan-owned baseline test copy to `target/car1-e-report-contract/negative/apps/desktop/src/shell/export-handlers.baseline-control.ts.txt`. The existing negative-control logs remain unchanged: exit 1, three expected failures. The earlier `gate1-final.log` predates the harness and is superseded. Reproduction before the rename: exit 1, 66 pass, 5 fail, `tmp/car1-r1/car1-e-report-contract/review-reproduction.log`.

- Discovery check: `find target/car1-e-report-contract \( -name '*.test.ts' -o -name '*.spec.ts' \) -print` exited 0 with no output; `tmp/car1-r1/car1-e-report-contract/review-discovery.log`.
- `shasum -a 256 -c tmp/car1-r1/car1-e-report-contract/post-sha256.txt` exited 0; all six files match, `tmp/car1-r1/car1-e-report-contract/review-hashes.log`.
- Exact gate 1 rerun: exit 0, 58 pass, 0 fail, Bun reports 4 files; `tmp/car1-r1/car1-e-report-contract/gate1-rerun.log`, copied to `target/car1-e-report-contract/logs/gate1-rerun.log`.
- Exact gate 2 rerun: exit 0, 44 pass, 0 fail, Bun reports 3 files; `tmp/car1-r1/car1-e-report-contract/gate2-rerun.log`, copied to `target/car1-e-report-contract/logs/gate2-rerun.log`.

The passing test counts match the plan; Bun's file counts are one higher than the review's expected counts despite no discoverable test file in this plan's artifact directory. Integration review remains downstream.

## Continuation: test discovery evidence

`bun test --reporter=junit --reporter-outfile=target/car1-e-report-contract/discovery-report.xml packages/core/src/capture/report.test.ts apps/cli/src/capture-cad.test.ts apps/desktop/src/shell/export-handlers.test.ts` exited 0 with 58 tests and no failures. The XML identifies exactly three test suites: `apps/cli/src/capture-cad.test.ts` (29), `apps/desktop/src/shell/export-handlers.test.ts` (13), and `packages/core/src/capture/report.test.ts` (16). Its console still reports four files; the extra count has no test suite in the report. Complete console log: `tmp/car1-r1/car1-e-report-contract/discovery-junit.log`.

Both exact gates were rerun: gate 1 exited 0, 58 pass, 0 fail (`tmp/car1-r1/car1-e-report-contract/gate1-continuation.log`); gate 2 exited 0, 44 pass, 0 fail (`tmp/car1-r1/car1-e-report-contract/gate2-continuation.log`). The summary's four-file count remains unexplained; independent review should assess the three-suite JUnit evidence against the literal three-file criterion.

## Continuation: duplicate discovery resolved

Removed the three plan-owned negative-harness symlinks to workspace packages and node_modules, preserving the archived harness and its negative-control logs. This resolved the extra discovery count: the exact gate 1 now exits 0 with 58 pass, 0 fail across 3 files (`tmp/car1-r1/car1-e-report-contract/gate1-continuation-2.log`). Gate 2 exits 0 with 44 pass, 0 fail (`tmp/car1-r1/car1-e-report-contract/gate2-continuation-2.log`). Copies are in `target/car1-e-report-contract/logs/`. No test or spec file remains under the plan artifact directory (`continuation-2-discovery.log`); all six source hashes still match (`continuation-2-hashes.log`).

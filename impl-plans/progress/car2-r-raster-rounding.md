# car2-r-raster-rounding progress

Status: done.

Implemented shared capturePixelSpan and plan dimensions in pixelFrame; added decimal boundary core and CLI regressions. Pre-fix tests: 53 passed, 2 failed (expected regressions), exit 1, `tmp/car2-r2b/car2-r-raster-rounding/attempt1/pre-fix.log`. Final focused tests: 54 passed, 1 failed, exit 1, `tmp/car2-r2b/car2-r-raster-rounding/attempt1/final-tests.log`. The unchanged deterministic test expects 1020x1121 for 3000x3296; the required rounding rule allows scale 0.341 and produces 1023x1124, instead of prior scale 0.340. This conflicts with unchanged admitted PNG dimensions and the requirement that the test pass unedited. A design decision is required before proceeding. Core tests exit 0 (11 passed), `tmp/car2-r2b/car2-r-raster-rounding/attempt1/core-tests.log`; scoped Biome exit 0, `tmp/car2-r2b/car2-r-raster-rounding/attempt1/biome.log`. Commands are recorded in the final handoff. Review and integration remain downstream.

## Pre-edit SHA-256

```text
d580a77385f5a4b403a0ad3994037510505bc2a069e0b99baddc1f5ad34904dc  packages/core/src/capture/raster-fit.ts
01f91bfc1258440890533dfcd6262a9e0d67fb7c5a12b0335a982360bef0fb3c  packages/core/src/capture/raster-fit.test.ts
2b5bcd1e64d7c9bcc8ff854e9d2e60614fcd1a663c0bb186d88d36482a5a79dc  apps/cli/src/capture-artwork.ts
873c7cdb15e372ad960d415dc150394475bf81c474ab3fe8e85ee6e0a72ae561  apps/cli/src/capture-command.test.ts
2f3ce7e7c6164fa3bb2b30d0db1ee9019e81a6a4c4e6d65335a23e1fe8b63a7b  impl-plans/active/car2-r-raster-rounding.md
```

## Post-edit SHA-256 (source files and unchanged plan)

```text
b80ba730bf3fc2445da0e6a151ee4da372b252fa2a6427dc52f2665300e1cb98  packages/core/src/capture/raster-fit.ts
ec71fc418cf52b8bf3dee1959f9346758fb63d83609d2953ecef623d95a8b5df  packages/core/src/capture/raster-fit.test.ts
1cb5c4bbddb582deff2dc359d5bce5a4c5a8e733145ebe1b562de681cf3a8ee2  apps/cli/src/capture-artwork.ts
39644eff509baf712c035b4ecfb1fef26b6e353c745036d99216f59b5f020a38  apps/cli/src/capture-command.test.ts
2f3ce7e7c6164fa3bb2b30d0db1ee9019e81a6a4c4e6d65335a23e1fe8b63a7b  impl-plans/active/car2-r-raster-rounding.md
```

Progress log was absent before this update; its post-edit hash is recorded in `tmp/car2-r2b/car2-r-raster-rounding/attempt1/progress-sha256.txt`.

## Integration review INT-R10-01

The plan amendment resolves the former conflict: the corrected default fit is
1023 x 1124 at 0.341. Only that existing expectation changed. Earlier blocked
status and failure details above are historical; review and integration remain downstream.

| File | SHA-256 before | SHA-256 after |
| --- | --- | --- |
| `apps/cli/src/capture-command.test.ts` | `39644eff509baf712c035b4ecfb1fef26b6e353c745036d99216f59b5f020a38` | `815245513b7862a96a378a1e6df81535acd9ac6e2fcdc57e090b54370aacb861` |
| `impl-plans/active/car2-r-raster-rounding.md` | `2f3ce7e7c6164fa3bb2b30d0db1ee9019e81a6a4c4e6d65335a23e1fe8b63a7b` | `a023c3032ded610b9b989d6fee82ce41a396ea7f95b6592f81d5480142a24f0a` |
| `impl-plans/progress/car2-r-raster-rounding.md` | `15c9f248f5399ca7f0f4b6096e01e903920b775f99f0b195cea2e58f3f64180e` | recorded in `tmp/car2-r2b/car2-r-raster-rounding/attempt2/progress-post-sha256.txt` |

- Reproduction: `bun test packages/core/src/capture/raster-fit.test.ts apps/cli/src/capture-command.test.ts`, exit 1, 54 pass, 1 fail, `tmp/car2-r2b/car2-r-raster-rounding/attempt2/reproduction.log`.
- `bun test packages/core/src/capture/raster-fit.test.ts apps/cli/src/capture-command.test.ts`, exit 0, 55 pass, 0 fail, `tmp/car2-r2b/car2-r-raster-rounding/attempt2/focused-tests.log`.
- `bun test packages/core/src/capture/raster-fit.test.ts apps/cli/src/capture-command.test.ts apps/cli/src/capture-cad.test.ts`, exit 0, 84 pass, 0 fail, `tmp/car2-r2b/car2-r-raster-rounding/attempt2/tests.log`.
- `bunx biome check --diagnostic-level=warn packages/core/src/capture/raster-fit.ts packages/core/src/capture/raster-fit.test.ts apps/cli/src/capture-artwork.ts apps/cli/src/capture-command.test.ts`, exit 0, `tmp/car2-r2b/car2-r-raster-rounding/attempt2/biome.log`.
- `git diff 3cd2401 -- apps/cli/src/capture-command.test.ts`, exit 0, `tmp/car2-r2b/car2-r-raster-rounding/attempt2/test-diff.log`; shows only the planned regression and the amended expectation.

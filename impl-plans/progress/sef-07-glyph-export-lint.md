# sef-07 glyph export and lint progress

PNG/PDF coverage and warnings and separate glyph lint page selection are wired. SVG bypasses coverage. Implementation gates pass on the shared working tree; formal review and stable integration verification remain downstream.

## Continuation

The focused suite covers fallback gating, attribution, quiet output, page eligibility and existing errors. The native parity suite exercises raster warnings, lint, custom fonts and macOS fallback. Its first run exposed a test expectation error caused by the editor's default notation page; the final fixture isolates the requested page and verifies the ERD-only behavior.

Final checks: `bun test apps/cli/src/glyph-commands.test.ts` (6 pass); the seven-file CLI regression command (100 pass); `bun run typecheck` (exit 0); the four-file Biome check (exit 0); release build plus the three native parity suites (12 pass, 0 fail, 0 skip); `test -x target/sef-baseline/nodetto-cli` (exit 0). Complete logs are in `tmp/sef-s733/sef-07-glyph-export-lint/`, including `continuation-glyph-final.log`, `continuation-regression-final.log`, `typecheck-final2.log`, `biome-final4.log`, `native-final.log` and `baseline-check.log`. The first native attempt is preserved as `native-attempt1.log`.

CPU comparison: baseline `target/sef-baseline/nodetto-cli` from archive `29f8691135fb6098a9496495f4a417e93ce0625e`, current `target/release/nodetto-cli`; three `/usr/bin/time -p` runs each using a 300-node CJK document and a where update expecting 300. User seconds baseline/current: lint [0.86, 0.89, 0.87] / [0.84, 0.76, 0.87] (mean ratio 0.943); PNG [1.37, 1.35, 1.29] / [1.23, 1.13, 1.17] (0.880); edit [10.16, 9.22, 9.57] / [8.46, 9.82, 7.48] (0.890). All 18 commands exited 0. Complete commands and logs: `tmp/sef-s733/sef-07-glyph-export-lint/cpu-agent-time.sh` and `cpu-agent-summary.log` in that directory. These checks ran on the shared working tree, not a stable integration snapshot.

## Test-integrity revisions

Added assertions that covered ERD lint reports the no-pages error and does not reject `--font-dir`. The unknown-option parser path has different stderr, so losing the option fails this test. Added an overflowing freeform label and asserted its notation finding is unchanged when an ERD glyph row is present. Existing ERD, selection and config assertions remain. The focused suite passed 6 tests, and the regression suite passed 100; typecheck and Biome passed. Logs: `ti-revision-focused.log`, `ti-revision-regression.log`, `ti-revision-typecheck.log`, and `ti-revision-biome.log` under `tmp/sef-s733/sef-07-glyph-export-lint/`. The full native gate is recorded in `ti-revision-native.log`.

The native gate's first revision attempt timed out in an existing 60-second export test under load (11 pass, 1 fail; `ti-revision-native.log`). The second attempt passed 12 tests with 0 failures and 0 skips, without changing deadlines (`ti-revision-native-retry2.log`).

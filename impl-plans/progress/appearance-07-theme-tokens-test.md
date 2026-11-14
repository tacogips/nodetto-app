# appearance-07-theme-tokens-test implementation progress

## Intent snapshot

Add one durable CSS test suite for the accepted appearance-token contracts: no desktop chrome literals outside the exact token allowlist, all desktop variables declared, light/dark token parity, unchanged design light values, light document paint pin, WCAG contrast, ui-solid fallback equality, and export isolation. Keep all tests read-only and include inline negative checks. Do not change CSS unless a dark-only contrast failure requires it.

## Dependency readiness

The dispatched plan lists `appearance-03-chrome-tokens`, `appearance-04-canvas-css` and `appearance-05-ui-solid-chrome-css` in `acceptedPlanIds`; all three `dependsOn` entries are satisfied. Their progress logs were read, the plan 03/05 token registries were used, and both logs ended in `STATUS: done`.

## Source and edit evidence

- Before implementation, `apps/desktop/src/style.test.ts` SHA-256: `a49ac7bd4aef894779cbbee68357bbb52df816fca957a397bd9ec35f80106f0c`.
- Initial shared CSS: `base.css` SHA-256 `4c7404d38821afc97dd807a62944a579603e7e9545b11aaa4604b477dc348f12`; `canvas.css` SHA-256 `e09226e28bb892bb1720445d02146ececc3136f33b7761f70ccfb204e402c4c3`.
- Edit intentions and before-edit source hashes: `tmp/canvas-theme-s539/appearance-07-theme-tokens-test/edit-intent-001.md`.
- Durable test file: `apps/desktop/src/styles/theme-tokens.test.ts`, final SHA-256 `c5983356928129856c14f4bc5d0ed735c1b107a3c9554f43dd396ea5b6e15590`.
- Shared CSS hashes are unchanged; plan 07 made no shared-path edits and no dark-value adjustments.

## Implementation findings

- No desktop literal or undeclared-variable findings were found by the new tests. No finding was assigned to another plan, so no sibling CSS was changed.
- Case 3 initially treated any additive token as a failure; the first run identified that the test must compare only the hard-coded original 13 values and the light canvas table. The helper was corrected to ignore additional tokens, per the plan contract. The earlier failure is retained at `tmp/canvas-theme-s539/appearance-07-theme-tokens-test/test-attempt-002.log` (exit 1, 1 failed test, before the correction). No runtime source was affected.
- Color normalization handles short/long hex with alpha, RGB/RGBA, HSL/HSLA, and white/black; alpha foregrounds are composited over the measured background for contrast.

## Verification

| Command | Exit | Result / log |
| --- | ---: | --- |
| `bun test apps/desktop/src/styles/theme-tokens.test.ts apps/desktop/src/style.test.ts` | 0 | 14 passed, 0 failed, 19 assertions. This includes all eight required cases (1, 1b, 2-7), five negative inline tests, and the existing style test. `tmp/canvas-theme-s539/appearance-07-theme-tokens-test/test.log` |
| `bun run typecheck` | 0 | `tsc --noEmit` passed. `tmp/canvas-theme-s539/appearance-07-theme-tokens-test/typecheck.log` |
| `bunx biome check apps/desktop/src/styles/theme-tokens.test.ts --diagnostic-level=warn` | 0 | One changed file checked. `tmp/canvas-theme-s539/appearance-07-theme-tokens-test/biome.log` |
| `bunx biome format --write apps/desktop/src/styles/theme-tokens.test.ts` | 0 | Formatted the owned test file. `tmp/canvas-theme-s539/appearance-07-theme-tokens-test/format.log` |
| `test -s impl-plans/progress/appearance-07-theme-tokens-test.md` | 0 | Progress log exists and is nonempty. `tmp/canvas-theme-s539/appearance-07-theme-tokens-test/progress-exists.log`; exit record `tmp/canvas-theme-s539/appearance-07-theme-tokens-test/progress-exists.exit` |
| `bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess` | 2 | NOT GREEN: 91 diagnostics, identical to the preimplementation checkpoint 58c8171 baseline; 0 diagnostics in `theme-tokens.test.ts`. This is a pending baseline-disposition candidate for independent review, not a passing gate. Current log `tmp/canvas-theme-s539/appearance-07-theme-tokens-test/unchecked-typecheck.log`; baseline log `tmp/canvas-theme-s539/step4/unchecked-baseline.log`; comparison `tmp/canvas-theme-s539/appearance-07-theme-tokens-test/unchecked-comparison-final.json`; comparison output `tmp/canvas-theme-s539/appearance-07-theme-tokens-test/unchecked-comparison-final.log` (exit 0). |

The first test run before fixing the case-3 helper also passed 13 tests and failed 1; its complete log is retained above. The standard `bun run typecheck` and final-source test/Biome runs pass. The stricter repository-wide `noUncheckedIndexedAccess` compiler run remains non-green at its pre-existing baseline; the comparison JSON reports 91 equal assertions, empty aggregate-only and baseline-only sets, and zero diagnostics in this plan's test. No `cargo` command was needed.

## Completion

Implementation is complete for the assigned plan. Combined-tree `mise run verify`, build, formal review, and reconciliation are owned by downstream workflow steps.

STATUS: done

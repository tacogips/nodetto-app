# sef-04 glyph attribution progress

Implemented the pure attribution, document coverage aggregation, and capped message contracts in `apps/cli/src/glyph-coverage.ts`; focused tests cover the pinned cases. Export and lint integration are owned by sef-07.

Completion criteria: all three functions exported; focused tests (4 passed), typecheck, scoped Biome check, and forbidden-import/split check passed on the moving shared tree. Complete logs and per-edit intentions are in `tmp/sef-s733/sef-04-glyph-attribution/`. An earlier typecheck failed on concurrent `apps/cli/src/edit/operation-fields.ts`; the final rerun passed. An earlier Biome check flagged the required ASCII regex; a targeted explanatory suppression resolved it. Formal review and stable integration verification remain downstream.

Redispatch for SERIAL-W1-EVIDENCE-SEF04: both source files match the prior `after:implementation-progress-check` snapshot by SHA-256. The four required gates were rerun on the shared tree and exited 0; the focused suite ran 4 tests with 0 failures. Complete logs are in `tmp/sef-s733/sef-04-glyph-attribution/redispatch/`. The three pinned exports remain present. Test-integrity and adversarial decisions and artifact capture remain downstream workflow steps.

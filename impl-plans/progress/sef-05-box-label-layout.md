# sef-05 box-label layout progress

Implementation complete on the shared working tree. The IR marker is validated and preserved; shared geometry gates box label alignment on it. Node and geo SVG, canvas and lint geometry honor top and bottom, while middle retains the previous expressions. Sequence participants and notes retain their prior behavior. Neutral tests cover legacy unbound, bound, detached and draw.io cases, marker serialization, geometry, overflow and canvas style.

Plan verification on the moving shared tree:

- Targeted tests: 179 passed, 0 failed (`final/targeted.log`).
- Core, shapes and io tests: 1804 passed, 5 skipped, 0 failed (`final/broad-final.log`).
- `bun run typecheck`: exit 0 (`final/typecheck.log`). An earlier run encountered a concurrent diagnostic in `apps/cli/src/edit/operation-fields.ts`; the rerun passed.
- Plan strict diagnostic filter: exit 0 (`final/strict-gate.log`; full diagnostics `final/strict.log`). The known pre-existing `packages/core/src/diagram-lint/node-overlap.ts(97,13)` TS7022 remains outside scope.
- Scoped Biome check: exit 0 (`final/biome.log`). Fixture status was empty (`final/fixtures.log`); core export is present (`final/export.log`).

Formal integrity, adversarial and integration review, stable-tree final verification, staging and commit remain downstream workflow steps. Edit-layer marker writes belong to sef-06.

Redispatch for SERIAL-W1-EVIDENCE-SEF05: the existing source was checked against this record and the accepted marker and geometry design; no source changes were made. All five manifest gates exited 0 on the shared tree. Fresh logs are `redispatch/gate-1.log` through `redispatch/gate-5.log`: 179 targeted tests passed; 1804 broad tests passed, 5 skipped; typecheck and Biome passed. The strict filtered gate passed; its complete compiler output is `final/strict.log` and includes diagnostics outside the selected production files, including the known node-overlap diagnostic. The fixture status contains `apps/cli/src/__fixtures__/test-font.ts` from sef-03, not this plan; the core export remains present. Existing goldens were not regenerated. Typed integrity and adversarial decisions and artifact capture remain downstream review steps.

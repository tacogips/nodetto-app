# schematic-39-ui-wire-tool progress

Implementation complete for the assigned plan. The wire tool classifies stored-field keys, routes pointer clicks with Shift, keeps endpoint junction candidates, applies the wire and junctions in one batch, rejects labelled crossings and checks coordinate ranges before applying. Drafting uses the existing Enter and Escape paths.

Continuation regressions cover endpoint-on-interior snapping, plain crossings, deliberate T starts, lattice joinables, finishing-target and Enter range rejection, pending junction preservation, notice lifecycle, and undo/redo history. Earlier tests cover both corner orders, crossing round-trip connectivity, two-junction atomic undo, classify-once behavior, candidate replacement, double-clicks, boundary serialization and Escape.

Focused tests and Biome are recorded under `tmp/schematic-s933/schematic-39-ui-wire-tool/`. Formal test-integrity, adversarial and integration reviews and the serial integration gate are downstream. No git write operations were performed.

## SCH39-DBLCLICK-T-JUNCTION

Review repair preserves the kept endpoint keys and junction when a repeat click adds no point, including the finish path. A new double-click regression checks the junction, net connectivity and atomic undo. Before the fix it failed with zero junctions; see `tmp/schematic-s933/schematic-39-ui-wire-tool/review-317-regression-before.log`. Independent re-review remains downstream.

## 2026-11-27: INT-S933-W14-CAD-EMITTER-CIRCUIT

The approved writePaths amendment adds `packages/core/src/cad/emitters.test.ts` and `design-docs/specs/design-cad3d.md`. Classified `interaction/circuit.ts` as C and documented its schematic-only wire and junction commits in row C; existing entries and guard text remain intact.

SHA-256 before -> after:
- `packages/core/src/cad/emitters.test.ts`: `ef09b2cf26dafc84d54c4ae1225ee0f2b0c2eb1cac3da0cdc94db7624c98eaf7` -> `36c31f6c97cea3ecec52797372e8372eb1a13a54228ecc0a189dc5b69cb1913b`.
- `design-docs/specs/design-cad3d.md`: `de0024cec6ae0f875369c1c70f3c8574efa08853d0ac9bbe37a01f6ea6a45d69` -> `46a4df53e045df720cd1029eae5742072982b2ea7578fe1721142745f4275611`.

Verification logs in `tmp/schematic-s933/schematic-39-ui-wire-tool/`: `amendment-emitters.log` (7/0), `amendment-ui-exact.log` (45/0), `amendment-plan39.log` (31/0), `amendment-biome.log`, `amendment-biome-ui.log`, `amendment-hash45.log`, `amendment-hash46.log` and `amendment-diff.log` (all exit 0). The pre-fix reproduction is `amendment-before-rerun.log` (6/1). Formal review and the full integration suite remain downstream.

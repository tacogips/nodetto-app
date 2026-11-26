# schematic-37-ui-problems-panel progress

Implemented the schematic and PCB problems panel and exported its component, props, row type and helpers. ERC and parity rows preserve their focus page, reference repair uses the editor annotation action, and projection only changes a breadboard card after a successful conversion. The panel uses the existing styles and native controls with a 300 ms refresh debounce.

Finding SCH-939-W7-ADMISSION-MISREAD-37: both dependencies were admitted in the assigned dispatch; implementation proceeded. The regression tests cover all five ERC rules, reference repair, PCB cross-page focus, successful projection, and sparse IC failure with an unchanged serialized target card. Existing breadboard problems tests are unchanged.

Verification: `bun test packages/ui-solid/src/schematic-problems.test.ts packages/ui-solid/src/breadboard-problems.test.ts` and `bunx biome check packages/ui-solid/src/SchematicProblemsPanel.tsx packages/ui-solid/src/schematic-problems.ts packages/ui-solid/src/schematic-problems.test.ts packages/ui-solid/src/index.ts`. Complete logs and hashes are under `tmp/schematic-s933/schematic-37-ui-problems-panel/`. Formal review and downstream desktop integration remain workflow-owned.

# Progress: breadboard-18-example-docs

## Status

The assigned implementation is complete. The example, CLI goldens, docs, README section, and assigned tests are authored. No product code or KiCad fixture was changed by this plan. The earlier own-export KiCad round-trip failure is resolved on the current shared source: `SW1` reimports as `breadboard.button`, and the focused suite passes.

## Implemented

- Added `examples/breadboard/led-button.jsonl`: half board; BT1 5V; SW1 PUSH across the channel; R1 220 with the catalogue-default span; red D1; VCC/GND wires. The net names are GND, VCC, N_D1_1, and N_R1_1.
- Generated the BOM, KiCad-style netlist, and SPICE output from the CLI and checked in their exact bytes.
- Added golden tests for connectivity, clean lint, output bytes, SVG details, KiCad fixture targets, own-export round trip, staged ratsnest completion, pin lattice, and documentation contracts.
- Added the format, ERC rules, and KiCad import guides; the examples README; and the root README CLI examples and breadboard section.

## Verification (final source)

| Command | Result | Evidence |
| --- | --- | --- |
| `mise exec -- bun test packages/core/src/breadboard/export-golden.test.ts packages/core/src/breadboard/kicad-golden.test.ts packages/core/src/breadboard/docs.test.ts` | Exit 0; 13 passed, 0 failed. | `tmp/breadboard-mode-s485/breadboard-18-example-docs/current-rerun/focused.log` |
| `mise exec -- bun test packages/core` | Exit 0; 1245 passed, 4 skipped, 0 failed. | `tmp/breadboard-mode-s485/breadboard-18-example-docs/current-rerun/core.log` |
| `mise exec -- bun run typecheck` and G1 owned-file/global error greps | Exit 0; no TypeScript diagnostics, G1 clean. | `tmp/breadboard-mode-s485/breadboard-18-example-docs/current-rerun/typecheck.log`, `g1.log` |
| `mise exec -- bunx biome check packages/core/src/breadboard/export-golden.test.ts packages/core/src/breadboard/kicad-golden.test.ts packages/core/src/breadboard/docs.test.ts` | Exit 0; 3 files checked. | `tmp/breadboard-mode-s485/breadboard-18-example-docs/current-rerun/biome.log` |
| `mise exec -- bun apps/cli/src/main.ts lint examples/breadboard/led-button.jsonl` | Exit 0; stdout and stderr are empty. | `tmp/breadboard-mode-s485/breadboard-18-example-docs/current-rerun/lint-stdout.txt`, `lint-stderr.txt` |
| CLI BOM, KiCad netlist and SPICE `--check` commands | All exit 0; each golden is up to date. | `tmp/breadboard-mode-s485/breadboard-18-example-docs/current-rerun/bom-check.log`, `kicad-check.log`, `spice-check.log` |
| ASCII whole-file gate for examples, docs, three owned tests; README added-line gate; `git diff --check -- README.md` | All exit 0. | `tmp/breadboard-mode-s485/breadboard-18-example-docs/current-rerun/ascii-files.log`, `ascii-readme.log`, `diff-check.log` |
| Golden contract counts | Exit 0; BOM has 5 lines and KiCad output has 4 nets. | `tmp/breadboard-mode-s485/breadboard-18-example-docs/current-rerun/golden-counts.log` |

## Resolved prior issue

An earlier shared-tree run failed the own-export assertion because `SW1` reimported as `breadboard.ic`. The current-source rerun passes all 13 focused tests, including the expected `breadboard.button` type and matching net partition. The predecessor-owned importer/exporter correction is present in the combined tree; this plan made no edits outside its assigned paths.

## Edit intent and hashes

Per-edit intent snapshots are under `tmp/breadboard-mode-s485/breadboard-18-example-docs/edit-*.md`. New files were absent before creation. `README.md` pre-edit SHA-256 was `a9e3245f13459daaf2efd5859db6b1bd3d92f4d4cd2034996d7d909986576e8f8`; post-edit SHA-256 is `bd397c6f62edd2d94c2acf9c16bd8454aac0dfe23d6f3adaccf63d6952e4ecf9`.

Final authored-file SHA-256 values:

- `examples/breadboard/README.md`: `e9d8792d2eec7bfd1d52bf3df1dc389dfdcd37704c48265b597a082b670ca3a2`
- `examples/breadboard/led-button.jsonl`: `3695f96414d48909db83dc2187d4c979646c8941f21f17baa09338e7bf282c06`
- `examples/breadboard/led-button.bom.csv`: `acaa2b0a4bf844dbbf04120976d6800c5359f94c5d742e5f9a6460a3a8c327a7`
- `examples/breadboard/led-button.net`: `31c0eeca4eaff02e40ae512b81f11d05354d4798a2df8cf38c88ca7eb8ffd34e`
- `examples/breadboard/led-button.cir`: `a1a64398f36c64a0972f26dbad1ffdc5e8ca059b43cc62bb2bb60f084e043e62`
- `docs/breadboard/format.md`: `cf5aedf3af0835e76aa2e4667de58df5d6540cf18822e91631748f176f47d59e`
- `docs/breadboard/erc-rules.md`: `fe8dd39bbed86cf2b754b1b085beebfdb7c0439807e4c09707539cdbb76042ee`
- `docs/breadboard/kicad-import.md`: `a875c36efaebd6ce0931500315f22d1195030fcbb8137183485d5f3ece715b95`
- `packages/core/src/breadboard/export-golden.test.ts`: `d6e4013373e144aa97af9ff219115f71ae84c41a1e5ebcfedec6034e6e3e0f0c`
- `packages/core/src/breadboard/kicad-golden.test.ts`: `63e0fe3f2c21548b85b6f84b0598fb91424eda3b43a3d4f770ac01850a5f7144`
- `packages/core/src/breadboard/docs.test.ts`: `82f6bae7672f88e65864c9437fa9a65da42291c8e63f1b998ce58b82f1bb1f7a`
- `README.md`: `bd397c6f62edd2d94c2acf9c16bd8454aac0dfe23d6f3adaccf63d6952e4ecf9`

## Completion criteria

All plan 18 completion criteria are met on the recorded current source: the focused suite passes 13 tests with 0 failures, the own-export part types and net partition match, and the docs, ASCII, typecheck, CLI golden, and output-count checks pass. Whole-repository final integration and later review/commit steps remain downstream workflow work.

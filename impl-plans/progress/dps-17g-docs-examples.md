# dps-17g documentation and examples progress

Implemented CLI authoring/export documentation, document export form, README feature paragraphs, paper and deck operations, and in-process example validation/export tests. Existing editing labels and CLI help already match the plan.

| File | Before SHA-256 (absent for new files) | After SHA-256 |
| --- | --- | --- |
| `README.md` | d2c07f6762a061561014e1274c105edbac94f42723173846358fca6c5fd471c0 | 76c61f40c5f7fb9310dc2e7f0a0e95b0392914c9c330708186f58ee58dcb5f5c |
| `docs/cli.md` | ca28bd8c7dcb5a7733d574a270a47a87af3d724ca757bd0ea05350b051ba6912 | c38721a0b2e5419cdb6b2a3d05c18223fb1d04f5d3d2a64c310565bca6a161c8 |
| `docs/import-export.md` | 162c91d5e68a2ad9efb42509c8e493f10775e1b4e2de6828a4238fd9acd8b626 | ac668fbb4ff40e861f40be7befa0396e0bc00097514e44322bb34edbca5d2e47 |
| `examples/document/README.md` | absent | 51d314295b7be8175badc5e18308ade4c6c15de569433895e30bc4c03ff06dc9 |
| `examples/document/paper.ops.json` | absent | 70dfb592d987e1edbc26651d8fb58668478a2019f1858b6182f68a9488e48fc8 |
| `examples/document/deck.ops.json` | absent | 9d1b22d756050fc03cff0fa9b7ea9d3fa1980360bb46b1a9f58160eb166bae77 |
| `apps/cli/src/document-examples.test.ts` | absent | 1d5ce09f7fa56c0c6ba4f0ae1b5aade324decf14c255ed4fcf9ed36e018ec45d |

Final checks on the moving shared tree:

- `bun test apps/cli/src/document-examples.test.ts apps/cli/src/cli-wiring.test.ts apps/cli/src/help-style-export.test.ts`: exit 0, 18 passed, 0 failed; `tmp/dps-s864/dps-17g-docs-examples/test-final.log`.
- `bun run typecheck`: exit 0; `tmp/dps-s864/dps-17g-docs-examples/typecheck-final.log`. An earlier run failed in sibling `packages/ui-solid/src/export-dialog-document.test.ts` while it was being edited; the final rerun passed.
- `bunx biome check --diagnostic-level=warn apps/cli/src/help.ts apps/cli/src/document-examples.test.ts examples/document/paper.ops.json examples/document/deck.ops.json`: exit 0; `tmp/dps-s864/dps-17g-docs-examples/biome.log`.

Implementation acceptance is satisfied. Formal review and final integration gates remain downstream.

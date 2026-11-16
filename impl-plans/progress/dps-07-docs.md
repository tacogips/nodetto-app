# dps-07-docs progress

- Added code and Markdown snippet editing, page frames and document flow to `docs/editing.md`; updated the existing presentation description for frame slides.
- Added document PDF and Markdown export, CLI examples and exporter fallbacks to `docs/import-export.md`, following the accepted design and user-qa defaults.
- `bun test apps/cli/src/cli-wiring.test.ts`: exit 0, 14 passed, 0 failed; log `tmp/dps-s861/dps-07-docs/cli-wiring.log`.
- `sh -c 'grep -q "Page frames and document flow" docs/editing.md && grep -q "Code and Markdown snippets" docs/editing.md && grep -q "Document export" docs/import-export.md && grep -q -- "--document" docs/import-export.md'`: exit 0; log `tmp/dps-s861/dps-07-docs/sections.log`.
- Assigned implementation criteria and verification are complete on the moving shared tree. Formal review and dps-17's final UI-label check remain downstream.
- Retry on the current shared tree: CLI wiring test exit 0, 14 passed, 0 failed (`tmp/dps-s861/dps-07-docs/cli-wiring-retry.log`); section check exit 0 (`tmp/dps-s861/dps-07-docs/sections-retry.log`).

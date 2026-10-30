# tll-02-cli-help-docs progress

Intent snapshot: update CLI overview, lint and export help and the CLI documentation to describe architecture text-layout warnings, retaining usage and exit-code semantics. Full pre-edit snapshot and exact intentions: tmp/text-layout-lint-s551/tll-02-cli-help-docs/pre-edit-snapshot.txt and edit-intent.txt.

Pre-edit SHA-256:
- apps/cli/src/help.ts: 18c425a74a822540bd1b60141e56af3ea68f879390589a040cc2f4ccbc470d45
- docs/cli.md: e68e1c3a0d7c5a2324bd040dcdba87a47e1b4204085c7ba3fabe4e4eb57f8ec8

Post-edit SHA-256:
- apps/cli/src/help.ts: cac78f6c0efa417290c382e44a2f4f8506c833ce2f747431930a678f34243e40
- docs/cli.md: f87f9cac5ec646b0f80c23b7afb4e518bcbbf53ce76af9c890e3fe48448a10f9

Verification on moving shared tree:
- bun apps/cli/src/main.ts help lint: exit 1, help-lint.txt; missing sibling module packages/core/src/text-layout-lint/index.ts.
- grep rule ids and architecture in help-lint.txt: exit 1, lint-grep.log; blocked by preceding command.
- bun apps/cli/src/main.ts help export: exit 1, help-export.txt; same missing sibling module.
- grep warning format in help-export.txt: exit 1, export-grep.log; blocked by preceding command.
- BUN_OPTIONS=--jsx-runtime=classic bun test apps/cli/src/ai-commands.test.ts: exit 1, ai-commands.log; 0 pass, 1 fail, missing sibling module.
- bunx --no-install biome check apps/cli/src/help.ts: exit 0, biome.log.
- grep -n 'architecture pages' docs/cli.md: exit 0, docs-grep.log.
- bun run typecheck: exit 2, typecheck.log; TS2307 for missing sibling module.

Continuation: tll-01 is done and the missing module is present. Moved the new export sentence after the unchanged lint exit-code text to keep its antecedent clear. Intent: tmp/text-layout-lint-s551/tll-02-cli-help-docs/continuation-docs-intent.txt. Final docs/cli.md SHA-256: 230caedee19dfe79bb28fe53213dd8e1285a97f31b6bba9ede9ecf4e627b7492. help.ts hash remains unchanged.

Final verification (logs under tmp/text-layout-lint-s551/tll-02-cli-help-docs):
- bun apps/cli/src/main.ts help lint: exit 0, help-lint-final.txt; grep count 4, lint-grep-final.log, exit 0.
- bun apps/cli/src/main.ts help export: exit 0, help-export-final.txt; warning format found once, export-grep-final.log, exit 0.
- BUN_OPTIONS=--jsx-runtime=classic bun test apps/cli/src/ai-commands.test.ts: exit 0, ai-commands-final.log; 13 pass, 0 fail.
- bunx --no-install biome check apps/cli/src/help.ts: exit 0, biome-final.log.
- bun run typecheck: exit 0, typecheck-final.log, on the current shared tree.
- grep -n 'architecture pages' docs/cli.md: exit 0, docs-check-final.log.
- git diff --stat -- apps/cli/src/help.ts docs/cli.md: exit 0, diff-final.log.

Final shared checks and formal reviews remain with reconciliation.
STATUS: done

# ipd-25 docs and help progress

Plan hash before work: `344c48a6fd4288ee2217f5d22c8e2df8b14eca5c`. The accepted design's help and docs section governs this unit. Dependencies ipd-20 and ipd-22 were accepted by dispatch.

Implemented CLI and MCP-reused help for app design, a generic executable CLI walkthrough, desktop design guidance, README features, and focused help assertions. Changes are restricted to the plan's owned files. Per-edit intentions and hashes are in `tmp/ipd-s772/ipd-25-docs-help/edits/`.

Verification on the resulting shared tree:

- `bun test apps/cli/src/help-app-design.test.ts apps/cli/src/ai-commands.test.ts apps/cli/src/help-style-export.test.ts apps/cli/src/help-convert-frame.test.ts apps/cli/src/sequence-self-help.test.ts apps/cli/src/mcp.test.ts`: exit 0, 38 pass, 0 fail; `final/tests-final.log`.
- `bunx biome check apps/cli/src/help.ts apps/cli/src/help-app-design.test.ts`: exit 0; `final/biome-final.log`.
- `bun run typecheck`: exit 0; `final/typecheck-final.log`.
- `bash -x ../recipe.sh` in `tmp/ipd-s772/ipd-25-docs-help/cli-work/run`: exit 0, all 10 CLI calls exit 0; `final/docs-commands.log`. Lint reports no app findings; export reports a note-overflow warning for a kit descendant.
- `grep -c 'Designing phone apps with the CLI' docs/cli.md` and `grep -c 'iPhone app design' docs/design.md`: exit 0, count 1 each; `final/grep-cli.log`, `final/grep-design.log`.

The first test attempt found the overview exceeded its existing line-count limit; the overview was shortened and the final aggregate passes. Formal test-integrity, adversarial and combined-tree integration review remain downstream. The ipd-23 bundle-size finding is monitoring for ipd-28's test-cli gate, outside this unit.

# breadboard-16-cli progress

## Implementation

- Added breadboard ERC and parity linting in document page order. BPMN-only lint output and configuration behavior stay on the BPMN path; .bpmnlintrc and --config are read only when a selected BPMN page exists. JSON breadboard findings include pin only when present and omit elementIds.
- Added the single breadboard dispatch and bom, netlist --format kicad|spice, and import commands. Exports support --output, newline-normalized --check, and strict warnings. They emit deterministic formatter output and select a sole breadboard page automatically. Import calls importKicad, lays out the plan with layoutBreadboardImport, then serializes JSONL; diagnostics and errors follow the draw.io CLI precedent.
- Added CLI tests for lint, mixed page kinds, BOM and netlist output/checks, strict warnings, real import fixtures, legacy diagnostics, and linting imported pages.
- Updated CLI overview and detailed help.

## Verification

Evidence logs are in tmp/breadboard-mode-s485/breadboard-16-cli/.

- bun test apps/cli/src/breadboard-commands.test.ts: exit 0, 6 passed, 0 failed (39 assertions), final3-focused.log.
- bun test apps/cli: exit 0, 100 passed, 13 skipped, 0 failed (113 tests), final3-cli.log. Protected commands.test.ts, bpmn-commands.test.ts, mcp.test.ts, mcp-stdio.test.ts, and native-parity.test.ts are unedited.
- bun run typecheck: exit 0, final3-typecheck.log.
- bunx biome check apps/cli/src/breadboard-command.ts apps/cli/src/breadboard-commands.test.ts apps/cli/src/commands.ts apps/cli/src/help.ts: exit 0, final3-biome.log.
- bun apps/cli/src/main.ts breadboard import test-fixtures/kicad/led-button.net: exit 0; output parses and validates as a breadboard document, final3-import.jsonl and final3-import.stderr.
- bun apps/cli/src/main.ts breadboard import test-fixtures/kicad/legacy.sch: expected exit 1 with kicad.legacyFormat, final3-legacy.log.
- Contract, ASCII, and protected-test-file gates: exit 0 (quiet; contract checks reran the one-dispatch and one-message counts).

## Completion

Plan 16 implementation and its required focused behavioral verification are complete. Owner-scoped typecheck, the CLI test suite, whole-repository typecheck, style, import behavior, contract, and ASCII gates pass. Formal review and serial integration remain downstream workflow steps.

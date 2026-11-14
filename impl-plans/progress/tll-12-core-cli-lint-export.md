# tll-12 progress

Intent: review core against design, correct the renderer test identifier, update the no-page message and cover lint/export page kinds and wide text.

- apps/cli/src/commands.ts: before 3e072fc7579a5b60835b4dca54d07854d503bfb821c5ba3d84bf08ac462248f0; Replace only stale LINT_NO_PAGES literal.
  After: be95ee01c8ed5874f75475bd3143e614e144263ca764196615574921d43b4fe7

- apps/cli/src/breadboard-commands.test.ts: before 182a9cf591b029f0c35d49f0452a9c982d933cc602b30f490fab6d5aaf1ee14f; Use UML control and update both no-page assertions.
  After: 8d02df8702aab9f0a3054841392576dfd4e18ecfc29992b913452f9ca46dacde

- packages/core/src/text-layout-lint/rules.test.ts: before 11cc911a255cc8b35a1d7365a631d7969875f9060844a38b1ab0b04fa6f8ecba; Match planned node-wide identifier in renderer agreement test.
  After: e78c0017bd01bf28e4d57f8444c60782a915d531b9551cf9edc4330aa868ea1b

- apps/cli/src/text-layout-lint.test.ts: before 3c815c73dd2012a9d4f4bb90cdca443d6781c6511aa20772f5b750d39c58099a; Replace old exclusion test with specified page selection and wide-text cases.

- apps/cli/src/text-layout-lint.test.ts: before 3c815c73dd2012a9d4f4bb90cdca443d6781c6511aa20772f5b750d39c58099a; Replace old exclusion test with specified page selection and wide-text cases.
  After: 70bd45766a0b1f70e9c0bccda4a897b61e5cd92ab9f9423ec33f3579e7e9db49

- apps/cli/src/text-layout-export.test.ts: before 9b6691e9a00975bbbab40f2467bab7e0b807404a1f681928504c360f7a5e6f55; Use UML control and add freeform, flowchart and wide SVG warning/byte assertions.
  After: cad8c2847ceed9266a676dfe1795341ad5af1362f3c18a14162618a858c98b40

- Formatting packages/core/src/text-layout-lint/rules.test.ts: before e78c0017bd01bf28e4d57f8444c60782a915d531b9551cf9edc4330aa868ea1b
  After: 868d8a591924854d290098e9d53f4640a326187f87ad0f00c5f095f3b584fada; exit 0.

- Formatting apps/cli/src/commands.ts: before be95ee01c8ed5874f75475bd3143e614e144263ca764196615574921d43b4fe7
  After: be95ee01c8ed5874f75475bd3143e614e144263ca764196615574921d43b4fe7; exit 0.

- Formatting apps/cli/src/breadboard-commands.test.ts: before 8d02df8702aab9f0a3054841392576dfd4e18ecfc29992b913452f9ca46dacde
  After: 7b23361eac722e596a8c20f624f91c26ee7ec5b103106d536fca195afe3bf82d; exit 0.

- Formatting apps/cli/src/text-layout-lint.test.ts: before 70bd45766a0b1f70e9c0bccda4a897b61e5cd92ab9f9423ec33f3579e7e9db49
  After: 25f6a68f24b23b9ce0c6edfa1c83e60f5948e8c90b426c60db7f61b33f804af1; exit 0.

- Formatting apps/cli/src/text-layout-export.test.ts: before cad8c2847ceed9266a676dfe1795341ad5af1362f3c18a14162618a858c98b40
  After: e35e43b5931686dbccb5522e7e3810dd589d6e13be7ae9cbf69c0263e80fdd88; exit 0.

## Design review
- A1 matches: packages/core/src/text-layout-lint/rules.ts:21 declares the three readonly page kinds.
- A2 matches: packages/core/src/text-layout-lint/rules.ts:14 imports both helpers; lint-ts reports no unused imports.
- A3 matches: packages/core/src/text-layout-lint/rules.ts:54 and :81 implement wide line detection and unchanged height behavior.
- A4 matches: packages/core/src/text-layout-lint/rules.ts:150 and :172-226 implement ordered clipping, wide-line and wide-height checks before rotation handling.
- A5 matches: packages/core/src/text-layout-lint/engine.ts:81-94 and index.ts:1; both unchanged from 45cc69f, ordering and deduplication retained.
- A6 differs and fixed: packages/core/src/text-layout-lint/rules.test.ts:223 and :269 now name the renderer fixture node-wide; engine.test.ts:10 and rules.test.ts:211-303 cover the specified cases.
- A7 matches: apps/cli/src/__fixtures__/text-layout.ts:5 and :136-150 provide unchanged expectations and wide fixture.
- F matches: apps/cli/src/help.ts:29, :395 and :480-495; docs/cli.md:35-42 conform to design.
- CLI page filtering and mapping confirmed at apps/cli/src/commands.ts:291-307 and :340-366. Only the no-page literal changed.

## Verification
All commands in the active plan ran in order on the final source and exited 0. Complete logs are under tmp/text-layout-lint-s556/tll-12-core-cli-lint-export/; statuses.log records all eight exits.
1. mkdir: mkdir.log, exit 0.
2. Focused bun tests: focused.log, exit 0; 38 pass, 0 fail.
3. Core, IO, CLI bun tests: core-io-cli.log, exit 0; 1877 pass, 24 skip, 0 fail.
4. Wide-width reference grep: references.log, exit 0; only rules.ts and wide-text-width.test.ts.
5. Boundary git diff: boundary.log, exit 0 and empty.
6. Old-message absence: old-message.log, exit 0.
7. mise run lint-ts: lint-ts.log, exit 0.
8. CARGO_TERM_QUIET=true mise run check: check.log, exit 0.

Native parity, formal review, archival and finalization belong to downstream workflow steps.
STATUS: done

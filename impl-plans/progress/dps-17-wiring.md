# dps-17-wiring progress

Status: blocked; implementation incomplete. Accepted dependencies: dps-14-document-export and dps-15-cli-authoring.

Implemented IR registration, core shape utilities, SVG renderers, editable fields, PDF text extractors, snippet tools and catalogue, and initial canvas view and inspector dispatch. The shared predecessor changes were preserved.

The Page palette tile must execute addPageFrame. The click and drag handlers reside in `packages/ui-solid/src/ShapePalette.tsx` (onClick near line 265), which is absent from the dispatched writePaths and sharedPaths. An amendment authorizing that file is required before continuing; no out-of-scope file was edited.

Outstanding: page palette/action/navigation, inline snippet editing, document export UI and handlers, fixture and identity tests, CLI integration and parity tests, documentation and examples, and all final plan gates. Identity/cache behavior has not yet been tested; layout.ts was not changed. The plan expectation for TS is superseded by accepted IR-W1-DPS15-CANONICAL-LANG: canonical value is javascript.

Verification on the partial source after formatting:
- `bun test packages/ir/src/registry.test.ts packages/core/src/shape-catalogue.test.ts`: exit 0, 10 passed, 0 failed; `tmp/dps-s863/dps-17-wiring/core-focused-final.log`.
- `bun run typecheck`: exit 0; `tmp/dps-s863/dps-17-wiring/typecheck-final.log`.
- Scoped `bunx biome check --diagnostic-level=warn` on 12 changed TypeScript files: exit 0; `tmp/dps-s863/dps-17-wiring/biome-final.log`.
- Required aggregate, lint, verify and test-cli gates are pending completion of implementation.

Formal reviews and finalization remain downstream.

## Resumed after Page palette amendment

The earlier ShapePalette.tsx authorization blocker is resolved. Added snippet and Page palette entries, Page action and PageUp/PageDown navigation, toolbar actions, snippet editor dispatch, initial document PDF and Markdown ZIP export callbacks and dialog choices, CLI type/help entries, and the end-to-end code snippet add assertion. These changes remain partial and require integration coverage and review. The store identity/cache test has not run; layout.ts remains unchanged.

New scope blocker: `packages/ui-solid/src/Toolbar.test.ts` has an exact `ACTION_MENUS` expectation. Adding the three required toolbar actions makes it fail (18 pass, 1 fail); the test is outside the dispatched writePaths. Amend the checkpoint to authorize that co-located test, then update the expectation and resume. Do not remove the required actions to make the old assertion pass.

Current verification after formatting:
- `bun test apps/cli/src/document-wiring.test.ts packages/ui-solid/src/app-palette.test.ts packages/ui-solid/src/shortcuts.test.ts packages/ui-solid/src/Toolbar.test.ts`: exit 1, 18 passed, 1 failed; `tmp/dps-s863/dps-17-wiring/resume-focused.log`.
- `bun test apps/cli/src/document-wiring.test.ts packages/ui-solid/src/app-palette.test.ts packages/ui-solid/src/shortcuts.test.ts`: exit 0, 16 passed, 0 failed; `tmp/dps-s863/dps-17-wiring/resume-focused-final.log`.
- `bun run typecheck`: exit 0; `tmp/dps-s863/dps-17-wiring/resume-typecheck-final.log`.
- Scoped `bunx biome check --diagnostic-level=warn` on 13 resumed TypeScript files: exit 0; `tmp/dps-s863/dps-17-wiring/resume-biome-final.log`.

Outstanding: golden fixture, store identity and palette/action tests, PDF text extraction for individual exports, document export behavioral tests, CLI Markdown and native parity tests, docs and examples, aggregate tests, lint, verify and test-cli. Formal reviews and finalization remain downstream.

## Round 2 continuation

Extended the exact expected action list in `packages/ui-solid/src/Toolbar.test.ts` with `addPageFrame`, `nextPageFrame`, and `previousPageFrame`, matching `Toolbar.tsx`; this resolves the prior focused assertion. `bun test packages/ui-solid/src/Toolbar.test.ts` exited 0 (3 passed, 0 failed), log `tmp/dps-s863/dps-17-wiring/round2-toolbar.log`.

The required aggregate `bun test packages/ir packages/io packages/core packages/ui-solid apps/cli/src/document-wiring.test.ts apps/cli/src/edit/operations/document-authoring.test.ts` exited 1 (3206 passed, 5 failed, 5 skipped), log `tmp/dps-s863/dps-17-wiring/round2-aggregate.log`. It exposes tests outside the amended write scope: `packages/ui-solid/src/interaction-creation.test.ts` treats the Page palette action as a creation tool, and `packages/core/src/document-export/text-runs.test.ts` expects an empty extractor registry. Both assertions conflict with required wiring and need an ownership decision. Amendment budget is exhausted; no out-of-scope test was changed. Other failures include the missing golden fixture and must be resolved after scope is clarified. Store identity remains unverified; layout.ts remains unchanged. Documentation, examples, integration and native parity tests, and final gates remain outstanding. Formal review and finalization are downstream.

Further aggregate failure details: `packages/ui-solid/src/bpmn-palette.test.ts` has an exact toolbar action list and is outside writePaths. `packages/ui-solid/src/shape-search.test.ts` expects every palette entry to be a shape; handling the Page action would require changing assertion logic, beyond its list/table-extension-only authorization. These are unresolved ownership/contract gaps, alongside the two tests above. The golden coverage failure is in-scope unfinished work.

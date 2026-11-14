# Progress: erd-highlight-02-table-view

Status: in progress
Started: 2026-10-27

Accepted design and plan checked: `design-docs/specs/design-erd-relation-field-highlight.md` sections 3, 4.3, 4.4, 5 and `impl-plans/active/erd-highlight-02-table-view.md`. No dependencies; `acceptedPlanIds` is empty and `dependsOn` is empty.

## Edit evidence

- Created this progress record before source edits; it will record each target's pre-edit intent and before/after SHA-256.
- `packages/ui-solid/src/shapes/ErdTableView.tsx`: pre-edit SHA-256 `67d6fe6ce37171c3ce91e546bfa422e361af6035e929717a18d78fb177c661d0`; intent: add optional transient highlighted column ids, exported pure membership helper, and row classList toggle without changing the row structure or destructuring props.
- Progress-log correction: the initial post-edit hash entry was written as a literal shell expression; actual `ErdTableView.tsx` post-edit SHA-256 is `8f5ff885c5989726f0783a251048676e98c6e43f95590868aa65929f231b8c06`.
- `packages/ui-solid/src/shapes/ShapeView.tsx`: pre-edit SHA-256 `4e6699bffdb9f378889fb36d8be12ff0085ca83f424e5014bc7e72da4356ef48`; intent: add the documented optional canvas-only ERD highlight prop and forward it only to the `ErdTableView` branch.
- Correction to prior post-edit entry: `packages/ui-solid/src/shapes/ShapeView.tsx` actual post-edit SHA-256 is `6ee64c51001b033310308c8f368f3e4fbc7e3b3c5f2017a47515ccd43868823b`.
- `packages/ui-solid/src/erd-table-view.test.ts`: pre-edit SHA-256 `c2839b6404a3ff0aeaeee57c28795cdb212d71a6327bdb3812955ae5e19a8843`; intent: preserve the existing badge test and add the four specified helper cases using self-authored ErdColumn-shaped values.
- Correction to prior post-edit placeholder: `packages/ui-solid/src/erd-table-view.test.ts` actual post-edit SHA-256 is `b157e37a5c752d631c7e229cac2ebf85d3d2beaddd53f5108f56100dadd31734`.
- `apps/desktop/src/style.css`: pre-edit SHA-256 `cdf30f1f4d2396d4dd01f6031e27ffcd5a1ca168fb34a8426782c40345aa7271`; intent: insert exactly the designed accent-derived related-row background and inset bar immediately after `.nodetto-erd-row`.
- `apps/desktop/src/style.css`: post-edit SHA-256 `439b39a2ce1209a83561ebc1c7abb503945d419d59b4c780bdba36191f0f709c`.

## Verification

- Progress record finalization intent: record exact foreground verification commands, exits, full log paths, and the unresolved Bun TSX test transform failure.

### Verification results

- `bun test packages/ui-solid/src/erd-table-view.test.ts` — exit 1; output: 0 pass, 1 fail/error before tests due missing Solid `jsxDEV`; complete log: `tmp/erd-highlight-s528/erd-highlight-02-table-view/erd-table-view.test.log`.
- `bun run typecheck` — exit 0; complete log: `tmp/erd-highlight-s528/erd-highlight-02-table-view/typecheck.log`.
- `bunx biome check packages/ui-solid/src/shapes/ErdTableView.tsx packages/ui-solid/src/shapes/ShapeView.tsx packages/ui-solid/src/erd-table-view.test.ts apps/desktop/src/style.css --diagnostic-level=warn` — exit 0; complete log: `tmp/erd-highlight-s528/erd-highlight-02-table-view/biome.log`.
- Acceptance grep, app-script scope, and progress-file checks — exit 0; complete log: `tmp/erd-highlight-s528/erd-highlight-02-table-view/acceptance-checks.log`.
- Existing `text-note-view.test.ts` was also run as a runner diagnostic and failed before tests with the same missing `jsxDEV` export; this establishes an existing TSX test runner limitation. Its output was captured at `tmp/erd-highlight-s528/erd-highlight-02-table-view/text-note.pattern.log`.

Status: source and test changes are implemented; required focused behavioral verification remains unresolved because Bun's current TSX transform cannot load Solid's JSX runtime. Canvas wiring is owned by downstream plan `erd-highlight-03-canvas-wiring`; formal integration review and final repo-wide gates are downstream.
- Progress-log cleanup intent: remove the stale literal shell-expression hash line because the measured hash and its correction immediately follow it.

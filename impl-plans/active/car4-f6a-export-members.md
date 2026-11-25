# car4-f6a-export-members

- planId: car4-f6a-export-members; wave 1; dependsOn: none
- planPath: impl-plans/active/car4-f6a-export-members.md
- progressPath: impl-plans/progress/car4-f6a-export-members.md
- Finding: maintainability-capture-glyph-attribution-scope (R4-6, medium), core
  membership owner part.
- Design: `design-docs/specs/design-ai-capture.md` 22.1 R4-6 (Core).
- writePaths: `packages/core/src/svg-export/document.ts`, `packages/core/src/index.ts`,
  `packages/core/src/svg-export/members.test.ts`,
  `tmp/car4-r4/car4-f6a-export-members`, `impl-plans/progress/car4-f6a-export-members.md`,
  `target`, `tmp/cad3d`
- sharedPaths: none; artifactRoots: `target`, `tmp/cad3d`

Follow the worker rules and pinned contracts in `impl-plans/active/car4-00-overview.md`.

## Intent and context

`renderSelectionSvg` (`document.ts:762-780`) and `renderArtboardSvg` (`:782-810`)
compute which elements a selection or frame export draws (`expandContainers`, page
filter, artboard `excludeIds`, `selfContained`). The CLI's glyph attribution needs that
exact set; f6b will call the new export.

Non-goals: no change to rendered SVG bytes, other renderers, or the CLI (f6b).

## Changes

- `document.ts`:
  - Private `selectionMembers(store, context, pageId, ids)` and
    `artboardMembers(store, context, frameId, excludeIds?)` returning the
    `selfContained(...)` element lists the two renderers compute today; both renderers
    call them (artboard keeps its `showTitle: false` mapping after membership and its
    `isHidden`/bounds null checks before).
  - `export function svgExportMemberIds(store: Store, registry: ShapeUtilRegistry,
    pageId: PageId, ids: Iterable<ElementId>): ReadonlySet<ElementId>`: a single frame
    id on `pageId` takes the artboard path (empty set where `renderArtboardSvg` would
    return null); otherwise the selection path; returns the member ids.
- `index.ts`: export `svgExportMemberIds` next to `renderSelectionSvg` (`index.ts:407`).

## Pitfalls

- Pure extraction: the two renderers' output must be byte-identical; do not reorder
  filters or move `selfContained`.
- Use `createShapeContext(store, registry, 1)` exactly as the renderers do.

## Tests (new `members.test.ts`)

- Group with an inside element and an outside element: `svgExportMemberIds` of the
  group contains the group and inside member, not the outside one, and equals the ids of
  elements present in `renderSelectionSvg` output (compare via the same membership).
- Frame with an inside and outside element: artboard path; same comparison against
  `renderArtboardSvg`.
- Single non-container element -> `{id}`.
- Existing SVG export tests pass unchanged (gate below).

## Verification (each exits 0 and runs tests)

1. `bunx biome check --diagnostic-level=warn packages/core/src/svg-export/document.ts packages/core/src/index.ts packages/core/src/svg-export/members.test.ts && bun test packages/core/src/svg-export/members.test.ts packages/core/src/svg-export.test.ts packages/core/src/frame-title.test.ts packages/core/src/rotation-export.test.ts packages/core/src/svg-paint-order.test.ts`

## Done criteria

- One membership owner used by both renderers and exported; existing export tests
  unchanged; progress log `done`.
- Implementation complete: shared membership helpers and public export are in place;
  group, frame and single-element regressions and the focused SVG suite pass.
  Formal review and integration gates remain downstream.

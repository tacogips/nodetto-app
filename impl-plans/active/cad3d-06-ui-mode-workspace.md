# M6 cad3d-06-ui-mode-workspace

- dependsOn: M2 (rules in commands, CAD shape utils)
- Design: sections 4 (UI tools, page conversion rows), 5
- writePaths: `packages/ir/src/types.ts`, `packages/ir/src/validate.test.ts`,
  `packages/core/src/tools.ts`, `packages/ui-solid/src/workspaces.ts`,
  `packages/ui-solid/src/shape-palette.ts`,
  `packages/ui-solid/src/ToolbarIcon.tsx` (icons for the new tools, existing
  icon source only), `packages/ui-solid/src/inspector/PageSection.tsx`,
  `packages/ui-solid/src/PageList.tsx`, `packages/ui-solid/src/PageTabs.tsx`,
  `packages/ui-solid/src/Toolbar.tsx` (hidden workspaces prop, image import
  control), `packages/ui-solid/src/page-kind-ui.ts` (new) and its test,
  `apps/desktop/src/App.tsx` (pass the two props),
  `apps/desktop/src/page-workspace.ts`,
  `packages/ui-solid/src/workspaces.test.ts`,
  `packages/ui-solid/src/cad-palette.test.ts` (new),
  `apps/desktop/src/page-workspace.test.ts`,
  `packages/collab/src/ydoc.test.ts`
- Compile fallout: exhaustive records over `PageMode`, `WorkspaceId` or
  `ToolKind` reported by `tsc` may get the minimal entry.

## Intent

Make "3D CAD" a mode like PCB: a dedicated workspace whose palette holds
only CAD tools, reachable from the toolbar, and lock the page kind in the UI.

## Behavior

- `PAGE_MODES` gains `"cad3d"` before `"all"`; `DEDICATED_PAGE_MODES` gains
  `cad3d: "cad3d"`.
- `tools.ts`: tools `cad:sketch`, `cad:line`, `cad:rect`, `cad:arc`,
  `cad:circle`, `cad:extrude`; `creationFor` returns `{ type }` of the
  matching CAD type (`cad:rect` creates `cad.line`).
- `workspaces.ts`: entry `{ id: "cad3d", label: "3D CAD", design: false,
  ... }` listing exactly those tools plus the select tool, placed after
  `pcb`; `WORKSPACES[0]` stays `flow`.
- `shape-palette.ts`: `PRIMARY_TOOLS.cad3d` = the six tools;
  `additionalShapes("cad3d")` returns an empty list (no `COMMON_SHAPES`);
  no other workspace lists a `cad:` tool, including `all`.
- `page-workspace.ts`: `DEDICATED_WORKSPACES.cad3d = "cad3d"`,
  `DEDICATED_PAGE_NAMES.cad3d = "3D CAD"`. The existing
  `selectWorkspacePage` (`apps/desktop/src/shell/workspace.ts:21-46`) then
  creates or jumps to the CAD page and leaves it when another mode is
  chosen; do not change that function.
- `PageSection.tsx`: the "Diagram format" select omits `cad3d` from its
  options on other pages and is disabled on a CAD page (shows "3D CAD").
- `page-kind-ui.ts` (pure): `newPageOptionsFor(currentPage, pages,
  cadAllowed)` returns `{ kind: "cad3d", name: "3D CAD <n>" }` when the
  current page is a CAD page and CAD is allowed, else the existing default;
  `<n>` is one more than the number of existing CAD pages.
  `isShapeEntryEnabled(page)` is false on a CAD page. `PageList.tsx:374`
  and `PageTabs.tsx:791` pass the options to `editor.createPage`. The
  toolbar hides or disables the image import control and the template,
  kit and block entries on a CAD page (the guards of M2 remain the
  backstop).
- Cloud guard: `Toolbar` gains `hiddenWorkspaces?: readonly WorkspaceId[]`;
  `App.tsx` passes `["cad3d"]` and `cadAllowed = false` while
  `isCloud()` (`apps/desktop/src/App.tsx:383-384`) is true. An existing
  CAD page in a cloud document still opens with the CAD workspace. The
  constant that decides this is one exported boolean function
  `cadCreationAllowed(isCloud)` in `apps/desktop/src/page-workspace.ts`
  with a comment pointing at design section 15.

## Tests

- `validate.test.ts`: mode enum accepts `cad3d`; `pageModeOf({kind:"cad3d"})`
  is `"cad3d"` even with another `mode` stored.
- `workspaces.test.ts`: existing loops pass for the new workspace
  (preference round trip, `creationFor` for every tool, palette category
  separation).
- `cad-palette.test.ts`: the `cad3d` palette contains only `cad:` tools and
  select; `additionalShapes("cad3d")` is empty; for every other workspace no
  primary or additional item has a `cad:` tool.
- `page-workspace.test.ts`: extend "maps dedicated page kinds to their
  workspaces" and the reverse mapping with `cad3d`; choosing `cad3d` on a
  freeform page creates a page of kind `cad3d` named "3D CAD"; choosing
  `flow` on the CAD page moves to a non-CAD page and stores no mode on the
  CAD page.
- `ydoc.test.ts`: a page with kind `cad3d` and mode `cad3d` round trips.
- `page-kind-ui.test.ts`: add-page on a CAD page gives kind `cad3d` and
  names "3D CAD 2", "3D CAD 3"; on a freeform page the default; with
  `cadAllowed` false always the default; shape entries disabled on a CAD
  page. A render test of `PageList` (existing `PageList.test.tsx` pattern)
  clicks add on a CAD page and finds a second page of kind `cad3d`.
- `page-workspace.test.ts`: `cadCreationAllowed(true)` is false and
  `cadCreationAllowed(false)` is true; a toolbar render with
  `hiddenWorkspaces: ["cad3d"]` has no "3D CAD" option.
- A `PageSection` render test (happy-dom, in `cad-palette.test.ts` or a new
  `packages/ui-solid/src/inspector/page-section-cad.test.tsx`): the select
  is disabled on a CAD page and has no `cad3d` option elsewhere.

## Acceptance criteria

- No CAD tool is reachable from a non-CAD workspace and no 2D creation tool
  from the CAD workspace.
- `canvas-background.test.ts` passes unmodified.

## Verification (each must exit 0)

1. `sh -c 'bun run typecheck && bun test packages/ui-solid/src/workspaces.test.ts packages/ui-solid/src/cad-palette.test.ts packages/ui-solid/src/page-kind-ui.test.ts packages/ui-solid/src/PageList.test.tsx packages/ui-solid/src/Toolbar.test.ts apps/desktop/src/page-workspace.test.ts packages/ir/src/validate.test.ts packages/collab/src/ydoc.test.ts packages/ui-solid/src/canvas/canvas-background.test.ts'`
2. `sh -c 'bunx biome check packages/ui-solid/src/workspaces.ts packages/ui-solid/src/shape-palette.ts packages/ui-solid/src/page-kind-ui.ts packages/core/src/tools.ts apps/desktop/src/page-workspace.ts && bun test packages/ui-solid/src/cad-palette.test.ts'`
3. `sh -c 'mkdir -p tmp/cad3d/m6; bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess > tmp/cad3d/m6/strict.log 2>&1; ! grep -E "^packages/(core|ir)/src/" tmp/cad3d/m6/strict.log | grep -vqE "\.test\.tsx?\(" && bun test packages/ui-solid/src/page-kind-ui.test.ts'`

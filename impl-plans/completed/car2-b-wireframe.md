# car2-b-wireframe: wireframe PCB input and mesh decode failure (R2-8, R2-9)

- planId: car2-b-wireframe
- Wave: 1
- dependsOn: none
- Design: `design-docs/specs/design-ai-capture.md`, section 20.2 R2-8 and
  R2-9.
- Progress log: `impl-plans/progress/car2-b-wireframe.md`

## Intent

- R2-8: construction SVG export must use the same CAD input collector as
  capture and `cad check`. A board whose page is no longer a PCB page then
  stops drawing.
- R2-9: a mesh that fails to decode, or that is empty, must fail in the
  construction walk, so that features depending on it do not draw.

## Non-goals

- Do not add `meshBounds` or any new option. Plan a2-export-bounds does
  that later, in `wireframe.ts` and `document.ts`.
- Do not change `construction.ts`, `check.ts` or `engine.ts`.

## Changes

1. `packages/core/src/svg-export/document.ts`, in `renderPageSvg` (CAD
   branch, around `:591-596`):
   - Replace `store.listElements()` with `collectCadInput({ pages:
     store.listPages(), elements: store.listElements() }, pageId,
     0).elements`.
   - Import `collectCadInput` from `../cad/engine.ts`. Check for an import
     cycle; if one appears, import from the module that defines it.
2. `packages/core/src/cad/wireframe.ts`
   - Change `meshCorners(data)` to return `Point[] | null`. It returns null
     when `decodeNmesh` throws `NmeshError`, or when
     `positions.length === 0` or `triangles.length === 0`. Other errors
     are still rethrown.
   - In the mesh visitor, compute the corners once. If they are null,
     return false. Otherwise draw the box edges from the same array and
     return true.

## Pitfalls

- `renderCadPageSvg` must still return null for an empty wireframe. Do not
  change that function.
- Do not decode the mesh twice.
- The visitor must return a boolean. `visitCadConstruction` turns false
  into `cad.mesh.invalid` and does not add the mesh as a body
  (`construction.ts:101-105`).

## Tests

1. `packages/core/src/cad/wireframe.test.ts`
   - A corrupt mesh plus a `cut` extrusion that targets it gives
     `segments.length === 0` and `bounds === null`. Fails before: 12
     segments.
   - Control: a valid mesh plus a `cut` that targets it draws the mesh's 12
     box edges and the cut's segments, so the segment count is greater
     than for the mesh alone.
   - An empty valid mesh payload (0 vertices) with a dependent cut gives 0
     segments.
2. `packages/core/src/svg-export/cad.test.ts`, through `new Editor({
   document })` and `editor.exportPageSvg()`. Imitate the existing
   PCB-reference fixtures in this file or in
   `apps/desktop/src/shell/export-handlers.test.ts:628-659`.
   - A board-only CAD page gives an SVG string.
   - After the board's page is converted to freeform with the editor's
     conversion command, it gives null. Fails before: it still gives an
     SVG.
   - After `editor.undo()`, the SVG is byte-equal to the first one.

## Verification

- `bun test packages/core/src/cad/wireframe.test.ts packages/core/src/svg-export/cad.test.ts packages/core/src/cad/check.test.ts`
  must exit 0. The wireframe timing test may be retried up to three times
  under load.
- `bunx biome check --diagnostic-level=warn packages/core/src/svg-export/document.ts packages/core/src/cad/wireframe.ts packages/core/src/cad/wireframe.test.ts packages/core/src/svg-export/cad.test.ts`
  must exit 0.

## Done when

- The tests above pass, and the existing SVG and wireframe tests pass
  unedited.
- The progress log reads `done`.

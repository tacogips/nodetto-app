# M2 cad3d-02-core-enforcement

- dependsOn: M1 (`pageAcceptsElementType`, CAD types, keep flag, shape utils)
- Design: sections 3.2 (detached shapes), 3.3 (clipboard semantics), 4
- writePaths: `packages/core/src/commands.ts`,
  `packages/core/src/references.ts`, `packages/core/src/editor/paste.ts`,
  `packages/core/src/editor/pages.ts`,
  `packages/core/src/editor/facade/page-editing.ts`; new tests under
  `packages/core/src/cad/`: `page-content-commands.test.ts`,
  `page-content-entry-points.test.ts`, `detach.test.ts`,
  `clipboard.test.ts`; existing test
  `apps/cli/src/edit/label-field.test.ts` (permitted change below)
- The guards for individual emitters and the classified emitter list are
  M22.

## Intent

Make the command layer the choke point for rules R and K, make paste,
duplicate, page copy and page conversion degrade without throwing, and make
delete and copy leave valid CAD payloads.

## Behavior

- `applyCommands`:
  - `createElement`: after `validateNewElement`, when the page exists and
    `pageAcceptsElementType` is false, fail with issue code
    `page.contentKind`, path `element.type`.
  - `convertElement`: same check for the new type on the element's page.
  - `updatePage`: when `page.kind` differs from the current kind and either
    is `cad3d`, fail with `page.kindLocked`, path `page.kind`, except the
    restoring case of rule K: new kind `cad3d` and the page holds at least
    one `cad.*` element and no element a CAD page refuses. `createPage`
    with kind `cad3d` is allowed. Inverse commands pass the same checks.
- Clipboard (`packages/core/src/references.ts:204-252`): for a definition
  with `keepsExternalReferences`, `survives` returns true and
  `detachOutside` leaves outside references untouched; all other types are
  unchanged. `planInsertCopies` (paste, duplicate): drops copies the target
  page does not accept; drops a CAD sketch entity whose `sketch` (after id
  remapping) does not resolve to a `cad.sketch` on the target page; keeps
  other unresolved references. When everything is dropped it returns the
  same empty result as for an empty clipboard.
- `copyPageElements`: when source and target differ in "is cad3d", return
  the function's existing failure value and apply nothing (resource
  carriers excepted only if the existing function copies them at all).
  `duplicatePage` of a CAD page keeps kind, remaps internal ids and keeps
  outside references.
- `setPageKind`: returns without applying when rule K would be violated.

## Pitfalls

- `validateNewElement` receives `pages`; do not materialise all elements.
  The rule K exception scans the page's elements only in that rare branch.
- Do not add a `Command` kind or a `Page` field (hosted Worker whitelist).
- Keep existing error message order for other failures.
- Delete expansion (`expandDeletes`, `commands.ts:169-231`) is not changed:
  M1's validators already accept what it produces.

## Tests

- `page-content-commands.test.ts`: createElement of `shape.geo` on a CAD
  page and of `cad.line` on freeform, pcb and breadboard pages throw
  `CommandError` with `page.contentKind`; convertElement both ways;
  updatePage kind `freeform -> cad3d` on an empty page and on a page with a
  shape, and `cad3d -> freeform`, throw `page.kindLocked`; the restoring
  case (a store built directly with `cad.*` elements on a freeform page)
  succeeds; renaming a CAD page works; undo and redo of a CAD createElement.
- `detach.test.ts`, one case per row of the design 3.2 table: build the
  Plate with a face sketch and a cut; run `deleteElements` on the target
  (the `cad.pcb.board` row is added to this file by M14, which introduces
  that type); then assert
  the stored shape of the referrer, `validateDocument` has no error,
  `serializeDocument` then `parseDocument` succeeds and deep-equals,
  `updateSemantic` on the survivor succeeds, and `undo` restores the
  original payloads exactly. Deleting a sketch deletes its entities.
- `clipboard.test.ts`: duplicating one circle adds one circle with the same
  `sketch`; duplicating a cut extrude adds an extrude with the same
  `sketch` and `bodies` that validates; copying a sketch with its entities
  and pasting on another CAD page remaps `sketch` to the copy; pasting a
  lone circle on another CAD page inserts nothing; pasting 2D shapes on a
  CAD page and CAD elements on a freeform page inserts nothing; none
  throws; an existing type without the flag behaves as before (relation
  without its tables is dropped).
- `page-content-entry-points.test.ts`, through the `Editor` facade:
  `copyPageElements` freeform to CAD and CAD to freeform apply nothing;
  `duplicatePage` of a CAD page yields a valid document; `setPageKind` in
  both directions leaves the kind unchanged; `createBreadboardPart`,
  `addPcbTrack`, `addPcbVia` on a CAD page create nothing; class B helpers
  (group, frame selection, boolean operations, component creation,
  connection creation) called with a CAD-only selection do not throw and
  change nothing; class D carriers (`createColorToken`, text style, guide,
  review comment, slide settings) succeed on a CAD page;
  `validateDocument` of the store is clean after every step.
- `label-field.test.ts` permitted change: inside the loop, when
  `isCadTypeName(type)`, create a page of kind `cad3d` and make it current
  before `createElement`. No other line changes.

## Acceptance criteria

- Every row of the first design section 4 table that names
  `packages/core` has a test here (the emitter class table is M22).
- Existing core tests pass unmodified; whole `bun test` log in
  `tmp/cad3d/m2/full.log`.

## Verification (each must exit 0)

1. `sh -c 'bun run typecheck && bun test packages/core/src/cad packages/core/src/editor.test.ts packages/core/src/editor-clipboard.test.ts packages/core/src/clipboard.test.ts packages/core/src/copy-page-elements.test.ts apps/cli/src/edit/label-field.test.ts'`
2. `sh -c 'bunx biome check packages/core/src/commands.ts packages/core/src/references.ts packages/core/src/editor packages/core/src/cad && bun test packages/core/src/cad/page-content-commands.test.ts'`
3. `sh -c 'mkdir -p tmp/cad3d/m2; bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess > tmp/cad3d/m2/strict.log 2>&1; ! grep -E "^packages/(core|ir)/src/" tmp/cad3d/m2/strict.log | grep -vqE "\.test\.tsx?\(" && bun test packages/core/src/cad/detach.test.ts'`
4. `sh -c 'mkdir -p tmp/cad3d/m2 && bun test > tmp/cad3d/m2/full.log 2>&1'`

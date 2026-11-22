# M15 cad3d-15-collab

- dependsOn: M2 (rules R and K in core), M4 (statuses for dangling
  references)
- Design: sections 4 (collaboration repair), 7.5, 13
- writePaths: `packages/core/src/editor/transaction.ts`,
  `packages/core/src/cad/content-repair.ts` (new) and its test,
  `packages/collab/src/cad.test.ts` (new),
  `packages/collab/src/ydoc.test.ts`

## Intent

Restore rules R and K after remote edits without ever deleting an element,
and prove the concurrent-edit behaviour the design promises. No change to
the Yjs document shape (the private Worker mirrors it,
`packages/collab/src/ydoc.ts:14-18`).

## Contract

```ts
// packages/core/src/cad/content-repair.ts
export function recoveredShapesPageId(pageId: PageId): PageId; // `${pageId}-shapes`
export function recoveredCadPageId(pageId: PageId): PageId;    // `${pageId}-cad`
/** Commands that restore rules R and K. Never contains a net deletion. */
export function planContentRepair(store: Pick<Store, "listPages" | "listElements">): Command[];
```

## Behavior

For every page, with "refused" meaning `pageAcceptsElementType("cad3d",
type)` is false and "CAD" meaning `isCadTypeName(type)`:

1. Kind is not `cad3d`, the page has CAD elements and no refused element:
   one `updatePage` setting `kind: "cad3d"` (the rule K restoring case, so
   it passes `applyCommands`).
2. Kind is `cad3d` and the page has refused elements: move them to the
   page `recoveredShapesPageId(id)`; when that page is absent, first a
   `createPage` with that id, kind `freeform`, name `<name> shapes`, order
   directly after the source page (fractional index between the source and
   its successor, computed deterministically from the two order strings).
3. Kind is not `cad3d` and the page has both CAD and refused elements:
   move the CAD elements to `recoveredCadPageId(id)` (created when absent
   with kind `cad3d`, name `<name> 3D CAD`).
4. Otherwise nothing. Resource elements never move.

A move of element E is `deleteElements [E]` without reference expansion
side effects followed by `createElement` of the same element with only
`page` changed, in one command list, ordered so that all deletes of one
page precede its creates and elements are processed in id order. If the
existing delete expansion would rewrite referrers, build the move so that
every referrer and target move in the same list and the recreated payloads
are the original ones (assert payload equality in the test). An element
that stays on the page and references a moved element (for example a
`review.comment` with `target`) is detached by that expansion; append one
`updateSemantic` per such element that restores its original semantic, so
the net change of a repair is only `page` on the moved elements. The output is
a pure function of the store state. The scan runs only when a `cad3d` page
or a `cad.` element exists (gate style of
`packages/core/src/editor/transaction.ts:188-207`).

`planReconciliation` appends these commands; they run under the untracked
derived origin used by `reconcileDerivedState`
(`packages/collab/src/binding.ts:465-473`), so they are not user history
and are published. The collab differ publishes a move as a write of the
element's `page` field (`packages/collab/src/diff.ts:252`); if the binding
instead publishes delete plus insert, change nothing in the binding and
assert convergence all the same.

Local edits never produce repair commands (M2 rejects violations): assert
`planContentRepair` is empty after the M2 scenarios.

## Tests

- `content-repair.test.ts`: each of the four cases on a hand-built store;
  the result applies through `applyCommands` without error; afterwards
  `validateDocument` is clean, the multiset of element ids and payloads
  (ignoring `page`) is unchanged, and a second `planContentRepair` is
  empty; resource elements stay; a `review.comment` on a CAD page whose
  `target` is a refused shape keeps its `target` after the shape moved to
  the recovery page (payload equal to before; `validateDocument` reports
  no error); unknown `cad.future` counts as CAD; two
  stores with the same content in different insertion order give equal
  command lists.
- `cad.test.ts`, two `Y.Doc`s bound to two editors and synced by exchanging
  updates (pattern of the existing `binding*.test.ts` files):
  1. A sets a circle radius while B sets the extrude distance: both
     present on both peers; documents equal.
  2. Both set the same radius: one value wins on both peers.
  3. A edits `a` of a line while B edits `b`: both applied; both edit `a`:
     one of the two pairs, never a mixture or a four-number array.
  4. A deletes a sketch while B (offline) changes its extrude: both peers
     hold the same elements, `validateDocument` has no error, and
     `analyzeCadPage` reports `cad.reference.missing` or the sketch
     survives (add wins); assert what the binding yields and that both
     agree.
  5. A and B reorder the same feature differently: same order on both.
  6. Old client adds a shape: a `shape.geo` with `page` set to the CAD
     page is written directly into A's `Y.Doc`. After sync and reconcile,
     both peers hold the shape on the page `<cadPage>-shapes`, the CAD
     page holds only CAD elements, no element was lost, and no undo stack
     grew.
  7. Old client changes the kind: the CAD page's `kind` is set to
     `freeform` directly in the `Y.Doc`. After sync and reconcile both
     peers show kind `cad3d` again and every CAD element is still present
     with an identical payload.
  8. Old client does both (kind to `freeform`, then adds a shape): both
     peers end with the shape on the original page (kind `freeform`) and
     the complete CAD model on `<page>-cad` (kind `cad3d`), references
     intact (`analyzeCadPage` statuses equal to before).
  9. Raw kind change of a freeform page with shapes to `cad3d`: the shapes
     move to `<page>-shapes`; nothing is lost. Both peers run the repair
     concurrently in scenarios 6 to 9 (each reconciles before receiving
     the other's repair) and still converge to one recovery page.
  10. A creates a CAD page and features while B creates 2D shapes on a
      freeform page: both documents valid and equal.
- `ydoc.test.ts`: a CAD document converts to a `Y.Doc` and back with deep
  equality, including `plane.face` objects and `bodies` arrays.

## Pitfalls

- Do not validate or reject remote updates in the binding; repair only.
- Never emit a delete without the matching create.

## Acceptance criteria

- All ten scenarios converge; no scenario loses an element or leaves a
  violation of rule R or K on any peer.

## Verification (each must exit 0)

1. `sh -c 'bun run typecheck && bun test packages/collab/src packages/core/src/cad/content-repair.test.ts'`
2. `sh -c 'mkdir -p tmp/cad3d/m15; bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess > tmp/cad3d/m15/strict.log 2>&1; ! grep -E "^packages/(core|ir)/src/" tmp/cad3d/m15/strict.log | grep -vqE "\.test\.tsx?\(" && bun test packages/collab/src/cad.test.ts'`
3. `sh -c 'bunx biome check packages/core/src/cad packages/core/src/editor/transaction.ts packages/collab/src/cad.test.ts && bun test packages/core/src/cad/content-repair.test.ts'`

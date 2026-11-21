# M22 cad3d-22-emitter-guards

- dependsOn: M2 (rule R in the command layer, CAD shape utils and types)
- Design: section 4 (emitter class table)
- writePaths: `packages/core/src/editor/facade/core.ts` (`canCreateOn`
  only), one guard and no other change in each class A emitter:
  `packages/core/src/templates/design-templates.ts`,
  `packages/core/src/ui-blocks.ts`, `packages/core/src/kits/ios/insert.ts`,
  `packages/core/src/shape-catalogue.ts`, `packages/core/src/html-layout.ts`,
  `packages/core/src/prototype-html.ts`,
  `packages/core/src/pcb-import.ts` (target page choice),
  `packages/ui-solid/src/image-import.ts`,
  `packages/ui-solid/src/ShapePalette.tsx`, `apps/desktop/src/seed.ts`;
  new tests `packages/core/src/cad/emitters.test.ts`,
  `packages/ui-solid/src/cad-emitters.test.ts`

## Intent

Rule R already holds through the command layer (M2). This milestone makes
each emitter that a user can reach on a CAD page return quietly instead of
running into a `CommandError`, and pins the list of emitters so a new one
must be classified.

## Contract

```ts
// packages/core/src/editor/facade/core.ts
canCreateOn(pageId: PageId, type: string): boolean; // pageAcceptsElementType for the page's kind; false for an unknown page
```

## Behavior

- Each class A emitter calls `canCreateOn` for the page it is about to
  write to, with the first element type it would create, before building
  any command, and returns the value it already returns when nothing is
  created (null, empty string, empty list or false, as the function does
  today). No emitter changes behaviour on a page that accepts its type.
- Imports that draw on the current page
  (`packages/core/src/pcb-import.ts:481`) target a new freeform page when
  the current page is `cad3d`.
- Generic entry points (class A0: `Editor.createElement`, `buildElement`,
  CLI `add`) are not changed; they keep failing through the choke point.
- If reading an emitter shows that the design's class is wrong (for
  example a file listed in class B is reachable without existing 2D
  content), move it to class A, add the guard, and correct the design
  table in the same commit.

## Tests

- `emitters.test.ts`:
  1. Each class A emitter in `packages/core`, called with a CAD page
     current, returns its "nothing" value, creates no element and does not
     throw; called on a freeform page it still creates what it created
     before (one positive case each).
  2. Class B helpers (group, frame selection, boolean operations,
     component creation, connection creation, sequence, BPMN containment,
     screen transition, page frames) called with a CAD-only selection or
     page do not throw and change nothing.
  3. Class D carriers (`createColorToken`, number token, text style,
     guide, review comment) succeed on a CAD page and
     `validateDocument` stays clean.
  4. Classified list: read every non-test `.ts`/`.tsx` under
     `packages/*/src` and `apps/*/src`; collect files that contain
     `type: "createElement"` or a `.createElement(` call whose receiver is
     not `document`; compare the sorted list with a literal list in the
     test in which every entry carries its class (A, A0, B, C, D or E) as
     in design section 4. A file missing from the literal list, or listed
     but no longer an emitter, fails the test.
- `cad-emitters.test.ts` (ui-solid): image import and the palette icon
  insert do nothing on a CAD page; `slide-transition-edits` creates its
  `presentation.slide` carrier on a CAD page (class D).
- Existing tests of the touched emitters pass unmodified.

## Acceptance criteria

- Every class A emitter has a negative and a positive test; the literal
  list in the test equals the design table.

## Verification (each must exit 0)

1. `sh -c 'bun run typecheck && bun test packages/core/src/cad/emitters.test.ts packages/ui-solid/src/cad-emitters.test.ts packages/core/src/templates packages/ui-solid/src/image-import.test.ts'`
2. `sh -c 'mkdir -p tmp/cad3d/m22; bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess > tmp/cad3d/m22/strict.log 2>&1; ! grep -E "^packages/(core|ir)/src/" tmp/cad3d/m22/strict.log | grep -vqE "\.test\.tsx?\(" && bun test packages/core/src/cad/emitters.test.ts'`
3. `sh -c 'mkdir -p tmp/cad3d/m22 && bun test > tmp/cad3d/m22/full.log 2>&1'`

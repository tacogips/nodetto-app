# M22 cad3d-22-emitter-guards

- dependsOn: M2 (rule R in the command layer, CAD shape utils and types)
- Design: section 4 (emitter class table)
- writePaths: `packages/core/src/editor/facade/core.ts` (`canCreateOn`),
  live-page emitters listed in design section 4, and specialized CLI kit
  and sequence add paths that handle a declined insertion. Add regression
  tests in core, UI and CLI.

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

- The live-page emitters in class A check `canCreateOn` for the page
  they will write to and the first type they would create. They return an
  empty result before building commands when the page refuses that type.
- The template and HTML layout builders already create separate freeform
  documents. Gerber import also produces its own freeform page, including
  when the CLI appends it to an existing document.
- Class C canvas handlers also check rule R until the CAD viewport is
  mounted in place of the 2D interaction surface.
- Generic entry points in class A0 still enforce rule R through commands.
  Specialized CLI kit and sequence adds turn a guarded return into an
  operation error before attaching or recording anything.

## Tests

- `emitters.test.ts`:
  1. Live-page emitters in class A return an empty result on CAD pages
     and create elements on compatible pages. Template and HTML layout
     builders produce valid documents with a fresh freeform page.
  2. Class B helpers (group, frame selection, boolean operations,
     component creation, connection creation, sequence, BPMN containment,
     screen transition) leave CAD-only selections unchanged. The M2
     entry-point tests cover the helpers already guarded there.
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
- `cad-emitters.test.ts` (UI): in the browser DOM with both light and
  dark theme settings, image import, icon and kit insertion, the seed,
  and canvas placement and connectors respect rule R. Slide settings
  create their `presentation.slide` carrier on a CAD page.
- `cad-emitters.test.ts` (CLI): specialized adds fail as operation errors;
  Gerber import appends a freeform page to a document containing CAD.
- Existing tests of the touched emitters pass unmodified.

## Acceptance criteria

- Every guarded class A emitter has a negative and a positive test.
  The literal list in the test matches the design table.

## Verification (each must exit 0)

1. `sh -c 'bun run typecheck && bun test packages/core/src/cad/emitters.test.ts packages/ui-solid/src/cad-emitters.test.ts packages/core/src/templates packages/ui-solid/src/image-import.test.ts'`
2. `sh -c 'mkdir -p tmp/cad3d/m22; bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess > tmp/cad3d/m22/strict.log 2>&1; ! grep -E "^packages/(core|ir)/src/" tmp/cad3d/m22/strict.log | grep -vqE "\.test\.tsx?\(" && bun test packages/core/src/cad/emitters.test.ts'`
3. `sh -c 'mkdir -p tmp/cad3d/m22 && bun test > tmp/cad3d/m22/full.log 2>&1'`

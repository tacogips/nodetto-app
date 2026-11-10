# sac-01-slide-data

- planId: sac-01-slide-data
- planPath: impl-plans/active/sac-01-slide-data.md
- progressPath: impl-plans/progress/sac-01-slide-data.md
- wave: 1
- dependsOn: none
- Design: `design-docs/specs/design-slide-area-copy-shapes.md` sections 2.1-2.3, 3.1, 3.2, 9 and 10.
  Pinned names: `impl-plans/active/sac-00-overview.md`.
- writePaths:
  - `packages/ir/src/types.ts`
  - `packages/ir/src/validate.ts`
  - `packages/ir/src/index.ts`: add the two type names to the existing `./types.ts` export list only
  - `packages/ir/src/slide-area.test.ts` (new)
  - `packages/io/src/jsonl/records.ts`
  - `packages/io/src/jsonl/parse.ts`
  - `packages/io/src/jsonl/slide-area.test.ts` (new)
  - `packages/core/src/store.ts`
  - `packages/core/src/commands.ts`
  - `packages/core/src/editor/dirty-pages.ts`, pre-authorized: the new kind has no `id`
  - `packages/core/src/editor/transaction.ts`, pre-authorized for the same type narrowing only
  - `packages/core/src/slide-area-commands.test.ts` (new)
  - `impl-plans/progress/sac-01-slide-data.md`
  - `tmp/sac-s826/sac-01-slide-data`
  - `target`
  - `apps/desktop/dist`
- sharedPaths: none
- artifactRoots: `target`, `apps/desktop/dist`

## Intent and context

Add the stored data:

- `Document.slideSize`: an optional explicit slide size on the JSONL
  document record.
- `Page.slideOrigin`: an optional slide origin on the page record.

Also add the only way to edit them that can be undone:

- the new `updateDocument` command
- a `slideOrigin` field on the `updatePage` patch

No command can change document metadata today: `Store.meta` is set only in
`loadDocument` (`packages/core/src/store.ts:154`). That is why the design
accepts one new Command kind (design 3.1).

The IR barrel line is owned here, not by wiring, because wave 2 must import
the types (the same reasoning as prs-02).

## Non-goals

- No collab changes (sac-04).
- No duplicate-page change (sac-04).
- No facade setters (design 3.3).
- No UI.
- No schema-version bump or migration.

## File-level changes

1. `types.ts`:
   - Add `SlideSize` and `SlideOrigin`.
   - Add `Document.slideSize?` (doc comment: absent means no explicit
     size).
   - Add `Page.slideOrigin?` after `hiddenInPresentation`.
2. `validate.ts`:
   - Root: when `root["slideSize"] !== undefined`, run `checkObject`
     (path `slideSize`). Then:
     - `width` and `height` must be finite numbers in `[1, 100000]`.
       Otherwise push `error("range.slideSize", "slideSize.width" | "slideSize.height", ...)`.
     - Any other key gives `error("type.unknown", "slideSize.<key>", ...)`.
   - Page loop, next to `hiddenInPresentation` (validate.ts:824): the same
     check for `slideOrigin`. `x` and `y` must be finite with
     `|v| <= 1000000`, code `range.slideOrigin`, path `pages[i].slideOrigin.x`.
   - Write one small shared helper for both checks; do not duplicate the
     logic.
3. `records.ts`:
   - Append `"slideSize"` after `"title"` in `DOCUMENT_RECORD_KEYS`.
   - Append `"slideOrigin"` after `"hiddenInPresentation"` in
     `PAGE_RECORD_KEYS`.
   - Add the child orders `slideSize: { keys: ["width", "height"] }` to
     `DOCUMENT_RECORD_ORDER` and `slideOrigin: { keys: ["x", "y"] }` to
     `PAGE_RECORD_ORDER`.
4. `parse.ts`: copy each key only when it is present.
   - Page: imitate `parse.ts:231` (`hiddenInPresentation`).
   - Document snapshot (around `parse.ts:305`): add `slideSize` when
     `known["slideSize"] !== undefined`.
   - Never default or normalize the value.
5. `store.ts`:
   - Add `DocumentMeta.slideSize?`.
   - `loadDocument` copies it only when it is present (conditional spread,
     so there is no `slideSize: undefined` key).
   - `getSnapshot` and `getScopedSnapshot` emit it conditionally, like
     `extensions`.
   - Add `StoreCommit.meta?: DocumentMeta`. In `commit`, when it is present,
     set `this.meta` and set `pagesChanged = true`.
6. `commands.ts`:
   - Add the `updateDocument` union member and a `case "updateDocument"`.
   - Validate a non-null `slideSize`: a plain object with exactly the keys
     `width` and `height`, each finite in `[1, 100000]`. Otherwise
     `CommandError` with code `range.slideSize` at path
     `document.slideSize`.
   - Keep a local `meta` working copy, starting from `store.getMeta()`.
     Apply `null` (remove the key) or the value. An omitted key keeps the
     previous value.
   - Push the undo inverse, `{ type: "updateDocument", document: { slideSize: previous ?? null } }`,
     only when the patch carries the key. Use `undo.unshift`, like the other
     cases.
   - At the end, pass `meta` to `store.commit` only if any `updateDocument`
     ran.
   - `updatePage`:
     - Validate `slideOrigin` when it is not null (code `range.slideOrigin`,
       path `page.slideOrigin`).
     - Add `slideOrigin: _oldSlideOrigin` to the destructured previous at
       `commands.ts:~815`.
     - Re-add it with the same null / patch / previous ternary as
       `hiddenInPresentation`.
     - The inverse carries `slideOrigin: previous.slideOrigin ?? null` only
       when the patch has the key.
7. `dirty-pages.ts`: return `undefined` (plan the whole document) for
   `updateDocument`, next to `createPage`/`updatePage`/`deletePage`.
   `transaction.ts`: change only what the typecheck requires for the new
   member.

## Pitfalls

- A missing key must stay missing:
  - `loadDocument` of a document without `slideSize` followed by
    `getSnapshot` must have no `slideSize` property.
  - Avoid `{ slideSize: document.slideSize }`, which creates an
    `undefined`-valued key.
- Without the destructure in step 6, `updatePage` with `slideOrigin: null`
  would keep the old value through `...base`.
- Do not change the existing undo payload keys for other fields.
- `SlideSize` in `packages/core/src/presentation/fit.ts` already exists. In
  `store.ts` and `commands.ts`, import the IR type from `@nodetto/ir`. Do
  not export it again from the core barrel.

## Tests (input -> expected)

- `packages/ir/src/slide-area.test.ts` (imitate `packages/ir/src/page-presentation-flag.test.ts`):
  - valid `{width:1920,height:1080}` -> no issues
  - `slideSize: 5` -> `type.object`
  - `width: 0`, `NaN` or `100001` -> `range.slideSize`
  - an extra key `{..., depth: 1}` -> `type.unknown`
  - page `slideOrigin {x:-50,y:100}` -> ok; `x: Infinity` -> `range.slideOrigin`
- `packages/io/src/jsonl/slide-area.test.ts` (imitate `packages/io/src/jsonl/page-presentation-flag.test.ts`):
  - A round trip with both fields is byte-identical, and the key order is
    `title` then `slideSize`, and `hiddenInPresentation` then `slideOrigin`.
  - Child keys are written `width,height` and `x,y` even when the input
    object has them reversed.
  - A golden-style file without the keys is byte-identical, and the parsed
    snapshot has no such keys.
- `packages/core/src/slide-area-commands.test.ts` (imitate `packages/core/src/page-presentation-flag.test.ts`):
  - `updateDocument` set -> `store.getMeta().slideSize` equals the value and
    the diff has `pagesChanged` true. Undo -> the key is absent. Redo -> set
    again.
  - set A, set B, undo -> A
  - `null` removes the key
  - an invalid size throws `CommandError` and the store is unchanged
  - `updatePage slideOrigin` set, clear (`null`) and undo restore the
    previous value exactly; a rename-only patch keeps `slideOrigin`
  - `new Editor({document with slideSize})` then `getSnapshot()` keeps
    `slideSize`
  - a document without it -> no key

## Verification (each exits 0 with at least 1 pass and 0 fail; logs in `tmp/sac-s826/sac-01-slide-data/final/`)

1. `bun test ./packages/ir/src/slide-area.test.ts ./packages/ir/src/page-presentation-flag.test.ts` -> `ir.log`
2. `bun test ./packages/io/src/jsonl` -> `io.log` (the golden and round-trip
   suites unchanged, plus the new file)
3. `bun test ./packages/core/src/slide-area-commands.test.ts ./packages/core/src/page-presentation-flag.test.ts ./packages/core/src/pages.test.ts` -> `core.log`
4. `bun run typecheck` -> `typecheck.log`

Static: `bunx biome check` on owned files only.

## Done criteria

- Verifications 1-4 exited 0. The log tails show the pass counts.
- `grep -n '"updateDocument"' packages/core/src/commands.ts` matches the
  union and the case.
- The progress log has the intent hash, the per-edit hashes and every
  command's exit status.

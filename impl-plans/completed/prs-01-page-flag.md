# prs-01-page-flag

- planId: prs-01-page-flag
- planPath: impl-plans/active/prs-01-page-flag.md
- progressPath: impl-plans/progress/prs-01-page-flag.md
- wave: 1
- dependsOn: none
- Design: `design-docs/specs/design-presentation.md` sections 2, 3 and 10.
  Rules and contracts: `impl-plans/active/prs-00-overview.md`.
- writePaths:
  - `packages/ir/src/types.ts`
  - `packages/ir/src/validate.ts`
  - `packages/ir/src/page-presentation-flag.test.ts` (new)
  - `packages/io/src/jsonl/records.ts`
  - `packages/io/src/jsonl/parse.ts`
  - `packages/io/src/jsonl/page-presentation-flag.test.ts` (new)
  - `packages/collab/src/ydoc.ts`
  - `packages/collab/src/page-presentation-flag.test.ts` (new)
  - `packages/core/src/commands.ts`
  - `packages/core/src/editor/pages.ts`
  - `packages/core/src/editor/facade/page-editing.ts`
  - `packages/core/src/page-presentation-flag.test.ts` (new)
  - `impl-plans/progress/prs-01-page-flag.md`
  - `tmp/prs-s793/prs-01-page-flag`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

Add an optional per-page flag that excludes a page from the slideshow. It
must persist in the JSONL page record and in Yjs, and it must be editable
through the existing `updatePage` command with exact undo. The plan also
adds `exportPageSvgOf`, which prs-04 needs to render pages other than the
current one: `requireAsset` is protected
(`packages/core/src/editor/facade/core.ts:109`).

## Non-goals

- No UI (that is prs-05). No presentation logic (prs-02).
- No CLI change. No migration or schema-version bump. No new Command kind.
- `serialize.ts` is not touched: `pageLine` flattens every present field in
  `PAGE_RECORD_ORDER`.

## File-level changes

1. `types.ts` `Page`: add `readonly hiddenInPresentation?: boolean;` after
   `connectorRouting`, with a one-line doc comment ("absent means shown").
2. `validate.ts` page loop (near the `sqlDialect`/`tokenMode` checks, about
   line 824):
   - add `checkBoolean(out, page["hiddenInPresentation"], `${path}.hiddenInPresentation`, { optional: true })`
   - imitate the `routingAvoidObstacles` call at about line 816
   - the code emitted for a non-boolean is whatever `checkBoolean` emits
     (expected `type.boolean`); assert the actual code in the test
3. `records.ts` `PAGE_RECORD_KEYS`: append `"hiddenInPresentation"` after
   `"connectorRouting"`.
4. `parse.ts` page branch (about line 222): copy
   `known["hiddenInPresentation"]` when it is not `undefined`, exactly like
   `sqlDialect`. Never coerce or default it.
5. `ydoc.ts`:
   - `pageFields` adds the key only when it is defined
   - `pageFromY` adds it only when `typeof record.hiddenInPresentation === "boolean"`
   - update the header comment listing the page map keys (line 5)
6. `commands.ts`:
   - Patch type (about line 96): `readonly hiddenInPresentation?: boolean | null;`.
   - Handler: a value that is not `undefined`, not `null` and not a boolean
     fails with `CommandError([error("type.boolean", "page.hiddenInPresentation", "expected a boolean or null")], "updatePage: invalid hiddenInPresentation")`.
   - Destructure `hiddenInPresentation` out of `previous` together with the
     other fields:
     - `null` drops it
     - a boolean sets it
     - `undefined` keeps `previous.hiddenInPresentation` when it is defined
     Imitate `sqlDialect`.
   - Undo: add `...(patch.hiddenInPresentation === undefined ? {} : { hiddenInPresentation: previous.hiddenInPresentation ?? null })`,
     imitating the `mode` entry.
7. `pages.ts` duplicate builder (about line 110): add
   `...(source.hiddenInPresentation === true ? { hiddenInPresentation: true } : {})`.
8. `page-editing.ts`, imitating `setPageMode` and `exportPageSvg`:
   - `setPageHiddenInPresentation(id, hidden, applyOptions = {})`:
     - returns `false` with no apply when the page is missing or
       `(page.hiddenInPresentation === true) === hidden`
     - otherwise applies `{ hiddenInPresentation: hidden ? true : null }`
       and returns `true`
   - `exportPageSvgOf(pageId, options = {})`: `renderPageSvg(this.store, this.registry, pageId, { resolveAsset: this.requireAsset, ...options })`

## Pitfalls

- Writing `false` on unhide would change files. The setter writes `null`
  (removal). Only an explicit `false` already read from a file survives.
- The reader must not normalize `false` to absent or absent to `false`.
- The undo entry must be conditional. Otherwise undoing a rename would
  reset the flag.
- Do not touch `serialize.ts`, the golden fixtures or `apps/cli`.

## Tests (input -> expected)

- `packages/ir/src/page-presentation-flag.test.ts` (use `validateDocument`):
  - `true`, `false` or absent -> no error
  - `"yes"` or `1` -> one error at `pages[0].hiddenInPresentation`
- `packages/io/src/jsonl/page-presentation-flag.test.ts`:
  - A canonical doc with no flag -> parse then serialize is byte-identical
    to the input.
  - `true` -> byte-identical, and the key appears after `connectorRouting`.
  - `false` -> byte-identical.
  - Writing a store document with the flag set -> the page line contains
    `"hiddenInPresentation":true`.
- `packages/collab/src/page-presentation-flag.test.ts`:
  - `pageFields` on a page with `true` -> contains the key
  - `pageFields` on a page without it -> no key
  - `pageFromY` -> `true` round-trips; a non-boolean is dropped
  - imitate `binding-pages-artboards.test.ts`
- `packages/core/src/page-presentation-flag.test.ts` (imitate
  `editor.test.ts:makeEditor`):
  - The setter hides -> the page has `true`. Undo -> the key is absent.
    Redo -> `true`.
  - Setting the same value -> returns `false`, and the revision is
    unchanged.
  - Unhide -> the key is absent (not `false`).
  - A page loaded with `false`, set to hidden, then undone -> `false`.
  - `updatePage` with `hiddenInPresentation: "x"` -> throws `CommandError`.
  - A rename patch -> the flag is kept.
  - Duplicating a hidden page -> the copy has `true`.
  - `exportPageSvgOf` on a non-current page -> non-null SVG containing its
    element's `data-id`.

## Verification (each exits 0 with at least 1 pass and 0 fail; logs in `tmp/prs-s793/prs-01-page-flag/final/`)

1. `bun test ./packages/ir/src/page-presentation-flag.test.ts` -> `ir.log`
2. `bun test ./packages/io/src/jsonl/page-presentation-flag.test.ts ./packages/io/src/jsonl/golden.test.ts ./packages/io/src/jsonl/roundtrip.test.ts` -> `io.log`
3. `bun test ./packages/collab/src/page-presentation-flag.test.ts ./packages/collab/src/binding-pages-artboards.test.ts` -> `collab.log`
4. `bun test ./packages/core/src/page-presentation-flag.test.ts ./packages/core/src/editor.test.ts` -> `core.log`

Static: Biome on the owned files, then `bun run typecheck`.

## Done criteria

- Verifications 1-4 exited 0.
- `git diff --stat -- packages/io/src/jsonl/serialize.ts packages/io/src/__fixtures__ apps/cli`
  is empty.
- `git diff d6f9ebd -- packages/core/src/commands.ts | grep -E '^\+\s*\| \{|^\+\s*readonly type:'`
  prints nothing: the `Command` union gains no member.
- The progress log has the intent hash, per-edit hashes and command results.

## Implementation status

- Implementation and assigned verification completed; formal review and integration remain downstream.
- Evidence: `tmp/prs-s793/prs-01-page-flag/final/` and `impl-plans/progress/prs-01-page-flag.md`.

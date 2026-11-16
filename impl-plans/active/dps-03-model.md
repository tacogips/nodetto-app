# dps-03-model

- planId: dps-03-model. Wave 1. dependsOn: none.
- Design: sections 3.1, 4.1, 5.1, 5.2 and 9 of
  `design-docs/specs/design-document-pages-snippets.md`.
- writePaths:
  - New IR files:
    - `packages/ir/src/semantics/document.ts`
    - `packages/ir/src/registry/document.ts`
    - `packages/ir/src/registry/document.test.ts`
    - `packages/ir/src/page-flow.test.ts`
  - Existing IR files: `packages/ir/src/semantics/design.ts`,
    `packages/ir/src/semantics.ts`, `packages/ir/src/index.ts`,
    `packages/ir/src/registry/containers.ts`,
    `packages/ir/src/registry/containers.test.ts`,
    `packages/ir/src/types.ts`, `packages/ir/src/validate.ts`.
  - io:
    - `packages/io/src/jsonl/records.ts`
    - `packages/io/src/jsonl/parse.ts`
    - `packages/io/src/jsonl/page-flow.test.ts` (new)
  - collab:
    - `packages/collab/src/ydoc.ts`
    - `packages/collab/src/page-flow.test.ts` (new)
  - core:
    - `packages/core/src/commands.ts`
    - `packages/core/src/editor/pages.ts`
    - `packages/core/src/page-flow-commands.test.ts` (new)
  - Logs and artifacts: `impl-plans/progress/dps-03-model.md`,
    `tmp/dps-s861/dps-03-model`, `target`.
- sharedPaths: none.
- artifactRoots: `target`.

## Intent and context

This plan adds the data model:

- `text.code` and `text.markdown` semantics with their definitions;
- `FrameSemantic.page`;
- `Page.pageFlow`, editable through the existing `updatePage` command.

It carries JSONL, collab and duplicate-page support. It is the only IR
writer before wiring, so it owns the IR type maps and barrel lines.
`DEFINITIONS` registration in `packages/ir/src/registry.ts` stays with
dps-17.

## Non-goals

- No new Command kind and no schema-version bump.
- No edit to `packages/ir/src/registry.ts`. Registration and the golden
  fixture belong to dps-17.
- No core shape utils or UI.

## Changes and contract

1. `semantics/document.ts`:
   - `TextCodeSemantic { code: string; language: string; showLineNumbers?: boolean; wrap?: boolean }`
   - `TextMarkdownSemantic { markdown: string }`
   - `TEXT_SNIPPET_MAX_LENGTH = 200000`
   - `TEXT_CODE_LANGUAGE_PATTERN = /^[a-z0-9][a-z0-9_+#.-]{0,31}$/`
   - `PAGE_FRAME_SIZES = ["a4","a5","letter","legal","slide-16-9","slide-4-3","custom"] as const`
   - `PAGE_FRAME_ORIENTATIONS = ["portrait","landscape"] as const`
   - `PageFrameSpec { size: PageFrameSize; orientation: PageFrameOrientation }`
   - `PAGE_FLOWS = ["vertical","horizontal"] as const`, `PageFlow`
2. `semantics/design.ts`: add `readonly page?: PageFrameSpec` to
   `FrameSemantic`.
3. `semantics.ts`:
   - re-export the new types and constants, imitating the `table.ts`
     re-export block;
   - add `"text.code": TextCodeSemantic` and
     `"text.markdown": TextMarkdownSemantic` to `SemanticByType`.
4. `index.ts`: export the new names, imitating the table exports at
   `packages/ir/src/index.ts:27-38`.
5. `registry/document.ts`: `TEXT_CODE` and `TEXT_MARKDOWN`
   `ElementTypeDefinition`s. Imitate `packages/ir/src/registry/table.ts`.
   - category `node`, `onReferenceDeleted: "detach"`, `references: noReferences`.
   - keyOrder: `["code","language","showLineNumbers","wrap"]` and
     `["markdown"]`.
   - Validation: `code` and `markdown` are strings (`allowEmpty`). Longer
     than the max is error `text.limit`. `language` is a string matching
     the pattern, else error `type.pattern` (reuse whatever code
     `checkString` gives for a pattern, if it has a pattern option;
     otherwise add `text.language`). The booleans use `checkBoolean`
     optional.
   - Unknown keys get the existing `semantic.unknownField` behaviour, which
     comes from keyOrder automatically in `validate.ts`. Do not duplicate
     it.
6. `registry/containers.ts` `FRAME`:
   - append `"page"` to keys and add child `page: { keys: ["size","orientation"] }`;
   - validate `page` when present: object (`type.object`), both fields
     required, `checkEnum`.
7. `types.ts`: add `readonly pageFlow?: PageFlow` to `Page` after
   `slideOrigin`. `validate.ts`: in the page loop next to `slideOrigin`
   (about :1021-1035), `checkEnum` at `pages[i].pageFlow` with optional.
8. io:
   - `records.ts`: append `"pageFlow"` to `PAGE_RECORD_KEYS` after
     `"slideOrigin"`.
   - `parse.ts` (about :231-236): copy the field only when present, the
     same pattern as `slideOrigin`.
9. collab `ydoc.ts`: `pageFields` emits `pageFlow` when defined.
   `pageFromY` accepts only `"vertical"` or `"horizontal"`. Imitate
   `hiddenInPresentation` at :97-102 and :242-251, and add `pageFlow?` to
   the schema comment at :5.
10. core `commands.ts`:
    - the `updatePage` patch gains `readonly pageFlow?: PageFlow | null`.
    - Handler next to `slideOrigin` (:862-928): a value other than null or
      a member of `PAGE_FLOWS` throws `CommandError` with code `type.enum`
      and path `page.pageFlow`.
    - `null` removes the key. An omitted key keeps the previous value.
    - Inverse at :963-970: only when the patch carries the key, restore
      `previous.pageFlow ?? null`.
11. core `editor/pages.ts` `planDuplicatePage` (:161-164): copy `pageFlow`
    when defined.

## Pitfalls

- Byte-identical round trip:
  - The reader never adds or normalises `pageFlow` or `page`.
  - A file without them writes back unchanged.
  - Writing `"vertical"` explicitly must survive as `"vertical"`.
- `SemanticByType` additions must not break exhaustive switches. Run
  typecheck and fix only compile errors that these additions cause in
  files this plan owns. If another file breaks, record it for dps-17 and do
  not edit it.
- `noUncheckedIndexedAccess`, no `any`.

## Tests (input -> expected)

- `TEXT_CODE.validateSemantic` (called directly, not through the registry):
  - `{code:"",language:"plain"}` gives no issues.
  - `language:"Rust"` gives a pattern error.
  - A missing `code` gives `field.missing`.
  - A 200,001-character code gives `text.limit`.
  - `wrap:"yes"` gives a boolean type error.
- `TEXT_MARKDOWN`: `{markdown:"# a"}` is valid. `{}` gives `field.missing`.
- `FRAME`:
  - `page:{size:"a4",orientation:"portrait"}` is valid.
  - `size:"a3"` gives `type.enum`.
  - A missing `orientation` gives `field.missing`.
  - `page:{size:"a4",orientation:"portrait",x:1}` gives
    `semantic.unknownField` through the document validator.
- Page `pageFlow:"diagonal"` gives `type.enum` at `pages[0].pageFlow`.
- JSONL:
  - A document with `pageFlow:"horizontal"` and a frame with `page`
    round-trips byte-identically.
  - A document without them is byte-identical.
  - The key order puts `pageFlow` after `slideOrigin`.
- Collab: seeding and reading a page with `pageFlow` keeps it. An invalid
  stored value is dropped.
- Commands:
  - Set `horizontal`, then undo, gives no key.
  - Set, then set `null`, removes the key.
  - Invalid input throws `type.enum`.
  - A patch without `pageFlow` keeps the existing value.
- Duplicating a page copies `pageFlow`.

## Verification (each must exit 0; logs go to tmp/dps-s861/dps-03-model/)

1. `bun test packages/ir packages/io/src/jsonl packages/collab packages/core/src/page-flow-commands.test.ts packages/core/src/duplicate-slide-origin.test.ts`
   must show 0 failures. Existing slide-origin and presentation-flag tests
   must still pass.
2. `bun run typecheck`
3. `bunx biome check --diagnostic-level=warn packages/ir/src packages/io/src/jsonl packages/collab/src/ydoc.ts packages/collab/src/page-flow.test.ts packages/core/src/commands.ts packages/core/src/editor/pages.ts packages/core/src/page-flow-commands.test.ts`

## Done criteria

- The listed names are exported from `@nodetto/ir`.
- `updatePage` accepts `pageFlow`.
- All three commands exit 0.
- The progress log records the per-file pre and post hashes, the commands,
  the exit codes and the log paths.

## Coordination

- No other wave-1 plan writes these files. Re-read each file before every
  edit and record its hashes.
- If an unexpected change appears, stop editing that file and record the
  drift.
- No git state changes.

## Implementation status

- Model, persistence, command and duplication changes implemented; behavioral suite, typecheck and Biome passed on the shared tree. See `impl-plans/progress/dps-03-model.md` for hashes and logs.
- Registry wiring and formal review remain downstream.

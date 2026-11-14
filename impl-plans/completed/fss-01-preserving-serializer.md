# fss-01-preserving-serializer

- planId: fss-01-preserving-serializer
- planPath: impl-plans/active/fss-01-preserving-serializer.md
- progressPath: impl-plans/progress/fss-01-preserving-serializer.md
- wave: 1
- dependsOn: none
- Design: `design-docs/specs/design-file-save-stability.md`, section "Byte-preserving serialization".
- Worker rules and pinned contracts: `impl-plans/active/fss-00-overview.md`.
- writePaths:
  - `packages/io/src/jsonl/serialize.ts`
  - `packages/io/src/jsonl/preserve-text.ts` (new)
  - `packages/io/src/jsonl/preserve-text.test.ts` (new)
  - `packages/io/src/index.ts`
  - `impl-plans/progress/fss-01-preserving-serializer.md`
  - `tmp/fss-s751/fss-01-preserving-serializer`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

Today every desktop save re-canonicalizes all records, so a line another writer wrote in a different but valid form changes even though nothing about it changed. This plan adds a serializer that keeps the raw base line of every unchanged record. `fss-03` calls it. The existing `sourceLines` option cannot be reused, because it is keyed by object identity (`packages/io/src/jsonl/source-lines.ts`) and editor snapshots are different objects.

## Non-goals

- `serializeDocument` output and options do not change. Golden and roundtrip tests must pass unmodified.
- No CLI call site. No change to `parse.ts`, `source-lines.ts`, `canonical.ts`, `records.ts`, or anything under `packages/ir`.
- No session wiring. That belongs to `fss-03`.

## File-level changes

`packages/io/src/jsonl/serialize.ts`: export the existing `documentLine`, `pageLine`, `elementLine`, `unknownLine`, `comparePages` and `compareElements` so `preserve-text.ts` can use them, or add one helper there returning canonical `{ key, line }` entries in canonical order. Do not add these to `packages/io/src/index.ts`. Behavior stays identical.

`packages/io/src/jsonl/preserve-text.ts`: add `serializeDocumentPreservingText(document: Document, baseText: string): string`.

- Record keys: `document`, `page:<id>`, `element:<id>`, `unknown:<canonical text>`.
- Order of work, as in the design's steps 1 to 7:
  1. `assertValidDocument(document)`, then canonical lines for `document`.
  2. `parseDocumentResult(baseText)`, then canonical lines for the parsed base.
  3. Walk raw base lines, split on the string `"\n"`, and map each record to its key. Use `JSON.parse` on the line for `kind` and `id`. An unknown record's key comes from `unknownLine` over its fields without `kind`.
  4. Unchanged means canonical base line equals canonical new line for the same key.
  5. If nothing changed, was added or removed, return `baseText` itself.
  6. If surviving base keys appear in the same relative order as canonical order, emit canonical order, with raw lines for unchanged records.
  7. Otherwise keep base order, replace changed records in place, drop removed ones, and insert each new record after its canonical predecessor, or after the document record if it has none.
- Return plain `serializeDocument(document)` when the base does not parse or validate, the base id differs from `document.id`, the raw document record's `schemaVersion` differs from the parsed base's, the parsed base's `schemaVersion` differs from `document.schemaVersion`, or the raw walk finds a duplicate non-unknown key.
- Keep a leading BOM. End with a newline exactly when `baseText` does. New and replaced lines end with `\n` only. Unchanged raw lines keep any trailing `\r`.

`packages/io/src/index.ts`: export `serializeDocumentPreservingText` from `./jsonl/preserve-text.ts`, next to the `serializeDocument` export.

Imitate: `packages/io/src/jsonl/parse.ts:collect` for the BOM and string split, and `setField` from `packages/io/src/jsonl/objects.ts` for building objects from disk keys.

## What a careless implementation gets wrong

- Comparing `raw line === new canonical line` would mark every non-canonical line as changed. Compare canonical to canonical.
- Reusing lines from a migrated base writes old-schema records under a new document line. That is why migrated bases fall back.
- `const [a] = ...` and `arr[i]` are `T | undefined` under `noUncheckedIndexedAccess`. Check them instead of using `!`.
- Do not split with a regular expression. The native CLI's interpreter is quadratic on those, and the rule applies to all shared code.
- `__proto__` keys from disk must not go through plain assignment. Use `setField`.
- A duplicate unknown record is legal. Treat unknown keys as a count, keeping as many raw lines as the new document has.
- Blank lines are not records. They are kept by the identity return and by base-order output, and may be dropped by canonical-order output.
- A move to another page or a page `order` change is a changed record whose sort position moves. In canonical-order output it must land at its canonical position.

## Tests

`packages/io/src/jsonl/preserve-text.test.ts`, imitating `packages/io/src/jsonl/source-lines.test.ts`. Build fixtures with self-authored `widgets` and `orders` elements.

- Document unchanged, canonical base -> result is the same string as the base.
- Document unchanged, base with reversed key order on one element, a blank line, a BOM and CRLF -> result is the same string as the base.
- Canonical base, one element edited -> equals `serializeDocument(document)`.
- Canonical base, element added, removed, and moved to another page -> each equals `serializeDocument(document)`.
- Base with one non-canonical element line, another element edited -> the non-canonical line is present byte for byte, and the edited record parses to the new value.
- Base in foreign record order, element edited -> surviving lines keep their order and the edited line stays in place.
- Base in foreign record order, element added -> new line directly follows its canonical predecessor. With no predecessor, it follows the document record.
- Unknown record kind in the base, element edited -> unknown line unchanged byte for byte.
- Two identical unknown records in base, document has both -> both kept.
- Base with an older `schemaVersion` that migrates -> equals `serializeDocument(document)`. If no real migration fixture is practical, pass a base whose raw `schemaVersion` differs through the existing migration path used in `packages/io/src/jsonl/roundtrip.test.ts`.
- Base with a different document id, and unparseable base -> equals `serializeDocument(document)`.
- Invalid `document` -> throws, as `serializeDocument` does.
- Base without a trailing newline, element edited -> result has no trailing newline.

## Verification (each must exit 0)

1. `bun test packages/io/src/jsonl/preserve-text.test.ts packages/io/src/jsonl/roundtrip.test.ts packages/io/src/jsonl/source-lines.test.ts packages/io/src/jsonl/golden.test.ts` -> 0 fail, new tests included. Log: `tmp/fss-s751/fss-01-preserving-serializer/test.log`.
2. `bun run typecheck`. Log: `typecheck.log` in the same directory. See the sibling rule in the overview.
3. `bunx biome check packages/io/src/jsonl/serialize.ts packages/io/src/jsonl/preserve-text.ts packages/io/src/jsonl/preserve-text.test.ts packages/io/src/index.ts`. Log: `biome.log`.

## Done criteria

- Verification 1-3 exit 0 with logs recorded.
- `grep -n "serializeDocumentPreservingText" packages/io/src/index.ts` matches.
- `grep -rn "serializeDocumentPreservingText" apps/cli/src` matches nothing.
- `golden.test.ts` and `roundtrip.test.ts` have no diff.
- Progress log complete.

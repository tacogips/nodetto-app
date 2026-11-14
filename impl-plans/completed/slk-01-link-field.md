# slk-01-link-field

- planId: slk-01-link-field
- planPath: impl-plans/active/slk-01-link-field.md
- progressPath: impl-plans/progress/slk-01-link-field.md
- wave: 1; dependsOn: none
- Design: `design-docs/specs/design-slide-link-animation.md` sections 2.1-2.3, 9.
- writePaths: `packages/ir/src/types.ts`, `packages/ir/src/validate.ts`,
  `packages/ir/src/keyOrder.ts`, `packages/ir/src/link-id.test.ts` (new),
  `packages/io/src/jsonl/link-id.test.ts` (new),
  `packages/collab/src/link-id.test.ts` (new),
  `impl-plans/progress/slk-01-link-field.md`, `tmp/slk-s855/slk-01-link-field`, `target`
- sharedPaths: none. artifactRoots: `target`.

## Intent and context

Copies of one shape on several pages share an optional `visual.linkId`.
Linked shapes are matched by it when a presentation animates between
slides. This plan only adds the field to the IR. JSONL
(`packages/io/src/jsonl/*`) and Yjs (`packages/collab/src/ydoc.ts`
`elementFromY`, line ~263, and the `toY({...element.visual})` writer) already
carry `visual` generically, so they need tests only, no code.

## Non-goals

- No change to `packages/io/src/**` or `packages/collab/src/**` source, or
  to `packages/core/**`.
- No schema-version bump and no migration.
- Never call it "group id".

## File-level changes

1. `types.ts`, `Visual`, right after `componentKey` (line ~340): add
   `readonly linkId?: string;` with the doc comment
   `/** Shared by copies of one shape on several pages; drives slide transitions. */`.
2. `validate.ts`, right after the `componentKey` check (line ~267):
   `checkString(out, raw["linkId"], `${path}.linkId`, { optional: true })`.
   That gives `type.string` for a non-string and `value.empty` for `""`
   (see `packages/ir/src/checks.ts:checkString`). Add no other rule.
3. `keyOrder.ts`: insert `"linkId"` directly after `"componentKey"` in the
   visual key list (line ~112).

## Pitfalls

- Do not default or normalize the field anywhere (no `linkId: undefined`
  spread). Absent must stay absent.
- Do not touch the golden fixtures.

## Tests

- `packages/ir/src/link-id.test.ts` (follow
  `packages/ir/src/*.test.ts` validate tests, for example the
  page-presentation-flag test):
  - visual `{ linkId: "a" }` -> no issue
  - `{ linkId: "" }` -> issue code `value.empty` at `elements[0].visual.linkId`
    (match the path format the existing tests use)
  - `{ linkId: 3 }` -> `type.string`
- `packages/io/src/jsonl/link-id.test.ts` (imitate
  `packages/io/src/jsonl/page-presentation-flag.test.ts`):
  - a document whose element has `linkId` -> serialize, parse, serialize:
    identical text; the parsed value equals the original
  - the serialized record puts `"linkId"` right after `"componentKey"`
    when both are present
  - a JSONL text without `linkId` -> parse then serialize is byte-identical
    to the input
- `packages/collab/src/link-id.test.ts` (imitate
  `packages/collab/src/page-presentation-flag.test.ts` or `binding.test.ts`):
  - an element with `linkId` written to a Y.Doc and read with
    `elementFromY` keeps `linkId`
  - an element without it reads back with no `linkId` key
    (`"linkId" in visual === false`)

## Verification (each must exit 0)

1. `bun test packages/ir packages/io packages/collab`: all pass, including
   the unchanged golden and round-trip suites.
2. `bun run typecheck`: exit 0.
3. `bunx biome check --diagnostic-level=warn packages/ir/src/types.ts packages/ir/src/validate.ts packages/ir/src/keyOrder.ts packages/ir/src/link-id.test.ts packages/io/src/jsonl/link-id.test.ts packages/collab/src/link-id.test.ts`

The strict-index gate for these files runs in slk-07 (slk-00 is in the
same wave).

Evidence: complete logs under `tmp/slk-s855/slk-01-link-field/`.

## Acceptance criteria

- `git diff --stat ccac2d3 -- packages/io/src packages/collab/src` shows
  only the two new test files.
- All listed tests pass; the golden suites are unchanged.

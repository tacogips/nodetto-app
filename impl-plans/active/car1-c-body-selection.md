# car1-c-body-selection: indexed interference body resolution (F7)

- planId: car1-c-body-selection. Wave 1. dependsOn: none. Gate: none.
- Design: `design-docs/specs/design-ai-capture.md` 19.1 F7 and 4.1
  (`--interference-bodies` row).
- Progress log: `impl-plans/progress/car1-c-body-selection.md`.

## Intent

A full body id must select its body even when it is also another id's
prefix or another body's name, so `part,part-extra` selects both. The
lookup must be indexed, not a full scan per query.

## Non-goals

- No new production file.
- No change outside the resolver hunk of `prepareCadCapture`
  (`cad-request.ts:76-101` today).
- The decoder type and the model-build placement belong to A2 and B3.

## Changes (`packages/core/src/capture/cad-request.ts`)

- Add a module-private `resolveInterferenceBodies(bodies, queries, stats?)`
  and call it from `prepareCadCapture` in place of the current loop:
  1. Deduplicate the queries, keeping the first occurrence.
  2. Build once:
     - `Map<id, index>`;
     - `Map<name, index[]>`;
     - an array of `[id, index]` sorted by UTF-16 code units (`<`).
  3. For each query:
     - an empty query fails;
     - an exact id selects that body;
     - otherwise collect the distinct bodies whose name equals the query,
       plus the binary-searched range of ids that start with it; exactly
       one must remain.
  4. The first failing query in input order throws the existing
     `CaptureInputError` message
     `Body query "<q>" is unknown or ambiguous. Bodies: <names>.`
     Build `names` only at that moment.
  5. Fewer than two distinct indices keeps the existing "Select at least
     two distinct bodies" error.
  6. Return the indices sorted ascending.
- `stats` is optional and test-only: `{ lookups: number }`, counting map
  probes and binary-search steps.
- Expose it through an optional field of `CadCaptureRequest`, for example
  `readonly selectionStats?: { lookups: number }`. Mark the field
  test-only in a comment.

## Pitfalls

- Keep the exact message text and error class.
- Keep `CaptureInputError` without the `limit` flag.
- A query that is an exact id must not also count name or prefix matches.
- Sort ids with `<`, not `localeCompare`.

## Tests (`packages/core/src/capture/cad-request.test.ts`)

- Bodies `part` and `part-extra`, queries `part,part-extra`: indices of
  both. Fails before with the ambiguity error.
- A body whose name equals another body's id: the full id wins.
- `par` with bodies `part` and `part-extra`: the existing ambiguity error,
  with the name list.
- `part,part,part-extra`: accepted; same result as without the
  duplicate.
- Output is ascending regardless of query order.
- 5,000 bodies and 500 distinct queries (ids, names, unique prefixes):
  `lookups` is at most `500 * (2 + 2 * ceil(log2(5000)))`. Before, the
  same work was 2,500,000 callbacks.

## Verification

1. `biome check packages/core/src/capture/cad-request.ts packages/core/src/capture/cad-request.test.ts && bun test packages/core/src/capture/cad-request.test.ts`
   must exit 0.
2. `bun run typecheck && bun test packages/core/src/capture apps/cli/src/capture-interference-options.test.ts apps/cli/src/capture-cad.test.ts`
   must exit 0.

## Done when

- The new cases pass and all existing `cad-request` tests are unchanged.
- The progress log records hashes and exit codes.

## Implementation status

- Indexed resolver and regression tests implemented; focused checks pass.
- Both required gates pass on the current shared tree; implementation is ready for downstream review. See the progress log for evidence.
- Formal reviews and integration are downstream.

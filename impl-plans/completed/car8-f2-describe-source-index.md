# car8-f2-describe-source-index

- planId: car8-f2-describe-source-index; wave 1; dependsOn: none
- progressPath: impl-plans/progress/car8-f2-describe-source-index.md
- Finding: performance-capture-sibling-attribution-rescans (medium).
- Design: `design-docs/specs/design-ai-capture.md` 26.1 R8-2 (attribution rules from
  23.1 R5-1 unchanged). Follow `impl-plans/active/car8-00-overview.md` worker rules.
  Evidence: `tmp/car8-r8/car8-f2-describe-source-index/`.

## Intent and context

`describeBodies` (`packages/core/src/capture/describe.ts:133-250`) builds `sources`
(`:154-170`, one entry per eligible emptied body, model order), then for every closed body
runs `body.steps.findIndex` once per other source (`:190-200`). One cut emptying B bodies
costs O(B^2) step reads (2,048 bodies: 16,775,168 reads). Callers
`apps/cli/src/capture-cad.ts:142` and `apps/desktop/src/shell/export-handlers.ts:294` run
this after the image is ready.

Non-goals: no change to `sources`, `existingIndex`, the strict `<` at `:201-204`, error
texts, error order, `names`, notes, `notSampled`, `describeInterference`, exports or any
other file. No test-only parameter on `describeBodies`.

## Changes (`packages/core/src/capture/describe.ts`, inside `describeBodies`)

1. After `sources`, build once a nested map
   `Map<number /* tool */, Map<CaptureStep op string, Source[]>>` holding, per
   `(step.tool, step.op)` of each source, the first two sources in model order (push only
   while length < 2). `Source` is `(typeof sources)[number]`.
2. Replace the per-source `findIndex` loop (`:190-200`) with:
   - No-sibling shortcut: if `state.open`, or `sources.length === 0`, or
     (`sources.length === 1` and `sources[0]?.i === i`), there is no sibling and no step
     is read.
   - Otherwise walk `body.steps` once in order; at step `k` look up
     `index.get(step.tool)?.get(step.op)`; candidate = first entry with `.i !== i`, else
     none. Stop at the first `k` with a candidate: `sibling = { index: k, source }`.
3. Keep everything after (`selectedSibling`, error pushes, names) byte-identical.

Pitfalls:
- Equivalence: the old result is the minimum first-match index over other sources, tie to
  the earliest source; the first step whose key has an other source gives the same index,
  and the first non-self entry of that key gives the same source. Two entries suffice
  because only the body itself can be skipped.
- Read each step's `tool`/`op` at most once per body (store in locals); the test counts
  property reads.
- Do not move the `sources` eligibility checks or read steps for bodies with
  `emptiedByStep === -1` in `sources` (today returns before reading steps).
- Typed reads: `sources[0]?.i`; no non-null assertions.

## Tests (`packages/core/src/capture/describe.test.ts`, append; existing tests untouched)

Use the file's `report` constant and `as unknown as CadCaptureModel` casts like the test
at `describe.test.ts:290`. Step objects are built with `get op()`/`get tool()` getters
that increment one `reads` counter.
- "a cut shared by many emptied bodies is attributed with linear step reads": for
  `B` in 256, 512, 1024: tools (objects `{ feature }`) `base-<i>` at index i, `cut` at
  index B, `base-stand` at index B + 1; bodies `e-<i>` steps `[union tool i, difference
  tool B]`, state `{ state: "empty", open: false, emptiedByStep: 1 }`; last body `stand`
  steps `[union tool B + 1, difference tool B]`, state `{ state: "drawn", open: false,
  emptiedByStep: -1 }`.
  -> `errors.length === B + 1`; `errors[i].text` for `e-<i>` is the own text
  (`leaves no material in "e-<i>"; the app rejects this feature and keeps the body, ...`)
  with `id` `cut`; last error is the sibling text naming `e-0` and `stand`; per doubling
  `reads` grows `<= 2.5` times. Pre-fix ~4x (step-3 probe: 394,241 -> 1,574,913 ->
  6,295,553) so it fails before.
- Same test, no-source case: 256 bodies x 256 instrumented union steps, state
  `{ state: "drawn", open: false, emptiedByStep: -1 }` -> `errors` `[]` and `reads === 0`
  (passes before and after; guards the shortcut).
- "self-exclusion uses the second indexed source": `a` steps `[union, difference cut,
  difference cut]` `emptiedByStep: 2`, `b` steps `[union, difference cut]`
  `emptiedByStep: 1`, both `state: "empty", open: false` -> `a`'s error is the sibling
  text naming `b` ("leaves no material in \"b\"; ... keeps \"a\" as it was"); `a` alone ->
  its own text ("keeps the body").

## Verification (exits 0 and runs tests)

1. `bunx biome check packages/core/src/capture/describe.ts packages/core/src/capture/describe.test.ts && bun test packages/core/src/capture/describe.test.ts`
   - evidence: new tests pass; existing tests at `describe.test.ts:180`, `:243`, `:290`
     pass unedited; pre-fix failing log and the read series before/after recorded.

## Done criteria

- No `findIndex` per source remains; the two-entry index and single walk are in place;
  signature unchanged; command 1 exits 0; pre-fix failure logged.
- Progress log reads `done` with hashes, commands, exit codes and log paths.

## Implementation status

Done: indexed source attribution and the assigned regressions pass the focused gate.
See `impl-plans/progress/car8-f2-describe-source-index.md` for hashes and evidence.

Completed. The test-integrity and adversarial reviews accepted it with no
findings. The integration review accepted the combined tree: combined focused
tests 22 pass, typecheck and lint exit 0
(`tmp/car8-r8/reconcile-wave-001/`), caller-path suites 419 pass. Still to run
before commit or merge, tracked in `car8-00-overview.md`:
`CARGO_TERM_QUIET=true mise run verify` and the native CAD determinism case.

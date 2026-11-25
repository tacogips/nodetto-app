# car6-f4-not-sampled-notes

- planId: car6-f4-not-sampled-notes; wave 2; dependsOn: car6-f2b-incomplete-describe
- planPath: impl-plans/active/car6-f4-not-sampled-notes.md
- progressPath: impl-plans/progress/car6-f4-not-sampled-notes.md
- Finding: maintainability-desktop-omits-incomplete-body-census (R6-4, medium), plus the
  R6-2 desktop acceptance test.
- Design: `design-docs/specs/design-ai-capture.md` 24.1 R6-4 and the R6-2 desktop item.
- writePaths: `packages/core/src/capture/describe.ts`, `packages/core/src/capture/describe.test.ts`,
  `apps/desktop/src/shell/export-handlers.ts`, `apps/desktop/src/shell/export-handlers.test.ts`,
  `apps/cli/src/capture-cad-census.test.ts` (new),
  `impl-plans/active/car6-f4-not-sampled-notes.md`,
  `impl-plans/progress/car6-f4-not-sampled-notes.md`,
  `tmp/car6-r6/car6-f4-not-sampled-notes`, `target`, `tmp/cad3d`
- sharedPaths: none; artifactRoots: `target`, `tmp/cad3d`

Follow the worker rules in `impl-plans/active/car6-00-overview.md`. Start only after
car6-f2b's progress log reads `done` (shared `describe.ts`/`describe.test.ts`).

## Intent and context

`describeBodies` (`describe.ts`) puts `[not sampled]` for an `unknown` body only into
`line`; the desktop save note (`export-handlers.ts:294-302`) appends only `errors`, so the
uncertainty is lost on desktop while the CLI shows it.

Non-goals: no change to `line`, `errors`, CLI code (`capture-cad.ts`), Rust, or
`describeInterference` (f2b's work stays as is).

## Changes

- `describeBodies` return gains `notSampled: readonly string[]`: `plain(body.name)` of
  every body whose report state is `unknown`, in `model.bodies` order, not limited by the
  eight-name summary. Unknown bodies never add an error.
- `export-handlers.ts` CAD capture note: after the error lines and before
  `N features failed.`, when `notSampled.length > 0`, push
  `not sampled (material unknown): <names joined with ", ">`. Call `describeBodies` once
  and reuse it for `errors` and `notSampled`.

Pitfalls: keep the existing note order for every other line; do not emit
`cad.result.empty` for an unknown body; keep indexed reads typed.

## Tests (write first; record failures)

Report used by all three: ten bodies `Bracket`, `Rib-1` ... `Rib-8`, `Gusset`; index 0
and 9 `{state:"unknown", emptiedByStep:-1, open:false}`, others drawn; `analysis: null`
(or a zero-pair analysis), `pairs: []`, no feature errors. Names are design data.

- `describe.test.ts` (imitate `"reports all body states ..."`, `:90`): `notSampled` is
  `["Bracket","Gusset"]`; `errors` empty; `line` unchanged in form.
- `export-handlers.test.ts` (imitate `"CAD image capture saves PNG and JPG ..."`,
  `:233-330`, in-memory backend whose `captureSolid` returns the report; the editor holds
  ten `cad.mesh` bodies with those names): the last note contains
  `not sampled (material unknown): Bracket, Gusset` and no `cad.result.empty`.
- `export-handlers.test.ts` R6-2 desktop case: two bodies, report with
  `analysis.incomplete: [[0,1]]`, `cappedCount 1`, `cappedWithoutHit [[0,1]]`, and a
  capped `source:"view"` pair 0-1 -> the note contains
  `1 of 1 checked candidate pair incomplete`, the picture-only incomplete line and
  `(found in the picture only)`.
- New `apps/cli/src/capture-cad-census.test.ts`: call `renderCadCapture` (import from
  `./capture-cad.ts`) with a document of ten mesh bodies and a fake `renderSolid`
  returning the ten-body report (imitate the fake backend in `capture-cad.test.ts` and
  body construction in its `"asymmetric mesh capture ..."` test) -> text body line
  contains `Bracket [not sampled]`; `metadata.bodies[9]` is `Gusset` with
  `state:"unknown"`; no error code `cad.result.empty`.

## Verification (each exits 0 and runs tests)

1. `bunx biome check --diagnostic-level=warn packages/core/src/capture/describe.ts packages/core/src/capture/describe.test.ts apps/desktop/src/shell/export-handlers.ts apps/desktop/src/shell/export-handlers.test.ts apps/cli/src/capture-cad-census.test.ts && bun test packages/core/src/capture/describe.test.ts apps/desktop/src/shell/export-handlers.test.ts apps/cli/src/capture-cad-census.test.ts`
   - evidence: desktop not-sampled case fails before, passes after; f2b's describe tests
     still pass.

## Done criteria

- `notSampled` field and desktop line in place; all listed tests pass; progress log `done`.

## Implementation status

Source and assigned regressions implemented; focused gate passed (23 tests). Workspace
`bun run typecheck` remains blocked by the sibling `packages/core/src/capture/report.test.ts:55`
tuple type error. See `impl-plans/progress/car6-f4-not-sampled-notes.md`.

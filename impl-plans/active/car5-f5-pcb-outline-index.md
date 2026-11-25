# car5-f5-pcb-outline-index

- planId: car5-f5-pcb-outline-index; wave 1; dependsOn: none
- planPath: impl-plans/active/car5-f5-pcb-outline-index.md
- progressPath: impl-plans/progress/car5-f5-pcb-outline-index.md
- Finding: performance-cad-pcb-outline-page-rescans (R5-5, medium).
- Design: `design-docs/specs/design-cad3d.md` 22 R5-5.
- writePaths: `packages/core/src/cad/pcb-outline.ts`, `packages/core/src/cad/history.ts`,
  `packages/core/src/cad/evaluate.ts`, `packages/core/src/cad/pcb-outline.test.ts`,
  `tmp/car5-r5/car5-f5-pcb-outline-index`,
  `impl-plans/progress/car5-f5-pcb-outline-index.md`, `target`, `tmp/cad3d`
- sharedPaths: none; artifactRoots: `target`, `tmp/cad3d`

Follow the worker rules in `impl-plans/active/car5-00-overview.md`.

## Intent and context

Per reference, `geometry.pcb` (`history.ts:480-494`) calls
`pcbBoardOutline(history.pcbElements, board)`, which finds the board linearly and
filters every linked graphic (`pcb-outline.ts:42-50`, `:93-106`), then rebuilds the
outline. `evaluate.ts:703` refilters and `:720` serializes the page graphics into each
tool key. Measured 2N^2+N reads (separate pages) and 3,072 -> 49,152 (shared board).

Non-goals: no change to outline validation, error codes/`at`, graphic order, thickness
rules, scene/STL bytes, `construction.ts`, `engine.ts`, or `packages/core/src/pcb`.

## Changes

`pcb-outline.ts`:
- `export interface PcbOutlineIndex { readonly boards: ReadonlyMap<ElementId, Element>; readonly graphics: ReadonlyMap<PageId, readonly Element[]>; }`
  plus a scan-local page-outline memo `Map<PageId, PageOutline | OutlineError>` held by
  the index object (private field or module `WeakMap` keyed by the index).
- `export function pcbOutlineIndex(elements: readonly Element[]): PcbOutlineIndex` -
  one pass: `pcb.board` into `boards`; `isPcbOutlineGraphic` elements grouped by page,
  each list sorted with `compareFractional` by id.
- Page outline (`{ loops, sources }` or `OutlineError`): today's loop over graphics,
  `pathFor`, `minX`/`maxY`, `buildProfileLoops`, error mapping - computed once per page.
- `export function pcbBoardOutlineIndexed(index, boardId): PcbOutline | OutlineError`:
  board lookup and `cad.pcb.noBoard` exactly as today, then page outline from the memo,
  then a new result object with the board's default thickness (1.6 rule).
- `pcbBoardOutline(elements, boardId)` = `pcbBoardOutlineIndexed(pcbOutlineIndex(elements), boardId)`.
  Keep `pcbOutlineGraphics` exported.

`history.ts`: `HistoryDetails` gains `readonly pcbOutline: PcbOutlineIndex`; `scanCadPage`
builds it once from `pcbElements` and sets `boards` to `pcbOutline.boards`;
`geometry.pcb` calls `pcbBoardOutlineIndexed(history.pcbOutline, semantic.board ?? "")`;
reference thickness still applied as `semantic.thickness ?? outline.thickness`.

`evaluate.ts`: `:703` uses `history.pcbOutline.graphics.get(source.page) ?? []`; a
call-local `Map<PageId, string>` in `evaluateCadPage` caches
`contentKey(["pcb graphics", canonicalCadJson(graphics.map(({ id, semantic }) => [id, semantic]))])`
per page; the `"pcb tool"` key uses that string in place of the inline serialization.
Other key parts unchanged.

## Pitfalls

- Never mutate shared loop arrays; return a fresh result object per board.
- Error precedence: noBoard before any graphic error, as today.
- The memo lives only in one index (one scan) / one `evaluateCadPage` call; never module
  global across scans.
- A changed geometry-stats count (point arrays) in an existing test is reported, not
  absorbed by editing the test.

## Tests (`pcb-outline.test.ts`; helpers `testing/pcb.ts`, `RecordingKernel`)

Step 1 (before any production edit): record the shared-board (N = 32) scene-bytes digest
literal on the unmodified tree (log the run).
- Separate pages via `prepareCadCapture`, counter reset after `collectCadInput`
  (counting getter on each graphic's `semantic`): N boards each on its own page with one
  rectangle, N references; reads(128) <= 4.5 x reads(32). Fails before (15.8x).
- Shared board: one board with a closed N-segment outline, N references alternating
  thickness 1 and 3; same ratio via `prepareCadCapture`. Fails before (16x).
- Same shared document via `evaluateCadPage` with `RecordingKernel` and `createCadMemo`,
  counter reset before the call; same ratio.
- Shared-board scene digest equals the pinned literal on two runs.
- Bodies' Z extents alternate 1 and 3 mm.
- Closed widening on a 4 x 4 closed line-segment board: move the right edge from x = 4
  to x = 5 and the adjoining endpoints of the top and bottom edges. -> new
  `prepareCadCapture` max X +1 mm, zero model errors; with the same memo and
  `RecordingKernel`, `evaluateCadPage` returns a different `CadBodyResult.key` and the
  kernel records a new `kind: "solid"` call. Control without the edit: old keys, no new
  call.
- Existing outline tests unchanged.

## Verification (each exits 0 and runs tests)

1. `bunx biome check --diagnostic-level=warn packages/core/src/cad/pcb-outline.ts packages/core/src/cad/history.ts packages/core/src/cad/evaluate.ts packages/core/src/cad/pcb-outline.test.ts && bun test packages/core/src/cad/pcb-outline.test.ts packages/core/src/cad/history.test.ts packages/core/src/cad/evaluate.test.ts packages/core/src/capture/determinism.test.ts`
   - evidence: ratio tests fail before (log with counts) and pass after; digest pinned
     before; existing history, evaluate and determinism tests pass.

## Done criteria

- All ratios <= 4.5; digest equal; thickness and edit cases pass; progress log `done`.

## Implementation status

Done: scan-local outline and graphics-key indexing, regression measurements,
pinned scene digest, thickness and edit invalidation checks. Focused gate passes
73 tests; see `impl-plans/progress/car5-f5-pcb-outline-index.md`. Formal review
and workspace-wide integration gates remain downstream.

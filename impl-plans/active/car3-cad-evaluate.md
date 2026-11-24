# car3-cad-evaluate

- planId: car3-cad-evaluate
- planPath: impl-plans/active/car3-cad-evaluate.md
- progressPath: impl-plans/progress/car3-cad-evaluate.md
- wave: 1; dependsOn: none
- Finding: performance-cad-intermediate-solid-retention (R3-4, high).
- Design: `design-docs/specs/design-cad3d.md` section 20 R3-4 (amends section 6.5).
- writePaths: `packages/core/src/cad/evaluate.ts`,
  `packages/core/src/cad/evaluate.test.ts`,
  `packages/core/src/cad/testing/recording-kernel.ts`,
  `tmp/car3-r3/car3-cad-evaluate`, `impl-plans/progress/car3-cad-evaluate.md`,
  `target`, `tmp/cad3d`
- sharedPaths: none; artifactRoots: `target`, `tmp/cad3d`

Follow the worker rules in `impl-plans/active/car3-00-overview.md`.

## Intent and context

Cache limits (256 entries, 4,000,000 triangles; `createCadMemo`, `evaluate.ts:86-101`)
are enforced only in `finish` (`evaluate.ts:227-249`), after every final body is
materialized (`evaluate.ts:675-699`). Cold evaluation keeps every superseded prism,
tool aggregate and Boolean result live (measured: 601 handles, 12.1M triangles; 23
handles for one nested feature at `entries: 4`; 62 for 60 empty Adds).

Non-goals: no change to `packages/cad-kernel/src/manifold-kernel.ts`,
`packages/cad-kernel/src/worker-host.ts`, the replay rule (`successful` keys, suffix
replay in `materializeBody`), the `replayFailure` second pass, published-final
lifetime, statuses or error codes, default limits.

## Changes (all in `evaluate.ts`)

1. Accounting. `MemoState` gains `lruTriangles: number`. Add `lruAdd(memo, solid,
   keys)`, `lruDelete(memo, solid)`, `lruClear(memo)`. `lruAdd` counts triangles only
   when the solid is not already a member (re-insertion in `markUsed` is not a
   membership change). Route `retain`, `markUsed`, the new trim, the eviction loop in
   `finish` and `releaseCadMemo` through them. `finish` uses `lruTriangles` instead of
   recomputing; which solids it releases and when stays unchanged.
2. Holds. `MemoState.holds: Map<Solid, number>` and `evictable: Map<Solid, true>`
   (insertion-ordered; exactly the LRU members with hold count 0, in LRU order).
   `hold(memo, solid)` / `unhold(memo, solid)` are O(1): 0 -> 1 removes from
   `evictable`; 1 -> 0 appends to `evictable` if the solid is still in the LRU.
   `lruAdd`/`markUsed` move an unheld solid to the end of `evictable`;
   `lruDelete`/`lruClear` keep it in step.
3. `trim(memo)`: while `lru.size > entries || lruTriangles > triangleLimit` and
   `evictable` is non-empty, take the oldest `evictable` entry: `lruDelete`, delete its
   cache keys, `kernel.release` unless it is in `memo.visible` (then `finish` releases
   it exactly once, as today). Count `trimVisits`.
4. Hold handoff (design "Pins" bullets; follow exactly):
   - No trim between a solid's creation or cache hit (`getSolid`, `getPrism`,
     `cached`) and its consumer's first hold.
   - `getTool` returns a held solid; the caller owns that hold. Pin prisms as obtained;
     a prism that becomes the aggregate (`prisms.shift()` or a depth with no further
     prisms) keeps its pin; for each depth Boolean, pin result R first, then unpin the
     consumed aggregate and prisms, then `trim`. Hold a whole-tool cache hit before
     return. Aliases share one solid and one count. On throw, release every pin held.
   - `materializeBody`: pin `previous` before its Boolean; pin the result before
     unpinning `previous`; `new` keeps the tool's hold as the result; add/cut/intersect
     release the operand hold after the result is pinned; return the final pinned
     result to the caller.
   - `evaluateHistory`: a feature's staged results stay held until the feature ends;
     on commit each becomes the body's current-body hold (transfer, no release) and the
     superseded state's hold is released; on failure staged holds are released. Then
     `trim` in a `finally` after every mesh, PCB and extrude feature, success or
     failure. Release every body hold when `evaluateHistory` returns or throws, before
     `finish`.
5. Test-only export `cadMemoUsage(memo): { entries: number; triangles: number; holds:
   number; trimVisits: number }` (not added to `packages/core/src/cad/index.ts`).

## Pitfalls

- Never walk the whole LRU in `trim`; take only from `evictable`.
- Do not release a handle that is in `memo.visible`; `finish` owns it.
- Do not change limits, keys, statuses, call order of existing replay tests, or
  `finish` release decisions.
- Every `unhold` must pair with a `hold` on all paths (use `try`/`finally`).

## Tests (`evaluate.test.ts`; record pre-fix peaks on unmodified code first)

Add a wrapper over `RecordingKernel` (or a small helper in `testing/recording-kernel.ts`)
that tracks live count and sum of `triangles` after every call. `RecordingKernel.get`
already throws on unknown handles, so use-after-release and double release fail.

- 300 successive Adds, one body, default limits -> peak live <= 259 (pre-fix 601).
- 60 Adds, `triangles: 100_000`, `entries: 10_000` -> peak triangles <= 4,300,000
  (pre-fix 12,100,000).
- 12 concentric circles r 2..24 mm, one New, `entries: 4` -> peak live <= 8, body
  valid (pre-fix 23).
- 60 empty Adds, `triangles: 100_000`, default triangle limit -> peak triangles <=
  4,300,000, every feature `cad.result.empty`.
- Three-target feature, `entries: 2` -> all three results published; no held handle
  released.
- Many bodies: one sketch, N = 1,000 and 2,000 one-loop News, default limits -> all
  finals live until `releaseCadMemo`; `trimVisits` equals evictions;
  `visits(2N) <= 2 * visits(N) + 2`; same with a two-loop sketch (nonzero visits).
- Zero-entry handoff: `entries: 0`; New of two disjoint loops, then Add with outer,
  hole and island loops -> both ok, final live, `releaseCadMemo` releases each handle
  once, `holds == 0`; failure variant (kernel throws on the island-depth Boolean) ->
  `cad.kernel.failed`, previous body still published, `holds == 0`, no double release.
- Accounting after every evaluation: `cadMemoUsage` entries/triangles equal a
  recomputation, `holds == 0`; after `releaseCadMemo` all zero and no live handle.
- Existing replay, failure atomicity, triangle-limit release and exactly-once release
  tests pass unchanged.

## Verification

1. `bunx biome check --diagnostic-level=warn packages/core/src/cad/evaluate.ts packages/core/src/cad/evaluate.test.ts packages/core/src/cad/testing/recording-kernel.ts && bun test packages/core/src/cad/evaluate.test.ts packages/core/src/cad/check.test.ts packages/cad-kernel/src`
   -> clean; all tests pass, new peak tests included.

## Done criteria

- Pre-fix peaks recorded; every new test fails or is impossible to satisfy on
  `a964ad5` and passes after; command above exits 0; progress log `done`.

## Implementation status

- Implementation and focused verification complete; baseline and command evidence are
  recorded in `impl-plans/progress/car3-cad-evaluate.md`.
- Formal review, workspace-wide verification and finalization remain downstream.

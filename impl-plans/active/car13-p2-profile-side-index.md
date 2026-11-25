# car13-p2-profile-side-index

- planId: car13-p2-profile-side-index; wave 1; dependsOn: none
- progressPath: impl-plans/progress/car13-p2-profile-side-index.md
- Finding: `performance-cad-side-face-member-rescans` (high).
- Design: `design-docs/specs/design-ai-capture.md` 30.1 R13-2.
- Worker rules: `car13-00-overview.md`.
- Evidence: `tmp/car13-r13/car13-p2-profile-side-index/`.

## Intent and context

R12-4 keys its scan budget and member set by the `ExtrudeGeometry` object
(`packages/core/src/cad/history.ts:482-513`). `extrude()` returns a fresh
object per extrusion (`:607`), so K extrusions of one M-member profile cost
M x K.

Answer side queries from the per-sketch member index that `extrude()`
already builds (`memberIndices`, `:565-575`):
- whole-profile tools need one `has`;
- explicit selections use a lazily built per-tool `Set<CadLoop>`.

Non-goals:
- Do not change the `ExtrudeGeometry` type, `extrude()`, the
  whole-profile array reuse at `:579`, `memberIndices`, `profiles`,
  `loops.ts` or `construction.ts`.
- Do not change the cap-face or base-plane paths.
- Do not change error codes or frames.

## Changes (`packages/core/src/cad/history.ts`)

1. Add `sideSelectionEntries: 0` to `cadGeometryWork` (`:440-447`).
2. In `createCadGeometry`, add a lazily created
   `selectedSides: Map<ExtrudeGeometry, Set<CadLoop>> | undefined`, next to
   `sideMembers`.
3. In `sketch()`, on the side path only: after the line lookup and type
   check (`:478-480`) and before the R12-4 block, try the index path.
   - Read `source = history.typed.get(feature)`. This is the typed view
     used at `construction.ts:81`.
   - If `source?.type === "cad.extrude"`, take
     `sketchId = source.semantic.sketch`. If `profiles.get(sketchId)` exists
     without `"error"` and `memberIndices.get(sketchId)` exists, handle the
     query here:
     - Whole profile (`tool.loops === profile.loops`): one
       `sideMemberVisits`, then `found = index.has(line.id)`.
     - Explicit selection (any other array):
       - On the tool's first side query, build `Set<CadLoop>` from
         `tool.loops`. Count `tool.loops.length` in both `sideMemberVisits`
         and `sideSelectionEntries`.
       - Then one visit for `index.get(line.id) ?? []`, plus one visit per
         index inspected while checking
         `selected.has(profile.loops[i])`. Guard the indexed read for
         `noUncheckedIndexedAccess`.
     - Not found -> `cadFailure("cad.reference.missing", entity)`.
       Found -> the same `faceFrame(...)` call as today (`:514-519`).
   - Otherwise (a `cad.pcb` tool, an ID absent from history, or a missing
     index), run the existing R12-4 block unchanged.
4. Leave `sideMemberIndexBuilds` counting R12-4 builds only.

Pitfalls:
- Do not allocate on the cap, base or whole-profile paths. Create
  `selectedSides` only for an explicit tool's first query.
- Do not key the selected set by sketch ID. Two extrusions of one sketch can
  select different loops.
- The selected `CadLoop` objects are the profile's objects (`:584-589`).
  Compare by identity; never compare points.
- The existing tests at `history.test.ts:582-713` register tools under IDs
  absent from history. They must keep hitting R12-4 and keep their exact
  counts (16/21 visits, 1 build). Do not edit them.

## Tests (`packages/core/src/cad/history.test.ts`)

Reset all three side counters before each measurement. Build documents
with the helpers the file already uses (`sketch`, `cadElement`, `extrude`,
`rectangle`). A side sketch plane is
`{ face: { feature, role: "side", entity } }`.

- Shared whole profile, through `checkCadPage`:
  - One closed M-line profile, K whole-sketch `new` extrusions of distances
    1..K, and one side sketch per extrusion on the profile's last member.
  - Sizes M = K = 256, 512 and 1024.
  - Expect no errors, `sideMemberVisits === K`,
    `sideMemberIndexBuilds === 0` and `sideSelectionEntries === 0`.
  - Fails before the fix (M x K visits).
- Shared explicit selection, through `checkCadPage`:
  - A 4-line rectangle plus a disjoint M-line loop in one sketch.
  - K = M / 4 extrusions, each with `loops: [<one M-loop member id>]`.
  - Per extrusion: four side sketches on M-loop members and one on a
    rectangle line.
  - Sizes M = 256, 512 and 1024.
  - Expect exactly K `cad.reference.missing` errors naming the rectangle
    line, `sideSelectionEntries === K`, `sideMemberIndexBuilds === 0` and
    `sideMemberVisits <= K * 16`.
- Frames: at M = 256, for both workloads, use
  `createCadGeometry(scanCadPage(elements))`.
  - Register each extrusion via `geometry.extrudes.set(<real feature id>, tool)`.
  - Each side hit equals `faceFrame(tool.frame, tool.span, "side", line.semantic)`.
- Ordinary: a new test on
  `generateCadDocument({ features: 500, entitiesPerSketch: 18 })` through
  `checkCadPage`.
  - Expect no errors and `sideSelectionEntries === 0`,
    `sideMemberVisits === 0`, `sideMemberIndexBuilds === 0`.
  - Log `cadGeometryWork.profileBuilds` and `loopProbes`.

## Verification (each exits 0)

1. `bunx biome check packages/core/src/cad/history.ts packages/core/src/cad/history.test.ts`
2. `bun test packages/core/src/cad/history.test.ts`
   - The new tests pass, and all existing tests pass unedited.

## Done criteria

- Commands 1-2 exit 0.
- The fail-before log is saved.
- The diff stays inside writePaths.
- The progress log reads `done`, with the measured visit series.

## Implementation status

Implementation and focused gates completed; see the plan-local progress log and
`tmp/car13-r13/car13-p2-profile-side-index/`. Formal review and serial
integration verification remain downstream.

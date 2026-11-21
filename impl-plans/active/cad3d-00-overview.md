# cad3d: 3D CAD pages, overview

- Design: `design-docs/specs/design-cad3d.md` (revision 3)
- Evidence root: `tmp/cad3d/<planId>/` (ignored by git)
- Base commit: `0a35708` on `feat/cad3d-pages`
- Spike evidence (not committed): `tmp/cad3d-spike/spike.ts`, `spike.log`,
  `spike2.ts`, `spike2.log`

## Goal

Ship the first slice of design section 2.2: the `cad3d` page kind with its
content rule at every entry point, sketch and extrude modelling with a
Manifold kernel behind a port, a themed 3D viewport, the NMESH and STL
codecs, a PCB board reference body, CLI support and format verification.

## Non-goals

Everything in design sections 2.3 and 2.4, and all work in the private
nodetto-cloud repository (design section 15).

## Milestones

One implementer session each. Ids are stable across plan revisions, so the
milestones split off in revisions 2 and 3 carry the ids M19 to M22; the
order of work follows `dependsOn`, not the id.

| Id | Plan | Scope | dependsOn |
| --- | --- | --- | --- |
| M1 | cad3d-01-ir-page-kind | Page kind, sketch and extrude types, lenient validators, rule R in IR validation, shape utils, golden fixture | - |
| M2 | cad3d-02-core-enforcement | Rules R and K in commands and page operations, clipboard semantics, delete and detach tests | M1 |
| M22 | cad3d-22-emitter-guards | `canCreateOn` guards for reachable emitters, classified emitter list test | M2 |
| M3 | cad3d-03-core-sketch-geometry | Frames, outward sign, loops, tessellation, triangulation (pure TS) | M1 |
| M4 | cad3d-04-core-evaluate | History order, statuses, tool solids, kernel port, memoised driver | M3 |
| M5 | cad3d-05-kernel-manifold | `packages/cad-kernel`, Manifold adapter, licence inventory, headless vertical slice | M4 |
| M6 | cad3d-06-ui-mode-workspace | Mode `cad3d`, workspace, palette exclusivity, tools, kind lock, add CAD page, cloud guard | M2 |
| M7 | cad3d-07-engine-worker | Display buffers, engine protocol, worker host, desktop wiring, CSP and devCsp | M5 |
| M8 | cad3d-08-viewport | Viewport pure modules: camera, picking, canvas-mode theme | M7 |
| M19 | cad3d-19-viewport-renderer | WebGL2 renderer, viewport mount, browser check | M6, M8 |
| M9 | cad3d-09-feature-list-inspector | Layer names and rename, feature list, inspector parameter edits | M19 |
| M10 | cad3d-10-sketch-tools | Sketch authoring commands and interaction | M9 |
| M11 | cad3d-11-extrude-tool | Extrude tool, preview, sketch on face | M10 |
| M12 | cad3d-12-nmesh-stl | NMESH and STL modules with measurements | - |
| M13 | cad3d-13-mesh-import-export | `cad.mesh` type, evaluation, worker decode | M7, M12 |
| M20 | cad3d-20-mesh-ui | STL import and export in the UI | M13, M10, M19 |
| M14 | cad3d-14-pcb-reference | `cad.pcb` type, board outline, evaluation, engine input | M7, M2 |
| M21 | cad3d-21-pcb-ui | PCB board tool, authoring command, inspector fields | M14, M10 |
| M15 | cad3d-15-collab | Non-destructive content repair, concurrent edit tests | M2, M4 |
| M16 | cad3d-16-cli | `cad check`, exclusions, enforcement and native tests | M4, M2 |
| M17 | cad3d-17-format-verification | Determinism, churn, size, speed, three-way and git merge | M16 |
| M18 | cad3d-18-export-docs-final | Wireframe export, docs, real-host checks, full verification | M11, M20, M21, M22, M15, M17 |

Shared files: `packages/ir/src/cad.ts`, `packages/ir/src/registry/cad.ts`,
`packages/ir/src/registry.test.ts`, `packages/io/src/__fixtures__/cad3d.jsonl`
and `packages/core/src/cad/evaluate.ts` are edited by M13 and M14;
`packages/core/src/cad/authoring.ts` by M10, M11 and M21;
`packages/core/src/cad/detach.test.ts` and `clipboard.test.ts` are created
by M2 and extended by M14. Milestones
that share a file run one after the other in the table order above.

## Rules for every implementer

- Read the design sections named in the plan first. The design wins over a
  plan when they disagree; report the disagreement in the commit message.
- English only, no emojis, strict TypeScript. `packages/core` and
  `packages/ir` never import `manifold-3d`, `@nodetto/cad-kernel`, DOM or
  Worker APIs.
- Strict index gate (the private sync Worker compiles `packages/core` and
  `packages/ir` with `noUncheckedIndexedAccess`; at the base commit the
  flag reports no error in any non-test file of those two packages). Every
  milestone that touches either package runs this gate over both whole
  packages, not only over its own files:
  `mkdir -p tmp/cad3d/<m>; bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess > tmp/cad3d/<m>/strict.log 2>&1; ! grep -E "^packages/(core|ir)/src/" tmp/cad3d/<m>/strict.log | grep -vqE "\.test\.tsx?\("`
  It fails when any non-test file under `packages/core/src` or
  `packages/ir/src` has an error. Each plan embeds it in a command that also
  runs a test.
- Code that the CLI runs (`packages/ir`, `packages/core`, `packages/io`,
  `apps/cli`) follows the Boa rules: no `split` with a regex on whole
  documents, no per-point destructuring or allocation in hot loops, no
  recursion deeper than 64 frames.
- Deterministic geometry under `packages/core/src/cad`: coordinates are
  computed with `+ - * /` and `Math.sqrt` only. The only `Math` members
  allowed there are `sqrt`, `abs`, `min`, `max`, `floor`, `ceil`, `round`,
  `trunc` and `sign`; the `**` operator is forbidden. A test enforces the
  allow-list (M3).
- Third-party projects are references only. Write own code and own
  fixtures with neutral names (Plate, Bracket, Holes). Never copy code,
  files or test data from other projects or from user material.
- Pre-authorised test edits are named in each plan with the exact permitted
  change. No other existing assertion is weakened and no existing deadline
  is relaxed; a new deadline that fails is fixed in code.
- Every verification command must exit 0 and runs at least one test.
- One local commit per milestone, no attribution lines, never push, never
  rewrite history. Cargo runs with `CARGO_TERM_QUIET=true`.

## Tests that enumerate every element type or page kind

Found by grepping tests for `ELEMENT_TYPES`, `PAGE_KINDS`, `PAGE_MODES` and
`WORKSPACES` at the base commit. Each is run by the milestone that can break
it:

| Test | Effect of this work | Milestone and permitted change |
| --- | --- | --- |
| `packages/ir/src/registry.test.ts:33` exact type list | new types | M1, M13, M14: append the new types |
| `packages/io/src/jsonl/golden.test.ts:90` every type has a fixture | new types | M1, M13, M14: add `cad3d` to `GOLDEN`, extend the fixture |
| `apps/cli/src/edit/label-field.test.ts:34-52` creates every type on a default page | rule R rejects `cad.*` on a freeform page | M1 runs it unchanged (valid defaults from the CAD shape utils); M2 may change the loop so that for a type with `isCadTypeName(type)` the editor first creates and selects a page of kind `cad3d`; nothing else |
| `packages/ui-solid/src/canvas/canvas-background.test.ts:28` loops `PAGE_KINDS` | none (`cad3d` follows the diagram setting) | M1 and M6 run it unchanged |
| `packages/ui-solid/src/workspaces.test.ts` loops `WORKSPACES` | new workspace | M6 runs it; no assertion change expected |
| `apps/desktop/src/page-workspace.test.ts` dedicated mappings | new mapping | M6: extend the two mapping tests |
| `apps/cli/src/arrange-modes.test.ts:130`, `apps/cli/src/cli-wiring.test.ts:147-180` exit-code lists | new excluded kind | M16: append `cad3d` |
| Tests that only read `ELEMENT_TYPES` to filter one family (`breadboard`, `pcb`, `bpmn` tests in `packages/core`, `packages/ir`, `packages/collab`, `packages/ui-solid`) | none | run by `bun test` in M1 verification |

M1 and M2 additionally run the whole `bun test` once (recorded in
`tmp/cad3d/<m>/full.log`) so an unlisted enumeration test is found in the
milestone that breaks it, not in M18.

## Final verification (M18)

1. `mise run verify`
2. `mise run test-cli` (native parity not skipped)
3. The strict index gate, the bundle check, the browser check and the
   WKWebView check
   (design section 14)

## Progress

| Milestone | Status |
| --- | --- |
| M1 | accepted |
| M2 | accepted |
| M22 | accepted |
| M3 | accepted |
| M4 | accepted |
| M5 | accepted |
| M6 | accepted |
| M7 | accepted |
| M8 | accepted |
| M19 | accepted |
| M9 | accepted |
| M10 | accepted |
| M11 | accepted |
| M12 | accepted |
| M13 | implemented |
| M20 | pending |
| M14 | pending |
| M21 | pending |
| M15 | pending |
| M16 | pending |
| M17 | pending |
| M18 | pending |

M1 added the CAD IR and document content rule, registered shape defaults,
advertised CAD types through the CLI, and added the canonical CAD fixture.
Implementation followed the milestone plan without changes to its scope.
Verification logs are under `tmp/cad3d/m1/`.

M2 enforced rules R and K in the command layer, filtered incompatible
clipboard copies, preserved CAD references, and covered page operations and
delete-detach round trips. The accepted design and milestone plans are
included in the M2 commit, resolving IR1-02.

M2 deviations: group, frame, generic connection, and component placement
can reach command creation on a CAD page, so those paths check rule R before
emitting a command. Boolean grouping shares the group check. A filtered
paste that inserts nothing preserves selection and paste offset. The editor
facade treats restoration of a mislabeled CAD page as a repair and skips
the undo entry because rule K forbids undoing that repair. The command
layer applies the same checks to inverse commands.

All four M2 checks and the repository TypeScript lint passed. The
supplemental `mise run verify` stopped at `cargo check` because mise
could not resolve its Cargo shim. Full Rust verification remains in M18.
Logs are under `tmp/cad3d/m2/`.

M22 added the facade check and guarded live-page emitters, along with a
source inventory test and regressions for the core, browser DOM, and CLI.

The M22 audit found that page frames, freehand strokes and
sequence participants can be created without existing 2D content, so class A
now covers them. The 2D canvas still mounts before M6, so its creation and
connector handlers also check the page. The editor can create a kit on a
freeform page even if an existing CAD page is named iOS kit. The CLI kit
and sequence routes report an operation error when insertion is declined.
Template and HTML layout builders already create separate freeform
documents, prototype HTML only exports, and Gerber import already
creates a freeform page. Tests cover these destinations where applicable
and the inventory excludes DOM-only calls.

All three M22 checks, the repository TypeScript lint, and the targeted
CLI and M2 entry-point regressions passed. The full Bun suite reports
4185 passed and 74 skipped. The supplemental workspace verification
passed with 91 Rust tests using the installed toolchain and a local
cache. Logs are under `tmp/cad3d/m22/`.

M3 added kernel-free sketch frames, outward directions, circle and arc
tessellation, profile assembly with edge provenance, and cap triangulation.
Grid predicates preserve the orientation of nearly collinear edges, and
triangulation retains collinear boundary vertices for the prism sides.
All three milestone checks, repository TypeScript lint, and workspace
verification passed. The workspace run reported 4214 Bun tests and 91 Rust
tests passed, with 74 Bun tests skipped. Logs are under `tmp/cad3d/m3/`.

M4 added feature history and dependency statuses, analytic face frames and
outward directions, named prism meshes, the kernel port, and memoised
evaluation. Results keep their handles until the next evaluation even when
the LRU cannot retain all visible bodies. A failed multi-body operation
preserves every target's preceding state.

M4 reports malformed sketch entities before building loops (IR3-01). It
reports `cad.limit` when a radius, absolute extrusion distance, or swept
vertex on any world axis exceeds 10,000 mm (IR1-01). Under design section
3.3, a reference to a later body creator reports `cad.order.forward`. Face
names escape percent and colon characters inside element IDs to distinguish
all feature, role and entity combinations.

History and face analysis use no triangulation (IR3-03). A Bun run on a
19,998-vertex spiral band measured 49.3 ms for loop building and 53.4 ms for
face analysis including history, profiles and bounds. Triangulating the
same cap took 1,886.4 ms. The M3 review measured 2,392 ms for a similar
20,000-vertex spiral band. M16's CLI check should keep cap triangulation
out of its path. Timing and verification logs are under `tmp/cad3d/m4/`.
All three milestone checks passed. Workspace verification, including the
repository TypeScript lint, passed with 4245 Bun tests and 91 Rust tests.
The workspace run skipped 74 Bun tests.

M4 review follow-up: the evaluator chains body keys before rebuilding
solids and reuses the newest retained state, including a still-visible
handle outside the LRU. The entry limit counts distinct solids. Unchanged
evaluations of a 501-feature model and an 81-feature model with
100,000-triangle boolean results issued zero solid or boolean calls.
With the predecessor retained, a last-feature edit issued one tool and one
boolean per target body. When no predecessor survives, the affected body
may replay from its creator. The recording kernel checks handle liveness
and release, including when a replay fails (IR4-01).

M4 review deviations: design section 6.5 now excludes sketch and feature
names from the keys and equates explicit false extrusion flags with omitted
flags (IR4-02). Section 6.6 lists `cad.feature.invalid`,
`cad.profile.invalid`, and `cad.reference.failed` for sketches on suppressed
faces (IR4-03). The LRU regression now requires reuse of visible handles
under pressure and checks release when they leave both the cache and the
visible result. The M4 plan and its acceptance criteria are unchanged.
All three milestone checks and full workspace verification passed. The
workspace run reported 4252 Bun tests and 91 Rust tests passed, with 74 Bun
tests skipped. Verification logs are under `tmp/cad3d/m4/rework/`.

M5 added the pinned Manifold WASM adapter, reference-counted face provenance,
and the headless JSONL slice. The tests measure a plate with six holes, edit
one radius and undo, build an additive boss on a named face, and intersect
two plates. Fresh kernels return byte-identical mesh buffers. The 60-hole
plate regenerated in 74.5 to 81.0 ms in the two milestone checks, with
WASM load times of 3.2 to 4.3 ms.

M5 review deviations (M5-LIC-01 and M5-LIC-02): the milestone plan and design
section 11 record SunPro and Apache-2.0 WITH LLVM-exception and apply the
reviewed licence rule by class. The notices reproduce the SunPro notice,
pin the distributed WASM hash, and list the Emscripten runtime conservatively
from its link rules. The npm inventory uses exact registry manifests for
uninstalled packages, since the Windows and WASM variants declare different
terms from the installed macOS sibling. The lockfile retains all existing
resolutions.

The adapter uses Manifold's execution-context factory to free a rejected
solid before reporting its status. The workspace adds `@nodetto/io` as a test
dependency for the JSONL round trip. Both milestone checks and workspace
verification passed. The workspace run reported 4266 Bun and 91 Rust tests
passed, with 74 Bun tests skipped. The local Rust toolchain emitted
debug-stripping warnings during the passing run. Timing and verification
logs are under `tmp/cad3d/m5/`.

M5 rework for review: the Manifold notices now include dset, tbtSVD,
QuickHull, and the PhysX routines used by `tri_dist.h` (IR5-01). To reproduce
the audit, search the v3.5.5 tag's `src/` and `include/` for copyright and
licence lines other than those for The Manifold Authors, then check source
attributions and build entries. The adapter treats zero-volume results as
empty, so the evaluator retains the preceding body when a face-touching
intersect produces a sheet. A real-WASM JSONL regression covers this case
(IR5-02). Both milestone checks and `mise run verify` passed, including
4267 Bun and 91 Rust tests, with 74 Bun tests skipped. The 60-hole plate
regenerated in 72.3 ms in both milestone checks. Logs are under
`tmp/cad3d/m5/rework/`. The milestone plan and dependency resolutions are
unchanged.

M6 added the dedicated 3D CAD workspace, its six creation tools and Select,
the diagram-format lock, and CAD-aware page creation in the list and tabs.
The cloud guard hides the CAD workspace option and keeps CAD pages openable.
The light and dark DOM checks exercise the palette, toolbar, inspector, and
both add-page buttons. All three milestone checks and `mise run verify`
passed. Workspace verification passed 4,274 Bun and 91 Rust tests, with 74
Bun tests skipped. Verification logs are under `tmp/cad3d/m6/`.

M6 deviations: global palette search needed a CAD-only scope while on a CAD
page. The temporary 2D canvas declines CAD placement and 2D tool shortcuts
on CAD pages until the dedicated gestures are wired. The default workspace
setting excludes CAD, and a stored CAD mode on another page falls back to
that page's normal workspace. The template button and native callback
follow the current page kind, and the cloud guard also covers CAD page
duplication. The workspace and icon tests account for the added tools and
icons, including Select's read-only behavior. The M6 plan now names M22 as
the emitter backstop (DR3-02).

M7 added the CAD display buffers, coalescing engine client, Manifold worker,
and desktop wiring. A request id distinguishes worker replies even when
two requests share a store revision. The worker transfers owned display
buffers and keeps a memo between requests. Timeouts and WASM traps restart
the worker. Display positions follow the 1 micrometre grid in design
section 6.6. Edge classification uses the original kernel coordinates.

M7 deviations: the desktop shell starts the worker on CAD pages so the
production build can already exercise its real entry point. It disposes
the worker on leaving CAD. The renderer still mounts in M19. The transport
has optional errors and disposal hooks for worker lifecycle management. The
desktop manifest and workspace lockfile link the approved kernel and pinned
Manifold asset without changing any existing resolution. The bundle audit
script is included in the repository TypeScript check.

The production audit registers its plugin in both Vite graphs and requires
`manifold.js` in the worker graph (DR3-01). It records one byte-identical
WASM asset. The only inventory name shared with the existing desktop bundle
is `tslib`. The audit exempts the existing `tslib@1.14.1` ES module only
when its recorded importers are all under `pdf-lib` and the module is absent
from the worker. The Manifold inventory's `tslib@2.9.1` remains forbidden.

The adapter detects rounding residue in face-touching intersections
(IR5-02). A real-kernel regression covers decimal contact and a genuine
thin overlap. The 3,000-case contact probe found no remaining sheets
reported as solids. The 300-cut history probe measured zero booleans on
an unchanged model, one on a last-feature edit, and 300 on a mid-history
edit after its predecessor was evicted (340.0 ms, IR4-04).

All four milestone checks passed. The real Bun worker returned the
60-hole plate with 15,612 triangles. The in-process host transferred that
plate in 100.5 ms and transferred a radius edit in 60.0 ms in the focused
check. The existing light and dark CAD workspace DOM checks passed.
Workspace verification passed from a tree without desktop dist, with 4283
Bun and 91 Rust tests passing and 74 Bun tests skipped. The extracted
upstream audit and prior review probe were temporarily moved out of Bun
test discovery and restored afterwards. Cargo used the installed toolchain
and caches inside the worktree with automatic installation disabled.
Verification and probe logs are under `tmp/cad3d/m7/`. The supplemental
Chromium attempt could not start while restricted to writing inside the
worktree. Browser and WKWebView rendering checks remain in M19 and M18.

M8 added the pure viewport camera, CPU face picking and theme reader. The
camera fits bounds, orbits, pans and zooms, and computes perspective and
orthographic projections and matching screen rays. Picking uses both
triangle windings and tolerates roundoff on shared edges. The theme reader
checks the existing canvas tokens in light and dark modes.

M8 deviation: `Camera3d` has an optional `roll` so alignment preserves
the sketch frame's U and V axes for arbitrary planar faces. `screenRay`
starts at the near plane so picking respects near clipping.

Both milestone checks and repository TypeScript lint passed. The existing
light and dark CAD DOM harness passed. The 200,000-triangle pick met the
50 ms budget, and the shared-edge probe found zero misses in 20,000 rays.
The supplemental workspace run passed 4,297 Bun tests and skipped 74.
Three existing browser tests failed when macOS tried to create Chrome
socket directories outside the worktree. The separate Rust run passed 73
tests. Eighteen existing file tests failed when macOS attempted to create
replacement directories outside the worktree. Verification logs are under
`tmp/cad3d/m8/`.

M19 mounts a dedicated WebGL2 viewport for CAD pages. The worker evaluates
the plain editor snapshot, and the viewport only submits another request
when the collected inputs change. The last successful geometry stays
visible on a worker failure. The renderer draws shaded indexed solids,
edges, grid lines and previews using the current canvas tokens. Camera
controls and face selection do not alter the document, and each CAD page
keeps its own session camera.

M19 deviations: the CAD viewport supplies the existing `nodetto-canvas`
root in the CAD branch so the 2D interaction and its listeners are never
instantiated there. The renderer seam is forwarded through
`NodettoCanvas` so the browser fixture can inspect the actual GL output.
The Bun test delegates to the existing Happy DOM JSX harness. The camera
module and its tests also cover rolled orbit axes (IR8-02) and invalid zoom
factors (IR8-03). Viewport orbit returns to perspective. Triangle lighting
is two-sided and culling is disabled so collapsed and reversed display
slivers do not require consistently wound display buffers (IR7-02).

All three milestone checks and repository TypeScript lint passed. Headless
Chrome rendered the 15,612-triangle, 60-hole plate under the production
CSP. All ten functional assertions passed, including light and dark
framebuffer colours and the changed pixel after editing the first hole.
Edit to display took 118.2 ms in the functional check and 193.9 ms in
the budget run, both within 250 ms. The browser used SwiftShader, so the
hardware camera-frame budget remains unverified. The Chrome profile, browser data and logs stayed inside the
worktree using the headless shell and an outer write sandbox. The status
of WebKit host verification remains with M18. Logs and the functional
report are under `tmp/cad3d/m19/`.

The supplemental workspace check passed Cargo check, formatting, Clippy
and TypeScript lint, then reported 4,300 Bun tests passing, 74 skipped
and three existing Chrome tests failing because Chrome could not create
its socket directory under the worktree-only restriction. A separate
Rust workspace run passed 73 tests and reported 18 file tests blocked by
macOS replacement-directory permissions. M18 still owns the full
workspace and native host checks.

M9 lists CAD features in history order, nests sketch entities, and shows
worker status codes on rows and in the inspector. The CAD inspector snaps
numeric inputs to the 1 nm grid and applies one semantic command per valid
change. CAD rename uses the same semantic name in the layer list and
inspector. The untitled autosave test writes a CAD-only model.

M9 deviations: the shared layer tree uses the CAD row order so searching,
collapse and keyboard navigation also respect sketch nesting. The layer
list and evaluator share the history comparator. CAD feature drag uses
the existing relative reorder command. The viewport and CAD layer rows share
Delete, Backspace and Escape handling. The target-body list uses existing
checkbox controls for multi-selection. The light and dark DOM harness
covers panel integration, drag reorder, undo and the per-feature fallback
when a worker reports only a top-level failure.

All three milestone checks passed with 46, 5 and 4 tests respectively.
Workspace check and lint passed, and the Bun suite passed 4,315 tests
with 74 skipped, including the three browser cases using the worktree's
headless Chrome. The Rust workspace ran all 91 tests. It passed 73, and
18 file tests reported permission errors when macOS attempted to use its
replacement-file directory. Verification logs are under `tmp/cad3d/m9/`.

M10 adds sketch creation on XY and on named planar faces, line chains,
rectangles, circles and three-point arcs. The 3D canvas projects pointer
positions onto the analytic frame, snaps in millimetres, and draws
construction dashes, an aligned grid and uncommitted previews using the
canvas theme. Each completed shape is one command batch and one undo step.

M10 deviations: the entity builders accept an optional last-entity index
lookup on `CadIds` because a sketch record does not hold its entities.
The viewport supplies the lookup and uses fractional gaps to keep new
entities next to their siblings when possible. The CAD command builder is
an additional class C emitter. The design inventory and its exact-list
test include it. The existing canvas forwards its controlled tool and tool
callback to the viewport. Frame resolution reuses the kernel-free history
resolver, and a face pick selects its defining feature. Active sketch
lines draw over solids, and dragging from a solid or empty space orbits
while a click still picks the face or sketch entity. This resolves IR19-02.
Alt or Option selects the 0.1 mm snap grid. The preview and status
coordination live in a separate viewport module.

All three milestone checks passed with 39, 4 and 5 tests respectively.
The light and dark DOM checks drew and undid rectangles and circles on
base and face planes, and exercised line chaining, arc retry, cancellation,
locked sketches, and the curved-face status. The real Chromium smoke
test passed all ten renderer, worker and production CSP assertions.
Workspace check and lint passed. The Bun suite passed 4,329 tests with
74 skipped. The Rust workspace passed 73 of 91 tests. The other 18 hit
macOS replacement-file permissions under the worktree write restriction.
Verification logs are under `tmp/cad3d/m10/`.

M11 adds extrusion from a selected sketch. A base-plane sketch creates a
new body. A face sketch starts with an outward boss on the face's body.
The viewport handle previews a signed distance in 0.1 mm steps and
commits one undoable edit on release. Dragging across the face switches
between add and cut. Cancelled and unchanged drags preserve the document.

M11 deviations: the viewport keeps extrude gesture state in a dedicated
controller and shares the overlay and index helpers with sketch
authoring. A face-on drawing view tilts when the tool needs a visible
drag axis. The preview uses the history geometry resolver and caches
loop triangulation for the drag. The renderer draws the translucent
tool volume through the body so an inward cut is visible. The core
intent helper accepts the current operation for base and unresolved
planes. The shared 3 px drag threshold also fixes IR10-01. The light
and dark DOM checks extend the existing canvas harness. The core and
real-kernel tests share face cases, including an intersection-created
face for DR1-07.

All three milestone checks passed with 187, 4 and 3 tests respectively.
Workspace check and lint passed, and the Bun suite passed 4,356 tests
with 74 skipped. Chromium passed all ten production CSP smoke assertions
and all eighteen assertions in the face extrusion probe. The probe
used pointer input, the worker and WebGL2 in both canvas modes and
confirmed a rendered cut preview, one committed edit, undo and redo.
The Rust workspace passed 73 of 91 tests. The other 18 hit macOS
replacement-file permissions under the worktree write restriction.
Verification logs are under `tmp/cad3d/m11/`. The browser probe report
and screenshots are under `tmp/cad3d/m11-gl/`.

M12 adds the standalone NMESH v1 codec and STL reader and writer with
public IO subpaths. NMESH preserves winding and face groups, validates
untrusted files before allocating mesh buffers, and gives the same bytes
after renumbering vertices or reordering triangles. STL reads binary and
ASCII and writes little-endian Float32 facets with computed normals.

Both milestone commands passed with 30 and 1 tests, respectively.
Workspace check and lint passed. The 128,008-vertex plate took 106 ms
to canonicalize and encode and 10 ms to decode in the standalone
measurement. Across the four meshes NMESH used 31–44% of raw typed
arrays and 21–29% of JSON number arrays. The M12 plate differs from the
spike by more than five percentage points, so design section 7.3 records
the new ratios alongside the spike measurements. The STL module uses
its own structurally compatible mesh type to preserve folder isolation.
The Bun workspace run passed 4,383 tests with 74 skipped. Three
existing browser tests hit Chrome startup permissions under the
worktree write restriction. The Rust workspace passed 73 of 91 tests,
with 18 macOS replacement-file permission errors under that restriction.
Verification logs and measurements are under `tmp/cad3d/m12/`.

M13 registers `cad.mesh` and round-trips a tetrahedron in the CAD fixture.
Closed imports become ordinary bodies that can be cut by an extrude.
Open meshes are drawn as references and cannot be used as boolean
targets. A corrupt mesh leaves other bodies intact.

M13 deviations: the IR exports and semantic map expose the new type,
the history scanner recognizes mesh body creators, the display converter
accepts the decoded triangles, and the feature-list test expects the
additional fixture row. The lockfile records the existing IO dependency
moving from dev to runtime in `cad-kernel`.

The worker accepts an explicit STL export request for selected body IDs
and returns the binary file in a transferable buffer. It uses a fresh
memo and the unrounded kernel buffers. M20 can request export for the
selected page snapshot and use `stlToInlineMesh` to prepare imports.
This addresses IR7-01, IR7-02, IR12-02 and IR12-03 with independent
edit-history, precision, empty-import and default-header tests. The
NMESH reader rejects overlong varints, addressing IR12-01. The design
documents the byte rules and export path.

All three milestone commands passed with 551, 31 and 6 tests,
respectively. The separate NMESH and STL checks passed 32 tests.
Workspace check and lint passed. The production bundle audit found one
worker chunk and the single pinned WASM asset. The supplemental Bun run
followed a symlink in the new mise state and ran out of memory. After
moving that state into the in-worktree dependency cache, the rerun
passed 4,392 tests with 74 skipped and three Chrome startup permission
failures. The Rust suite passed 73 of 91 tests with 18 macOS replacement
file permission failures under the worktree write restriction.
Verification logs are under `tmp/cad3d/m13/`.

## Completion

All twenty-two milestones accepted by the adversarial implementation
review, the plan files moved to `impl-plans/completed/`, and the cloud
follow-up of design section 15 handed over as a list.

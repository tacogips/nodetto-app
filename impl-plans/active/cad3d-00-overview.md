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
| M5 | implemented |
| M6 | pending |
| M7 | pending |
| M8 | pending |
| M19 | pending |
| M9 | pending |
| M10 | pending |
| M11 | pending |
| M12 | pending |
| M13 | pending |
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

## Completion

All twenty-two milestones accepted by the adversarial implementation
review, the plan files moved to `impl-plans/completed/`, and the cloud
follow-up of design section 15 handed over as a list.

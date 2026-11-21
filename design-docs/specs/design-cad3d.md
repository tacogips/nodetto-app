# 3D CAD pages (`cad3d`): parametric solid modelling inside nodetto

Status: design revision 3, base commit `0a35708`, branch `feat/cad3d-pages`.
Implementation plan: `impl-plans/active/cad3d-00-overview.md`.
Citations of the form `path:line` are repository evidence at the base commit.
Citations `[R-n]` are external sources listed in section 17. Measurements
marked "spike" come from a throwaway script under `tmp/cad3d-spike/` (ignored
by git, `.gitignore:41`), run with Bun 1.4.4 on Apple Silicon
(`spike.ts` / `spike.log` for the kernel and plate meshes, `spike2.ts` /
`spike2.log` for curved meshes and record sizes).

## 1. Context (facts at `0a35708`)

1. Page kinds and modes select a palette and never restrict content.
   `packages/ir/src/types.ts:22-37` (`PAGE_KINDS`, comment "never restricts
   which element types may live on the page"), `:41-63` (`PAGE_MODES`),
   `:65-70` (`DEDICATED_PAGE_MODES` for bpmn, breadboard, pcb). The validator
   only checks the enums (`packages/ir/src/validate.ts:989-991`). No page-kind
   content rule exists anywhere, so the CAD rule is the first one.
2. Every content mutation is a `Command` applied by `applyCommands`
   (`packages/core/src/commands.ts:75-141`, `:484`). `validateNewElement`
   (`:360-411`) checks id, type, index, page existence and payload, not the
   page kind. Paste, duplicate, copy-to-page, CLI `add` and imports all end in
   `createElement` (`packages/core/src/editor/paste.ts:39-101`,
   `packages/core/src/editor/pages.ts:92-179`,
   `apps/cli/src/edit/batch.ts:328-401`). There is no move-to-page command.
3. Remote collaboration edits bypass the command layer:
   `packages/collab/src/binding.ts:432-441` commits straight to the store,
   then runs `editor.reconcileDerivedState()` (`:442`, implemented at
   `packages/core/src/editor/facade/core.ts:380-383` through
   `planReconciliation`). Arrays without item ids are written as one field
   (`packages/collab/src/diff.ts:10-17`), so a coordinate pair is replaced
   atomically.
4. The hosted sync Worker (private repository) whitelists `Command` kinds and
   the fields inside `updatePage.page` (`name`, `kind`, `tokenMode`, `order`);
   see `design-docs/specs/design-slide-transition-settings.md:79-97`. It
   compiles `packages/core` with `noUncheckedIndexedAccess`
   (`design-docs/specs/design-source-module-split.md:123-125`). New `Page`
   fields or new `Command` kinds would not pass it unchanged.
5. The JSONL format has three record kinds (`document`, `page`, `element`),
   one record per line, canonical key order, elements sorted by page id then
   element id, unknown records and fields preserved
   (`packages/io/src/jsonl/records.ts:10-57`,
   `packages/io/src/jsonl/serialize.ts:146-191`,
   `packages/io/src/jsonl/parse.ts:81-103,277-278`). `SCHEMA_VERSION` is 1 and
   `breadboard`/`pcb` were added without a bump
   (`packages/ir/src/migrations.ts:8,28`,
   `design-docs/specs/design-kicad-pcb.md:102-103`). A golden test demands a
   fixture for every registered element type
   (`packages/io/src/jsonl/golden.test.ts:90`), and
   `packages/ir/src/registry.test.ts:33` pins the exact type list.
6. A record-level three-way merge exists and is wired as a git merge driver:
   records merge by id, objects key by key, arrays and scalars atomically
   (`design-docs/specs/design-cli-layout-merge-lint.md:737-760,796-806`,
   `packages/core/src/document-merge.ts`).
7. The native CLI runs the TypeScript core in Boa (`boa_engine 0.22`,
   `apps/cli/native/Cargo.toml`); the engine bundle is an IIFE embedded with
   `include_str!` (`apps/cli/scripts/build-engine.ts:11-48`,
   `apps/cli/native/src/engine.rs:250`). No file in `apps/cli/native/src`
   mentions WebAssembly, and nothing in the repository uses WASM, a Worker,
   WebGL or three.js today (grep over `packages/`, `apps/`, `crates/`).
   The canvas is DOM plus SVG (`packages/ui-solid/src/Canvas.tsx:420-470`).
8. The desktop CSP has no `script-src` and no `'wasm-unsafe-eval'`
   (`apps/desktop/src-tauri/tauri.conf.json`, `default-src 'self'`).
9. PCB data: millimetres, KiCad frame (x right, y down), geometry in
   `semantic` (`packages/ir/src/pcb.ts:81-164`). The outline is the set of
   `pcb.graphic` elements on layer `Edge.Cuts`; export only takes their
   bounding box (`packages/core/src/pcb-board/export.ts:309-327`). There is no
   component height and KiCad `model` entries are skipped
   (`packages/io/src/kicad/pcb.ts:739-750`).
10. Theme tokens: chrome in `apps/desktop/src/styles/base.css:5,99`, canvas in
    `apps/desktop/src/styles/canvas.css:7,33`; pinned by
    `apps/desktop/src/styles/theme-tokens.test.ts` (light values, dark mirror,
    `UI_SOLID_CHROME_FILES` at `:21`).
11. Deleting an element rewrites its referrers without validating them:
    a `detach` referrer loses the scalar key or the array entry
    (`packages/core/src/references.ts:44-86`,
    `packages/core/src/commands.ts:169-231,566-592`); a dangling id is only
    a validation warning (`packages/ir/src/validate.ts:1160-1171`). The
    clipboard keeps the largest self-contained fragment: a `cascade`
    element whose target was not copied is dropped and a `detach` element
    loses the outside reference (`packages/core/src/references.ts:204-252`,
    `packages/core/src/clipboard.ts:83`).
12. Elements of registry category `resource` are hidden from the layer
    tree (`packages/core/src/layer-tree.ts:120-126,222-227`) and do not
    count as content for autosave of an untitled document
    (`apps/desktop/src/file/session.ts:515-525`). PCB types use category
    `node` (`packages/ir/src/registry/pcb.ts:439`). Resource carriers are
    created on the current page whatever its kind: `design.token`
    (`packages/core/src/color-tokens.ts:215-224`), `design.text-style`,
    `design.guide` (`packages/core/src/page-guides.ts:60-74`),
    `presentation.slide`
    (`packages/ui-solid/src/inspector/slide-transition-edits.ts:68-76`) and
    `review.comment` (`packages/core/src/comments.ts:94`).
13. A client of the current release reads a page kind from Yjs without a
    check (`packages/collab/src/ydoc.ts:219`) and lets the user change it
    (`packages/ui-solid/src/inspector/PageSection.tsx:61-69`,
    `packages/core/src/editor/facade/page-editing.ts:219-229`). The collab
    differ writes an element's `page` as a field
    (`packages/collab/src/diff.ts:252`).
14. The canvas mode (light or dark canvas) is a preference separate from
    the chrome theme (`apps/desktop/src/App.tsx:949-950`,
    `packages/ui-solid/src/canvas/canvas-background.ts:10-18`). Canvas-mode
    tokens are the `--nodetto-canvas-*` properties
    (`apps/desktop/src/styles/canvas.css:7-45`); the 2D layers pin the
    chrome-named tokens to light values inside the shape layers
    (`canvas.css:125-135`).
15. The repository is MIT (`LICENSE`); notices live in
    `THIRD_PARTY_NOTICES.md`. The Mac App Store build is sandboxed
    (`docs/development.md:74-113`).

## 2. Scope

### 2.1 Goal

A page of kind `cad3d` is a part studio: sketches on planes, features that
turn sketch profiles into solids, a 3D viewport, parameter edits that
regenerate the model, the same undo/redo, page list, toolbar, inspector,
layers panel and theming as every other page. PCB boards can be referenced as
solid reference bodies so that an enclosure can be modelled around them.

### 2.2 First shippable slice (this plan, milestones M1 to M22)

- Page kind and mode `cad3d`, with the content rule enforced at every entry
  point (section 4).
- Sketch entities: line, three-point arc, circle (rectangle is four lines).
- Features: extrude with operations new, add, cut, intersect; sketch on a
  base plane or on a planar face of an earlier extrude.
- Bodies from other sources: a PCB board as a reference body (`cad.pcb`)
  and an imported mesh as an ordinary body (`cad.mesh`).
- 3D viewport (orbit, pan, zoom, face and body picking), feature list in the
  layers panel, parameter editing in the inspector, preview while dragging.
- STL import and export; kernel-free wireframe in SVG/PDF/PNG export.
- CLI: authoring through `edit`, structural check through `cad check`.

### 2.3 Later phases (designed here, not in this plan)

- Phase 2: revolve, patterns, named parameters with expressions, a
  `cad.settings` resource (tessellation tolerance, units display), external
  mesh attachments (`artifacts/<sha256>.nmesh`), derived mesh cache in
  `.nodetto` bundles, STEP AP214 export (planar faces as `ADVANCED_FACE`,
  curved faces faceted), 3MF export, per-footprint component heights, a
  body-as-tool boolean feature (for example board clearance pockets).
- Phase 3: sketch constraint solver, fillet and chamfer, exact curved
  surfaces and STEP import, which need a B-rep kernel behind the kernel port
  (section 6.1).

### 2.4 Non-goals

Assemblies and mates, drawings with dimensions, CAM, simulation, surfacing,
server code, auth and deployment config (the latter three never live in this
repository; section 15 lists the cloud follow-up).

## 3. Data model

### 3.1 Decision: CAD is ordinary elements on a dedicated page kind

A CAD page is a `Page` with `kind: "cad3d"`. Every sketch, sketch entity and
feature is an `Element` whose `type` starts with `cad.`; all geometry is in
`semantic`, `visual` carries only `hidden` and `locked`, exactly like PCB
(`design-docs/specs/design-kicad-pcb.md` section 3.1).

Alternatives rejected:

| Alternative | Why rejected |
| --- | --- |
| New record kind (`cad-feature`) or a `Page` field holding the model | Needs new `Command` kinds or `Page` fields, which the hosted Worker rejects (fact 4); loses selection, undo, layers, merge and collab for free |
| One element per sketch with an `entities` array | Any two edits in one sketch touch the same line: git conflicts, coarser merge (arrays are atomic in the merge driver, fact 6) |
| Text program as source of truth (OpenSCAD, KCL [R-14]) | Does not fit an element/CRDT document; point-and-click edits would rewrite text regions |
| Companion binary model file (FCStd-like zip [R-17]) | Undiffable, full copy per commit [R-17] |

Element granularity equals merge and collaboration granularity: one sketch
entity or one feature per JSONL line, per Yjs map, per merge record.

### 3.2 Element types (slice)

Lengths are millimetres, angles degrees. Every persisted length lies on the
1 nm grid (`roundNm`, `packages/ir/src/pcb.ts:166-171`, the KiCad convention
[R-20]); the validator rejects off-grid numbers so that text is canonical.
All CAD types use registry category `node`, as PCB does (fact 12), so they
appear in the layer tree and count as content for autosave.

| Type | `semantic` (declared key order) | References (policy) |
| --- | --- | --- |
| `cad.sketch` | `name`, `plane` | `plane.face.feature`, `plane.face.entity` (detach) |
| `cad.line` | `sketch`, `a:[x,y]`, `b:[x,y]`, `construction?` | `sketch` (cascade) |
| `cad.arc` | `sketch`, `a`, `m`, `b` (start, any mid point, end), `construction?` | `sketch` (cascade) |
| `cad.circle` | `sketch`, `c:[x,y]`, `r`, `construction?` | `sketch` (cascade) |
| `cad.extrude` | `name`, `sketch?`, `loops?:[entityId]`, `distance`, `symmetric?`, `op`, `bodies?:[featureId]`, `suppressed?` | `sketch`, `loops[i]`, `bodies[i]` (detach) |
| `cad.pcb` | `name`, `board?` (id of a `pcb.board` element), `thickness?`, `suppressed?` | `board` (detach) |
| `cad.mesh` | `name`, `data` (`nmesh1:` + base64, section 7.3), `suppressed?` | none |

`plane` is `{"base":"xy"|"yz"|"zx","offset"?:mm}` or
`{"face":{"feature"?:id,"role":"start"|"end"|"side","entity"?:id}}`.
`op` is `"new" | "add" | "cut" | "intersect"`; `bodies` names the bodies an
`add`/`cut`/`intersect` acts on by the id of the feature that created them
(`op:"new"` extrude, `cad.pcb`, `cad.mesh`).

Detached shapes are valid payloads. Deleting a referenced element rewrites
the referrer exactly as fact 11 describes, so the registry validators accept
every shape that rewrite can produce, and the evaluator, not the validator,
reports the loss:

| After deleting | Stored shape of the referrer | Validator | Evaluator status |
| --- | --- | --- | --- |
| the sketch of an extrude | `sketch` key absent | valid | `cad.reference.missing` |
| a body named in `bodies` | entry filtered, possibly `bodies: []` | valid for every `op` | `cad.body.missing` when `op` is not `new` and no body is left |
| an entity named in `loops` | entry filtered, possibly `loops: []` | valid | `cad.profile.empty` when the array is present and empty (absent means all loops) |
| the feature of a face plane | `plane: {"face":{"role":...}}` | valid | `cad.reference.missing` |
| the entity of a side face plane | `plane.face.entity` absent | valid | `cad.reference.missing` |
| the board of a `cad.pcb` (or its page) | `board` key absent | valid | `cad.reference.missing` |
| the sketch of an entity | the entity is deleted too (cascade) | - | - |

The validators therefore only reject wrong types, unknown enum values,
off-grid or out-of-range numbers and malformed ids; no reference field is
required. A reference field holding the empty string is invalid (the detach
rewrite never produces it). M1 and M2 test each row by running
`deleteElements` or `deletePage` on the target, then `validateDocument`,
serialize, parse, `updateSemantic` on the survivor, and undo.

Arcs are stored by three grid points, not centre and angles, so arc and line
end points coincide exactly and loop detection is exact integer comparison.

### 3.3 Feature order and dependencies

History order is the existing `Element.index` (fractional index) with the
element id as tie break, the order every list in the editor already uses.
Reordering a feature is the existing `reorder` command. A map of elements plus
a sort key is the approach the Yjs maintainers suggest for movable lists and
it gives the "one concurrent move wins" semantics of [R-23] without
duplicating an element.

Dependencies are element ids inside `semantic`, exposed through the registry
`references()` contract (`packages/ir/src/registry/definition.ts:25-39`), so
delete policies apply and copies remap ids.

Clipboard semantics. The existing self-contained rule (fact 11) would drop a
copied circle (its sketch is not in the fragment), strip `sketch` and
`bodies` from a copied extrude and strip the board from a duplicated page.
CAD definitions therefore set a new optional registry flag
`keepsExternalReferences: true` (`packages/ir/src/registry/definition.ts`):
`selfContained` keeps such an element and leaves a reference to an element
outside the fragment untouched (ids inside the fragment are remapped as
today). No existing type sets the flag, so existing behaviour is unchanged.
At insertion (`planInsertCopies`), a kept outside reference is resolved
against the target document: a sketch entity whose `sketch` does not resolve
to a `cad.sketch` on the target page is dropped; every other unresolved
reference stays and shows as an evaluator status. Results: duplicating one
circle adds a circle to the same sketch; duplicating a cut extrude gives a
second cut on the same sketch and bodies; duplicating a page that holds a
`cad.pcb` keeps the board link; pasting into another document degrades to
statuses, never to a throw or an invalid payload.

Rules, checked by the evaluator, never by blocking an edit:

- A reference must resolve to a `cad.*` element on the same page, except
  `cad.pcb.board`, which resolves to a `pcb.board` on a `pcb` page.
- A feature may only use features that come earlier in history order.
- A missing, later or cyclic reference gives that feature an error status
  (section 6.6) and the rest of the model still regenerates. This is the
  never-block policy of Onshape [R-18] and it matches add-wins collaboration:
  a concurrent delete can always produce a dangling id.

### 3.4 Stable references to faces (persistent naming)

The topological naming problem [R-10, R-11, R-12] is avoided in the slice by
never persisting an index into kernel output. A face reference is
`(feature id, role, sketch entity id)`, the scheme that Onshape queries
(`qCapEntity`, `sketchEntityQuery`) and the Fusion 360 Gallery format encode
[R-11, R-16]:

- `start` / `end`: the caps of an extrude; `side` + entity: the faces swept
  from one sketch entity (all facets of a circle share one name).
- The plane of a face reference is computed analytically from the defining
  feature (section 6.3), not from the tessellation, so sketch-on-face keeps
  working after later booleans split, trim or remove that face.
- For display and picking, names travel through booleans as provenance: each
  tool solid is handed to the kernel with one face number per triangle and a
  unique original id, and the kernel reports both for every output triangle.
  Spike: a plate cut by six 48-gon prisms returned run `orig+0` with face ids
  `1,2,10,11,12,13` and six runs with face id `7`, i.e. every output triangle
  maps back to (tool, face) (`tmp/cad3d-spike/spike.log`).
- Known limits, documented failure modes of every creator-based scheme
  [R-10, R-11]: a split face yields several regions with the same name (all
  are selected together); edges and vertices have no persisted names in the
  slice, which is why fillet and chamfer are phase 3.

## 4. The content rule and its enforcement

Rule R (shapes). An element whose type starts with `cad.` lives only on a
`cad3d` page. A `cad3d` page holds only `cad.*` elements and elements of
registry category `resource`. Resource elements are page or document
settings stored as elements (`design.token`, `design.text-style`,
`design.guide`, `presentation.slide`, `review.comment`; fact 12); they are
not shapes, they are created on whatever page is current, and rejecting them
would break tokens, slide settings and comments. Every other known type, and
every unknown type that does not start with `cad.`, is refused on a CAD
page. The prefix form keeps forward compatibility: an unknown future `cad.x`
type is preserved on a CAD page (unknown types are warnings,
`packages/ir/src/validate.ts:884`).

Rule K (kind). The kind of a page never changes to or from `cad3d`, with one
restoring exception: `updatePage` may set the kind to `cad3d` when the page
holds at least one `cad.*` element and no element that a CAD page refuses.
Such a page can only exist after a non-conforming edit (below), and the
change makes the document valid again.

One function owns R: `pageAcceptsElementType(kind, type)` in
`packages/ir/src/page-content.ts`.

| Entry point | Enforcement | Evidence of the path |
| --- | --- | --- |
| IR validation | `validateDocument` reports error `page.contentKind` per offending element; `parseDocument` therefore refuses the file and `nodetto-cli validate` names the record | `packages/ir/src/validate.ts:944` |
| Commands (choke point) | `createElement` and `convertElement` fail with `CommandError` `page.contentKind`; `updatePage` fails with `page.kindLocked` under rule K | `packages/core/src/commands.ts:606,688,791` |
| Paste, duplicate | `planInsertCopies` filters by R against the target page; nothing inserted returns the existing empty result, never a throw | `packages/core/src/editor/paste.ts:39-101` |
| Copy shapes to page, duplicate page | `copyPageElements` rejects incompatible page pairs; `duplicatePage` copies kind and content (resource carriers included, `packages/core/src/editor/pages.ts:100-104`) | `packages/core/src/editor/pages.ts:92-179` |
| Page conversion | `setPageKind` returns false under K; the inspector kind select omits `cad3d` and is disabled on CAD pages | `packages/core/src/editor/facade/page-editing.ts:219-242`, `packages/ui-solid/src/inspector/PageSection.tsx:61-69` |
| Notation creators | `createBreadboardPart`, `addPcbTrack`, `addPcbVia` already require their own page kind | `packages/core/src/editor/facade/notation-editing.ts:56-138` |
| Imports | KiCad and breadboard imports create their own page (`packages/core/src/pcb-board/page.ts:16-21`, `packages/core/src/breadboard/import-layout.ts:63`); imports that draw on the current page create a new page when the current one is `cad3d`; STL import targets a CAD page | section 9 |
| CLI and MCP | `edit` ops run `applyCommands`, so R and K surface as operation errors; `arrange` and `lint` skip CAD pages like PCB; MCP tools derive from `COMMAND_HELP` | `apps/cli/src/edit/batch.ts:327-406`, `apps/cli/src/mcp.ts:78-110` |
| Collaboration | Remote commits bypass commands (fact 3); a non-destructive repair in `planReconciliation` restores R and K (below) | `packages/collab/src/binding.ts:432-473` |
| UI tools | The `cad3d` workspace lists only CAD tools and no `COMMON_SHAPES`; CAD tools exist in no other workspace; a CAD page always shows the CAD workspace | `packages/ui-solid/src/shape-palette.ts:487-498`, `apps/desktop/src/page-workspace.ts:4-17` |

M22 initially classifies 42 source files containing a `createElement` command
literal or a non-`document` `.createElement(...)` call. The exact-list test
checks these forms in non-test TypeScript under `packages/*/src` and
`apps/*/src`. The paths below are relative to the indicated source root.

| Class | Emitters | Treatment |
| --- | --- | --- |
| A. Can create without existing 2D content, or from generic endpoints | Core paths are `templates/design-templates.ts`, `ui-blocks.ts`, `kits/ios/insert.ts`, `shape-catalogue.ts`, `html-layout.ts`, `editor/facade/notation-editing.ts` (sequence participant), `page-frames/editing.ts` (through `editor/facade/page-editing.ts`), `freehand-gesture.ts`. UI paths are `image-import.ts`, `ShapePalette.tsx`. Desktop paths are `seed.ts`. | Live-page helpers check `editor.canCreateOn(pageId, type)` (a facade over `pageAcceptsElementType`) before editing. The template and HTML layout builders create their own freeform document. M6 hides or disables the template, image import, kit and block controls on CAD pages. |
| A0. Generic entry points | Core paths are `editor/facade/core.ts`, `editor/facade/element-editing.ts`. CLI paths are `edit/operations/add.ts`. | The command choke point reports `page.contentKind`. Specialized CLI kit and sequence add operations report an operation error when their helper declines creation. |
| B. Requires 2D content or has a guard in M2 | Core paths are `group.ts`, `frame-selection.ts`, `boolean-operations.ts`, `editor/components.ts`, `editor/connections.ts`, `editor/sequence.ts`, `editor/bpmn.ts`, `bpmn/containment.ts`, `screen-transition.ts`. | These helpers return without editing for a CAD-only page or selection. |
| C. Canvas interaction | UI paths are `interaction/creation.ts`, `interaction/connectors.ts`. The CAD viewport calls the command builders in core `cad/authoring.ts`. | M22 checks the page kind for 2D placements and connectors. Those controls do not mount inside the CAD viewport, which checks `canCreateOn` before applying a sketch command. The command layer enforces rule R in both cases. |
| D. Resource carriers | Core paths are `color-tokens.ts`, `number-tokens.ts`, `text-styles.ts`, `page-guides.ts`, `comments.ts`. UI paths are `inspector/slide-transition-edits.ts`. | Rule R permits these elements. Comment pins and guides are absent from the 3D viewport in the slice. Comments stay listed in the comments panel. |
| E. Fixtures, inverse commands and clipboard planning | CLI paths are `__fixtures__/bpmn-layered.ts`, `__fixtures__/connector-arrange.ts`, `__fixtures__/dense-relations.ts`, `__fixtures__/obstacle-routing-batch.ts`, `__fixtures__/sequence-self-timing.ts`, `__fixtures__/text-layout.ts`. Desktop paths are `file/session-test-helpers.ts`. Core paths are `commands.ts`, `clipboard.ts`. UI paths are `interaction-test-helpers.ts`, `test-dom/text-editor.dom.tsx`. | The list includes test-support files that lack a `.test.ts` or `.test.tsx` suffix. |

Collaboration repair (never deletes). A conforming client cannot violate R
or K, but a client of the current release can (fact 13): it can change the
kind of a CAD page and it can add 2D shapes to a page whose kind it does not
know. The repair, `planContentRepair`, is deterministic, runs with the
untracked derived origin after remote changes, and only moves or relabels:

1. A page that is not `cad3d` and holds `cad.*` elements and nothing a CAD
   page refuses: set its kind back to `cad3d` (the rule K exception).
2. A `cad3d` page holding elements it refuses: move those elements to a
   freeform page with the deterministic id `<pageId>-shapes` (created if
   absent, named "<name> shapes", ordered right after the CAD page).
3. A page that is not `cad3d` and holds both `cad.*` elements and refused
   elements: move the `cad.*` elements to a `cad3d` page with the
   deterministic id `<pageId>-cad` (created if absent).

A move is `deleteElements` plus `createElement` with the same id in one
command list; the collab differ publishes it as a write of the element's
`page` field (fact 13), which is idempotent, and every peer computes the
same target page id, so peers converge without duplicates. All `cad.*`
elements of a page move together, so their mutual references stay intact.
An element that stays behind and references a moved element (a
`review.comment` whose `target` is a moved shape) would be detached by the
delete expansion (`packages/core/src/commands.ts:169-231`); the repair
appends an `updateSemantic` that restores its original payload, so the
net effect of a repair is only the changed `page` of the moved elements (a
cross-page target is a validation warning, not an error). No element is
ever deleted by the repair, so an edit from an older client cannot destroy
a model or anyone's shapes. Known limit: a field edit that the older client
makes on a shape concurrently with its move can be lost, because the move
rewrites the element.

File load and live session differ on purpose: a file is the user's text and
is reported, never silently edited; a session must converge, so it repairs.
An older build opening a file with a `cad3d` page fails the page-kind enum
check, the same behaviour as an older build meeting a `pcb` page; no schema
bump (fact 5).

## 5. User interface

The CAD page reuses the shell: page list and tabs, toolbar mode select,
palette, layers panel, inspector, selection store, history shortcuts.

- Entering: the toolbar mode select gains "3D CAD"
  (`packages/ui-solid/src/workspaces.ts:16-157`). Choosing it jumps to or
  creates the dedicated page, the PCB flow
  (`apps/desktop/src/shell/workspace.ts:21-35`). Choosing another mode while
  on a dedicated page already leaves it for a non-dedicated page or a new
  freeform page (`workspace.ts:36-43`), so no mode is ever stored on a CAD
  page; `cad3d` only has to join `DEDICATED_WORKSPACES`.
- More CAD pages: the add-page actions of the page list and the page tabs
  (`packages/ui-solid/src/PageList.tsx:374`,
  `packages/ui-solid/src/PageTabs.tsx:791`) create a page of kind `cad3d`
  named "3D CAD n" when the current page is a CAD page, and a freeform page
  otherwise, so a multi-part document needs no duplicate or CLI detour.
- Cloud documents: until the hosted Worker accepts `cad3d` (section 15) the
  "3D CAD" mode and the CAD add-page action are not offered while the
  editor is bound to a cloud document (`isCloud()`,
  `apps/desktop/src/App.tsx:383-384`); an existing CAD page still opens.
- Viewport: `NodettoCanvas` renders `CadViewport` instead of the 2D layers
  when the current page kind is `cad3d` (`packages/ui-solid/src/Canvas.tsx`).
  It sits in the same `.nodetto-canvas` container, so the canvas mode
  applies (`packages/ui-solid/src/canvas/canvas-background.ts`).
- Chrome entries that create 2D content (template dialog, image import,
  kits, UI blocks; section 4 class A) are hidden or disabled on a CAD page.
- Feature list: the layers panel lists the page elements in history order
  with names from `packages/core/src/layer-name.ts`; sketch entities nest
  under their sketch; an error badge shows the derived status. Reorder,
  hide, lock and delete are the existing layer actions. Rename differs in
  one point: the existing rename writes `visual.layerName`, which
  `layerName()` prefers over `semantic.name`
  (`packages/core/src/layer-name.ts:4-10,66`); for `cad.*` types that have a
  `name` field, rename writes `semantic.name` instead, so the inspector,
  the CLI and the layer list always agree and `visual` keeps only `hidden`
  and `locked`. Sketch entities have no name field and are not renamable.
- Inspector: `CadSection` is selected by the `cad.` type prefix, the pattern
  of `PcbSection` (`packages/ui-solid/src/Inspector.tsx:204-212,359-370`).
  Each field edit is one `updateSemantic` command, hence one undo step.
- Selection: picking a face selects its feature element (and remembers the
  face name for "sketch on face"); picking a sketch entity selects that
  element. Delete, undo and redo use the existing shortcuts
  (`apps/desktop/src/history-shortcuts.ts`).
- Sketch mode: selecting a sketch and a sketch tool aligns the camera to the
  sketch plane; pointer positions are projected on the plane and snapped to
  the grid, to existing end points and to horizontal/vertical. Escape leaves
  the tool, the existing idiom.
- Theming: no new tokens. Everything drawn over the canvas background
  follows the canvas mode, not the chrome theme (fact 14), so the renderer
  uses canvas-mode tokens only, read with `getComputedStyle` from the
  viewport element and re-read when the canvas mode changes:

  | Use | Token | Light / dark value | Contrast on `--nodetto-canvas-bg` |
  | --- | --- | --- | --- |
  | Background | `--nodetto-canvas-bg` | `#f6f4ee` / `#15191b` | - |
  | Grid | `--nodetto-canvas-grid` | `#e3ded1` / `#343c40` | decorative |
  | Body fill (lit) | `--nodetto-canvas-ruler-surface` | `#fffdf8` / `#1f2427` | separated by edges |
  | Edges, sketch and construction lines (construction dashed) | `--nodetto-canvas-ruler-text` | `#596366` / `#a3adb1` | about 5.6 / 7.6 |
  | Selection, hover, preview, active sketch | `--nodetto-canvas-overlay` | `#335c67` / `#5fb4c7` | about 6.6 / 7.5 |

  The chrome-named tokens (`--nodetto-ink`, `--nodetto-accent`,
  `--nodetto-danger`) are not used for geometry: with a light chrome and a
  dark canvas they would give about 2:1. Errors are not coloured in the
  viewport; they appear as badges in the feature list and in the status
  strip, which are chrome and use chrome tokens on chrome surfaces. M8
  computes the contrast of each line token against the background for both
  canvas modes (which covers all four chrome and canvas combinations,
  because no chrome token is read) and requires at least 3:1. New CSS files
  join `UI_SOLID_CHROME_FILES` so the token test covers them.
- Camera state is session state per page, not persisted, so navigating never
  dirties a document.

## 6. Geometry

### 6.1 Kernel decision

| Candidate | Licence | Size | Verdict |
| --- | --- | --- | --- |
| Open CASCADE (opencascade.js, occt-wasm, Replicad) [R-1, R-2, R-3] | LGPL-2.1 with an exception that covers header material only | 21 to 49 MB raw, 4.5 to 9 MB brotli | Rejected for the slice: static WASM plus closed distribution through the Mac App Store has no authoritative clearance [R-1]; 40 to 90 times the size of the alternative; cannot run in the CLI; no reproducibility guarantee |
| Manifold (`manifold-3d` 3.5.5) [R-4] | Apache-2.0 | 542,744 bytes raw, 205,307 gzip, 159,215 brotli (spike) | Chosen for the slice |
| Rust B-rep kernels (truck, arris, brepkit, Fornjot) [R-5] | Apache/MIT, AGPL (brepkit), archived (Fornjot) | not measured | Not mature or not licensable today; revisit for phase 3 |
| JSCAD modelling [R-6] | MIT, pure JS | 1.6 MB | Rejected: float BSP booleans without a robustness guarantee |
| Own boolean kernel in TypeScript | - | - | Rejected: robust 3D booleans are the hard part (the prior debate is right on this point) |

Manifold gives guaranteed-manifold booleans, a serial WASM build that needs
no SharedArrayBuffer or cross-origin isolation, works under a CSP without
`unsafe-eval` since 3.5.4, and preserves per-triangle provenance [R-4]. Its
limit is honest: triangle meshes only, so curved faces are faceted and there
is no fillet or STEP B-rep. The prior debate's recommendation (Open CASCADE
through Replicad plus three.js) is therefore changed: its reasoning about
writing only the recompute logic ourselves is adopted, its kernel and
renderer choices are not, for licence, size and CLI reasons.

The kernel sits behind a port (`packages/core/src/cad/kernel.ts`):
`solid(toolMesh, faceNames)`, `boolean(op, target, tools)`, `mesh(handle)`
returning triangles with face names, `measure(handle)`, `release(handle)`.
Nothing persisted depends on kernel output, so a B-rep kernel can replace
Manifold in phase 3 without a format change.

The adapter lives in a new workspace package `packages/cad-kernel`
(`@nodetto/cad-kernel`). `packages/core` must not import it, because core is
bundled into the Boa engine and compiled by the sync Worker (facts 4, 7).

### 6.2 What nodetto computes itself (pure TypeScript in `packages/core/src/cad`)

Feature order and dependency graph, sketch frames, loop detection and
nesting, curve tessellation, tool solids (prisms with named faces), the
memoised evaluation driver, display buffers, picking and the PCB outline.
These are small, deterministic and testable without WASM, and they are all
the CLI needs (section 10).

### 6.3 Frames, profiles and tool solids

- Base frames: `xy` (u=+X, v=+Y, n=+Z), `yz` (u=+Y, v=+Z, n=+X), `zx`
  (u=+Z, v=+X, n=+Y), shifted by `offset` along n.
- An extrude spans t from t0 to t1 along n of its sketch: (0, distance), or
  (-distance/2, distance/2) when `symmetric`. Face `start` is the cap at
  t0, `end` the cap at t1; both reuse the parent sketch frame (same u, v, n)
  at their t, so 2D coordinates line up across stacked sketches. Face `side`
  of a line a->b has origin a at the start cap, u along b-a, v along n. A
  `side` face of an arc or circle is not planar: `cad.plane.notPlanar`.
- The frame normal of a face is a coordinate convention, not the outward
  direction. A kernel-free function `faceOutwardSign(elements, faceRef)`
  returns +1 when the body's material lies behind the face along -n of the
  face frame (outward of the body is +n), -1 when outward is -n, and 0 when
  unknown. It is the product of two factors:
  - the tool factor, which says where the feature's own tool solid lies:
    `end` gives sign(t1 - t0); `start` gives -sign(t1 - t0); `side` gives
    +1 when the stored direction a->b agrees with the counter-clockwise
    traversal of its loop and the loop has even depth, and flips once for a
    reversed line and once for an odd depth (a hole);
  - the operation factor of the defining feature: +1 for `new`, `add` and
    `intersect` (the body keeps the inside of the tool, so the tool's
    outward side is the body's outward side) and -1 for `cut` (the body is
    what the tool removed material from, so the tool's outward side is the
    body's inward side). A `cad.pcb` counts as `new`.
  Example: Plate, `new`, +5 on `xy` (z 0 to 5); Pocket, `cut`, distance -2
  from the plate's end face (z 5 down to 3). The pocket floor is the
  pocket's `end` face: tool factor sign(-2) = -1, operation factor -1,
  result +1, so outward is +z, into the open pocket; a boss sketched on the
  floor grows upward and a downward drag cuts. Pocket walls flip the same
  way. The extrude tool uses the function for the default direction and for
  the add or cut decision (section 6.4). It is tool behaviour, not persisted
  meaning: what is persisted is the frame (u, v, n) and a signed `distance`
  along n, and those conventions are fixed by tests.
- The body a face belongs to: for a `new` feature (or `cad.pcb`,
  `cad.mesh`) the feature itself; for `add`, `cut` and `intersect` the
  first id in the feature's `bodies` that names an existing earlier body
  creator. A cut through several bodies therefore offers its first body as
  the default target, and the user can change `bodies` in the inspector.
- Loops: line and arc end points are chained by exact equality of grid
  coordinates; a circle is a loop. Each loop edge records its source entity
  and whether the stored direction was reversed to make the loop
  counter-clockwise. Construction entities are ignored. Open
  chains, branching points and intersecting loops are errors
  (`cad.profile.open`, `cad.profile.branch`, `cad.profile.intersect`).
  Nesting is even-odd: depth 0 adds material, depth 1 removes it, and so on.
- Tessellation uses recursive bisection: a circle starts from its four
  cardinal points, an arc from its three stored points; each chord is split
  at the midpoint pushed out to the radius until the sagitta is at most
  0.01 mm or depth 6 (256 segments per circle). Only `+ - * /` and `sqrt` are
  used, which IEEE 754 defines exactly, so V8, JavaScriptCore and Boa produce
  identical vertices; `Math.sin`/`cos` are not reproducible across engines
  [R-21]. Vertices are snapped with `roundNm`.
- A tool solid is one prism per loop with face numbers for start, end and
  one per source entity; caps are triangulated by ear clipping of a simple
  polygon. Holes are not triangulated: the extrude body is the union of even
  depth prisms minus the odd depth prisms, computed by the kernel, which also
  keeps hole side names.

### 6.4 Threading, preview and commit

- All kernel work runs in one dedicated Web Worker created by the host
  (`apps/desktop/src/cad/engine.ts`); `packages/ui-solid` depends only on a
  `CadEngine` interface from core. The worker receives the page's CAD
  elements (plus referenced PCB elements) as plain JSON and returns statuses
  and display buffers (`Float32Array` positions, `Uint32Array` indices and
  per-triangle face index, `Float32Array` edge segments) as transferables.
- Requests are coalesced: one in flight, the newest pending, older ones
  dropped. Results carry the store revision they were computed for.
- Preview: while a distance or sketch point is dragged, the main thread draws
  the dragged feature's own tool prism translucently (pure TypeScript, no
  boolean). The default extrude of a sketch on a face points outward
  (`distance = 10 * faceOutwardSign`) with `op: "add"`; while dragging,
  `distance * faceOutwardSign > 0` means add and `< 0` means cut into the
  body. Commit: one `updateSemantic` (or `createElement`) at pointer up,
  hence one history entry, one changed JSONL line and one collaboration
  update. Camera moves only redraw GPU buffers.
- A watchdog terminates and restarts the worker when a request exceeds 20 s
  or the WASM instance traps; the memo is dropped and the features report
  `cad.kernel.failed` (section 13).

### 6.5 Incremental regeneration

Evaluation walks features in history order and chains content keys per
body. A key hashes canonical geometry inputs, the preceding body state
keys, the kernel id and the tessellation constants (input addressing as in
build systems [R-33]). Sketch and feature names are excluded. An explicit
`false` extrusion flag has the same key as an omitted flag.

The memo records which feature keys succeeded in the preceding evaluation.
For those keys, it can defer obtaining handles until a changed feature
needs a boolean input or the viewport needs a final body. If that state is
missing, it replays only the suffix after the newest retained predecessor.
If no predecessor survives, it may replay the affected body from its creator.
A multi-body feature succeeds only when all targets succeed.

The LRU retains up to 256 distinct solids and 4,000,000 total triangles.
Keys that alias the same handle share one entry, with one key per role.
Final bodies stay reusable
through the next evaluation even if they exceed either cache limit. The memo
calls `release` when a handle is neither cached nor visible. Keys are
in-memory only in the slice (64-bit non-cryptographic), so a collision can
never reach a file.

### 6.6 Statuses, tolerances, limits

- Statuses are derived, never persisted: `ok`, or an error code
  (`cad.reference.missing`, `cad.reference.failed`, `cad.order.forward`,
  `cad.cycle`, `cad.feature.invalid`, `cad.profile.*`, `cad.plane.notPlanar`,
  `cad.body.missing`, `cad.body.reference`, `cad.result.empty`, `cad.limit`,
  `cad.mesh.*`, `cad.pcb.*`, `cad.kernel.failed`). A failed or
  suppressed feature is skipped and its bodies pass through unchanged.
  `cad.feature.invalid` covers invalid sketch or extrusion payloads.
  `cad.profile.invalid` covers invalid sketch entity payloads or a profile
  that cannot be turned into a prism. A sketch on a face of a suppressed
  extrusion reports `cad.reference.failed` because that face is unavailable.
- Units: mm on a 1 nm grid in text; the kernel works in doubles; display and
  mesh payloads quantise to 1 micrometre, above the Float32 resolution of the
  kernel's JS mesh output at 1 m (6e-5 mm).
- Limits (errors, not crashes): 20,000 CAD elements per page, 20,000
  vertices per loop, 2,000,000 triangles per body, model extent 10 m.

### 6.7 Rendering

Decision: an own WebGL2 renderer (`packages/ui-solid/src/cad/renderer.ts`),
no three.js. three.js is MIT but 186 kB gzip for the main entry [R-7] against
a viewport that needs one shaded pass, one line pass and a grid; the
repository has no rendering dependency today (fact 7), and reading theme
tokens directly is simpler in own code. WebGPU is not used: WKWebView has it
only from Safari 26 [R-7] while the app supports macOS 12
(`apps/desktop/src-tauri/tauri.appstore.conf.json`).

- Faces: indexed triangles, flat normals from screen-space derivatives,
  polygon offset; colour from tokens with a fixed head light.
- Edges: line segments where the two adjacent triangles have different face
  names or meet at more than 30 degrees.
- Picking: CPU ray casting over the display buffers (pure function, tested);
  brute force in the slice with a measured deadline, BVH in phase 2.
- If WebGL2 is unavailable the viewport shows the feature list and a message;
  the document stays editable.

## 7. Persisted format

### 7.1 Source of truth and derived data

| Data | Role | Where |
| --- | --- | --- |
| `cad.*` element records | Source of truth for parametric geometry | JSONL document |
| `cad.mesh.data` | Source of truth for imported geometry | inline NMESH payload in the element (slice); `artifacts/<sha256>.nmesh` (phase 2) |
| Solids, display meshes, statuses, memo keys | Derived, regenerated on open | memory only (slice); optional cache entries in bundles (phase 2) |
| Camera, sketch mode, selection | Session state | memory |

Decision: the parametric model fits the existing JSONL document format
unchanged; no companion format is needed for it. A custom binary format,
NMESH, is defined only for triangle payloads. Derived meshes are not stored
in the slice: the spike regenerates a plate with 60 holes (15,612 triangles)
in 58 ms and its mesh would be 106 kB, while its source is a few lines. The
prior debate's `model.json` + `history.jsonl` + mesh cache layout is
rejected: nodetto has no replay log to shortcut (the document is the current
state), and a second file per document would break single-file save, merge
and sync.

### 7.2 Record level (JSONL)

Self-authored example (`visual` is omitted when empty, as today):

```
{"kind":"page","id":"pg3","name":"Bracket","pageKind":"cad3d"}
{"kind":"element","id":"ci1","page":"pg3","type":"cad.circle","index":"a2V","semantic":{"sketch":"sk2","c":[10,10],"r":1.6}}
{"kind":"element","id":"ex1","page":"pg3","type":"cad.extrude","index":"a1","semantic":{"name":"Plate","sketch":"sk1","distance":5,"op":"new"}}
{"kind":"element","id":"ex2","page":"pg3","type":"cad.extrude","index":"a3","semantic":{"name":"Holes","sketch":"sk2","distance":-5,"op":"cut","bodies":["ex1"]}}
{"kind":"element","id":"ln1","page":"pg3","type":"cad.line","index":"a0V","semantic":{"sketch":"sk1","a":[0,0],"b":[100,0]}}
{"kind":"element","id":"sk1","page":"pg3","type":"cad.sketch","index":"a0","semantic":{"name":"Base","plane":{"base":"xy"}}}
{"kind":"element","id":"sk2","page":"pg3","type":"cad.sketch","index":"a2","semantic":{"name":"Hole centres","plane":{"face":{"feature":"ex1","role":"end"}}}}
```

Properties, all inherited from the existing writer (fact 5) and verified by
tests in M1 and M17:

- Deterministic: canonical key order, records sorted by page id then element
  id, numbers through `JSON.stringify` after `roundNm`; `serialize(parse(x))`
  is byte-identical.
- Minimal churn: changing a hole radius changes one line; reordering a
  feature changes one `index`; adding an entity adds one line.
- Size with 26-character ULID ids (`packages/core/src/ids.ts:37-40`),
  measured on representative records (`tmp/cad3d-spike/spike2.log`, bytes
  including the newline): line 196, circle 199, arc 217, sketch on a face
  220, cut extrude 254. A part with 60 features and 600 sketch entities is
  about 135 kB; 10,000 records about 2.1 MB. M17 asserts an average of at
  most 260 bytes per record on its generated document and records the
  measured value. (The example above uses short ids for readability.)
- Parse and write speed: the existing parser and serializer, one
  `JSON.parse` per line. Budget: a 10,000 record CAD page parses and
  serialises in under 1 s in Bun and passes `validate` and `cad check` in the
  native CLI in under 10 s, the existing deadline class
  (`apps/cli/src/native-parity/documents.test.ts:247`).

### 7.3 NMESH version 1 (byte level)

A self-contained, canonical, integer-only triangle container. Little endian;
`uv` is an unsigned LEB128 varint; `zz` is a zigzag-encoded `uv`.

```
offset  size  field
0       4     magic "NMSH" (4E 4D 53 48)
4       1     version = 1
5       1     flags = 0 (a reader rejects any set bit)
6       1     unitExp = 3 (coordinate unit is 10^-unitExp mm = 1 micrometre)
7       1     reserved = 0
8       uv    V  vertex count
        uv    T  triangle count
        uv    G  face group count (G >= 1 when T > 0)
        G x { uv faceId (strictly ascending), uv triangleCount }  (sum = T)
        V x { zz dx, zz dy, zz dz }   delta to the previous vertex, first from 0,0,0
        3T x uv index code: 0 = the next unused vertex; k > 0 = vertex (used - k)
end-4   4     CRC-32 (IEEE) of all preceding bytes, little endian
```

Canonical form (a writer must produce it, so equal triangle sets give equal
bytes whatever the input order): quantise positions to integers; weld equal
positions; drop degenerate triangles; rank vertices lexicographically by
(x, y, z); rotate each triangle so its lowest rank comes first, keeping the
winding; sort triangles by (faceId, r0, r1, r2); emit vertices in order of
first use. Normals are not stored (flat shading derives them). `faceId` is 0
for an imported mesh; the cache use in phase 2 pairs ids with a name table.

Reader rules (untrusted input): reject wrong magic, version, flags, reserved
or `unitExp`; require `3V + 3T + 2G <= len - 12` before allocating (every
vertex, triangle and group costs at least that many bytes), so the two
output arrays together (12 bytes per vertex and per triangle) are at most
four times the input size; reject an
index code greater than the used count, a first-use count different from V,
group counts not summing to T, trailing bytes, CRC mismatch, coordinates
beyond +-10^7 units (10 m). The reader accepts a well-formed file whose
triangles are not in canonical order (another tool may have written it);
`isCanonical(mesh)` reports it. Byte stability is a property of nodetto's
writer: every path that stores a mesh (`stlToMeshCommands`) canonicalises
first. A hand-edited non-canonical payload still loads; it only loses the
byte-stability guarantee until it is re-imported.

The registry validator checks a payload without decoding it: a length
check and one regular expression test
(`/^nmesh1:[A-Za-z0-9+/]+={0,2}$/`), the pattern of the image validator
(`packages/ir/src/image.ts:16-24`), so the cost in the native CLI is one
native regex pass per mesh; M18 measures a document with four maximum-size
meshes natively against the 10 s deadline class.

Inline armour: `cad.mesh.data` is the string `nmesh1:` followed by standard
base64 of the file bytes, at most 1,048,576 characters, the size class of an
inline image in a collaboration message (`MAX_IMAGE_BYTES`,
`packages/ir/src/image.ts:5`). Larger imports are refused with a message in
the slice; phase 2 stores the same bytes as `artifacts/<sha256>.nmesh`, the
existing content-addressed attachment scheme
(`apps/desktop/src-tauri/src/attachments.rs:43-74`).

Alternatives:

| Alternative | Evidence | Verdict |
| --- | --- | --- |
| JSON number arrays | spike: 3.2 times larger, 3 times slower to parse | Rejected |
| base64 of raw Float32 + Uint32 | spike: 2.3 times larger than NMESH before base64; not canonical (float noise, input order) | Rejected |
| Draco [R-26] | smallest, but 720 kB pure JS decoder or WASM, reorders vertices, 50 MB/s decode | Rejected: no WASM in the CLI, size |
| meshoptimizer codecs [R-25] | about 7.5 bytes per vertex including indices, official decoder is WASM, pure JS decoder "not recommended for production" | Not adopted in v1: needs prior cache-order optimisation that is not canonical; kept as the reference point for a v2 bitstream |
| glTF/GLB container | float attributes, no canonical form | Rejected as the stored form; possible export later |

Measured (spike, plate with 60 / 200 / 1000 holes, 64 segments each):

| Mesh (welded vertices / triangles) | JSON | raw f32+u32 | NMESH body | NMESH gzip | JSON gzip | decode NMESH / JSON.parse |
| --- | --- | --- | --- | --- | --- | --- |
| 7,688 / 15,612 | 344,235 | 279,600 | 106,441 | 42,811 | 88,058 | 0.25 ms / 0.50 ms |
| 25,608 / 52,012 | 1,257,945 | 931,440 | 376,647 | 127,029 | 285,631 | 0.60 ms / 1.67 ms |
| 128,008 / 260,012 | 6,732,534 | 4,656,240 | 2,048,358 | 630,425 | 1,466,726 | 2.99 ms / 8.86 ms |

Curved meshes, where deltas are less regular (spike2, own generators):

| Mesh (welded vertices / triangles) | NMESH body | bytes per vertex | of raw | of JSON |
| --- | --- | --- | --- | --- |
| sphere 160 x 80 (12,642 / 25,280) | 188,085 | 14.9 | 41% | 29% |
| sphere 360 x 180 (64,442 / 128,880) | 1,004,638 | 15.6 | 43% | 28% |
| torus 256 x 96 (24,576 / 49,152) | 373,037 | 15.2 | 42% | 28% |
| sphere 200 x 100 with pseudo-random noise (20,200 / 40,000) | 305,114 | 15.1 | 42% | 28% |

Over plates and curved meshes that is 13.9 to 16.0 bytes per vertex (6.8 to
7.9 per triangle), 28 to 31% of JSON and 41 to 44% of raw binary. The
inline cap (786,432 bytes before base64) holds about 50,000 vertices, which
decodes in about 1 ms in Bun; at 40 to 100 times slower the native CLI would
need 40 to 100 ms. M12 measures the Bun time against a deadline. The CLI
does not decode mesh payloads in the slice (the validator only tests a
pattern), so no native decode deadline exists yet.

### 7.4 Git behaviour

- Parametric data: line diffs are meaningful and small (7.2). The existing
  merge driver merges records by id and fields by key (fact 6): two people
  editing different features, or different fields of one feature, merge
  cleanly; the same field edited twice is a reported conflict that keeps
  ours. Delete against modify: a delete on one side has already rewritten
  that side's referrers (fact 11), so "theirs deleted a sketch, ours changed
  its extrude's distance" merges cleanly into an extrude without `sketch`
  and with the new distance, which the evaluator reports as
  `cad.reference.missing`. Where the merged result would hold a reference
  to a record that one side deleted (ours added an entity to a sketch that
  theirs deleted), the driver's integrity pass
  (`packages/core/src/document-merge.ts:379-405`) restores the deleted
  target from ours with a `deleted-in-theirs` conflict, or drops the
  referrer with a `deleted-in-ours` conflict when ours was the deleting
  side; it never leaves the dangling reference. Either way the result
  validates, and anything geometrically broken is visible as a status.
- Mesh payloads: an imported mesh is immutable content on one line; it
  changes only on re-import and is byte-stable because NMESH is canonical.
  Git stores it once and deltas whole objects [R-29]. Derived meshes are
  never committed in the slice. Phase 2 cache files are named by input key
  under one directory that can be ignored.
- Plain `git merge` without the driver still works line by line, because
  every record is one line with stable order.

### 7.5 Cooperative editing

- Ids are client-minted ULIDs (`packages/core/src/ids.ts:37-40`); no counter
  can collide.
- Each element is a Y.Map with field-granular writes
  (`packages/collab/src/ydoc.ts:120-138`, `packages/collab/src/diff.ts`).
  Concurrent edits of different fields commute; the same field is last
  writer wins; a coordinate pair or id list is one atomic field (fact 3), so
  it can never interleave into a four-number point.
- Concurrent delete and reference: add wins over delete at element level
  (`packages/collab/src/binding.ts:323-327`); otherwise the dependent
  feature shows `cad.reference.missing`, the outcome classified as a
  dependency conflict in [R-22] and handled by regeneration in [R-18].
- Concurrent reorder: one `index` wins; a tie sorts by id.
- Derived data is never synchronised; every peer regenerates. Statuses and
  camera are local. Large binary data stays out of the Y.Doc [R-34]; the
  inline cap bounds a mesh element at 1 MiB.
- Rule R is restored by the reconcile repair (section 4).

## 8. PCB interplay

First step (in the plan): `cad.pcb` references a `pcb.board` element on a PCB
page and produces a reference body.

- Outline: a new pure function `pcbBoardOutline(document, boardId)` chains
  the `Edge.Cuts` graphics (line, arc, circle, rect, polygon) of the board's
  page into closed loops with a 1 micrometre end point tolerance, the first
  code that does so (fact 9). Inner loops are cut-outs.
- Placement: X = x - minX, Y = maxY - y over the outline bounds, the mapping
  the Gerber export already uses (`packages/core/src/pcb-board/export.ts:328`),
  Z from 0 to `thickness` (`cad.pcb.thickness`, else board `thickness`, else
  1.6 mm).
- Liveness: the evaluation input includes the referenced PCB elements, so a
  board edit changes the content key and the board body regenerates.
- Use: the board is visible reference geometry, and its faces
  `<id>:start` and `<id>:end` accept sketches, so the pocket, standoffs and
  walls of an enclosure are sketched in board coordinates and extruded into
  the enclosure body. Features only use sketch profiles as tools in the
  slice, so the board solid itself cannot be subtracted from another body
  with a clearance; that needs a body-as-tool boolean feature (phase 2).
  Naming the board in `bodies` would modify the board body, which the
  evaluator refuses for reference bodies (`cad.body.reference`).

Realistic limits: no component bodies in the slice because the PCB model has
no height data (fact 9). Phase 2 adds a per-footprint height and keep-out
prisms from footprint bounds, drilled holes from pads and vias, and the
reverse direction (deriving `Edge.Cuts` from a CAD face).

## 9. Import and export

- STL export (binary) of the visible non-reference bodies, and STL import
  (binary and ASCII) into a `cad.mesh`, writer and reader in
  `packages/io/src/stl/`. NMESH codec in `packages/io/src/nmesh/`. Both
  modules import nothing from the rest of the repository and take plain
  typed arrays, so they can be extracted as libraries.
- Existing exports: `packages/core/src/svg-export/` draws a CAD page as an
  isometric wireframe of the feature tool solids (loops at both caps plus
  the connecting edges), computed without a kernel so the CLI produces the
  same output. It is labelled a construction view; a hidden-line view needs
  the phase 2 cache.
- Phase 2: STEP AP214 with a hand-written writer (planar faces merged per
  face name into `ADVANCED_FACE` on `PLANE`), 3MF through the existing
  stored-zip writer (`packages/core/src/zip.ts`).

## 10. CLI and MCP

Boa has no WebAssembly (fact 7) and is 40 to 100 times slower, so the CLI
never runs a kernel. It needs none for its job:

- Authoring: `edit` ops create and update `cad.*` elements; R and K are
  enforced by the shared command layer.
- `nodetto-cli cad check <file> [--page <id>]`: history order, reference,
  profile and limit statuses from the pure TypeScript layer (linear in the
  entity count, no per-point allocation in loops, no regex split, per
  `impl-plans/active/zorder-00-overview.md:60-62`), plus counts and the
  analytic bounding box of tool solids. Exit 0 clean, 1 with errors.
- `types`, `pages`, `inspect`, `validate`, `merge`, `diff` work unchanged on
  CAD records. `arrange` and `lint` exclude `cad3d`.
- MCP tools follow `COMMAND_HELP` automatically (`apps/cli/src/mcp.ts:78-110`).
- Phase 2: mesh export in the CLI from bundle cache entries.

## 11. Licensing and distribution

- New dependency: `manifold-3d` 3.5.5, Apache-2.0. Only two of its files
  are distributed: `manifold.js` (the Emscripten glue; it has no static
  import, only a guarded `import("node:module")` for Node) and
  `manifold.wasm`. The WASM contains Manifold and the libraries compiled
  into it; the binary's strings show Clipper2 (Boost Software Licence 1.0)
  and linalg (public domain / Unlicense); M5 confirms the list against the
  upstream source tree of the pinned tag, because the package README does
  not list them, and records it in `THIRD_PARTY_NOTICES.md` with the WASM
  SHA-256 and the Emscripten runtime components. The reviewed permissive
  terms include SunPro, which requires preservation of its notice, and
  Apache-2.0 WITH LLVM-exception, which grants additional permissions.
  Record permissive attribution or notice-preservation terms and continue.
  Stop and report copyleft or weak copyleft, usage restrictions such as
  non-commercial or field-of-use terms, advertising clauses, or any
  compiled component with an unidentified licence. This applies to
  desktop, Mac App Store and web SPA distribution. The CLI ships no
  kernel.
- Installed but not distributed: the package declares eleven hard
  dependencies for its optional `manifoldCAD` tooling (`@gltf-transform/*`,
  `@jscadui/3mf-export`, `commander`, `convert-source-map`,
  `fast-xml-parser`, `fflate`, `magic-string`, `@jridgewell/*`) and a peer
  `esbuild-wasm`; with their own dependencies about 60 packages are
  resolved (`tmp/cad3d-spike/bun.lock:115`), among them `sharp`
  (Apache-2.0) with a prebuilt `@img/sharp-libvips-*` binary
  (LGPL-3.0-or-later). The earlier statement "no runtime dependencies" was
  wrong. These packages enter `node_modules` and `bun.lock` only. The
  difference to the rejected Open CASCADE option is that the LGPL code
  there would be the shipped kernel; here nothing of that tree is imported
  or shipped. This is enforced, not assumed:
  - `packages/cad-kernel` imports the bare specifier `manifold-3d` only
    (never `manifold-3d/lib/*` or `manifold-3d/manifoldCAD`); a test checks
    every import specifier.
  - A bundle check script (`apps/desktop/scripts/cad-bundle-check.ts`)
    runs the Vite build through its JS API into a temporary directory with
    a plugin that records the module ids of every emitted chunk, and fails
    unless the only modules from `node_modules/manifold-3d` are
    `manifold.js` (plus the `manifold.wasm` asset, byte-identical to the
    package file) and no module id lies under any other package of the
    inventory. It inspects the module graph, not strings: the existing
    bundle already contains the word "sharp" (Lucide icon tags,
    `packages/core/src/icons/lucide-data.generated.ts`; the draw.io
    importer, `packages/io/src/drawio/import.ts:641`), so a string marker
    would fail on a correct build. The script is run by the M7 and M18
    verification commands and is not part of `bun test`, so `mise run
    test`, `verify` and `ci` keep working on a tree without `dist`
    (`dist/` is ignored, `.gitignore:8`). Its pure decision function is
    unit tested with synthetic module lists.
  - A test walks the packages reachable from `manifold-3d` in `bun.lock`
    through `dependencies`, `peerDependencies` and `optionalDependencies`
    (the libvips packages hang off `sharp` as optional dependencies,
    `tmp/cad3d-spike/bun.lock:23,131`)
    and compares their licence fields with a committed inventory
    (`packages/cad-kernel/licence-inventory.json`), so an update that
    changes the tree or a licence fails until it is reviewed. The inventory
    marks each package "distributed" (only `manifold-3d`) or "installed
    only".
- Bundle impact: 543 kB WASM (159 kB brotli) plus 82 kB JS glue, loaded
  lazily on the first CAD page; own renderer and CAD code are plain
  TypeScript.
- CSP: `script-src 'self' 'wasm-unsafe-eval'` is added to the production
  `csp`, and `'wasm-unsafe-eval'` is added to the existing `script-src` of
  `devCsp` (`apps/desktop/src-tauri/tauri.conf.json:25-26`); it permits WASM
  compilation only, not `eval`. Manifold 3.5.4 fixed its bindings for a CSP
  without `unsafe-eval` [R-4]. No JIT entitlement is needed because WASM
  runs in the WebKit content process.

## 12. Security

- STL: size cap 64 MiB before parsing; binary length must equal
  84 + 50 * count; ASCII tokens are bounded; at most 2,000,000 triangles;
  non-finite numbers rejected; result must fit the inline cap.
- NMESH: reader rules of 7.3; allocation bounded by input size.
- `cad.*` payloads: validated field by field in the registry; limits of 6.6
  stop pathological loops before tessellation.
- Kernel isolation: WASM in a worker, watchdog and restart (6.4); nothing
  from a document is evaluated as code.

## 13. Failure and recovery

| Failure | Behaviour |
| --- | --- |
| WASM fails to load (CSP, old WebKit) | Viewport message, feature list and inspector stay usable, document saves unchanged |
| Kernel trap or timeout | Worker restart, `cad.kernel.failed` on the running feature, retry on next edit |
| Feature error | Feature skipped, later features continue, badge in the feature list |
| Violating record in a file | Validation error naming the record; file not modified |
| Violating element or page kind from a non-conforming peer | Reconcile repair restores the kind or moves elements to a deterministic page; nothing is deleted |
| Corrupt mesh payload | `cad.mesh` reports `cad.mesh.invalid`; other bodies unaffected |

## 14. Performance budgets and measurement

| Budget | Value | Measured by |
| --- | --- | --- |
| Kernel load | under 100 ms warm (spike 10 to 30 ms) | M5 test log |
| Regenerate reference part (plate, 60 holes) | under 150 ms (spike 58 ms) | M5 timing test with a generous CI deadline of 2 s |
| Edit to display for the reference part | under 250 ms | M7 worker round trip test; browser check (M19, M18) |
| Camera frame at 200,000 triangles | under 16 ms | browser check (M18); enforced only on a hardware GL context, recorded otherwise |
| Pick at 200,000 triangles | under 50 ms | M8 unit test |
| 10,000 CAD records parse + serialize | under 1 s each (Bun); `validate` and `cad check` under 10 s each native | M17, M16 |
| NMESH decode of 128,008 vertices | under 50 ms (Bun) | M12 |
| `validate` of four maximum-size inline meshes | under 10 s native | M18 |

Real-host verification. Unit tests use a fake renderer and an in-process
worker host, so they cannot show that the viewport draws. Two checks close
that gap:

- Browser check, `apps/desktop/scripts/cad-viewport-check.mjs`, a
  verification command of M19 and M18. It builds a fixture page
  (`apps/desktop/scripts/fixtures/cad-viewport.html`) with Vite into
  `tmp/`, serves it from a local static server that sends the production
  CSP read from `tauri.conf.json` as a response header, drives headless
  Chrome over CDP as `erd-scale-check.mjs` does, and fails unless: the
  module worker starts and the WASM compiles under that CSP; both shader
  programs link; with the Plate document, pixels read back from the canvas
  differ from the background colour in the light and in the dark canvas
  mode and the two modes differ from each other; a parameter edit changes
  the rendered pixels. It records load, edit-to-display and frame times to
  `tmp/cad3d/<milestone>/viewport-check.json`.
- WKWebView check, `apps/desktop/scripts/cad-wkwebview-check.swift` (M18):
  loads the same served page in a `WKWebView` of the system WebKit, the
  engine the desktop app runs in, waits for the page's result object and
  exits non-zero unless the same functional assertions hold. Its output is
  recorded in `tmp/cad3d/m18/wkwebview.json` and summarised here.

Hosts not verified by this plan: WebKit on macOS 12 (the minimum the
macOS builds declare) and WebKitGTK, in which the Linux builds run
(`.github/workflows/linux.yml` builds deb and AppImage bundles). For both
the only protection is the runtime fallback of section 13: when the
worker, the WASM or WebGL2 is unavailable the viewport shows a message
and the document stays editable. `docs/cad3d.md` states this (M18).

No existing deadline is relaxed. Large-page rules of
`design-docs/specs/design-large-page-performance.md` are untouched because
CAD elements have no 2D bounds and the 2D canvas is not mounted on CAD pages.

## 15. Follow-up in the private nodetto-cloud repository (not done here)

Release order. Local-file documents need nothing from the cloud and ship
first. For cloud documents the public client keeps CAD page creation
switched off (section 5) until items 1 and 2 are deployed; enabling it is a
one-line change in `apps/desktop` made in the release that follows that
deployment.

1. Sync Worker: add `cad3d` to the page kind list and the `cad.*` types to
   the Yjs/IR parity test (`workers/sync/src/ydoc-ir.ts`, referenced at
   `packages/collab/src/ydoc.ts:14-18`); accept `createPage` with kind
   `cad3d`; pick up rules R and K through the updated core, and apply the
   same content repair to raw Yjs updates.
2. Refuse or warn clients older than the first CAD release when a document
   contains a `cad3d` page. Until then the client-side repair of section 4
   keeps such sessions convergent without losing data.
3. Hosted SPA: serve `manifold.wasm` with `application/wasm`, add
   `'wasm-unsafe-eval'` to its CSP, build the worker chunk, provide the
   `CadEngine` to the editor, add the licence notice.
4. Message size and storage review for `cad.mesh` payloads up to 1 MiB of
   base64 in one update (the repository notes a 1 MiB message class at
   `packages/ir/src/image.ts:1-5`); phase 2 attachment storage for `.nmesh`
   files and bundle cache entries.
5. Server-side thumbnails or previews of CAD pages, if wanted.

## 16. Compatibility and migration

No migration and no `SCHEMA_VERSION` change. Existing documents contain no
`cad3d` page and no `cad.*` type, so rule R cannot reject them (asserted over
all golden fixtures in M1). Existing page modes keep their palettes;
`canvas-background.test.ts` keeps passing because `cad3d` follows the diagram
canvas setting.

## 17. External sources

- [R-1] Open CASCADE licence exception and releases:
  https://raw.githubusercontent.com/Open-Cascade-SAS/OCCT/master/OCCT_LGPL_EXCEPTION.txt ,
  https://github.com/Open-Cascade-SAS/OCCT/releases
- [R-2] opencascade.js size and threading: https://ocjs.org/docs/getting-started/file-size ,
  https://ocjs.org/docs/advanced/multi-threading/intro
- [R-3] occt-wasm, brepjs, Replicad kernel package: https://github.com/andymai/occt-wasm ,
  https://github.com/andymai/brepjs , https://registry.npmjs.org/replicad-opencascadejs
- [R-4] Manifold: https://registry.npmjs.org/manifold-3d ,
  https://github.com/elalish/manifold/wiki/Manifold-Library , https://github.com/elalish/manifold
- [R-5] Rust kernels: https://github.com/ricosjp/truck , https://github.com/hannobraun/fornjot ,
  https://github.com/andymai/brepkit , https://docs.rs/crate/arris/latest
- [R-6] JSCAD: https://www.npmjs.com/package/@jscad/modeling
- [R-7] three.js size and WebGPU state: https://bundlephobia.com/package/three ,
  https://forum.babylonjs.com/t/introducing-babylon-lite/63648
- [R-8] STEP in TypeScript (stepts): https://registry.npmjs.org/stepts/latest ;
  3MF core spec: https://github.com/3MFConsortium/spec_core
- [R-9] planegcs: https://github.com/Salusoft89/planegcs ; Zoo solver:
  https://zoo.dev/blog/announcing-solver
- [R-10] FreeCAD topological naming: https://github.com/realthunder/FreeCAD_assembly3/wiki/Topological-Naming-Algorithm
- [R-11] Onshape FeatureScript queries: https://cad.onshape.com/FsDoc/library.html
- [R-12] Farjana and Han, "Mechanisms of persistent identification of
  topological entities in CAD systems: A review", Alexandria Engineering
  Journal 57(4), 2018: https://doaj.org/article/bf42fdae16584d0ba2d824137aba6599
- [R-13] Jones et al., "B-rep Matching for Collaborating Across CAD
  Systems", ACM TOG 42(4), 2023: https://dblp.uni-trier.de/rec/journals/tog/JonesNKBS23.html
- [R-14] Zoo KCL: https://zoo.dev/research/introducing-kcl ,
  https://docs.rs/kcl-lib/latest/src/kcl_lib/execution/cache.rs.html
- [R-15] Deng et al., "Untangling the Timeline", CHI 2026: https://arxiv.org/html/2602.09236v1 ;
  Cheng et al., CSCW 2023: https://arxiv.org/pdf/2307.02583
- [R-16] Fusion 360 Gallery reconstruction format:
  https://github.com/AutodeskAILab/Fusion360GalleryDataset/blob/master/docs/reconstruction.md
- [R-17] FreeCAD FCStd: https://wiki.freecad.org/File_Format_FCStd/en
- [R-18] Onshape collaboration and merging:
  https://www.onshape.com/en/blog/under-the-hood-how-collaboration-works ,
  https://cad.onshape.com/help/Content/Document/merging.htm
- [R-19] Hepworth, "Conflict Management and Model Consistency in Multi-user
  CAD", 2014: https://scholarsarchive.byu.edu/etd/5586
- [R-20] KiCad units and file format: https://docs.kicad.org/doxygen/base__units_8h_source.html ,
  https://dev-docs.kicad.org/en/file-formats/sexpr-intro/
- [R-21] WebAssembly nondeterminism and libm differences:
  https://github.com/WebAssembly/design/blob/master/Nondeterminism.md ,
  https://users.rust-lang.org/t/f64-ln-1p-platform-specific-behavior/77113
- [R-22] Lv, He et al., "A novel CRDT-based synchronization method for
  real-time collaborative CAD systems", Advanced Engineering Informatics,
  2018: https://www.sciencedirect.com/science/article/abs/pii/S147403461730486X
- [R-23] Kleppmann, "Moving Elements in List CRDTs", PaPoC 2020:
  https://www.cl.cam.ac.uk/research/dtg/www/files/publications/public/mk428/list-move-papoc20.pdf ;
  Yjs forum: https://discuss.yjs.dev/t/moving-elements-in-lists/92
- [R-24] Figma multiplayer: https://www.figma.com/blog/how-figmas-multiplayer-technology-works/
- [R-25] meshoptimizer and the glTF meshopt extensions: https://github.com/zeux/meshoptimizer ,
  https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Vendor/EXT_meshopt_compression/README.md ,
  https://gist.github.com/zeux/b48678a44944187c16f55ad6cca45e78
- [R-26] Draco: https://github.com/google/draco
- [R-27] KHR_mesh_quantization:
  https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_mesh_quantization/README.md
- [R-28] Index buffer compression (Stokes 2014):
  https://conorstokes.github.io/graphics/2014/09/30/better-vertex-cache-optimised-index-buffer-compression
- [R-29] Git attributes, pack heuristics, large binary practice:
  https://git-scm.com/docs/gitattributes , https://git-scm.com/docs/pack-heuristics ,
  https://studio.blender.org/blog/benchmarking-version-control-git-lfs-svn-mercurial/
- [R-30] Structured merge precedents: https://nbdime.readthedocs.io/en/latest/ ,
  https://docs.unity.com/en-us/engine/current/manual/get-started/project-configuration/version-control/smart-merge
- [R-31] Content-defined chunking and prolly trees:
  https://www.usenix.org/conference/atc16/technical-sessions/presentation/xia ,
  https://www.dolthub.com/blog/2024-03-03-prolly-trees/
- [R-32] Base64 and compression in browsers:
  https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array/fromBase64 ,
  https://developer.mozilla.org/en-US/docs/Web/API/CompressionStream/CompressionStream
- [R-33] Hash throughput and input-addressed caches: https://github.com/Daninet/hash-wasm
- [R-34] Yjs document growth, binary data, awareness: https://github.com/yjs/yjs/blob/main/README.md ,
  https://discuss.yjs.dev/t/syncing-binary-data/2047 , https://docs.yjs.dev/getting-started/adding-awareness
- [R-35] Reproducible archives and zip safety: https://reproducible-builds.org/docs/archives/ ,
  https://wiki.sei.cmu.edu/confluence/spaces/java/pages/88487470/IDS04-J.+Safely+extract+files+from+ZipInputStream

Content-defined chunking [R-31], LFS [R-29] and zip containers [R-35] were
evaluated and are not used in the slice: the only binary payload is an
immutable, canonical, size-capped inline mesh.

## 18. Risks

| Risk | Mitigation |
| --- | --- |
| Faceted geometry disappoints mechanical users | Stated scope; kernel port and kernel-independent format allow a B-rep kernel later |
| Provenance behaviour changes in a Manifold release | Version pinned exactly; M5 tests assert names through cut, add and intersect |
| WASM blocked by CSP in a host | Section 13 fallback; cloud follow-up item 3 |
| Inline meshes bloat documents | 1 MiB cap per element; attachments in phase 2 |
| Own renderer cost | Small fixed feature set; pure math tested; no dependency to track |
| Old clients in a shared session change a CAD page's kind or add shapes to it | Non-destructive reconcile repair (section 4); CAD creation off for cloud documents until cloud follow-up items 1 and 2 |
| The installed dependency tree of `manifold-3d` grows or changes licence | Licence inventory test and bundle marker test (section 11) |
| Viewport renders nothing although unit tests pass | Browser check and WKWebView check are verification commands (section 14) |

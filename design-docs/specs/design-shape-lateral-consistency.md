# Shape lateral consistency

Status: DESIGNED, 2026-10-29 (branch `fix/shape-lateral-consistency`, on top of
878f2cb "per-page editing modes, UML use-case shapes and a shape catalogue CLI")

## Overview

A user drew a person as a UML actor on an architecture page. Four gaps showed
up, and each one applies to every element type or shape, not just that one.

1. Unknown `semantic` keys are silently accepted. `uml.component` with
   `{"kind":"actor"}` validates and the key is ignored.
2. `shape.geo` has no stick figure. `person` is a head-and-shoulders bust.
3. draw.io `umlActor` is imported as an approximation of `person`, and some
   draw.io export mappings fall back to labelled rectangles.
4. `draw.path` only has closed contours, so a plain line has to be drawn as a
   thin filled shape.

This document fixes each gap for every type or shape it affects. It also
records the CLI, palette and docs changes. The use-case notation
(`usecase.node`, `usecase.relationship`, geo `package`) and the shape
catalogue (`packages/core/src/shape-catalogue.ts`, `nodetto-cli shapes|draw`)
from 878f2cb are the baseline and are not redesigned here.

No earlier design covers these topics. `design-cli-ai-drawing.md` describes
the CLI loop and is unchanged; this document only adds `edit` warning output
and `validate --strict` to it.

## 1. `semantic.unknownField` validation warning

### Rule

`validateDocument` (`packages/ir/src/validate.ts`, inside `validateElement`)
reports one issue for every key in an element's `semantic` payload that the
element type's registry `keyOrder` does not declare:

- severity `warning`, code `semantic.unknownField`;
- path `elements[<i>].semantic.<key>`, or a nested path such as
  `elements[<i>].semantic.columns[2].<key>`;
- message `unknown semantic field for <type>; preserved but ignored by this
  build`.

The check runs only when `getElementTypeDefinition(type)` returns a
definition, after `definition.validateSemantic`. Unregistered types such as
`future.widget` already get `type.unknown` and get no `semantic.unknownField`.
The check also runs only when `semantic` is a plain object. A non-object is
already an error from `checkObject`.

### Walk

`walkSemantic(value, order, path)`:

- Keys are enumerated with `Object.keys` (own enumerable string keys). A key
  is known when `order.keys.includes(key)`. This reports `__proto__`,
  `constructor` and `valueOf` own keys safely and never consults the
  prototype chain.
- A known key recurses only when `order.children` has an own entry for it
  (`Object.hasOwn(order.children, key)`):
  - plain object value: walk it with the child order;
  - array value: walk each item that is a plain object, with path suffix
    `[<index>]`, and skip non-object items (PCB `[x, y]` tuples, nested
    polygon arrays);
  - any other value: no recursion. Type errors belong to `validateSemantic`.
- A known key without a `children` entry is opaque and is never recursed
  (`group.fabricationLayer`, PCB `shape.justify`).

The helper lives in `validate.ts` next to the existing `warnUnknownFields`
and uses the same severity contract. The existing `field.unknown` code for
`visual` and `visual.style` is unchanged.

### Round trip and forward compatibility

- The JSONL reader does not move unknown `semantic` keys into `extensions`.
  They stay inline, and the serializer already writes undeclared keys after
  the declared ones in lexicographic order. Nothing about parsing or
  serialization changes, so unknown fields are preserved and documents stay
  byte-identical.
- The issue is never an error. `parseDocumentResult`, `assertValidDocument`,
  the editor, collaboration and every importer keep accepting such documents.
- `packages/io/src/__fixtures__/forward-compat.jsonl` deliberately carries
  unknown semantic keys on `n-known` (`node.generic`): `__proto__`,
  `constructor` and `futureSemantic`. For that element it must now report
  exactly those three `semantic.unknownField` warnings. `z-future`
  (`future.widget`) reports only `type.unknown`. This fixture is the one
  intended exception to the zero-warnings rule below.

### keyOrder audit

Acceptance rule: zero `semantic.unknownField` warnings for

- every golden fixture under `packages/io/src/__fixtures__/**` except
  `forward-compat.jsonl`;
- every document and every `add`/`connect` op semantic under `examples/**`
  (`*.jsonl`, `*.ops.json`);
- `ShapeUtil.defaultSemantic()` for every type in `createDefaultRegistry()`;
- every design template from `createDesignTemplate` (location:
  `packages/core/src/templates/design-templates.ts`);
- the BPMN XML importer output for every BPMN fixture under
  `packages/io/src/__fixtures__/bpmn`.

A static audit of all 68 registered types against their semantic TypeScript
interfaces, `validateSemantic` reads, defaults, fixtures, examples and
templates found these omissions. Each is fixed by adding the key to the
registry `keyOrder`, not by suppressing the warning:

| Type(s) | Missing key | Producer |
|---|---|---|
| `bpmn.boundaryEvent` | `parent` | `packages/io/src/bpmn/import.ts:644` |
| `bpmn.group` | `parent` | `packages/io/src/bpmn/import.ts:704` |
| `bpmn.gateway` | `gatewayDirection` | `packages/io/src/bpmn/import.ts:650` |
| `erd.view`, `erd.materialized-view`, `erd.function`, `erd.procedure` (`columns` children, `packages/ir/src/database-objects.ts`) | `autoIncrement`, `comment`, `defaultExpression`, `generatedExpression`, `identityGeneration`, `nullable`, `pk` | `ErdColumn` type (`packages/ir/src/semantics/erd.ts`) |

Byte-identity rule for keyOrder fixes: missing keys are appended at the end
of the existing `keys` list, in lexicographic order. That is exactly where
the serializer already writes undeclared keys, so every existing file
serializes unchanged. Only `keyOrder` changes. Semantic interfaces and
`validateSemantic` are not widened, except that the BPMN interfaces gain the
optional fields the importer already writes (`parent?: ElementId`,
`gatewayDirection?: string`), so the type matches the declared order.

New `draw.path` contour key `closed` (section 4) is added to its `keyOrder`
in the same change.

The static audit is backed by an automated test that walks every source
listed above and asserts zero `semantic.unknownField` issues, so a future
type or fixture cannot reintroduce the gap.

### CLI: `nodetto-cli edit`

`applyBatch` (`apps/cli/src/edit-command.ts`) records, for each operation
index, the ids of elements whose stored record that operation created or
replaced. After the batch it computes the `semantic.unknownField` issues
that are new compared with the input document, keyed by element id plus the
path relative to the element (`semantic.kind`). It then attributes each one
to the last operation that touched that element. Warnings that were already
in the input are not repeated.

- The batch still succeeds, writes the file and exits 0. Only `error`
  issues fail a batch, as today.
- Text output adds one line per warning after the created lines:
  `  warning operation <index> (<op>): <id> (<type>) semantic.kind: unknown
  semantic field for <type>; preserved but ignored by this build
  (semantic.unknownField)`.
- JSON output adds a top-level `warnings` array next to `written`,
  `operations`, `created` and `pages`. Each entry is `{ "operation": <index>,
  "op": "<op>", "element": "<id>", "type": "<type>", "path":
  "semantic.kind", "code": "semantic.unknownField", "message": "..." }`. The
  array is always present (empty when there are no warnings), so consumers
  can rely on the key. The MCP server returns the same stdout unchanged.

### CLI: `nodetto-cli validate`

`validate` already prints every parse and validation issue, including the
new warning, to stderr through `loadDocument`. It gains `--strict`: when the
document has at least one warning, it exits `3` (`EXIT_WARNINGS`) and stderr
ends with `<n> validation warning(s) with --strict.`. Without `--strict`
the exit code stays 0. Every other command that loads a document also shows
the new warning on stderr, the same way it already shows `type.unknown`.

## 2. Geo kind `actor` (stick figure)

- IR: `GEO_KINDS` (`packages/ir/src/semantics/drawing.ts`) gains `actor`
  after `package`. No schema migration is needed: older builds draw an
  unknown kind as a rectangle, per the existing forward-compatibility rule.
- Outline (`packages/core/src/shapes/geo-outline.ts`): `case "actor"`
  returns the existing `polygon` variant.
  - `points`: the head circle, sampled with the file's arc helper and
    centred horizontally at the top of the box.
  - `detail`: open polylines for the body (neck to hip), arms (one
    horizontal line at shoulder height) and legs (hip to both bottom
    corners).
  - Proportions follow the use-case actor notation in
    `packages/core/src/shapes/usecase.ts`: head radius about 0.11 of the
    height, shoulders at 0.36, hip at 0.64, feet at the bottom edge. Points
    honour `flip` like every other kind.
  - The figure fills the whole box. No label band is reserved.
- Rendering: the canvas (`GeoShapeView.tsx`) and SVG export
  (`svg-export/basic-shapes.ts`) already draw `polygon` plus an unfilled
  `detail` path, so the head takes the fill and the stroke and the limbs
  take the stroke only. PNG and PDF are rasterized from that SVG in both the
  app and the CLI, so they need no separate path.
- Label: the existing geo label rule applies unchanged (centred in the box,
  `boxLabelLayout` / `centredLabel`), the same as `person`.
- Picking, ports and connectors: `geoOutlinePolygon`
  (`packages/core/src/shapes/outline.ts`) returns `null` for `actor`. The
  shape's box is then its interaction region: hit test (`geo.ts` already
  falls back to `boxContains`), marquee overlap, connection points and
  connector boundary clipping. This matches draw.io's rectangular perimeter
  for `umlActor`. `edge.generic` connects like any boxed shape.
- Exports that need a region rather than a drawing follow from the `null`
  outline. Boolean operations reject it as an operand (`geo !== "rect"` with
  no outline already returns `null`). PCB copper export skips it with the
  existing skipped-element warning. In handoff code
  (`interface-code.ts` `outlineClipPath`), `actor` is excluded from
  clip-path tracing, like `rect`, `ellipse` and `cylinder`, so the box is
  never clipped to the head.
- Tool and catalogue: new `Tool.StickFigure = "geo:actor"` in
  `packages/core/src/tools.ts`. It is added to `GEO_TOOLS` after `Person`,
  to the geo kind map, and to the geo creation case, with a portrait default
  visual of `{ width: 60, height: 110 }`. The shape catalogue gets
  `[Tool.StickFigure, "Stick figure"]` in General after Person.
  `nodetto-cli shapes actor` then lists `geo:actor`, and `nodetto-cli draw
  <doc> geo:actor --label <text>` works with no CLI changes.
- Palette (`packages/ui-solid/src/shape-palette.ts`): a General tile `{ tool:
  Tool.StickFigure, label: "Stick figure", icon: "actor" }` after Person,
  reusing the existing `actor` icon path.
- D2 export: `actor` maps to D2 `person`, the same as `usecase.node` actor
  already does.
- `person` is unchanged.

## 3. draw.io mappings

### Import (`packages/io/src/drawio/style.ts`)

Import keeps its documented freeform model (geo shapes, text notes, frames
and generic connectors; see the `import.ts` header). A draw.io name maps
exactly when a native geo kind draws the same symbol.

| draw.io name | Before | After |
|---|---|---|
| `umlActor` | `person`, `approximate: true` | `actor`, exact (no warning) |
| `actor` | `person` | unchanged (`person` is the bust draw.io calls actor) |
| `folder` | `package` | unchanged, exact |
| `ext` | `rect`, approximate | unchanged: no native double-border shape |
| `mxgraph.basic.4_point_star_2`, `6_point_star`, `8_point_star` | `star`, approximate | unchanged: native `star` is five-pointed only |

### Export (`export-page.ts`, `export-shape-style.ts`)

| nodetto | draw.io style | Change |
|---|---|---|
| `shape.geo` `actor` | `shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top` plus `nodettoGeo=actor` | new |
| `shape.geo` `person` | `shape=actor` | unchanged |
| `shape.geo` `package` | `shape=folder` with tab size | unchanged |
| `usecase.node` `actor` / `usecase` / `system` | `umlActor` / `ellipse` / container rectangle | unchanged (878f2cb); now covered by a round-trip test |
| `uml.class`, `erd.table` | swimlane list | unchanged |
| `state.node` | ellipse / doubleEllipse / rhombus / rounded rect | unchanged |
| `uml.component` | `shape=component;align=left;spacingLeft=36` | new; was a labelled-rectangle fallback with a warning |
| `uml.interface` `provided` / `required` | `ellipse` / `shape=requiredInterface` | new; was the fallback |
| `uml.port` | `rounded=0` square | new; was the fallback |
| `sequence.participant`, `sequence.message` | skipped, "has no fixed geometry" | unchanged: lifeline geometry is derived by layout and has no fixed box |

Round trip: `nodettoGeo=actor` makes nodetto-to-draw.io-to-nodetto exact
for the geo actor. A `usecase.node` actor imports back as geo `actor` with
its name as the label. That is the exact symbol inside the freeform import
model, and it produces no warning.

### Tests (`packages/io/src/drawio/drawio.test.ts`)

- The palette fixture expectation changes from `"person", // UML actor,
  approximated` to `"actor"`, and the warning `Shape "umlActor" was
  approximated as a person shape.` is removed from the expected list.
- New: geo actor export contains `shape=umlActor` and re-imports as geo
  `actor` with no warnings.
- New: `usecase.jsonl` export contains `umlActor`, `ellipse` and
  `container=1`, and re-import yields geo `actor` with no approximation
  warning.
- New: `uml-component.jsonl` export contains `shape=component` and
  `ellipse`, and no longer contains the labelled-rectangle fallback warning
  for those types.

## 4. Open `draw.path` contours

### Data and validation

- `PathContour` gains `readonly closed?: boolean`. Absent or `true` means
  closed, which is today's behaviour. `false` means an open polyline or curve
  stroked with no fill.
- Contour `keyOrder` becomes `keys: ["points", "closed"]`.
- `DRAW_PATH.validateSemantic`: `closed` is an optional boolean. A closed
  contour still needs 3 or more points, with the unchanged message "a closed
  contour requires at least three points". An open contour needs 2 or more
  points, with the message "an open contour requires at least two points".
  The total point and contour limits are unchanged.
- Writers emit `closed: false` only for open contours and never add
  `closed: true`. Existing documents have no `closed` key, so they serialize
  byte-identically.

### Geometry (`packages/core/src/shapes/compound-path.ts`)

- `compoundPathGeometry` accepts a contour when it meets its own minimum (3
  closed, 2 open). It still returns `null` when any contour is below its
  minimum.
- `CompoundPathGeometry` gains `closed: readonly boolean[]`, parallel to
  `contours`.
- `path` holds only the closed contours (`strokePath(contour, true)`), so
  output is unchanged for all-closed paths. A new `openPath` holds only the
  open contours (`strokePath(contour, false)`) and is `""` when there are
  none.
- Bounds use every contour's samples, open ones included. The existing
  `Math.max(1, ...)` source extent keeps a straight horizontal or vertical
  line from collapsing to zero.

### Hit testing and selection

- Fill hit (winding) uses closed contours only.
- Stroke hit: every contour, using the existing tolerance `max(4 / zoom,
  strokeWidth / 2)`. Open contours are flattened with `flattenStroke(contour,
  false, ...)`, and their distance is measured along consecutive segments
  without the closing segment. Clicking the empty area between the ends of
  an open stroke does not select it.
- Selection box and marquee use `getBounds`. `elementOutlinePolygon`
  (`outline.ts`) returns `null` for a path whose single contour is open, so
  marquee overlap and connector clipping fall back to the bounds, the same as
  open freehand strokes.

### Rendering and export

- Canvas (`packages/ui-solid/src/shapes/CompoundPathView.tsx`): the
  closed-contour `<path>` renders exactly as today, and only when `path` is
  non-empty. When `openPath` is non-empty, a second `<path>` is drawn with
  `fill="none"`. Its stroke is `strokeGradient` when set, otherwise
  `style.stroke`, otherwise the default ink `#1d2a2e`. Stroke width, cap,
  join and dash come from the same `svgStyle` attributes.
- SVG export (`packages/core/src/svg-export/shapes.ts`): the same two-path
  rule. The open path is `fill="none"`, its stroke is `style.stroke` or else
  `theme.ink`, and it is passed through `styled()` for width, cap, join and
  dash. PNG and PDF follow from the SVG.
- Arrowheads on open paths are out of scope: plain stroke only.

### Other consumers

Each consumer that needs a filled region treats open contours explicitly:

- Point editing. The edit API today passes bare `FreehandPoint[][]` and
  rebuilds `{ points }` only, which would drop the flag. The contract below
  fixes that.
  - Contract (`packages/core/src/compound-path-edit.ts`): a new exported type
    `PathWorldContour = { readonly points: readonly FreehandPoint[];
    readonly closed: boolean }`.
    - `pathWorldContours(element)` returns `PathWorldContour[]`, with
      `closed` normalised from the semantic (`contour.closed !== false`).
    - `planPathWorldContours(element, contours: readonly PathWorldContour[])`
      accepts these objects. It writes `closed: false` only for contours
      whose `closed` is `false`, and never writes `closed: true`, so an
      edited closed contour is still `{ points }`.
    - The per-contour minimum is 2 points for an open contour and 3 for a
      closed one. The contour count (1 to 1024) and the total-points limit
      (20000) are unchanged.
    - The flag always travels inside its contour object. No caller recovers
      flags by index from the previous element.
  - `PathAnchorDrag` (`compound-path-edit.ts`): `active.contours` and the
    `preview` callback use `PathWorldContour[]`. A drag replaces only
    `points` of the dragged contour and copies `closed` unchanged.
  - `packages/ui-solid/src/CompoundPathHandles.tsx`: `preview` and `source`
    are `PathWorldContour[]`. The preview outline is
    `strokePath(contour.points, contour.closed)`, so an open contour shows no
    closing segment. Anchor and handle iteration goes over `contour.points`.
  - `packages/ui-solid/src/inspector/PathSection.tsx`:
    - `replacePoints` keeps the chosen contour's `closed`.
    - "Split segment after" calls
      `splitStrokeSegment(points, index, contour.closed)`, so an open
      contour cannot split after its last anchor (the helper already returns
      `null` there).
    - "Remove anchor" is disabled at the contour's own minimum: 2 or fewer
      points when open, 3 or fewer when closed.
    - "Add contour" appends a closed contour (`closed: true`, so no key is
      written), as today.
    - "Remove contour" filters whole `PathWorldContour` objects, so the
      removed contour's flag goes with it.
    - No open/closed toggle is added (see user-qa Q7).
  - Existing callers that only read points
    (`packages/core/src/compound-path.test.ts`) move to `.points`.
- Boolean operations (`boolean-operations.ts`): a `draw.path` with any open
  contour is not an operand (`null`), the same as open freehand strokes.
- PCB copper export (`pcb-export.ts` `pathContours`): open contours are
  ignored. A path with no closed contour is counted as skipped with the
  existing warning.
- Handoff CSS mask and Swift/Compose code (`handoff.ts`,
  `mobile-code/*-modifiers.ts`): these consume `geometry.path`, which now
  holds closed contours only, so open contours are omitted from generated
  code. This is documented as a limitation.

## 5. CLI discoverability and docs

- `apps/cli/src/types-command.ts`: `TYPICAL.architecture` becomes
  `[...GENERAL, "usecase.node", "usecase.relationship"]`. The overview text
  gains one footer line: `Run "nodetto-cli shapes <words>" for drawable
  shapes by shape ID, e.g. geo:actor (stick figure).`
- `apps/cli/src/help.ts`:
  - `validate` usage gains `[--strict]`, with one line on warnings including
    `semantic.unknownField`;
  - `edit` help describes the per-operation warnings and the JSON `warnings`
    array;
  - `draw` / `shapes` examples mention `geo:actor`.
- `docs/cli.md`: `validate --strict`, `edit` warning output (text and JSON),
  and the `geo:actor` drawing example.
- `docs/editing.md`, section "Shapes, arrowheads and connector styles": the
  Stick figure shape, open `draw.path` contours (`closed: false`), and the
  unknown semantic field warning.
- `docs/import-export.md`, section "draw.io import and export":
  - the mapping table gains an `actor` row (`umlActor`), and the `person` row
    drops `umlActor (approximated)`;
  - the approximation sentence no longer lists the UML stick-figure actor;
  - the export paragraph lists UML component, interface and port as native
    draw.io shapes.

## Verification

- `packages/ir/src/validate.test.ts`:
  - `uml.component` with `{ name, kind: "actor" }` gives exactly one
    `semantic.unknownField` at `elements[0].semantic.kind`;
  - the same check for `node.generic`, `erd.table` (nested `columns[0].x`),
    `shape.geo`, `usecase.node`, `state.node` and `draw.path` (nested
    `contours[0].x`);
  - `__proto__` and `constructor` own keys are reported;
  - `future.widget` gets no `semantic.unknownField`;
  - forward-compat expectations as stated in section 1.
- An audit test walks fixtures, examples, `defaultSemantic` for every
  registered util, design templates and BPMN import outputs, and asserts
  zero `semantic.unknownField`.
- `packages/ir/src/registry/drawing.test.ts`:
  - open contour with 2 points is valid;
  - open contour with 1 point is an error;
  - closed contour with 2 points still gives the closed-contour error.
- `packages/io`: round-trip tests show that `freeform.jsonl` and every
  fixture stay byte-identical, and that an open-contour path round-trips
  with `closed: false`.
- `packages/core`:
  - geo-outline tests for `actor` (head ring and limb detail inside the box,
    flip honoured, `geoOutlinePolygon` returns `null`);
  - SVG export snapshots for geo actor and open path (`fill="none"`);
  - compound-path bounds and hit tests (a point on the stroke hits, a point
    between the open ends misses);
  - `compound-path.test.ts`: a `PathAnchorDrag` on one anchor of a 2-point
    open contour applies a command, and the stored contour still has
    `closed: false` with 2 points;
  - removing contour 0 from `[closed, open]` through `planPathWorldContours`
    leaves one contour with `closed: false`;
  - editing a closed contour writes no `closed` key;
  - a 1-point open contour or a 2-point closed contour yields no command;
  - shape catalogue contains `geo:actor`.
- `apps/cli/src`:
  - `edit` adds `uml.component` with an unknown field and succeeds; text and
    JSON warnings name `semantic.kind` and operation 0;
  - `validate --strict` exits 3;
  - `shapes actor` lists `geo:actor`;
  - `draw <doc> geo:actor --label Visitor` plus an `edge.generic` connect
    succeeds;
  - `types --kind architecture` lists `usecase.node`.
- Commands:
  - `bunx tsc -p tsconfig.json --noEmit`
  - `bunx biome check <changed files>`
  - `BUN_OPTIONS=--jsx-runtime=classic bun test packages/ir packages/core
    packages/io apps/cli/src`
  - `mise run verify`

## Rollout constraints

- No schema version bump: every change is additive (an optional key, a new
  enum value, a warning).
- Existing JSONL stays byte-identical. Closed contours, `person`, and every
  existing draw.io mapping not listed as changed render and export as
  before.
- Open questions are recorded in `design-docs/user-qa/shape-lateral-consistency.md`.
  None of them block implementation; each has a default decision recorded
  above.

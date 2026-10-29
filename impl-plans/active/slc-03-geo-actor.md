# slc-03-geo-actor

- planId: slc-03-geo-actor
- planPath: impl-plans/active/slc-03-geo-actor.md
- wave: 2; dependsOn: slc-01-ir-drawing-contract
- design: section 2 (geo kind `actor`)
- progress log: impl-plans/progress/slc-03-geo-actor.md
- scratch and logs: tmp/shape-lateral-s544/slc-03-geo-actor/

## Intent

Draw `shape.geo` `geo: "actor"` as a UML stick figure: a head circle plus
body, arm and leg strokes. It works on every page. The canvas, SVG, PNG and
PDF exports use the shared geo outline. Users find it as the General
palette tile "Stick figure", the catalogue shape ID `geo:actor`, and the
inspector kind label "Stick figure". D2 export maps it to `person`.

From slc-01, the box is already its picking, port and connector region
(`geoOutlinePolygon("actor")` returns `null`).

## Repository context

- `packages/core/src/shapes/geo-outline.ts`:
  - `geoOutline(kind, width, height, flip)` switch, with the `case
    "person"` and `case "package"` examples near the end;
  - the `polygon(points, detail)` local helper applies `flip` to points and
    detail;
  - helpers `arcPoints` (line ~173), `ellipseRing` (~189), `round`;
  - coordinates are inset by 1 unit.
- Use-case actor proportions to imitate:
  `packages/core/src/shapes/usecase.ts:useCaseNodeNotation`, the `actor`
  branch. Head radius ~0.11 of the figure height, shoulders at 0.36, hip at
  0.64, feet at the bottom.
- Canvas (`packages/ui-solid/src/shapes/GeoShapeView.tsx`) and SVG
  (`packages/core/src/svg-export/basic-shapes.ts:renderGeo`) already render
  `polygon` plus an unfilled `detail`. Do not edit them.
- `packages/core/src/interface-code.ts:226`: the
  `geo !== "rect" && geo !== "ellipse" && geo !== "cylinder"` clip-path
  exclusion.
- `packages/core/src/tools.ts`:
  - the `Tool` object (`Person: "geo:person"` at ~165);
  - `GEO_TOOLS` (~211);
  - the geo kind map (~456, `satisfies Record<(typeof GEO_TOOLS)[number],
    GeoKind>`);
  - `creationFor(tool)` geo case (~712) returns `{ type: "shape.geo",
    semantic: { geo, label: "" } }`;
  - other cases add `visual: { width, height }`, for example ~547.
- `packages/core/src/shape-catalogue.ts:73`: `[Tool.Person, "Person"]`.
- `packages/ui-solid/src/shape-palette.ts:129`: the General item `{ tool:
  Tool.Person, label: "Person", icon: "person" }`. Icon `actor` already
  exists at line 69.
- `packages/ui-solid/src/inspector/ShapeSections.tsx:30`: `GEO_LABELS`.
- `packages/io/src/d2/export.ts:218`: the geo-to-D2 map (`person:
  "person"`).

## File-level changes

1. `geo-outline.ts`: add `case "actor"`, returning `polygon(headRing,
   [body, arms, leftLeg, rightLeg])`.
   - Work in the inset box: `left = 1`, `top = 1`, `w = width - 2`,
     `h = height - 2`.
   - `r = max(1, min(h * 0.11, w / 4))`; head centre `(width / 2,
     top + r)`.
   - Head ring: about 24 points from `arcPoints` over a full turn (or an
     equivalent helper).
   - `neck = top + 2r`, shoulders `top + h * 0.36`, hip `top + h * 0.64`,
     feet `top + h`.
   - `reach = max(1, min(w / 2, h * 0.25))`.
   - Body: a polyline from the neck to the hip. Arms: one line at shoulder
     height from `cx - reach` to `cx + reach`. Legs: from the hip to
     `(cx - reach, feet)` and to `(cx + reach, feet)`.
   - Round every coordinate with `round`. All points must stay inside
     `[1, width - 1] x [1, height - 1]`.
   - Add a one-line comment: UML stick figure; picked and connected by its
     box.
2. `interface-code.ts`: add `&& geo !== "actor"` to the exclusion at ~226,
   so the handoff box is never clipped to the head.
3. `tools.ts`:
   - `StickFigure: "geo:actor"` right after `Person`;
   - `Tool.StickFigure` in `GEO_TOOLS` after `Tool.Person`;
   - `[Tool.StickFigure]: "actor"` in the geo kind map;
   - in `creationFor`, a dedicated `case Tool.StickFigure:` returning
     `{ type: "shape.geo", semantic: { geo: "actor", label: "" }, visual: {
     width: 60, height: 110 } }`. Do not add it to the shared geo
     fall-through case, which has no visual.
4. `shape-catalogue.ts`: `[Tool.StickFigure, "Stick figure"]` right after
   the Person entry.
5. `shape-palette.ts`: `{ tool: Tool.StickFigure, label: "Stick figure",
   icon: "actor" }` right after the Person item. Do not add it to the
   `usecase` mode list.
6. `ShapeSections.tsx`: `GEO_LABELS.actor = "Stick figure"`.
7. `d2/export.ts`: `actor: "person"` next to `person`.
8. Tests (below) in `packages/core/src/geo-actor.test.ts` (new), one added
   test in `packages/ui-solid/src/workspaces.test.ts`, and one added test in
   `packages/io/src/d2/export.test.ts`.

## Pitfalls and what not to do

- Do not add a new `GeoOutline` variant. Reuse `polygon` plus `detail`.
- Do not edit `geo.ts`. Its hit test already falls back to `boxContains`
  when `geoOutlinePolygon` returns `null` (slc-01).
- Do not edit `outline.ts`; slc-01 owns it.
- Do not edit `GeoShapeView.tsx` or `basic-shapes.ts`.
- `person` must stay byte-identical. Do not touch `personPoints`.
- Do not touch draw.io files; slc-05 owns them.
- The existing loop tests (`svg-export.test.ts` expects `<polygon` for every
  kind without an explicit entry; `geo-outline.test.ts` "every polygon kind
  stays inside the one-unit inset box") must pass for `actor` with no edits
  to those test files.

## Tests

`geo-actor.test.ts`:

- `geoOutline("actor", 60, 110)` -> `kind: "polygon"`, at least 12 head
  points, a non-empty `detail` starting with `M`. All head and detail
  coordinates are within `[1, 59] x [1, 109]`.
- `geoOutline("actor", 60, 110, { x: true })` -> mirrored points (the first
  head x becomes `60 - x`).
- An Editor `shape.geo` actor at `(100, 100, 60, 110)`: a point inside the
  box but outside the head and limbs, for example `(105, 200)`, hits; a
  point outside the box misses.
- `connectionPorts` (pattern from
  `packages/core/src/shapes/connection-points.test.ts`) returns the
  standard port ids, each on the box edge.
- `exportPageSvg` (or the svg-export helper used in `svg-export.test.ts`)
  for an actor contains `<polygon` and a `<path` with `fill="none"`, plus
  the label text when the label is set.
- Shape catalogue: an entry with shape ID `geo:actor`, label `Stick figure`
  and category General.
- `creationFor(Tool.StickFigure)` -> `type: "shape.geo"`, `geo: "actor"`,
  `visual` `60 x 110`.
- Interface-code output for an actor contains no `clip-path`.

`workspaces.test.ts`: the General group of `shapePaletteGroups("flow")`
contains `Tool.StickFigure`, and its item label is `Stick figure`.

`d2/export.test.ts`: a page with a geo actor exports `shape: person`.

## Verification

```
mkdir -p tmp/shape-lateral-s544/slc-03-geo-actor
BUN_OPTIONS=--jsx-runtime=classic bun test packages/core/src/geo-actor.test.ts packages/core/src/shapes/geo-outline.test.ts packages/core/src/svg-export.test.ts packages/core/src/shapes/connection-points.test.ts packages/core/src/shape-catalogue.test.ts packages/core/src/interface-code.test.ts > tmp/shape-lateral-s544/slc-03-geo-actor/core.log 2>&1; echo "exit=$?"
BUN_OPTIONS=--jsx-runtime=classic bun test packages/ui-solid/src/workspaces.test.ts > tmp/shape-lateral-s544/slc-03-geo-actor/ui.log 2>&1; echo "exit=$?"
BUN_OPTIONS=--jsx-runtime=classic bun test packages/io/src/d2 > tmp/shape-lateral-s544/slc-03-geo-actor/d2.log 2>&1; echo "exit=$?"
bunx tsc -p tsconfig.json --noEmit > tmp/shape-lateral-s544/slc-03-geo-actor/tsc.log 2>&1; echo "exit=$?"
bunx biome check packages/core/src/shapes/geo-outline.ts packages/core/src/interface-code.ts packages/core/src/tools.ts packages/core/src/shape-catalogue.ts packages/core/src/geo-actor.test.ts packages/ui-solid/src/shape-palette.ts packages/ui-solid/src/inspector/ShapeSections.tsx packages/ui-solid/src/workspaces.test.ts packages/io/src/d2/export.ts packages/io/src/d2/export.test.ts
grep -c 'StickFigure: "geo:actor"' packages/core/src/tools.ts
```

Expected:

- all test commands exit 0;
- tsc exits 0 (rule 8 gate: siblings slc-04 and slc-05);
- biome exits 0;
- the grep prints `1`.

## Done criteria

- The commands above are logged with exit codes.
- The rule-9 transient failures (`svg-export.test.ts`,
  `geo-outline.test.ts` for `actor`) now pass.
- The last line of the progress log is `STATUS: done`.

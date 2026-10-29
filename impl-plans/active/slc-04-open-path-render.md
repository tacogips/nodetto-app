# slc-04-open-path-render

- planId: slc-04-open-path-render
- planPath: impl-plans/active/slc-04-open-path-render.md
- wave: 2; dependsOn: slc-01-ir-drawing-contract
- design: section 4 (Geometry, Hit testing and selection, Rendering and
  export, and Other consumers except point editing)
- progress log: impl-plans/progress/slc-04-open-path-render.md
- scratch and logs: tmp/shape-lateral-s544/slc-04-open-path-render/

## Intent

Give a `draw.path` contour with `closed: false` (2 or more points) these
behaviours:

- it draws as an unfilled stroke on the canvas and in SVG (and so PNG/PDF)
  export;
- it has correct bounds;
- it hit-tests along the stroke only, never between its open ends.

Consumers that need a filled region skip open contours. Closed contours
render byte-identically to today. Point editing is slc-06; do not touch
`compound-path-edit.ts`.

## Repository context

- `packages/core/src/shapes/compound-path.ts`:
  - `compoundPathGeometry(element)` returns `null` if any contour has fewer
    than 3 points; it builds `path` with `strokePath(contour, true)`;
  - `compoundPathMaskCss`;
  - `compoundPathShapeUtil.hitTest` (winding fill test plus stroke distance
    with `contour[(index + 1) % contour.length]`).
- `packages/core/src/stroke-path.ts:strokePath(points, closed = false)` and
  `flattenStroke(points, closed, tolerance)`.
- `packages/core/src/svg-export/shapes.ts:renderShape`, `case
  "draw.path"`: one `tag("path", styled({...}, visual, id))`.
- `packages/core/src/svg-export/paint.ts:styled`: sets `fill` from
  `style.fill` and `stroke` from `style.stroke`. To force no fill, set
  `fill: "none"` after the spread, as
  `packages/core/src/svg-export/basic-shapes.ts:renderGeo` does for
  `detail`.
- `packages/ui-solid/src/shapes/CompoundPathView.tsx`: one `<path>` with
  fill and stroke attributes, then `{...svgStyle(...)}`.
  `packages/ui-solid/src/shapes/visual.ts:svgStyle` also returns `fill`, so
  an open path must set `fill="none"` after the spread or via
  `style={{ fill: "none" }}`. The inline-style idiom is in
  `GeoShapeView.tsx` (the detail path).
- `packages/core/src/boolean-operations.ts`:
  - ~87-90 `draw.path` operand check;
  - `pathSourceMultiPolygon` (~483);
  - precedent: open freehand returns `null` (~83-85).
- `packages/core/src/pcb-export.ts:pathContours` (~113-157) skips contours
  under 3 points.
- `packages/core/src/mobile-code/swift-modifiers.ts:swiftCompoundPath`
  (~185) and `compose-modifiers.ts:composeCompoundPath` (~177) loop over
  `geometry.contours` and close every contour.

## File-level changes

1. `compound-path.ts`:
   - `CompoundPathGeometry` gains `readonly closed: readonly boolean[]` and
     `readonly openPath: string`.
   - Each contour's flag is `contour.closed !== false`.
   - Validity: return `null` when any contour has fewer than its minimum
     (3 closed, 2 open), or when there are no contours.
   - Bounds use samples from every contour, as now.
   - `path` = closed contours only (`strokePath(points, true)`) joined by
     `" "`. `openPath` = open contours only (`strokePath(points, false)`),
     `""` when there are none.
   - For an all-closed path, `path` must be byte-identical to today.
   - `compoundPathMaskCss`: return `undefined` when `geometry.path` is
     `""`.
   - `hitTest`:
     - the winding/fill test iterates closed contours only;
     - the stroke test covers all contours, flattened with their own
       closed flag;
     - for open contours, skip the wrap-around segment from the last point
       back to the first;
     - the tolerance formula is unchanged.
   - `getBounds` is unchanged.
2. `svg-export/shapes.ts`, `case "draw.path"`:
   - emit the existing closed `<path>` only when `geometry.path !== ""`,
     with identical attributes;
   - when `geometry.openPath !== ""`, also emit
     `tag("path", { ...styled({ d: openPath, transform, fill: "none",
     stroke: theme.ink }, visual, id), fill: "none" })`;
   - concatenate closed path then open path.
3. `CompoundPathView.tsx`:
   - render the existing `<path>` only when `geometry().path` is non-empty;
   - when `geometry().openPath` is non-empty, render a second `<path>`
     with `d={openPath}`. Its stroke is the stroke gradient url when set,
     else `style.stroke ?? "#1d2a2e"`. Spread `svgStyle(...)`, then force
     fill none via `style={{ fill: "none" }}`.
   - The `<title>` is unchanged.
4. `boolean-operations.ts`:
   - in the operand check, return `null` for a `draw.path` whose
     `semantic.contours` has any `closed === false`;
   - in `pathSourceMultiPolygon`, return `null` when
     `geometry.closed.some((flag) => !flag)`.
5. `pcb-export.ts:pathContours`: skip contours with `closed === false`.
   Bounds sampling stays over all contours, to match the renderer's box.
6. `swift-modifiers.ts`, `compose-modifiers.ts`: iterate only contours whose
   `geometry.closed[index]` is true. When none remain, return the existing
   empty placeholder (`"EmptyView()"`, or `"Spacer(modifier = Modifier)"`).
7. `packages/core/src/open-path.test.ts` (new): tests below.

## Pitfalls and what not to do

- Never fill an open contour. SVG implicitly closes subpaths for fill, which
  is why open contours go in a separate path element.
- Do not change the closed-contour attribute order or values in SVG export.
  Existing snapshots in `svg-export.test.ts` and `compound-path.test.ts`
  must pass unchanged.
- Do not change the type of `contours` in `CompoundPathGeometry`.
  `outline.ts` and the edit code read it.
- Do not edit `compound-path-edit.ts`, `index.ts`, `PathSection.tsx` or
  `CompoundPathHandles.tsx`; slc-06 owns them.
- No arrowheads and no new style keys.

## Tests (`open-path.test.ts`)

Build elements with `new Editor()` and `createElement("draw.path", ...)`
with explicit visual boxes.

- Geometry:
  - open 2-point contour `(0,0)-(100,0)` -> geometry non-null,
    `closed: [false]`, `path === ""`, `openPath` starts with `M`;
  - box height falls back to `max(1, ...)` and is not 0.
- Mixed `[closed triangle, open polyline]` -> `closed: [true, false]`;
  `path` equals the geometry of the triangle alone; `openPath` is
  non-empty.
- Rejection:
  - open contour with 1 point -> `null`;
  - closed with 2 points -> `null`.
- Hit tests:
  - a point on the open stroke hits;
  - a point 30 units away from the stroke but inside the bounds misses;
  - for a 3-point open "V", the midpoint between its two open ends misses,
    even with a fill style set.
- SVG export of an open path -> contains `fill="none"` and
  `stroke="<theme ink or style.stroke>"`, with no filled path.
- SVG export of the existing freeform fixture path (closed) -> identical
  output before and after. Assert it against an expected string captured
  from HEAD in the test, or rely on the existing `svg-export.test.ts`
  snapshots.
- A Boolean operation with an open path operand -> no result or
  unavailable, matching the open-freehand precedent.
- PCB export area list ignores an open contour; an all-open path is
  skipped.
- Swift and Compose code for an all-open path -> the empty placeholder.

## Verification

```
mkdir -p tmp/shape-lateral-s544/slc-04-open-path-render
BUN_OPTIONS=--jsx-runtime=classic bun test packages/core/src/open-path.test.ts packages/core/src/compound-path.test.ts packages/core/src/svg-export.test.ts > tmp/shape-lateral-s544/slc-04-open-path-render/core.log 2>&1; echo "exit=$?"
BUN_OPTIONS=--jsx-runtime=classic bun test packages/core > tmp/shape-lateral-s544/slc-04-open-path-render/core-all.log 2>&1; echo "exit=$?"
BUN_OPTIONS=--jsx-runtime=classic bun test packages/ui-solid > tmp/shape-lateral-s544/slc-04-open-path-render/ui.log 2>&1; echo "exit=$?"
bunx tsc -p tsconfig.json --noEmit > tmp/shape-lateral-s544/slc-04-open-path-render/tsc.log 2>&1; echo "exit=$?"
bunx biome check packages/core/src/shapes/compound-path.ts packages/core/src/svg-export/shapes.ts packages/core/src/boolean-operations.ts packages/core/src/pcb-export.ts packages/core/src/mobile-code/swift-modifiers.ts packages/core/src/mobile-code/compose-modifiers.ts packages/ui-solid/src/shapes/CompoundPathView.tsx packages/core/src/open-path.test.ts
```

Expected:

- the first command exits 0;
- `core-all`, `ui` and `tsc` exit 0. They are shared-input gates (rule 8,
  siblings slc-03 and slc-05); otherwise record them as `pending-join`;
- biome exits 0.

## Done criteria

- All commands are logged with exit codes.
- `compound-path.test.ts` passes unchanged. This plan does not edit it.
- The last line is `STATUS: done`.

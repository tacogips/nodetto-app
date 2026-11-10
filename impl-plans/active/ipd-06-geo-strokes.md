# ipd-06-geo-strokes

- planId: ipd-06-geo-strokes
- planPath: impl-plans/active/ipd-06-geo-strokes.md
- progressPath: impl-plans/progress/ipd-06-geo-strokes.md
- wave: 3. dependsOn: ipd-01-ir-schema
- Design (binding): `design-docs/specs/design-iphone-app-design.md`, Decision 3 (3.1 thin rects D4, 3.2 `strokeAlign`, 3.3 `strokeSides`) and Decision 1.6 (geo label `textPadding`, part of D5).
- Evidence: `tmp/ipd-s772/ipd-06-geo-strokes/`.
<!-- ownership:start -->
- writePaths:
  - `packages/core/src/shapes/geo-outline.ts`
  - `packages/core/src/svg-export/rect-strokes.ts`
  - `packages/core/src/svg-export/basic-shapes.ts`
  - `packages/core/src/svg-export/paint.ts`
  - `packages/core/src/label-layout.ts`
  - `packages/core/src/geo-strokes.test.ts`
  - `apps/cli/src/thin-rect-export.test.ts`
  - `packages/ui-solid/src/shapes/GeoShapeView.tsx`
  - `packages/ui-solid/src/shapes/RectStrokes.tsx`
  - `packages/ui-solid/src/shapes/label-align-style.ts`
  - `packages/ui-solid/src/shapes/rect-strokes-view.test.ts`
  - `impl-plans/progress/ipd-06-geo-strokes.md`
  - `tmp/ipd-s772/ipd-06-geo-strokes`
- sharedPaths:
  - `packages/core/src/index.ts`
- sharedPathNotes:
  - path: `packages/core/src/index.ts`; intendedEdit: append export lines only; re-read immediately before writing; never reorder or remove lines; verify sibling plans' new lines survive after writing
- artifactRoots:
  - `tmp/ipd-s772/ipd-06-geo-strokes`
<!-- ownership:end -->

## Intent and context

D4: `packages/core/src/shapes/geo-outline.ts:274-283` (`rectOutline`) insets every rect by 1 unit per side. A 1-2 unit divider therefore becomes a zero-size rect and disappears in the SVG, the PNG and the canvas.

App designs also need Figma-style stroke alignment and per-side borders. An example is a card with a thick left accent border that follows the rounded corner.

D5 (part): geo labels always inset 8 units, ignoring `visual.textPadding`.

This plan fixes all three:

- for `shape.geo` rects in core SVG export and in the ui-solid canvas;
- with a shared geometry helper that `ipd-11` (frames) and `ipd-12` (controls) reuse.

## Non-goals

- Frames and `ui.control` stroke rendering are adopted by `ipd-11`/`ipd-12` through the helper. Do not edit their renderers here.
- No change to non-rect geo kinds, other than the label padding.
- No change to output when neither `strokeAlign` nor `strokeSides` is set and the rect is at least 3×3. That output must be byte-identical.

## File-level changes

`packages/core/src/shapes/geo-outline.ts`, `rectOutline`: apply the 1-unit inset only when `width >= 3 && height >= 3`. Otherwise use the exact box (inset 0). This is shared by the SVG and canvas (`GeoShapeView.tsx:54`).

New `packages/core/src/svg-export/rect-strokes.ts`, pure geometry plus markup:

- `export interface RectStrokeParts`, with fields:
  - `readonly fillBox: Box`
  - `readonly strokeBox?: Box`: the uniform stroke path box, after alignment offset.
  - `readonly strokeWidth: number`
  - `readonly strips: readonly Box[]`: per-side border strips, in top, right, bottom, left order.
  - `readonly clipBox: Box`: the outline the strips are clipped to.
  - `readonly radii: CornerRadii`: the resolved radii, from `packages/core/src/corner-radii.ts`.
- `export function rectStrokeParts(box: Box, style: VisualStyle | undefined): RectStrokeParts | undefined`
  - Returns undefined unless `style.strokeAlign !== undefined || style.strokeSides !== undefined`, meaning the legacy path stays.
  - `strokeAlign`: `inside` -> `strokeBox` inset by `sw/2`; `center` -> the box; `outside` -> outset by `sw/2`. `fillBox` is always the exact box.
  - `strokeSides` present -> no `strokeBox`. Strips have each side's width; a missing side is 0, and 0-width strips are omitted. Alignment defaults to inside:
    - inside top strip `{x, y, width, height: top}`;
    - outside top strip `{x, y: y - top, width, height: top}`;
    - center halves it.
  - `clipBox` is the exact box for inside and center, and the box outset by the maximum side width for outside.
- `export function rectStrokeMarkup(parts: RectStrokeParts, paint: { fill?: string; stroke?: string; opacity?: number }, clipId: string): string`
  - Emits the fill rect with radii, then either the stroke rect or `<clipPath id=clipId>` plus the strips.
  - Use `tag`, `wrap` and `fmt` from `markup.ts`.
  - Rounded radii use the existing rounded-rect path helper used for `cornerRadii` in `svg-export/basic-shapes.ts`. Find it and reuse it; do not write a new arc routine.
- The `clipId` is derived by the caller from the element id (for example `nd-strokes-<elementId>`) so the output is deterministic.

`packages/core/src/svg-export/basic-shapes.ts`, geo rect painting: when `rectStrokeParts` returns parts and `geo === "rect"`, paint through `rectStrokeMarkup`. Otherwise keep the existing code path untouched.

`packages/core/src/label-layout.ts`, `boxLabelLayout`: use `visual.textPadding` when it is a finite number >= 0 as the horizontal inset per side (wrap width `box.width - 2 * pad`). Otherwise keep the existing 8, so the default is unchanged.

`packages/core/src/svg-export/paint.ts`, `centredLabel` (`:237-286`): start/end x uses the same padding, `visual.textPadding ?? TEXT_PADDING`.

`packages/ui-solid/src/shapes/GeoShapeView.tsx`: render the parts from `rectStrokeParts`, as SVG elements with the same geometry, when they are present. Put that in the new `packages/ui-solid/src/shapes/RectStrokes.tsx` component, which `ipd-11` and `ipd-12` will reuse:

- `export function RectStrokes(props: { box: Box; style: VisualStyle | undefined; clipId: string; fill?: string; stroke?: string })`

`packages/ui-solid/src/shapes/label-align-style.ts`: the canvas label padding honors `visual.textPadding`, matching the export. This replaces the fixed `padding: 0 8px` from `apps/desktop/src/styles/canvas.css:237` with an inline style only when `textPadding` is set.

`packages/core/src/index.ts` (sharedPaths, append-only): export `rectStrokeParts`, `rectStrokeMarkup`, `RectStrokeParts`.

## Patterns to imitate

- The `cornerRadii` handling in `svg-export/basic-shapes.ts` and `corner-radii.ts:resolvedCornerRadii`.
- `packages/ui-solid/src/shapes/GeoShapeView.tsx` for SolidJS SVG elements.

## Pitfalls

- Do not change the inset for rects of size 3 or more. Golden SVG fixtures depend on it.
- `rx`/`ry` must not exceed half the side. SVG clamps, but compute it explicitly so the canvas and resvg agree.
- With strips, do not also draw the uniform stroke.
- Clip paths need ids unique per element. Duplicate ids across elements would break the export.
- Do not touch `apps/desktop/src/styles/canvas.css`; the inline override is enough.

## Tests

New `packages/core/src/geo-strokes.test.ts`:

- `rectOutline` for heights 0.5, 1, 2 and 2.9 (width 100) -> height equals the input, and y equals the box y.
- Height 3 -> the legacy inset (height 1).
- A 100×40 rect without the new fields keeps the legacy geometry: the outline is `x+1`, `y+1`, width 98, height 38, with the legacy radius. Assert these values explicitly. Byte-identity of the legacy output is also covered by the existing `packages/core/src/svg-export.test.ts`, `apps/cli/src/export-determinism.test.ts` and `apps/cli/src/export-paint-order.test.ts`, which must pass unchanged.
- `strokeAlign: "inside"`, `strokeWidth: 4` -> the stroke rect inset by 2.
- `outside` -> outset by 2.
- `strokeSides: {left: 4}` with `cornerRadius: 12` -> markup contains `clipPath` and one strip of width 4, and no uniform stroke.
- `textPadding: 0` on a geo label -> wrap width equals the box width. Omitted -> width - 16.

New `apps/cli/src/thin-rect-export.test.ts`:

- Export an SVG with a 200×1 rect, fill `#000000`, at y=10 on a white background, through the core page export.
- Rasterize with `@resvg/resvg-js` at zoom 2, as in `apps/cli/src/raster-backend.ts`. Use `render().pixels` to read RGBA.
- Expected: the pixel rows for page y 10-11 (image rows 20-21, after export padding offset) are dark at x center, and the rows above and below are white.

New `packages/ui-solid/src/shapes/rect-strokes-view.test.ts`: `RectStrokes` renders strips and a clipPath for `strokeSides`, imitating `packages/ui-solid/src/text-note-view.test.ts` rendering setup.

## Verification (evidence in `final/`)

1. `bun test packages/core/src/geo-strokes.test.ts packages/core/src/svg-export.test.ts packages/core/src/label-layout.test.ts packages/core/src/geo-actor.test.ts apps/cli/src/thin-rect-export.test.ts apps/cli/src/export-determinism.test.ts apps/cli/src/export-paint-order.test.ts packages/ui-solid/src/shapes/rect-strokes-view.test.ts` -> exit 0, 0 fail.
2. `bun test packages/core/src/text-layout-lint apps/cli/src/text-layout-lint.test.ts apps/cli/src/box-label-compat.test.ts` -> exit 0. Label padding defaults are unchanged.
3. `bun run typecheck` -> no `error TS` line in the owned files.
4. `bunx biome check` on the owned files -> exit 0.
5. Visual evidence:
   - Export a fixture page to `final/strokes.png` with `bun apps/cli/src/main.ts export <fixture> --format png --scale 2`. The fixture has 0.5/1/2-unit dividers, inside/center/outside strokes, and a left-border rounded card.
   - Inspect the image and describe it in the progress log.
   - Write the fixture JSONL into `tmp/ipd-s772/ipd-06-geo-strokes/fixture.jsonl`.

## Done criteria

Verification passes, and the progress log records the visual inspection notes.

## Worker rules

- Record `git hash-object` of this plan first.
- Read each file fresh before editing it, with pre and post hashes. On drift, re-read, keep the other change and record it.
- `packages/core/src/index.ts` is shared: append export lines only.
- No state-changing git commands, no emojis. Evidence files must not match Bun test patterns.

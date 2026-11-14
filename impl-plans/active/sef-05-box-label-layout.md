# sef-05-box-label-layout

- planId: sef-05-box-label-layout
- planPath: impl-plans/active/sef-05-box-label-layout.md
- progressPath: impl-plans/progress/sef-05-box-label-layout.md
- wave: 1
- dependsOn: none
- Design: `design-docs/specs/design-style-export-fixes.md`, sections "Scope and default", "Compatibility contract" and "Geometry".
- Worker rules and pinned contracts: `impl-plans/active/sef-00-overview.md`.
- writePaths:
  - `packages/ir/src/types.ts`
  - `packages/ir/src/keyOrder.ts`
  - `packages/ir/src/validate.ts`
  - `packages/ir/src/box-label-align.test.ts` (new)
  - `packages/core/src/label-layout.ts`
  - `packages/core/src/label-layout.test.ts`
  - `packages/core/src/node-label.ts`
  - `packages/core/src/node-label.test.ts`
  - `packages/core/src/svg-export/paint.ts`
  - `packages/core/src/svg-export/basic-shapes.ts`
  - `packages/core/src/text-layout-lint/rules.ts`
  - `packages/core/src/text-layout-lint/box-label-align.test.ts` (new)
  - `packages/core/src/index.ts`
  - `packages/ui-solid/src/shapes/GeoShapeView.tsx`
  - `packages/ui-solid/src/shapes/label-align-style.ts` (new)
  - `packages/ui-solid/src/shapes/label-align-style.test.ts` (new)
  - `apps/cli/src/box-label-compat.test.ts` (new)
  - `impl-plans/progress/sef-05-box-label-layout.md`
  - `tmp/sef-s733/sef-05-box-label-layout`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

Box-node label text is always vertically centered. `verticalAlign` must position `node.generic` and `shape.geo` labels,
with middle as the default and byte-identical output for existing documents. Existing documents can already store
`verticalAlign` on box nodes with no effect: `planTextStyles` copies it (`packages/core/src/text-styles.ts:272`) with a
default of `top`, detached styles keep it, and draw.io import writes it (`packages/io/src/drawio/import.ts:257`). So the key
only takes effect with the marker `visual.style.boxLabelAlign: true`. sef-06 makes `edit` write the marker.

## Non-goals

- No edit-layer changes (sef-06). No migration or schema version change.
- Do not change `text.note` behavior or its top default, sequence participants, or `planTextStyles`.
- Do not change `packages/io` (draw.io import and export stay as they are).
- Do not change the inspector (`StyleSection.tsx`), `text-editor-alignment.ts`, `NodeView.tsx`, `handoff.ts`, HTML bundle export,
  Mermaid or D2.
- Do not change `apps/desktop/src/styles/canvas.css`.

## File-level changes

IR:

- `types.ts`: `readonly boxLabelAlign?: boolean` on `VisualStyle`, next to `verticalAlign` (line 271), with a short comment saying what it means.
- `keyOrder.ts`: `"boxLabelAlign"` right after `"verticalAlign"` in `VISUAL_STYLE_KEY_ORDER`. Without it the reader moves the key to `extensions`.
- `validate.ts`: optional boolean with `checkBoolean(out, style["boxLabelAlign"], ...)`, next to the `verticalAlign` check at line 657.

`packages/core/src/label-layout.ts`, both pinned functions:

- `boxLabelVerticalAlign(visual)`: `style.verticalAlign ?? "middle"` when `style.boxLabelAlign === true`, otherwise `"middle"`.
- `alignedLabelTop(align, height, contentHeight, padding)`: `top` -> `padding`; `bottom` -> `padding + Math.max(0, height - 2 * padding - contentHeight)`.

`packages/core/src/index.ts`: add both names to the existing `label-layout` export list (line 713 area). One hunk, no reformatting.

`packages/core/src/node-label.ts`, `nodeLabelLayout`: if effective alignment is middle, keep the existing `top` expression unchanged; otherwise
use `alignedLabelTop` with padding 10 and content height `lines.length * lineHeight`. `NodeView`, `renderNode` and lint already read `layout.top`.

`packages/core/src/svg-export/paint.ts`, `centredLabel`: optional fifth parameter `verticalAlign: "top" | "middle" | "bottom" = "middle"`. Middle keeps the
existing `top` expression. Otherwise the first center is `box.y + alignedLabelTop(...) + layout.lineHeight / 2`, with padding `TEXT_PADDING`.

`packages/core/src/svg-export/basic-shapes.ts`: only `renderGeo` passes `boxLabelVerticalAlign(element.visual)`. `renderSequenceParticipant` does not.

`packages/core/src/text-layout-lint/rules.ts`, `labelOverflow` (line 97 onward): with effective alignment middle, today's condition and `top` stay. Otherwise
`top` is `layout.top` for a node, or `alignedLabelTop(align, box.height, height, TEXT_NOTE_PADDING_X)` for a geo, and the check is `top + height > box.height + EPS`.
The message text does not change. The note rules stay as they are.

`packages/ui-solid/src/shapes/label-align-style.ts` (new): `geoLabelAlignStyle(visual, height, lineCount, lineHeight): JSX.CSSProperties`. Middle -> `{}`. Top or bottom ->
`"align-items": "flex-start"` and `"padding-top": "<alignedLabelTop with padding 8>px"`. Import the JSX type only, as `packages/ui-solid/src/shapes/visual.ts` does.

`packages/ui-solid/src/shapes/GeoShapeView.tsx`: label div's `style` becomes `labelStyle(visual)` merged with `geoLabelAlignStyle(...)`, using `props.box.height`, `label().lines.length` and `label().lineHeight`.

## What a careless implementation gets wrong

- Reading `style.verticalAlign` directly anywhere in these box paths: always use `boxLabelVerticalAlign`.
- Rewriting middle through `alignedLabelTop` or a shared formula: floating-point results and bytes can change. Middle keeps each existing expression.
- `flex-end` for bottom on canvas: in an overflow it would differ from SVG. Use the computed `padding-top`.
- A `top`-storing text-style-bound node with no marker must stay centered.
- Padding differs by type: 10 for `node.generic`, 8 for `shape.geo`.
- Keep `noUncheckedIndexedAccess` safe.

## Tests

`packages/ir/src/box-label-align.test.ts`: `boxLabelAlign: true` validates; `boxLabelAlign: "yes"` gives a type error; the key appears in `VISUAL_STYLE_KEY_ORDER.keys`; no `field.unknown` warning.

`packages/core/src/label-layout.test.ts` and `node-label.test.ts` (add):

- No marker with any stored value -> `boxLabelVerticalAlign` is middle.
- Marker with no value -> middle. Marker with top, middle, bottom -> that value.
- `alignedLabelTop("top", 100, 20, 10)` -> 10. `("bottom", 100, 20, 10)` -> 70. `("bottom", 30, 50, 10)` -> 10.
- `nodeLabelLayout` height 100, one line, default font, no marker with stored top -> same `top` as no key (42.2 at line height 15.6).
- Same with marker and top -> 10. With marker and bottom -> `100 - 10 - 15.6`.

`packages/core/src/text-layout-lint/box-label-align.test.ts`, using `labelOverflow` as `packages/core/src/text-layout-lint` tests do:

- Node, marker, top, text fits the box height but `10 + height` exceeds it -> finding.
- Same geometry, no marker -> no finding, as today.
- Geo equivalents with padding 8.

`packages/ui-solid/src/shapes/label-align-style.test.ts`: no marker -> `{}`; top -> `padding-top: 8px`; bottom with height 100, 2 lines of 20 -> `padding-top: 52px`.

`apps/cli/src/box-label-compat.test.ts`, SVG via `new Editor({document}).exportPageSvg(...)`, both box types. Each compared to the same box with no key -> identical bytes:

- unbound storing top, middle and bottom with no marker
- bound to a `design.text-style` storing top and bottom, no marker
- detached (no `textStyle`) storing a copied value, no marker
- draw.io XML with `verticalAlign=top` through `importDrawio` -> SVG equals a run with the key stripped from that document

Also:

- marker with top and bottom for both types -> expected first or last line position in the SVG; sequence participant with the marker and `top` -> identical bytes to no key.
- `parseDocument` then `serializeDocument` on a document holding the marker -> it stays in `style`, not `extensions`.

## Verification (each must exit 0)

1. `bun test packages/ir/src packages/core/src/label-layout.test.ts packages/core/src/node-label.test.ts packages/core/src/text-layout-lint packages/ui-solid/src/shapes/label-align-style.test.ts apps/cli/src/box-label-compat.test.ts` -> 0 fail.
2. `bun test packages/core/src packages/ui-solid/src/shapes packages/io/src` -> 0 fail, with existing goldens not regenerated.
3. `bun run typecheck`.
4. `sh -c 'mkdir -p tmp/sef-s733/sef-05-box-label-layout/final; bun run typecheck --noUncheckedIndexedAccess > tmp/sef-s733/sef-05-box-label-layout/final/strict.log 2>&1; ! grep -qE "^packages/core/src/(label-layout|node-label|svg-export/paint|svg-export/basic-shapes|text-layout-lint/rules|index)\.ts\(" tmp/sef-s733/sef-05-box-label-layout/final/strict.log'` -> no strict diagnostic in a production core file this plan edits. The `packages/core/src/diagram-lint/node-overlap.ts(97,13)` TS7022 diagnostic predates this work: record it in the progress log, and do not fix it here, because that file is outside this plan's `writePaths`.
5. `bunx biome check packages/ir/src/box-label-align.test.ts packages/core/src/label-layout.ts packages/core/src/label-layout.test.ts packages/core/src/node-label.ts packages/core/src/node-label.test.ts packages/core/src/svg-export/paint.ts packages/core/src/svg-export/basic-shapes.ts packages/core/src/text-layout-lint/rules.ts packages/core/src/text-layout-lint/box-label-align.test.ts packages/ui-solid/src/shapes/GeoShapeView.tsx packages/ui-solid/src/shapes/label-align-style.ts packages/ui-solid/src/shapes/label-align-style.test.ts apps/cli/src/box-label-compat.test.ts`.

## Done criteria

- Verification 1-5 exit 0 with logs recorded.
- `git status --short packages/io/src/__fixtures__ apps/cli/src/__fixtures__` shows nothing from this plan.
- `grep -n "boxLabelVerticalAlign" packages/core/src/index.ts` matches.
- Progress log complete.

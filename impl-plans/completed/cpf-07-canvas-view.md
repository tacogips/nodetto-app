# cpf-07-canvas-view

- planId: cpf-07-canvas-view
- planPath: impl-plans/active/cpf-07-canvas-view.md
- progressPath: impl-plans/progress/cpf-07-canvas-view.md
- wave: 4
- dependsOn: cpf-02-participant-export, cpf-06-wiring
- Design: `design-docs/specs/design-convert-participant-frame-scope.md`, "E2: participant shapes".
- Worker rules: `impl-plans/active/cpf-00-overview.md`.
- writePaths:
  - `packages/ui-solid/src/shapes/SequenceParticipantView.tsx`
  - `packages/ui-solid/src/shapes/ShapeView.tsx`
  - `packages/ui-solid/src/sequence-participant-view.test.ts`
  - `apps/desktop/src/styles/canvas.css`
  - `impl-plans/progress/cpf-07-canvas-view.md`
  - `tmp/cpf-s748/cpf-07-canvas-view`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

The canvas shows the same box for every kind, plus a small caption
(`packages/ui-solid/src/shapes/SequenceParticipantView.tsx`). `actor` and `db` must draw their shapes
from the same notation export uses (`cpf-02`), with the lifeline still attached. The canvas path is
in `packages/ui-solid`; its CSS is in `apps/desktop/src/styles/canvas.css`.

## Non-goals

- No change to `service`: its markup, classes and caption stay the same.
- No change to bounds, hit testing, the lifeline's position, `packages/core`, export, or the 54 px
  canvas band.
- No new DOM test environment or dependency. The repo has none, so test the exported view model.

## File-level changes

`SequenceParticipantView.tsx`:

- Add `readonly box: Box` to props. Add an exported pure helper:

```ts
export const SEQUENCE_PARTICIPANT_HEAD_HEIGHT = 54;
export function sequenceParticipantViewModel(element: Element, box: Box): SequenceParticipantNotation | null;
```

  It calls `sequenceParticipantNotation(element, { x: 0, y: 0, width: box.width, height: 54 }, { ink: "var(--nodetto-ink)", surface: "var(--nodetto-surface)" })`.
- When the model is `null`, render the existing markup unchanged.
- Otherwise render, inside `.nodetto-sequence-participant`:
  - A head element with a modifier class (`nodetto-sequence-participant-actor` or `-db`) holding an
    `<svg role="img" aria-label={name}>` with `<For>` over the primitives. Render each `circle` and
    `path` directly in this file from `primitiveAttributes` (`packages/ui-solid/src/shapes/bpmn-primitive.ts`),
    spreading `attrs` as `BpmnNotationPrimitiveView` does (`packages/ui-solid/src/shapes/BpmnShapeView.tsx:12`).
  - `data-smart-paint="svg"` on the actor head circle (`participant-head`) and the db cylinder
    (`participant-cylinder`), as `GeoShapeView.tsx:106` places it. Not on the `participant-body` limbs.
  - The name in `<strong data-smart-text>` positioned by `labelBox`. No kind caption.
  - The same `.nodetto-sequence-lifeline` element.

Intentional divergence: the design says to render through `BpmnNotationPrimitiveView` with smart paint
attributes. That component takes only `primitive` and forwards no attributes, and `BpmnShapeView.tsx`
is not in this plan. Direct rendering from the same `primitiveAttributes` gives the same SVG plus the
attribute. Record this in your progress log.

`ShapeView.tsx`: pass `box={props.box}` at the `sequence.participant` match (line 236). No other edit.

`apps/desktop/src/styles/canvas.css`: add the modifier classes after
`.nodetto-sequence-participant-head`: `border: none`, `background: transparent`, a fixed 54 px height,
and absolute positioning for the SVG. The lifeline rule stays at `top: 54px`.

## What a careless implementation gets wrong

- `box.x` and `box.y` are page coordinates, and the view is already positioned by `ShapeView`. Use
  `x: 0, y: 0`, as `StateNodeView` does.
- `box.width` must be read reactively (`props.box`). Do not capture it at setup, or a resize shows stale shapes.
- The base head class has `min-height`, a border and a background, so the modifier must reset them
  or the box still shows behind the figure.
- SVG fill does not support the CSS gradient that `fillPaintStyle` handles. A gradient falls back to
  the solid value. Log this; do not add gradient handling.
- `pointer-events` must not change: a click on the head still selects the participant.
- `svgPaintKeyframe` (`packages/ui-solid/src/prototype-transition.ts:307`) animates `fill`. An open limb
  path with `data-smart-paint` would fill during a transition, so limbs do not animate paint. Log this.
- Do not edit `BpmnShapeView.tsx`, `bpmn-primitive.ts` or `prototype-transition.ts`. Import them read-only.

## Tests (`packages/ui-solid/src/sequence-participant-view.test.ts`, new)

Imitate `packages/ui-solid/src/text-note-view.test.ts`, which imports a pure helper from a `.tsx`.

- `service`, missing kind -> `sequenceParticipantViewModel` returns `null`.
- `actor` -> a `circle` and a `path` primitive, all inside `{0, 0, width, 54}`.
- `db` -> a `path` primitive inside the band, and a `labelBox` below the top ellipse.
- Actor, db and the export call -> the same primitive kinds for the same band size.
- `visual.style.stroke` -> used on the primitives, not the CSS variable.
- Source check, as `packages/ui-solid/src/canvas-paint-order.test.ts` reads source: `ShapeView.tsx`
  passes `box` to `SequenceParticipantView`, and `canvas.css` keeps `.nodetto-sequence-lifeline` with
  `top: 54px` and defines both modifier classes. `SequenceParticipantView.tsx` contains
  `primitiveAttributes`, `data-smart-paint="svg"` and `data-smart-text`, and sets the smart paint
  attribute only for the `participant-head` and `participant-cylinder` roles.

## Verification

1. `bun test packages/ui-solid/src/sequence-participant-view.test.ts packages/ui-solid/src/text-note-view.test.ts packages/ui-solid/src/canvas-paint-order.test.ts` exits 0.
2. `bun test packages/ui-solid/src/shapes` exits 0.
3. `bun run typecheck` exits 0.
4. `bunx biome check packages/ui-solid/src/shapes/SequenceParticipantView.tsx packages/ui-solid/src/shapes/ShapeView.tsx packages/ui-solid/src/sequence-participant-view.test.ts` exits 0.

## Done criteria

- `git diff --quiet 1e8f43d -- packages/core/src/shapes/sequence.ts packages/core/src/sequence-layout.ts` exits 0.
- The progress log records the gradient fallback, the limbs not animating paint, the divergence from
  `BpmnNotationPrimitiveView`, and evidence for each command.

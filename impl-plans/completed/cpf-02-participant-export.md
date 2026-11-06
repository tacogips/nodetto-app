# cpf-02-participant-export

- planId: cpf-02-participant-export
- planPath: impl-plans/active/cpf-02-participant-export.md
- progressPath: impl-plans/progress/cpf-02-participant-export.md
- wave: 1
- dependsOn: none
- Design: `design-docs/specs/design-convert-participant-frame-scope.md`, "E2: participant shapes".
- Worker rules: `impl-plans/active/cpf-00-overview.md`.
- writePaths:
  - `packages/core/src/shapes/sequence-participant-notation.ts`
  - `packages/core/src/shapes/sequence-participant-notation.test.ts`
  - `packages/core/src/svg-export/basic-shapes.ts`
  - `apps/cli/src/types-command.ts`
  - `apps/cli/src/sequence-participant-export.test.ts`
  - `impl-plans/progress/cpf-02-participant-export.md`
  - `tmp/cpf-s748/cpf-02-participant-export`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

Every `sequence.participant` kind exports as the same rounded box
(`renderSequenceParticipant`, `packages/core/src/svg-export/basic-shapes.ts:185`). `actor` must
draw a stick figure with the name below, and `db` a cylinder. Geometry stays unchanged, so lifelines
and messages need no change. PNG and PDF rasterize this SVG, so one export fix covers all three.

## Non-goals

- No change to bounds, hit testing, `sequence-layout.ts`, `shapes/sequence.ts`, or connector code.
- No change to `service` output or to a missing or unknown kind: bytes stay identical.
- No canvas change (`cpf-07`) and no `packages/core/src/index.ts` change (`cpf-06`). Inside core,
  import the new module by relative path.

## Contract for `cpf-06` and `cpf-07`

`packages/core/src/shapes/sequence-participant-notation.ts` exports:

```ts
export interface SequenceParticipantNotation {
  readonly primitives: readonly NotationPrimitive[];
  readonly labelBox: Box;
}
export function sequenceParticipantNotation(
  element: Element,
  headBox: Box,
  paint: { readonly ink: string; readonly surface: string },
): SequenceParticipantNotation | null;
```

It returns `null` for `service`, a missing kind and any other value. It reads the kind and
`visual.style` from `element`, which is why it takes the element rather than the design's bare
kind: style overrides need it too. `paint` holds defaults only, and `visual.style.stroke`, `fill`
and `strokeWidth` win, as in `stateNodeNotation` (`packages/core/src/shapes/state.ts:84`). Export
passes theme colors, and the canvas passes CSS variables. Primitive `role` values:
`participant-head`, `participant-body`, `participant-cylinder`.

## File-level changes

`sequence-participant-notation.ts` (new). All coordinates derive from `headBox`, which is the band:

- `actor`: centred on `headBox.x + headBox.width / 2`, in the top of the band with no box. A
  `circle` head and a `path` with torso, arms and legs, with `fill: "none"` on the path. The figure
  ends 20 px above the band's bottom. `labelBox` is the bottom 20 px at full width.
- `db`: a `path` filling the band, with the top ellipse, the sides and the bottom arc. Use an
  ellipse vertical radius of 8. `labelBox` is the band below the top ellipse's lower edge.

`basic-shapes.ts`, `renderSequenceParticipant`:

- Keep the lifeline `line` exactly as it is, painted first, from `box.y + 56`.
- Keep the `head` band at height 56. Call the notation with `head` and `{ ink: theme.ink, surface: theme.surface }`.
- On `null`, run the existing rect and `centredLabel` unchanged.
- Otherwise paint each primitive through `styled(..., element.visual, element.id)` so gradient and
  dash overrides keep working, then `centredLabel(labelBox, name, element.visual, theme)`. Build the
  attributes from the primitive's own geometry. The actor body path must stay `fill: "none"` after
  `styled`, as the open path does in `renderShape` for `draw.path`
  (`packages/core/src/svg-export/shapes.ts:78`).

`apps/cli/src/types-command.ts`: for `sequence.participant` only, add one text line after
`References:`, and a `rendering` string key in the JSON output. Text: `Rendering: kind actor draws a
stick figure with the name below; db draws a cylinder; service draws a rounded box. All keep a
lifeline.` Other types' output stays byte-identical.

## What a careless implementation gets wrong

- Changing the band height or lifeline start moves message attachment. Do not.
- `centredLabel` was not read during design. Read it at `packages/core/src/svg-export/paint.ts:236`
  and confirm how a long name behaves in a 20 px box. Do not change it. If a name overflows, log the
  behavior. Overflow must not move the lifeline or the bounds.
- `styled` can set `fill` from the style, which would fill the actor's limbs.
- Keep `noUncheckedIndexedAccess` safety.
- Raster tests must not rely on fonts. Use a single-space name in the raster fixture so glyphs do
  not decide the result. The shapes alone must make the bytes differ.

## Tests

`packages/core/src/shapes/sequence-participant-notation.test.ts` (new):

- `service`, missing kind -> `null`.
- `actor` and `db` -> every primitive and `labelBox` lie inside `headBox`.
- `visual.style.stroke` set -> primitives use it, not `paint.ink`.

`apps/cli/src/sequence-participant-export.test.ts` (new), imitating
`apps/cli/src/export-paint-order.test.ts`, with participants named Widget and Orders:

- `service` and missing kind SVG -> the participant's markup equals a literal expected string
  captured before your edit to `basic-shapes.ts` (one `rect` with `rx="8"` at the head box, a `line`
  and a label, no `circle` or `path`). Capture it first and record the pre-edit hash in your log.
- `actor` SVG -> holds a `circle` and a `fill="none"` `path` inside the head band, and no head `rect`.
- `db` SVG -> holds a cylinder `path` inside the band, and no head `rect`.
- Each kind -> the lifeline `line` has the same `x1`, `y1`, `x2`, `y2` relative to the box.
- `sequence.message` between participants of each kind -> the same message path `d` for all kinds.
- Fixture with palette shape `sequence.actor` added through `edit`, and `sequence.database` ->
  export draws the actor and db forms.
- PNG with a single-space name, per kind -> valid PNG signature and pairwise different bytes.
- PDF, per kind -> exits 0 and starts with `%PDF-`.
- `types sequence.participant` -> the text contains `Rendering:`, and JSON has `rendering`.
- `types state.node --format json` -> has no `rendering` key.

## Verification

1. `bun test packages/core/src/shapes/sequence-participant-notation.test.ts apps/cli/src/sequence-participant-export.test.ts` exits 0.
2. `bun test packages/core/src/svg-export.test.ts packages/core/src/sequence-layout.test.ts packages/core/src/hit-test.test.ts packages/core/src/shapes/connection-points.test.ts packages/core/src/sequence-authoring.test.ts apps/cli/src/export-paint-order.test.ts` exits 0, showing existing rendering and geometry still pass.
3. `bun run typecheck` exits 0 (overview rule 11).
4. `bunx biome check` on the files you edited exits 0.

## Done criteria

- `git diff --quiet 1e8f43d -- packages/core/src/sequence-layout.ts packages/core/src/shapes/sequence.ts packages/core/src/shapes/connector` exits 0.
- The progress log records the `centredLabel` long-name observation and evidence for each command.

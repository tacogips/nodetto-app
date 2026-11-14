# seq-self-02-export

Workflow mode: `issue-resolution`. Manifest: `impl-plans/active/seq-self-s750-dispatch.json`. Wave 2;
dependsOn: `seq-self-01-contract`. Design: `design-docs/specs/design-sequence-self-messages.md` sections 3, 4, 6 and 10.
Evidence: `tmp/seq-self-s750/seq-self-02-export/`. Progress: `impl-plans/progress/seq-self-02-export.md`.

## Intent and context

Self-messages already resolve to a loop (plan 01) and export as a polyline with an end marker. This plan makes the label
left-aligned beside the loop in SVG, and keeps long labels inside the viewBox. PNG and PDF derive from this SVG
(`apps/cli/src/export-command.ts:11-13`), so they need no separate change.

Contract from plan 01: `ConnectorEndpoints.labelStartX?: number` and `SEQUENCE_SELF_LABEL_BOUNDS_GLYPH_WIDTH` in
`packages/core/src/sequence-layout.ts`.

## Non-goals

- No change to routes, `labelPoint`, backdrop, `connectorLabelExtent` or any shared label function in `label-layout.ts`.
- No viewBox box for any connector except a labelled self-message. Other connector labels stay unprotected, as today.
- No edit to `svg-export.test.ts`, `shapes.ts`, `resolve.ts` or anything under `packages/ui-solid` or `apps/cli`.

## File-level changes

1. `packages/core/src/svg-export/connectors.ts`, `renderConnector`: when `resolved.labelStartX` is defined, the label
   text uses `x = resolved.labelStartX` and `"text-anchor": "start"`. Otherwise it uses today's values. Keep the attribute
   keys in the same object positions, changing only the values, so attribute order and bytes stay identical for other
   connectors. The backdrop code is unchanged.
2. `packages/core/src/svg-export/document.ts`: in the per-element loop, after the existing BPMN flow-label block, for an
   unclipped `sequence.message`, resolve the route with `resolveConnector` and `endpointReaderFor`. If `labelStartX` is
   defined and the layout from `connectorLabelLayout(connectorDecoration(element).label, element.visual)` has lines, push
   one box to `boxes`:
   - `x = labelStartX`
   - `y` and `height` from `connectorLabelExtent(layout, resolved.labelPoint)`
   - `width = longest line characters * (layout.fontSize * SEQUENCE_SELF_LABEL_BOUNDS_GLYPH_WIDTH + Math.max(0, element.visual.style?.letterSpacing ?? 0))`

   Count characters per line as `[...line].length`, as `connectorLabelExtent` does.

Imitate the `boxes.push` pattern of `bpmnLabelBox` and the `bpmn.` connector block in the same loop.

## Pitfalls

- Test the type first, so other connectors never resolve a route here. This loop runs for every element in Boa.
- Respect the existing skips: hidden elements and clipped elements must not add a box. Skip the box when the element has a
  clip, because the clip would cut the label anyway.
- `layout.fontSize` already reflects `style.fontSize`. Do not read the default.
- Negative `letterSpacing` must add nothing.
- Use the wrapped `layout.lines`, not the raw label: a newline or wrap makes the longest line shorter than the label.
- Do not use `Math.max(...lines)` on an empty list. The box is only built when lines exist.

## Tests

`packages/core/src/svg-export-self-message.test.ts` (new). Imitate the `renderPageSvg` store setup in
`packages/core/src/svg-export.test.ts:286-345`, using one participant at x=0, width=160, height=300 and a self-message at y=120
(so cx=80, `labelStartX`=128). Parse `viewBox` numerically and compare with `toBeCloseTo`, with default padding 16.

- Kinds `sync` and `async` -> `points="80,120 120,120 120,152 80,152"` and `marker-end="url(#nodetto-arrow)"`, with no dash.
- Kind `return` -> same points, and `stroke-dasharray="6 4"`.
- Label "check" -> text has `x="128"` and `text-anchor="start"`.
- 26 `W`, `fontSize` 11, `fontFamily` Arial -> viewBox right edge = 128 + 26*11*1.15 + 16 = 472.9.
- 6 `W`, `letterSpacing` 20, default font size -> right edge = 128 + 6*(11*1.15+20) + 16 = 339.9.
- 6 `W`, `letterSpacing` -5 -> right edge = 128 + 6*11*1.15 + 16 = 219.9.
- A label that wraps to two lines -> width uses the longest line from `connectorLabelLayout`, not the total characters.
- Label "Hi" (reach 128 + 2*12.65 = 153.3, inside the 160-wide participant) -> viewBox unchanged compared with no label.
- Normal message with a 60-character label -> viewBox identical to the same message without a label, and text keeps
  `text-anchor="middle"`.
- Hidden self-message with a long label -> adds no box.

## Verification

Each command must exit 0.

- `bun test packages/core/src/svg-export-self-message.test.ts packages/core/src/svg-export.test.ts apps/cli/src/sequence-self-golden.test.ts`: new tests pass; goldens stay byte-identical.
- `bun run typecheck`
- `bunx biome check packages/core/src/svg-export/connectors.ts packages/core/src/svg-export/document.ts packages/core/src/svg-export-self-message.test.ts`

If a failure comes from a file another wave 2 plan owns, read it fresh, re-run once it is stable, and do not edit it.

## Acceptance criteria

- Every test case above exists and passes.
- `git diff --quiet HEAD -- packages/core/src/label-layout.ts packages/core/src/svg-export/shapes.ts` exits 0.
- The golden test still passes without any change to the fixtures.

## Working rules

Before each edit, read the file fresh and record its sha256 in the progress log; record it again afterwards. If a file
changed unexpectedly, stop and report the drift. Edit only your writePaths. Never use worktrees, private branches or
concurrent git operations. Do not commit or archive plans. Fixtures use neutral text only. No emojis. The progress log
records each step, command, exit status and complete log path under the evidence directory.

# crl-03-label-placement

- planId: crl-03-label-placement
- planPath: impl-plans/active/crl-03-label-placement.md
- progressPath: impl-plans/progress/crl-03-label-placement.md
- wave: 1
- dependsOn: none
- Design: `design-docs/specs/design-connector-routing-arranging.md`, section "R4. Label placement".
- Worker rules and contracts: `impl-plans/active/crl-00-overview.md`.
- writePaths:
  - `packages/core/src/connector-label-placement.ts` (new)
  - `packages/core/src/connector-label-placement.test.ts` (new)
  - `impl-plans/progress/crl-03-label-placement.md`
  - `tmp/crl-s749/crl-03-label-placement`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

Today A3 in `packages/core/src/arrange-route.ts` tries 7 positions along the route, so dense pages keep overlaps,
and `lint --fix` cannot move labels. This plan adds a standalone module with a wider search. crl-05 calls
`placeConnectorLabels` from `planRoute`, and crl-07 connects `planLabelFixes` to `lint --fix`.

## Non-goals

- Do not edit `arrange-route.ts`, `metrics.ts`, `index.ts` or any `apps/cli` file.
- Do not import from `arrange-route.ts`: it will import this module.
- Do not write `visual.labelBounds`. Page-kind filtering of `lint --fix` is crl-07's.

## File-level changes

`placeConnectorLabels({edges, obstacles})`:

- Imports `labelOverlapScore`, `resolvedLabelBox`, `boxesOverlap`, `segmentOverlapsBox` as needed from `./diagram-lint/metrics.ts` and `pointAlongRoute` from `./shapes/connector/route.ts`.
- A movable edge has label text: `name` for `bpmn.*`, else `connectorDecoration(element).label`. A movable `bpmn.*` edge with `element.visual.labelBounds` is treated as not movable. No text means no map entry, and no change.
- A non-movable edge with a label box reserves that box at its stored anchor: `labelPosition` (clamped 0..1, default 0.5) plus its offsets (not on `bpmn.*`).
- Candidate order, exactly as in the design: the 7 existing positions, then the 12 other 0.05 steps, then (not on `bpmn.*`) each of the 19 positions, in that order, with the 8 offsets, computed from the zero-offset box `w` and `h` and rounded to integers.
- Score: same meaning as `labelOverlapScore(box, obstacles, placedLabels, otherRoutes)`, where `otherRoutes` is every other edge's route. First 0 wins. Otherwise the lowest wins, and ties go to the earlier candidate.
- Place in stable id order, then a second pass over movable labels still above 0, with all other labels held. No further passes.
- Result: 0.5 and zero offsets are absent keys. Rounded: position 4 decimals, offsets integers.
- Hot loop: flatten other routes' segments and label and obstacle boxes into numeric arrays once per call, with a bounding-box reject before the Liang-Barsky test. The score must equal `labelOverlapScore` for the same input: pin this with a test.

`planLabelFixes(document, pageId)`, imitating `packages/core/src/text-layout-lint/fix.ts:planTextWrapFixes`:

- Builds `Store`, default registry and context. Edges exclude `sequence.message`. Routes come from `resolveConnector`.
- Obstacles use `isLabelObstacle` and `boundsOf`.
- The stored anchor is computed from `route.points` and the semantic label fields, not from `route.labelPoint`.
- Movable: score above 0, or a `label-collision` finding when `page.kind` is in `TEXT_LAYOUT_LINT_PAGE_KINDS` (`lintTextLayoutPage`). Only call the lint on those kinds.
- A fix is emitted only if the new position scores strictly lower than the current one, or removes the finding. Otherwise the label stays, so a rerun is a no-op.
- `before` and `after` hold the three fields with absent meaning removed. Sorted by element id.

## What a careless implementation gets wrong

- The 7 legacy positions must come first in the same order, or existing outputs change.
- A label with empty text must keep its stored `labelPosition` (existing test: `labelPosition` stays undefined for an empty label).
- Score must count each segment of another route, as `labelOverlapScore` does, not each route, or `lint --metrics` will disagree.
- Own route is not an obstacle.
- Early exit on the first 0 is required for Boa cost.
- Do not call `resolveConnector` inside the candidate loop.
- This wave has crl-01 in parallel: compute anchors with the module's own helper, and do not depend on the resolver adding offsets to `labelPoint`.

## Tests

`packages/core/src/connector-label-placement.test.ts`:

- Clear label at 0.5 -> no entry fields (all absent).
- Obstacle over 0.5 only -> `labelPosition` 0.35.
- All 7 legacy positions blocked, 0.45 free -> 0.45.
- All 19 positions blocked on one straight route, free space above -> offset result with `labelOffsetY` negative, integer.
- `bpmn.sequenceFlow` with all 19 blocked -> no offset keys, lowest-score position.
- `bpmn.*` with `labelBounds` -> no entry, and its box blocks another label.
- Two labels wanting one spot -> earlier id keeps 0.5, later moves.
- First pass stuck, second pass finds a position after later labels moved -> final score 0.
- No free candidate -> lowest score, ties to the earlier candidate.
- Non-movable edge with stored offsets -> reserves the offset box.
- Input order shuffled -> same output.
- Fast score equals `labelOverlapScore` on a table of boxes and routes.
- `planLabelFixes` on a document with overlap -> one fix, `after` differs, all scores recomputed from `after` are lower; clear document -> `[]`; applying the fix and replanning -> `[]`.
- `sequence.message` label -> never in fixes.

## Verification (each must exit 0)

1. `bun test packages/core/src/connector-label-placement.test.ts` -> 0 fail.
2. `bun run typecheck`.
3. `bunx biome check packages/core/src/connector-label-placement.ts packages/core/src/connector-label-placement.test.ts`.

## Done criteria

- Verification 1-3 exit 0 with logs recorded.
- `grep -n "export function placeConnectorLabels\|export function planLabelFixes" packages/core/src/connector-label-placement.ts` matches twice.
- `git diff --stat packages/core/src/arrange-route.ts packages/core/src/index.ts` is empty.
- Progress log complete.

# crl-08-repair-labels

- planId: crl-08-repair-labels
- planPath: impl-plans/active/crl-08-repair-labels.md
- progressPath: impl-plans/progress/crl-08-repair-labels.md
- wave: 1; dependsOn: none
- Manifest (single source for writePaths, sharedPaths, artifactRoots): `impl-plans/active/crl-s754-dispatch.json`
- Design (binding): `design-docs/specs/design-connector-routing-arranging.md`, sections "Overlap repair", "R4. Label placement", "Nearest free position", "Fixture and acceptance tests", "Existing outputs that may change".
- Evidence: `tmp/crl-s754/crl-08-repair-labels/`, with gate logs in `final/`.

## Intent and context

Finishes W1 and W2. The arrange engine is in the shared TypeScript core, so Bun and the native CLI (Boa) run the same code.

- W1: `layered and route fixture metrics and repeatability` (`apps/cli/src/connector-arrange.test.ts`) fails. The last recorded result is 3 overlapping segment pairs and 1 label overlap, with crossings 169 against an input of 604. See "Resume state" below.
- W2: a label moved by placement can land away from its own connector, or from its loop for a self-transition, because own-route distance plays no part in the choice.

`planRouteLanes` compares a connector only with earlier routes and never revisits one. `placeConnectorLabels` takes the first free offset from a fixed list.

## Non-goals

- Do not change `apps/cli/src/__fixtures__/connector-arrange.ts`, or weaken any assertion in `layered and route fixture metrics and repeatability`.
- No new CLI flag, operation, IR field or export from `packages/core/src/index.ts`. No help or docs edits (crl-10). No native parity tests (crl-09).
- Do not restructure the crl-01 to crl-06 code. Change it only as this plan states.
- No Rust change. No change to the default routing of `connect`.
- `obstacle-routing-batch` fixtures must not change.

## Resume state (2026-11-06, read this first)

This plan was started in an earlier run and is incomplete. `impl-plans/progress/crl-08-repair-labels.md` holds the record. Append to it, and do not delete it.

- Done, keep: nearest-gap offset sorting in `connector-label-placement.ts`, the test-only exports `labelRouteGapSquaredForTest` and `labelCandidatesForTest`, and the recorded rebaseline of the blocked-offset test. Check these against the file-level changes below, and do not redo them.
- Not done, first task: the repair pass and `RouteLanePatch` in `arrange-route-lanes.ts`. Then the route scenes, label scenes and distance-bound tests under "Tests to add" that are still missing.
- Recorded measurements: `tmp/crl-s753/crl-08-repair-labels/before-probe.log` (after layered then route: crossings 169, label overlaps 2, segment overlaps 3, maximum gap 54.698) and `after-label-probe.log` (169, 1, 3, maximum gap 24.990). These satisfy the "before" measurement of Step 1, and the probe under that directory may be reused. That directory is read-only for this run: copy the probe to the evidence directory above if it needs changes, and write new logs there.
- Residual pairs: edge-10/edge-21 (1) and edge-14/edge-27 (2). Both are facing stubs on state-05 `right` and state-14 `left`, at the same y (203.998 and 224.002). Candidate B is the expected fix. edge-20's label hits edge-21, so re-measure it after repair before deciding on rings.
- The manifest also authorizes `packages/core/src/shapes/connector/resolve.ts` and `orthogonal-routing.ts`. Edit them only for a defect a probe or test measurement shows, and record that measurement. They are not part of the planned change.
- Existing `final/` gate logs are not completion evidence. Move `final/` to `attempt-<n>/` before the first gate run.
- Do not return until verification 1 to 6 exit 0. Keep iterating on the repair rather than reporting partial progress. The only early return is the blocker in the tier C rule below.

## Step 1: measure first

Before editing source, write a probe script under the evidence directory, not named like a test (for example `probe.ts`). It runs `arrangeLayeredOrRoute` from `apps/cli/src/arrange-modes.ts` with layered, then route, on `connectorArrangeDocument()`. Record in the progress log:

- `pageMetrics` for page `States`
- every pair from `countRouteOverlaps`, with ids, stored ports, lane, and points
- every label overlap, with what it hits
- each label's gap to its own route

Rerun it after the changes and record the same data. Imitate `apps/cli/src/connector-arrange-route.test.ts` for the imports.

## File-level changes

`packages/core/src/arrange-route-lanes.ts`, symbol `planRouteLanes`:

- Return type gains port positions. Pin this shape, exported from this module:
  `export interface RouteLanePatch { routingLane?: number; routingBend?: number; fromPortPosition?: number; toPortPosition?: number }`
- Keep the existing greedy search and its result unchanged. Keep each connector's current route in a map by id for the repair.
- Add a repair pass at the end, as a module-private function, following the design's numbered rules: at most 3 rounds, stable id order, candidates A then B, scored against all other current routes, adopted only on a strictly lower score, and the whole patch replaced. Connectors with a stored `routingLane` above 0 are excluded.
- Extract the existing bend and lane patch calculation into one private helper used by the greedy search and by candidates A and B.
- Candidate B: build the occupied positions per node and side from every connector in `input`, using stored `fromPort`, `toPort` and positions (absent position = 0.5), updated when a repair is adopted. Skip an end with no stored port.
- The existing `crossings` rule is applied against the connector's current route, not against its original base.

`packages/core/src/arrange-route.ts`, symbol `planRoute`: the merge at the lane commands already spreads the patch. Confirm position-only patches reach `data`. Change only what this needs. `planRoute` runs repair only through `planRouteLanes`, which is already inside `options.separation !== false`.

`packages/core/src/connector-label-placement.ts`:

- `candidates(edge)` stays a generator. It yields items 1 and 2 unchanged. Only when the consumer asks for more does it build the 16-offset list for each of the 19 positions, sort it by gap, and yield in that order. The listed offsets and their order are in the design.
- Add a private gap function using squared distance between a box and each route segment, 0 when they touch, with indexed loops.
- Add test-only exports next to `scoreLabelPlacementForTest`: `labelRouteGapSquaredForTest(box, points): number` and `labelCandidatesForTest(edge): LabelFields[]`. Do not add them to `index.ts`.
- `place` and `planLabelFixes` keep using `candidates`.

Tests: see below. Goldens and existing tests change only under "Rebaseline".

Imitate: `packages/core/src/arrange-route-lanes.test.ts` for scene setup; `packages/core/src/connector-label-placement.test.ts:63` ("offsets clear blocked positions and BPMN never uses offsets") for blocked labels.

## What a careless implementation gets wrong

- A position-only patch has `routingLane` undefined. The current filter `bestPatch.routingLane !== undefined` would drop it.
- k = 0 writes no lane or bend. A candidate B at k = 0 has only a position key.
- Scoring repair only against earlier routes repeats the bug. Score against all other current routes, including fixed ones.
- Self-loops and manual connectors are routes but never candidates. A self-loop's 0.3 and 0.7 count as occupied. Never change a port side in repair.
- A shift within 0.0001 of an occupied position is skipped. Round positions to 4 decimals.
- `resolveConnector` caches per element object and context. Candidates must be copied elements, as the greedy code does.
- Do not use `Math.hypot` or `Math.sqrt` for ordering or scoring: engine rounding can change ties and break native byte parity.
- Tie-break the sort with the original index in the comparator. Do not rely on engine sort stability.
- Round offsets to integers before computing the gap, because the written value is what later draws. Avoid writing `-0`: keep the existing `if (x)` style.
- BPMN connectors get no offsets, so their candidates must stay items 1 and 2 only.
- Do not add tier C up front. Add it only if the post-change measurement shows overlaps above 0, and record that measurement. If C still leaves overlaps, record the pairs and report a blocker with command and log path. Add label rings only if label overlaps measure above 0, again with the measurement recorded.
- A second `--mode route` must stay "0 layer update(s)". The label stage runs again on that call and must select the same fields.
- Boa: no per-point destructuring in hot loops. `packages/core`: no unchecked index lookups, guard `undefined` as the existing loops do. No `node:*` imports in core modules.

## Invariants

- Same input gives byte-identical output. No time, randomness, locale or parse-order input. Reversed input order to `planRouteLanes` gives the same patches.
- A page with no overlaps gets no new patch from repair. Items 1 and 2 label output stays identical where a zero was found there.
- `--mode layered` selection keeps `separation: false`, so no repair runs in selection.
- `Moved <n> connector label(s)` reporting and `--check` exit codes do not change.

## Tests to add

`packages/core/src/arrange-route-lanes.test.ts`:

- Scene where the greedy pass leaves an overlap that only moving the earlier connector clears -> overlap count 0, and the earlier id has the changed patch.
- Scene where lanes cannot clear facing stubs and a port shift can -> position-only or position plus lane patch, end order on the side unchanged.
- Self-loop on the same node side -> no shifted position equals or falls within 0.0001 of 0.3 or 0.7.
- No overlaps -> empty patches. Reversed input -> equal patches.

`packages/core/src/connector-label-placement.test.ts`:

- On-route positions blocked, free space around -> chosen gap is the smallest among free candidates (use both seams), and at most h + 8 when a position beside the route is free.
- Same for a self-transition, with the gap measured to its loop.
- BPMN edge -> candidate list has only the 19 position candidates, all with no offsets.
- Candidate order is the same when the sorted list is requested twice.

`apps/cli/src/connector-arrange.test.ts` (additions only):

- After layered then route on the fixture, each label's gap to its own route is at most 1.5 x max(w, h) + 8. Print the measured maximum.
- `--mode route --reset-manual --write` twice -> second output byte-identical to the first.

## Rebaseline

An existing expectation may change only for: which offset a blocked label gets (R4 nearest), or saturated lane scenes in `arrange-route-lanes.test.ts` where repair now clears what was pinned (R3 repair), or BPMN goldens where overlaps or overlapping labels existed (only `routingLane`, `routingBend`, port positions and label fields). Record each with the design section and a one-line reason. Tests of items 1 and 2 and BPMN candidates must not change.

## Worker rules

Before starting, record `git hash-object` of this plan. Read each file fresh before each edit and record pre and post `git hash-object` in the progress log. A pre-edit hash that differs from your last post hash means drift: re-read, keep the other change, record it. Edit only your own progress log. No state-changing git commands. No broad formatting. Never run `cargo clean`. Neutral names only (`Idle`, `Running`, widgets, orders). No emojis. Before repeating a gate, move `final/` to `attempt-<n>/`. An incomplete log is not a passing check.

## Verification (each must exit 0, full output in `final/<name>.log`)

1. `bun test packages/core/src/arrange-route-lanes.test.ts packages/core/src/arrange-route.test.ts packages/core/src/connector-label-placement.test.ts packages/core/src/arrange-layered.test.ts packages/core/src/arrange-layered-order.test.ts packages/core/src/arrange-layered-bpmn.test.ts apps/cli/src/connector-arrange.test.ts apps/cli/src/connector-arrange-route.test.ts apps/cli/src/arrange-modes.test.ts apps/cli/src/lint-diagram.test.ts` -> 0 fail. This shows the fixture reaches 0 and 0 with its assertion intact.
2. `bun run typecheck` -> exit 0.
3. `bunx biome check packages/core/src/arrange-route-lanes.ts packages/core/src/arrange-route-lanes.test.ts packages/core/src/arrange-route.ts packages/core/src/connector-label-placement.ts packages/core/src/connector-label-placement.test.ts apps/cli/src/connector-arrange.test.ts` -> exit 0.
4. `sh -c 'CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity/connector-arrange.test.ts apps/cli/src/native-parity/edit-performance.test.ts'` -> 0 fail, 0 skip. Up to 3 attempts on a deadline timeout only.
5. `git diff --exit-code -- apps/cli/src/__fixtures__/connector-arrange.ts` -> exit 0.
6. `grep -q 'expect(after.segmentOverlaps).toBe(0)' apps/cli/src/connector-arrange.test.ts` -> exit 0.

## Done criteria

- Verification 1 to 6 exit 0 with complete logs and exit statuses in the progress log.
- The progress log holds the before and after probe data, including `{edgeCrossings, labelOverlaps, segmentOverlaps}` with 0 overlaps of both kinds and crossings not above the input, the maximum label gap, any tier C or ring decision with its measurement, and every rebaseline with its reason.
- `grep -n 'Math.hypot\|Math.sqrt' packages/core/src/arrange-route-lanes.ts` lists nothing.

# crl-01-ir-resolver

- planId: crl-01-ir-resolver
- planPath: impl-plans/active/crl-01-ir-resolver.md
- progressPath: impl-plans/progress/crl-01-ir-resolver.md
- wave: 1
- dependsOn: none
- Design: `design-docs/specs/design-connector-routing-arranging.md`, sections "Shared IR additions", "R2" and "Lanes in the resolver", and the resolver sentence in "R4".
- Worker rules and contracts: `impl-plans/active/crl-00-overview.md`.
- writePaths:
  - `packages/ir/src/types.ts`
  - `packages/ir/src/index.ts`
  - `packages/ir/src/validate.ts`
  - `packages/ir/src/validate.test.ts`
  - `packages/ir/src/semantics/connectors.ts`
  - `packages/ir/src/registry/generic.ts`
  - `packages/ir/src/registry/uml.ts`
  - `packages/ir/src/registry/erd.ts`
  - `packages/ir/src/registry/bpmn.ts`
  - `packages/ir/src/connector-routing-fields.test.ts` (new)
  - `packages/io/src/jsonl/parse.ts`
  - `packages/io/src/jsonl/records.ts`
  - `packages/io/src/jsonl/serialize.ts`
  - `packages/io/src/jsonl/roundtrip.test.ts`
  - `packages/io/src/bpmn/equivalence.ts`
  - `packages/collab/src/ydoc.ts`
  - `packages/collab/src/ydoc.test.ts`
  - `packages/core/src/commands.ts`
  - `packages/core/src/editor/pages.ts`
  - `packages/core/src/editor/facade/page-editing.ts`
  - `packages/core/src/editor/bpmn.ts`
  - `packages/core/src/pages.test.ts`
  - `packages/core/src/shapes/connector/resolve.ts`
  - `packages/core/src/shapes/connector/route.ts`
  - `packages/core/src/connector-stored-routing.test.ts` (new)
  - `packages/ui-solid/src/connector-routing.ts`
  - `packages/ui-solid/src/connector-routing.test.ts`
  - `impl-plans/progress/crl-01-ir-resolver.md`
  - `tmp/crl-s749/crl-01-ir-resolver`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

This is the contract plan. It adds three connector fields and one page field, and teaches the shared
resolver to honor them. `resolveConnector` feeds SVG export, the canvas, lint metrics and text-layout
lint, so one change here reaches all of them. It also fixes the R2 root cause: routing written under
`visual` is stored (`parseVisual` moves it to `visual.extensions`) but `computeConnector` reads only
`semantic`.

## Non-goals

- No `apps/cli` change. `connect`, ops, help and docs belong to crl-04 and crl-07.
- Do not edit `packages/core/src/arrange-route.ts` or `packages/core/src/index.ts`.
- Do not edit `svg-export` or `apps/desktop`. The design finds no export or desktop route change.
- No inspector control, no document migration, no schema version change.
- Do not write these fields from any planner here.

## File-level changes

IR:

- `semantics/connectors.ts`: add `routingLane`, `labelOffsetX`, `labelOffsetY` to
  `ConnectorRoutingSemantic`; add `export const MAX_ROUTING_LANE = 8`.
- `registry/generic.ts`, the shared routing validator (near line 58-108): `routingLane` is an integer in
  0..`MAX_ROUTING_LANE`; offsets are finite numbers. Errors name the path. Imitate the `labelPosition`
  check beside it.
- `keyOrder`: add `routingLane` to every type that lists `routing` (generic, four in uml, erd, four in
  bpmn). Add `labelOffsetX` and `labelOffsetY` to those except the bpmn types. Place them after
  `labelPosition` where listed. Do not add anything to `SEQUENCE_MESSAGE`.
- `types.ts`: `PageConnectorRouting` and `Page.connectorRouting`. Export from `index.ts` if it does not
  re-export the type automatically.
- `validate.ts`, page checks near `sqlDialect` (line 808): `routing` must be `straight` or `orthogonal`
  (so `manual` is an error), `routingAvoidObstacles` optional boolean, no other requirement.

Page field through every layer, imitating `sqlDialect` at each site:

- `io/jsonl/records.ts`: add `connectorRouting` to `PAGE_RECORD_KEYS` right after `sqlDialect`.
- `io/jsonl/parse.ts`: copy it in the page block (line 221-239). Check `serialize.ts` writes it, and edit
  only if it enumerates fields.
- `collab/ydoc.ts`: both directions (lines 93 and 210), and the comment at line 5. Accept only an object
  with a valid `routing` when reading.
- `core/commands.ts`: `updatePage` patch type, validation, merge with `null` clearing, undo restore
  (`previous.connectorRouting ?? null`); page validation near line 384.
- `core/editor/pages.ts`: the page copy near line 116.
- `core/editor/facade/page-editing.ts`: `setPageConnectorRouting`, imitating `setPageSqlDialect` (line
  135). Returns false when nothing changes.

Lists: add `routingLane` to `io/bpmn/equivalence.ts` `stable`, `core/editor/bpmn.ts` retained keys, and
`ui-solid/connector-routing.ts` `straightConnectorSemantic` keys.

Resolver, `shapes/connector/resolve.ts`, inside `computeConnector` only:

- New private helper for `routing` and `routingAvoidObstacles`: `semantic`, then `element.visual`, then
  `element.visual.extensions`; `semantic` wins whenever the key is present. Accept only a value of the
  right type. Use it at the three `semantic["routing"]` reads and the `routingAvoidObstacles` read.
- Lane k = `routingLane` when an integer in range, else 0. On the orthogonal branch only:
  - `obstacleBoxes` takes k. Page obstacle box is grown by `8k` per side from the cached 12-unit box.
    If the 12-unit box contains the route start or end, skip it (today's rule). If only the grown box
    contains one, use the 12-unit box.
  - `portEscape` distance `min(24 + 3k, 44)`, replacing the literal 24.
  - Endpoint obstacle clearance `min(12 + 8k, escape - 1)`, replacing the literal 12.
  - Do not touch the middle channel. `routingBend` already controls it.
- Label offset: in the local `route` closure, add `labelOffsetX` and `labelOffsetY` (finite numbers,
  else 0) to the returned `labelPoint`, unless `element.type` starts with `bpmn.`. Do this there, not in
  `pointAlongRoute`.

## What a careless implementation gets wrong

- k = 0 must give byte-identical geometry. All new values must reduce to 12 and 24.
- Do not change `pageObstacles` caching to hold lanes. The cache stays at the 12-unit box, so one context
  serves all candidates of the lane search.
- Dropping a neighbor because a grown box contains the endpoint lets the route pass through that
  neighbor. That is the reason for the fallback rule.
- `visual.extensions` may be absent or non-object. `Visual` may hold a non-object off disk: guard it.
- A stored `routing` of an invalid type must be ignored, not thrown.
- A page copy that omits the field loses the default on duplicate. A collab read that omits it silently
  clears the default for other clients.
- The `updatePage` block rebuilds the page from `base`: destructure the old `connectorRouting` out, as
  `sqlDialect` is, or `null` will not clear it.
- Keep the unknown-visual warning. Do not add `routing` to `VISUAL_KEY_ORDER`.

## Tests

`packages/ir/src/connector-routing-fields.test.ts`:

- `routingLane` 0 and 8 valid; -1, 9, 1.5, `"1"` -> error at that path.
- `labelOffsetX` `NaN`-equivalent string -> error; 12.5 -> valid.
- Each listed connector type with `routingLane` -> no `semantic.unknownField`.
- `sequence.message` with `routingLane` -> `semantic.unknownField`.
- `bpmn.sequenceFlow` with `labelOffsetX` -> `semantic.unknownField`.
- Page `connectorRouting` with `manual` -> error; `orthogonal` with `true` -> valid.

`packages/io/src/jsonl/roundtrip.test.ts`: a page with `connectorRouting` -> parse then serialize is
byte-identical, key after `sqlDialect`.

`packages/collab/src/ydoc.test.ts`: a page with `connectorRouting` -> round trip equal; invalid stored
value -> dropped.

`packages/core/src/pages.test.ts`: `setPageConnectorRouting` set -> stored; `null` -> removed; undo ->
restored; duplicate page -> copied; same value -> returns false.

`packages/core/src/connector-stored-routing.test.ts`, boxes A, C, B on one row with an `edge.generic`
A to B (use `renderPageSvg`, parse the `polyline` points):

- `semantic` routing orthogonal -> SVG points equal `resolveConnector(...).points`, and no segment enters
  C's box.
- `visual: {routing, routingAvoidObstacles}` -> same points as the semantic form.
- Same document through `serializeDocument` and `parseDocument` (`visual.extensions` path) -> same points.
- `semantic.routing: "straight"` with `visual.routing: "orthogonal"` -> straight, because `semantic` wins.
- `visual.routingAvoidObstacles: false` with orthogonal -> the route is the preferred one through C.
- Two renders -> byte-identical.
- Lane 0 versus absent -> identical points.
- A stack of three boxes with lanes 1 to 8 -> no route enters a neighbor's box, and lane 1 differs from lane
  0 on a blocked route.
- Lane on a pinned connector -> first segment leaves outward and does not enter its own box.
- `labelOffsetX: 10`, `labelOffsetY: -5` -> `labelPoint` moved by exactly that from the no-offset point.
- BPMN flow with offsets -> `labelPoint` unchanged.

`packages/ui-solid/src/connector-routing.test.ts`: straighten removes `routingLane`.

## Verification (each must exit 0)

1. `bun test packages/ir/src/connector-routing-fields.test.ts packages/core/src/connector-stored-routing.test.ts` -> new cases pass.
2. `bun test packages/ir packages/io/src/jsonl packages/io/src/bpmn packages/collab/src/ydoc.test.ts packages/core/src/pages.test.ts packages/core/src/shapes packages/core/src/connector-positions.test.ts packages/ui-solid/src/connector-routing.test.ts` -> 0 fail.
3. `bun run typecheck`.
4. `bunx biome check packages/ir/src/semantics/connectors.ts packages/ir/src/connector-routing-fields.test.ts packages/core/src/shapes/connector/resolve.ts packages/core/src/connector-stored-routing.test.ts packages/core/src/editor/facade/page-editing.ts packages/ui-solid/src/connector-routing.ts`.

## Done criteria

- Verification 1-4 exit 0 with logs recorded.
- `grep -n "MAX_ROUTING_LANE = 8" packages/ir/src/semantics/connectors.ts` matches.
- `grep -n "connectorRouting" packages/io/src/jsonl/records.ts packages/collab/src/ydoc.ts packages/core/src/editor/pages.ts` matches in each file.
- `git diff --stat packages/core/src/svg-export` is empty.
- Progress log complete.

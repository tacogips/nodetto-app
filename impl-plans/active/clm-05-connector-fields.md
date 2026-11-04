# clm-05-connector-fields

- planId: clm-05-connector-fields
- planPath: impl-plans/active/clm-05-connector-fields.md
- progressPath: impl-plans/progress/clm-05-connector-fields.md
- wave: 2
- dependsOn: clm-02-edit-perf. clm-02 owns
  `shapes/connector/resolve.ts` in wave 1. Start from its final version and
  keep its performance changes.
- Design: `design-docs/specs/design-cli-layout-merge-lint.md`, section
  "Shared IR additions (connector semantics)" and the "IR fields" row of
  "Verification".
- writePaths:
  - `packages/ir/src/semantics/connectors.ts`
  - `packages/ir/src/registry/generic.ts`
  - `packages/ir/src/registry/uml.ts`
  - `packages/ir/src/registry/erd.ts`
  - `packages/ir/src/registry/bpmn.ts`
  - `packages/ir/src/connector-positions.test.ts` (new)
  - `packages/core/src/shapes/connector/resolve.ts`
  - `packages/core/src/shapes/connector/boundary.ts`
  - `packages/core/src/shapes/connector/route.ts`
  - `packages/core/src/shapes/connector/label-box.ts`
  - `packages/core/src/connector-positions.test.ts` (new)
  - `impl-plans/progress/clm-05-connector-fields.md`
  - `tmp/clm-s725/clm-05-connector-fields`
  - `target`
- artifactRoots: `target`

## Intent and context

Add three optional connector semantic fields and one resolver case that A3,
A4 and A5 need (planned in clm-06). Documents that do not use the fields
must render byte-identically.

- Every renderer and the lint read `resolveConnector(...).labelPoint`, which
  is computed by `route.ts:withRoute` at 0.5 of the route length.
- Ports come from `boundary.ts:pinnedPort`, which uses
  `connectionPorts(...)` side midpoints.
- The state self-loop is the hard-coded case in `resolve.ts`, around lines
  200-227.
- Routing keys are validated in `registry/generic.ts`, lines 51-110
  (`routingBend` checks). They are listed in the `keyOrder` of every
  connector type that has `"routingBend"`: `generic.ts:141`,
  `uml.ts:154,250,367,422`, `erd.ts:329` and `bpmn.ts:311,338,364,390`.

## Non-goals

- No UI inspector controls. `packages/ui-solid/src/connector-routing.ts`
  stays as it is: `straightConnectorSemantic` does not clear ports.
- No arrange logic and no CLI changes.
- Do not change `connectionPorts` (the UI handles).

## Contract (clm-06 depends on it)

- `ConnectorRoutingSemantic` gains `labelPosition?: number`,
  `fromPortPosition?: number` and `toPortPosition?: number`.
- `label-box.ts` exports
  `connectorLabelBoxAt(element: Element, anchor: Vec): Box`. It is the same
  layout as `connectorLabelBox`, at a given anchor. `connectorLabelBox`
  keeps returning the same values and calls the new function.
- `route.ts` exports `pointAlongRoute(points: readonly Vec[], ratio: number): Vec`.
  This is the existing private `pointAlong`, exported.
- `withRoute` gains an optional `labelRatio` parameter (default 0.5).
  `resolveConnector` passes the clamped `labelPosition`.

## Rules

- Validation, in the shared routing validator:
  - each field must be a finite number in [0, 1], else an error at the
    path;
  - a position without its port is a warning with code
    `semantic.portPositionWithoutPort`.
  - Add the three keys to every `keyOrder` listed above, after `routingBend`
    or in the position the existing key-order tests require.
- `pinnedPort(element, context, port, position?)`: when `position` is a
  number, shift the outward target along the side by
  `(position - 0.5) * sideLength` before `resolvedBoundary`. Side length is
  the box width for top and bottom, and the box height for left and right,
  in unrotated box space. Then apply the existing rotation. The resolver
  passes `semantic.fromPortPosition` and `semantic.toPortPosition`.
- Same-side self-loop:
  - Applies when `ids.from === ids.to`, both ports are set and equal, the
    type is not `erd.relation`, and the type is not `sequence.message`.
  - Place it before the generic orthogonal path. The existing state
    self-loop only covers the case without ports.
  - Points: start (the pinned port at `fromPortPosition ?? 0.3`), then
    start + normal*40, then end + normal*40, then end (the pinned port at
    `toPortPosition ?? 0.7`).
  - Pass it through `withRoute` so label placement works.

## Pitfalls

- Byte-identity: when none of the fields are present, every existing
  resolver, SVG golden and export test output must be unchanged. Run the io
  golden tests (`packages/io/src/jsonl/golden.test.ts`) and the core
  svg-export tests.
- Clamp, but never NaN: ignore non-finite values at render time (validation
  reports them).
- No per-point destructuring in the new loop code.
- `noUncheckedIndexedAccess`: guard every array access.

## Tests (input -> expected)

- `packages/ir/src/connector-positions.test.ts`:
  - `labelPosition: 1.5` -> an error at `.labelPosition`.
  - `fromPortPosition: 0.2` without `fromPort` -> the warning code.
  - The valid fields on `state.transition`, `edge.generic`, `erd.relation`
    and a uml association -> no `semantic.unknownField`.
- `packages/core/src/connector-positions.test.ts`:
  - `labelPosition: 0.25` moves `labelPoint` to a quarter of the route.
  - Absent fields give a `labelPoint` identical to before (compare with
    `pointAlongRoute(points, 0.5)`).
  - `fromPort: "right"`, `fromPortPosition: 0.25` -> the start y is a
    quarter down the right side.
  - A self-transition with `fromPort` and `toPort` both `"bottom"` -> 4
    route points below the box, 40 units out.
  - A self-transition without ports -> the same points as before (the
    right-and-top loop).
  - `connectorLabelBoxAt(element, labelPoint)` equals `connectorLabelBox`.

## Verification (each must exit 0)

1. `bun test packages/ir/src packages/core/src/connector-positions.test.ts packages/core/src/connector-endpoints.test.ts packages/core/src/connector-policy.test.ts packages/core/src/connector-outlines.test.ts`.
2. `bun test packages/core/src packages/io/src`. No regressions in goldens.
3. `bun run typecheck`.
4. `bunx biome check <owned files>`.

## Done criteria

- The contract exports exist and the tests above pass.
- `git diff --stat` shows only writePaths.

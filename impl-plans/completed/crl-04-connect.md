# crl-04-connect

- planId: crl-04-connect
- planPath: impl-plans/active/crl-04-connect.md
- progressPath: impl-plans/progress/crl-04-connect.md
- wave: 2
- dependsOn: crl-01-ir-resolver
- Design: `design-docs/specs/design-connector-routing-arranging.md`, section "R1. `connect` routing".
- Worker rules and contracts: `impl-plans/active/crl-00-overview.md`.
- writePaths:
  - `apps/cli/src/edit/connect-routing.ts` (new)
  - `apps/cli/src/edit/connect-routing.test.ts` (new)
  - `apps/cli/src/edit/operations/connect.ts`
  - `apps/cli/src/edit/operations/add.ts`
  - `apps/cli/src/edit/operations/pages.ts`
  - `apps/cli/src/edit/operation-fields.ts`
  - `apps/cli/src/edit/operation-fields.test.ts`
  - `apps/cli/src/edit/batch.ts`
  - `apps/cli/src/native-parity/connect-routing.test.ts` (new)
  - `impl-plans/progress/crl-04-connect.md`
  - `tmp/crl-s749/crl-04-connect`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

`connect` accepts `visual` but neither branch of `apps/cli/src/edit/operations/connect.ts` reads it. There is
no routing shorthand, page default or convention. Documented precedence: explicit field > page default > page
convention > existing default.

## Non-goals

- Do not change the default for a page with no default and no convention: it stays straight (user-qa Q3).
- Do not change the app's connect tool, `connectSmart`, or `packages/core`.
- Do not change `update`.
- Do not edit `help.ts` or `docs/cli.md`: crl-07 owns them. The `Unknown op` message in `batch.ts` is yours.

## File-level changes

`apps/cli/src/edit/connect-routing.ts`:

- `splitVisualRouting(visual)`: returns the two routing keys and the rest of the visual object.
- `pageRoutingConvention(store, pageId)`: peers are page connectors whose `getElementTypeDefinition(type)?.keyOrder.keys` lists `routing`. Rules in the design section "Page convention". Returns `{routing, routingAvoidObstacles?}` or undefined. No peers, or any peer with absent or `manual` `routing`, or differing keys -> undefined. `routingAvoidObstacles`: `false` when peers are false, `true` when any peer stores true, otherwise absent.
- `resolveConnectRouting(...)`: applies the design's tier rules. `routing` order: top-level, `semantic.routing`, `visual.routing`, page default, convention. `routingAvoidObstacles` from explicit fields in the same order, otherwise only from the tier that supplied `routing`.
- Validate top-level and `visual` values: `routing` in `CONNECTOR_ROUTINGS`, `routingAvoidObstacles` boolean. Bad value -> `OperationError` naming the field.

`operations/connect.ts`:

- Compute the routing plan before creating the connector, so the new connector is not its own peer.
- Typed branch (`operation["type"]`): pass the merged semantic and the remaining visual to `addElement`.
- Smart branch: after creation, merge routing into the existing `patch`, and apply the remaining visual with `withBoxLabelAlign(created.type, visual, undefined)` (see `add.ts`) and an `updateVisual` command.
- Created type does not list `routing`: an explicit field -> `OperationError` with the type name; default and convention are skipped. The batch's all-or-nothing behavior undoes the creation.

`operations/add.ts`, `addElement`: for a type with `category === "edge"` that lists `routing`, move the two visual keys to `semantic` using `splitVisualRouting`, before `createElement`. An explicit `semantic` value wins. Non-connector types are untouched.

`operations/pages.ts`:

- New `setPageRouting(batch, operation, index)`, dispatched as `set-page-routing`, imitating `set-page-mode` in the same file. `routing: null` clears and allows no `routingAvoidObstacles`. Uses `batch.editor.setPageConnectorRouting`. `manual` -> `OperationError`.
- `addPage` accepts `connectorRouting`, same checks.

`operation-fields.ts`: `connect` adds `routing`, `routingAvoidObstacles`; `add-page` adds `connectorRouting`; new `set-page-routing: ["op","id","routing","routingAvoidObstacles"]`. `checkOperationFields` runs `checkVisualStyleFields` for `connect` too.

`batch.ts`: the `case`, and the `Unknown op` list.

## What a careless implementation gets wrong

- An earlier `connect` in the same batch is a peer of a later one. Read from `batch.editor.store`, not the input document.
- `connectSmart` may already write `routing` on a BPMN flow. A page default overrides it. With no tier, leave it as it is.
- Do not write `routing` when no tier supplies it, or existing connect output changes.
- `routing: "straight"` explicit must not inherit `routingAvoidObstacles` from a page default.
- `routingAvoidObstacles` alone does not imply orthogonal.
- A `sequence.message` page: a page default must be skipped silently, not raise an error.
- An earlier decision let `connect` accept unknown `visual.style` keys because the visual was dropped. Now it applies, so it is rejected. If `operation-fields.test.ts` pins the old behavior, update it and record R1.
- Connector ids and indexes from `connect` are generated, so parity cannot compare bytes.

## Tests

`apps/cli/src/edit/connect-routing.test.ts`, imitating `apps/cli/src/edit/selectors.test.ts`:

- `visual: {routing:"orthogonal", routingAvoidObstacles:true}` -> stored in `semantic`, absent from `visual`.
- `visual: {style:{stroke:"#112233"}}` -> applied to `visual.style`.
- `visual: {style:{strok:"#112233"}}` -> error with suggestion.
- Top-level `routing` and `routingAvoidObstacles` -> stored.
- Top-level `routing: "straight"` over `semantic.routing: "orthogonal"` -> straight.
- Top-level over page default over convention, each pair -> higher tier wins.
- Page default orthogonal, no explicit -> orthogonal.
- Peers all orthogonal and explicit true -> orthogonal, `routingAvoidObstacles: true`.
- Peers all orthogonal, one absent and one true for avoid -> convention holds, true stored.
- Peers orthogonal and false -> false stored.
- Peers mixed, or one with absent routing, or a manual one -> no `routing` stored.
- No peers -> no `routing` stored.
- Two connects in one batch, first explicit orthogonal -> second follows.
- `{"type":"edge.generic"}` branch -> same tier results and `visual` applied.
- `sequence.message` with explicit `routing` -> error; with page default -> created with no routing.
- `add` of `edge.generic` with `visual.routing` -> moved to `semantic`.
- `add` of `node.generic` with unknown visual key -> as today.
- `set-page-routing` set -> stored on page; `null` -> removed; `manual` -> error; unknown field -> error.
- `add-page` with `connectorRouting` -> stored.
- Architecture A, C, B, connect A to B with page default -> `resolveConnector` route does not enter C.

`apps/cli/src/native-parity/connect-routing.test.ts`, using `nativeTest` from `./harness.ts`: each of Bun and native edits its own copy of one seed with the same operations -> same exit codes and stderr, and equal parsed connector `semantic` and `visual` matched by `from` and `to`, with page records byte-equal. Do not compare whole-file bytes.

## Verification (each must exit 0)

1. `bun test apps/cli/src/edit/connect-routing.test.ts` -> new cases pass.
2. `bun test apps/cli/src/edit apps/cli/src/ai-commands.test.ts apps/cli/src/ai-features.test.ts` -> 0 fail. Any shifted expectation is reported under the rebaseline rule.
3. `bun run typecheck`.
4. `bunx biome check apps/cli/src/edit/connect-routing.ts apps/cli/src/edit/connect-routing.test.ts apps/cli/src/edit/operations/connect.ts apps/cli/src/edit/operations/add.ts apps/cli/src/edit/operations/pages.ts apps/cli/src/edit/operation-fields.ts apps/cli/src/edit/operation-fields.test.ts apps/cli/src/edit/batch.ts apps/cli/src/native-parity/connect-routing.test.ts`.
5. `sh -c 'CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity/connect-routing.test.ts'` -> 0 fail, 0 skip.

## Done criteria

- Verification 1-5 exit 0 with logs recorded.
- `grep -n "set-page-routing" apps/cli/src/edit/batch.ts apps/cli/src/edit/operation-fields.ts` matches in both files.
- `git diff --stat apps/cli/src/help.ts docs/cli.md packages/core/src/index.ts` is empty.
- Progress log complete.

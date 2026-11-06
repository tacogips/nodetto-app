# seq-self-05-canvas progress

Workflow: issue-resolution. Dependency seq-self-01-contract accepted by dispatch. Design sections 4, 7 and 10 match the assigned plan.

Implemented message-tool self-drag with the screen-pixel click guard, reactive left-aligned labels, and label anchor geometry comparison. Tests cover drag, selection, undo, clicks, short drags, locked participants, generic connector, state transitions, route, hit test and label attributes. package.json and bun.lock unchanged. Formal reviews and final integration are downstream.

## Edit audit

### edit-0.intent

```
packages/ui-solid/src/interaction/geometry.ts
before sha256 37f8f95b9d608e21b15be8293c9db5c03a6cc01b34ecf335daf3d0dc01ef34ef
connectorType === "state.transition" || connectorType === "erd.relation" => connectorType === "state.transition" || connectorType === "erd.relation" || connectorType === "sequence.message"
after sha256 8a0f9e85404dd3dfbfa0b67b60d0d72db7bf6f981f3adfd7fa17d535c9581980
```

### edit-1.intent

```
packages/ui-solid/src/interaction/connectors.ts
before sha256 6203c4a2f351a31ce238bad6c5ec6c742d35428cf6103a63e4f55bf8d29c5096
// A click on a table with the relation tool is not a self-reference; => // A click with the relation or message tool is not a self-connection;
gesture.connectorType === "erd.relation" && => (gesture.connectorType === "erd.relation" ||
        gesture.connectorType === "sequence.message") &&
after sha256 83f82c0f11827bd6a98c43c49c2fbf1d7ac963454be7bcf3560d57fd2478ded4
```

### edit-2.intent

```
packages/ui-solid/src/connector-geometry.ts
before sha256 b0eed7e1785e060a5a70724283736ef2aeecbd8ddc18f3827bd7ad3c3aac3961
samePoint(a.labelPoint, b.labelPoint) && => samePoint(a.labelPoint, b.labelPoint) &&
    a.labelStartX === b.labelStartX &&
after sha256 536bcc2479348b90488b1da6b1e0c68cb849f96a26f3020c6effb7b36bd2a67c
```

### edit-3.intent

```
packages/ui-solid/src/shapes/ConnectorView.tsx
before sha256 bb9c88f53b5b463fdf1c46e53703c762041ba6fbc09eda51d11a25fbdf1cd870
  connectorPath, =>   connectorPath,
  type ConnectorEndpoints,
export function ConnectorView(props: => export function connectorLabelTextAttrs(resolved: ConnectorEndpoints): { readonly x: number; readonly textAnchor: "start" | "middle" } {
  return resolved.labelStartX === undefined
    ? { x: resolved.labelPoint.x, textAnchor: "middle" }
    : { x: resolved.labelStartX, textAnchor: "start" };
}

export function ConnectorView(props:
              return (
                <>
                  <Show when={backdrop()}> =>               const textAttrs = () => connectorLabelTextAttrs(resolved());
              return (
                <>
                  <Show when={backdrop()}>
<text class="nodetto-connector-label" text-anchor="middle"> => <text class="nodetto-connector-label" text-anchor={textAttrs().textAnchor}>
x={resolved().labelPoint.x} => x={textAttrs().x}
after sha256 47d7879cb65d7b2aa77e058caf9ddf48b2fdc90ab0501e3f8b13451d7e0109d1
```

### edit-4.intent

```
packages/ui-solid/src/interaction-connectors.test.ts
before sha256 d8031f8bd94052e11368aed66cbae479157994e9d99ff8aab0d5d36adca8bc7c
Append message drag, click, undo, locked, generic and state regression tests.
after sha256 cf36f8b1e22e9b76bddb5315fec4dc4446c5506d127b33bb90ac578095222dfb
```

### edit-5.intent

```
packages/ui-solid/src/connector-view-self-message.test.ts
before absent
Add label attributes, geometry comparison, real route and hit-test coverage.
after sha256 4b5b72d7bf793d457b74220c6f5ed592fd1ae02fdae6fe6a28a9656c05f8c42f
```

### edit-6.intent

```
Format only these files with Biome; preserve behavior.
packages/ui-solid/src/interaction/geometry.ts before sha256 8a0f9e85404dd3dfbfa0b67b60d0d72db7bf6f981f3adfd7fa17d535c9581980
packages/ui-solid/src/interaction/connectors.ts before sha256 83f82c0f11827bd6a98c43c49c2fbf1d7ac963454be7bcf3560d57fd2478ded4
packages/ui-solid/src/shapes/ConnectorView.tsx before sha256 47d7879cb65d7b2aa77e058caf9ddf48b2fdc90ab0501e3f8b13451d7e0109d1
packages/ui-solid/src/connector-geometry.ts before sha256 536bcc2479348b90488b1da6b1e0c68cb849f96a26f3020c6effb7b36bd2a67c
packages/ui-solid/src/interaction-connectors.test.ts before sha256 cf36f8b1e22e9b76bddb5315fec4dc4446c5506d127b33bb90ac578095222dfb
packages/ui-solid/src/connector-view-self-message.test.ts before sha256 4b5b72d7bf793d457b74220c6f5ed592fd1ae02fdae6fe6a28a9656c05f8c42f
packages/ui-solid/src/interaction/geometry.ts final sha256 aca94d3dfb1ca79741b6e146d6ad5f154159a5b89cfac39f431102144c377754
packages/ui-solid/src/interaction/connectors.ts final sha256 83f82c0f11827bd6a98c43c49c2fbf1d7ac963454be7bcf3560d57fd2478ded4
packages/ui-solid/src/shapes/ConnectorView.tsx final sha256 d73bff76e254ef5beb399d08c13825a2c6d0ec33cbc53883ec3dca052d37684f
packages/ui-solid/src/connector-geometry.ts final sha256 536bcc2479348b90488b1da6b1e0c68cb849f96a26f3020c6effb7b36bd2a67c
packages/ui-solid/src/interaction-connectors.test.ts final sha256 9c0238a30c6f38aaa6e290f284fdd7284f4eeb023521f2fa2bd4886393241229
packages/ui-solid/src/connector-view-self-message.test.ts final sha256 8d14ff8d6fda3ff762086ce0315841e98ad7a70ee11589d9cc66d2a67fff2d55
```

### edit-7.intent

```
packages/ui-solid/src/interaction-connectors.test.ts
before sha256 261b44f0b9ca2758c00078b6de06ce51a0aad769370ba23fc90f722f33ab8479
Widen test setup tool parameter to both tested tool literals.
after sha256 5540982cb32bd85e1d71448c8d76bcf2d3ff59938fb06dbcb8c8fe54f8ea0e4d
```

### edit-8.intent

```
packages/ui-solid/src/interaction-connectors.test.ts
before sha256 5540982cb32bd85e1d71448c8d76bcf2d3ff59938fb06dbcb8c8fe54f8ea0e4d
Format changed test helper signature.
packages/ui-solid/src/interaction-connectors.test.ts final sha256 9c0238a30c6f38aaa6e290f284fdd7284f4eeb023521f2fa2bd4886393241229
```

## Verification on shared tree

- `bun test packages/ui-solid/src/interaction-connectors.test.ts packages/ui-solid/src/connector-view-self-message.test.ts packages/ui-solid/src/connector-routing.test.ts packages/ui-solid/src/interaction-creation.test.ts`: exit 0, 195 passed, 0 failed; `tmp/seq-self-s750/seq-self-05-canvas/tests-final.log`.
- `bun run typecheck`: exit 0; `tmp/seq-self-s750/seq-self-05-canvas/typecheck-final.log`.
- `bunx biome check packages/ui-solid/src/interaction/geometry.ts packages/ui-solid/src/interaction/connectors.ts packages/ui-solid/src/shapes/ConnectorView.tsx packages/ui-solid/src/connector-geometry.ts packages/ui-solid/src/interaction-connectors.test.ts packages/ui-solid/src/connector-view-self-message.test.ts`: exit 0; `tmp/seq-self-s750/seq-self-05-canvas/biome-final.log`.

Earlier typecheck failed on the test helper tool literal inference (exit 2, `tmp/seq-self-s750/seq-self-05-canvas/typecheck.log`); the helper type was corrected and the final checks rerun. Final shared-tree verification remains the integration stage's responsibility.

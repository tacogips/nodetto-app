# car4-f1a-capture-scene

- planId: car4-f1a-capture-scene; wave 1; dependsOn: none
- planPath: impl-plans/active/car4-f1a-capture-scene.md
- progressPath: impl-plans/progress/car4-f1a-capture-scene.md
- Finding: function-capture-hidden-target-empty-cut (R4-1, high), TypeScript model and
  NCS1 writer part.
- Design: `design-docs/specs/design-ai-capture.md` 22.1 R4-1 (Model, NCS1), 22.3.
- writePaths: `packages/core/src/capture/scene.ts`,
  `packages/core/src/capture/scene-binary.ts`, `packages/core/src/capture/cad-request.ts`,
  `packages/core/src/capture/scene.test.ts`,
  `packages/core/src/capture/scene-binary.test.ts`, `tmp/car4-r4/car4-f1a-capture-scene`,
  `impl-plans/progress/car4-f1a-capture-scene.md`, `target`, `tmp/cad3d`
- sharedPaths: none; artifactRoots: `target`, `tmp/cad3d`

Follow the worker rules and pinned contracts in `impl-plans/active/car4-00-overview.md`.

## Intent and context

A cut that targets a visible body and a hidden body it would empty is rejected by the
app (`packages/core/src/cad/evaluate.ts:294`, `:827-837`), but capture drops the hidden
body (`scene.ts:220-226`) and attaches the cut only to visible targets (`:311-315`), so
the scene is byte-identical to a successful cut. This plan keeps the hidden history in
the model and writes it into NCS1. The Rust reader (f1b), census (f1d) and report text
(f1c) are other plans.

Non-goals: no change to drawing, camera fit, interference indices, `bodies`, report
shape, `describe.ts`, `report.ts`, Rust code, or bytes of scenes without hidden targets.

## Changes

- `scene.ts`:
  - Export `interface CaptureHiddenTarget { readonly id: ElementId; readonly steps:
    readonly CaptureStep[] }` (export `CaptureStep` too if needed by the type).
  - `CadCaptureModel` gains optional `readonly hiddenTargets?: readonly
    CaptureHiddenTarget[]` (always set by `buildCadCaptureModel`, possibly `[]`).
  - `addBody`: a hidden non-reference body (`feature.visual.hidden` and not a PCB
    reference) goes into a new `hidden` map keyed by id with its union step, instead of
    returning. Tool push and `toolCount++` stay exactly as today.
  - `tool()` for add/cut/intersect: for each target, push the step to the visible body
    (unchanged) or to the hidden building body. Bounds of hidden bodies are never used.
  - Mark a hidden body `needed` when a `difference` or `intersection` step also targets
    at least one visible non-reference body (same step object/tool index).
  - Return `hiddenTargets`: needed hidden bodies in creation order, `{ id, steps }`.
- `scene-binary.ts`:
  - `CaptureSceneModel` gains `hiddenTargets?: readonly { readonly steps: readonly
    { op; tool }[] }[]`.
  - `byteLength`: validate hidden records exactly like bodies (step count >= 1, first op
    union, tool index range) and add `8 + steps * 8` each.
  - `checkScenePreTool` `counts` gains optional `hidden?: number`, bounded with
    `boundedInteger("hidden body count", n, 0, 20_000)`.
  - `writeCaptureScene`: the `writer.u32(0)` after the budget (byte offset 36) writes the
    hidden count; after the body loop write each hidden record: `u32 0` flags,
    `u32 steps.length`, then `u32 OP[op]`, `u32 tool` per step.
- `cad-request.ts` `prepareCadCapture`: pass `hidden: model.hiddenTargets?.length ?? 0`
  to `checkScenePreTool`.

## Pitfalls

- Bytes must not change when no hidden target is emitted: word 36 stays 0 and nothing
  is appended. Existing golden tests (`scene-binary.test.ts:316`, `:339`,
  `scene.test.ts:681`, `:982`, `determinism.test.ts`) must pass unchanged.
- A hidden body that is only cut alone, or only unioned, is not emitted.
- Hidden mesh bodies follow the same rule; display-only meshes never get steps (keep
  the `targets` list as `visitCadConstruction` passes it).
- Do not add hidden bodies to `bodies`, `bounds` or `visible`.
- Imitate `scene.test.ts:209` (`hidden creators stay available ...`) for hidden fixtures.

## Tests

Fixture (test data of the design, not user data), built with
`packages/core/src/cad/testing/documents.ts` (`sketch`, `rectangle`, `extrude`):
visible `wide` 20 x 10 x 4 mm (`op: "new"`), hidden `hidden` 2 x 2 x 4 mm (`op: "new"`,
`visual.hidden: true`) placed under the strip, cut `trim` 5 x 10 mm strip through `wide`
covering `hidden`, distance through both.

- `scene.test.ts`: targets `[wide, hidden]` -> `bodies` ids `[wide]`, `hiddenTargets`
  `[{ id: "hidden", steps: [union hidden-tool, difference trim-tool] }]`; targets
  `[wide]` -> `hiddenTargets` `[]`; both `bounds` equal; scenes written with
  `prepareCadCapture` differ; control scene word at offset 36 is 0 and its length equals
  the two-target length minus the hidden record length.
- `scene-binary.test.ts`: one hidden record writes the exact words at the tail and the
  count at offset 36; `hidden: 20_001` and a hidden record starting with a difference
  throw `RangeError`.

## Verification (each exits 0 and runs tests)

1. `bunx biome check --diagnostic-level=warn packages/core/src/capture/scene.ts packages/core/src/capture/scene-binary.ts packages/core/src/capture/cad-request.ts packages/core/src/capture/scene.test.ts packages/core/src/capture/scene-binary.test.ts && bun test packages/core/src/capture/scene.test.ts packages/core/src/capture/scene-binary.test.ts packages/core/src/capture/cad-request.test.ts packages/core/src/capture/determinism.test.ts`
   -> new tests pass (failed before), all golden byte tests unchanged.

## Done criteria

- Two-target fixture has one hidden target; control has none; goldens unchanged;
  command exits 0; progress log `done` with pre-fix failure recorded.

Implementation status: complete; fixture, writer validation and focused gate passed. Formal review and integration remain downstream. See `impl-plans/progress/car4-f1a-capture-scene.md`.

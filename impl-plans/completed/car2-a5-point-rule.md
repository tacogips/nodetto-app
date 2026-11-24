# car2-a5-point-rule: shared scene point accounting (R2-3, shared rule)

- planId: car2-a5-point-rule
- Wave: 1
- dependsOn: none
- Design: `design-docs/specs/design-ai-capture.md`, section 20.2 R2-3 (the
  first bullet) and the precedence list in section 19.1 F4.
- Progress log: `impl-plans/progress/car2-a5-point-rule.md`

## Intent

Extract the scene writer's own checks into two exported functions in
`packages/core/src/capture/scene-binary.ts`, and make the writer call them.
Plan a5-charged-walk then reuses the same rule before it allocates
geometry. The writer's output and messages stay byte-identical.

## Non-goals

- Do not edit `scene.ts`, `cad-request.ts` or any caller.
- Do not change any message text, check order or the `MAX_POINTS` value.

## Changes (`packages/core/src/capture/scene-binary.ts`)

1. Export `MAX_POINTS`, which is `4_000_000` today and stays that value.
2. Pre-tool checks:

       export function checkScenePreTool(options: CaptureSceneOptions, counts: { tools: number; bodies: number }): void

   - It throws the same `RangeError`s, in the same order, as the writer's
     code before the tool loop. That means the header checks in
     `writeCaptureScene` (width, height, supersample, reference opacity,
     camera scale, the interference fields and body indices, checked
     against `counts.bodies - 1`), followed by `tool count` and `body
     count` from `byteLength`.
   - The little-endian platform check stays first in `writeCaptureScene`.
3. Per-tool charge. Export a running state and a charge function:

       export interface PointCharge { points: number }

       export function chargeTool(state: PointCharge, tool: { kind: "prism"; loopCounts: readonly number[] } | { kind: "mesh"; vertices: number; triangles: number }): string | undefined

   - For a prism, each loop count goes through `boundedInteger("loop point
     count", n, 3, 20_000)`.
   - For a mesh, `mesh vertex count` and `mesh triangle count` are checked
     as today.
   - Then the points are added, and `total point count` is checked against
     `MAX_POINTS`.
   - It returns the exact `RangeError` message on the first failure, or
     `undefined`. On failure, `state.points` is left unchanged.
4. The writer uses both functions.
   - `writeCaptureScene` calls `checkScenePreTool` where its header checks
     were.
   - `byteLength` calls `chargeTool` per tool and throws `new
     RangeError(message)` when it returns one.
   - The loop points/faces mismatch check stays in `byteLength`, at its
     current position.

## Pitfalls

- Keep the order exactly: width, height, supersample, opacity, camera
  scale, positive scale, interference fields, body indices, tool count,
  body count, then per tool the loop or mesh bounds and the total.
- The prism mismatch check (`loop.points.length !== count * 2`) comes
  before the total in the current code. Keep it where it is, in the
  writer.

## Tests (`packages/core/src/capture/scene-binary.test.ts`)

- `chargeTool`:
  - running exactly to 4,000,000 returns `undefined`;
  - one more point returns `Capture scene total point count must be an
    integer in 0..4000000.`;
  - a loop count of 20,001 returns the loop message;
  - `state.points` is unchanged after a failure.
- `checkScenePreTool` with `supersample: 4` throws the supersample message,
  even when `counts.tools` is 20,001. This shows the header comes before
  the counts.
- The writer's output is unchanged. Write the existing test scenes and
  compare their sha256 with digests computed on `3cd2401` before the edit.
  Record the digests in the progress log.

The new tests fail before the fix, because the exports do not exist.

## Verification

- `bun test packages/core/src/capture/scene-binary.test.ts packages/core/src/capture/scene.test.ts packages/core/src/capture/determinism.test.ts`
  must exit 0.
- `bunx biome check --diagnostic-level=warn packages/core/src/capture/scene-binary.ts packages/core/src/capture/scene-binary.test.ts`
  must exit 0.

## Done when

- All the tests pass, the existing writer tests pass unedited, and the
  digests are equal.
- The progress log reads `done`.

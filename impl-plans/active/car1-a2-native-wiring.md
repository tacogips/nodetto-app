# car1-a2-native-wiring: core decoder type, native bounds and decode wiring (F9, gated Q2)

- planId: car1-a2-native-wiring. Wave 2. dependsOn: car1-a1-nmesh-contract,
  car1-c-body-selection (both edit `cad-request.ts` and its test),
  car1-j-cad-ui-strict (provides `strict-index.test.ts`, which this plan's
  verification runs). Gate: Q2.
- Design: `design-docs/specs/design-ai-capture.md` 19.1 F9 (traced paths)
  and F1 "Decoder contract"; `design-docs/user-qa/ai-capture-audit-r1.md`
  Q2.
- Progress log: `impl-plans/progress/car1-a2-native-wiring.md`.

## Gate (do this first)

Read the `Decision:` line under Q2 in
`design-docs/user-qa/ai-capture-audit-r1.md`. If it is not exactly
`Decision: approved`, make no edit, write `blocked: Q2 pending` and stop.

## Intent

- Type the a1 decoder contract in core and on the native CLI.
- Native shaded capture uses Rust bounds instead of a scan in Boa.
- Native construction-view export gets mesh bounds from a bounds-only Rust
  host function and never calls the TS decoder.

## Non-goals

- No eligibility or point-limit behaviour; that is b2 and b3. `scene.ts`
  only switches from `pointBounds(positions)` to the decoder `bounds`.
- Do not edit `capture-command.ts` (it already forwards `io.decodeMesh`)
  or `page-editing.ts`.

## Changes

1. `packages/core/src/capture/cad-request.ts`: export two result types
   and make `CaptureMeshDecoder` an overloaded call type:
   - `CaptureMeshFull = { readonly vertexCount: number; readonly bounds: { min: Vec3; max: Vec3 }; readonly booleanTarget: boolean; readonly positions: Float64Array; readonly triangles: Uint32Array }`
   - `CaptureMeshResult = { ...the same keys, except booleanTarget: boolean | undefined; positions?: Float64Array; triangles?: Uint32Array }`
   - ```
     export type CaptureMeshDecoder = {
       (data: string): CaptureMeshFull;
       (data: string, options: { maxVertices?: number; needTarget?: boolean }): CaptureMeshResult;
     };
     ```

   The type matches a1's two `decodeCaptureMesh` overloads, so
   `decodeCaptureMesh` is assignable to it. `options` is required in the
   second signature; do not make it optional.
2. `packages/core/src/capture/scene.ts`:
   - The mesh visitor uses the decoder's `bounds` for `addBody`.
   - Within the limit, `positions` and `triangles` are present; keep the
     existing empty-mesh rule.
   - Update the fake decoders in `scene.test.ts` and `cad-request.test.ts`
     to the new shape. They can stay simple arrows that always return a
     full `CaptureMeshFull` (with `vertexCount`, `bounds` and
     `booleanTarget: true`), because a full result is assignable to both
     overloads. Invalid-data fakes still throw.
3. `apps/cli/native/src/engine.rs`:
   - `nmeshDecode(data, maxVertices?, needTarget?)` uses
     `nodetto_capture::nmesh::decode_capture` and returns a packet:
     - `u32 vertexCount`, `u32 triangleCount`, `u8 flags` (bit0
       `booleanTarget` known, bit1 its value, bit2 geometry present),
       3 zero bytes;
     - 6 `f64` bounds;
     - then, if present, the positions and triangles laid out as today.
   - New host function `nmeshBounds(data)` returns 6 `f64`, or null on
     invalid data.
4. `apps/cli/src/native-engine.ts`:
   - Implement `decodeMesh` as a named function declaration, not an arrow
     in the object literal. It carries the same two overload signatures
     as `CaptureMeshDecoder`, so it is assignable to the overloaded type.
   - It parses the new packet.
   - The one-argument call passes no `maxVertices` to `nmeshDecode`, so
     the Rust side always returns geometry and `booleanTarget`. The
     packet's "geometry present" and "booleanTarget known" flags must be
     set on that path; if they are not, throw
     `Error("Invalid mesh packet.")` rather than returning partial data.
   - Reference it from the `io` object.
   - Add `meshBounds(data)`.
5. Q2 files:
   - `apps/cli/src/commands.ts`: type `CommandIo.decodeMesh` as
     `decodeMesh?: CaptureMeshDecoder` (imported as a type from
     `@nodetto/core`). Add optional
     `meshBounds?(data: string): { min: Vec3; max: Vec3 } | null`.
     `apps/cli/src/cad-command.ts:56` passes `io.decodeMesh` to
     `checkCadPage`, whose `MeshDecoder` (`packages/core/src/cad/check.ts:20-23`)
     requires `positions: ArrayLike<number>`. That call keeps compiling
     because TS matches the one-argument overload. `cad-command.ts` and
     `check.ts` are not edited.
   - If `bun run typecheck` proves that the overload approach does not
     compile at `cad-command.ts:56`, stop and record a scope-amendment
     request in the progress log. Do not edit those two files, and do not
     add casts or `any`.
   - `packages/core/src/svg-export/theme.ts`: add `meshBounds?` to
     `SvgExportOptions`.
   - `packages/core/src/svg-export/document.ts`: `renderPageSvg` forwards
     `options.meshBounds` into `cadPageWireframe(elements, pageId, { meshBounds })`.
6. `packages/core/src/cad/wireframe.ts`: `cadPageWireframe` accepts
   `{ meshBounds? }`. `meshCorners` uses it when given; null gives the
   existing empty corners. Otherwise the TS path is unchanged.
7. `apps/cli/src/export-command.ts`: pass `meshBounds: io.meshBounds` into
   `editor.exportPageSvg(...)`.

## Pitfalls

- Rust bounds are mm values. They equal `min(q)/1000` bit for bit; keep
  the order in which millimetres are converted.
- `cad check` (`cad-command.ts`) still calls `io.decodeMesh(data)` with
  one argument. It must keep compiling and behaving the same.
- Browser and desktop paths never set `meshBounds`.

## Tests (each fails before)

- `packages/core/src/cad/wireframe.test.ts`: with `meshBounds`, the SVG
  equals the TS-path SVG, and a spy decoder is never called.
- Native, release binary built with
  `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car1-a2 cargo build --release -p nodetto-cli`:
  - `apps/cli/src/native-parity/export.test.ts`: export of a page with a
    large inline mesh gives SVG bytes equal to the pre-fix output, which
    is recorded in the pre-fix run and stored as an expected string or
    digest;
  - `apps/cli/src/native-parity/capture.test.ts`: capture of the same page
    gives the pre-fix camera and frame lines and image digest.
- The existing `scene.test.ts`, `cad-request.test.ts` and
  `capture-decoder.test.ts` pass with the new types.
- cad check is unchanged: `apps/cli/src/cad-command.ts` and
  `packages/core/src/cad/check.ts` are unedited. `bun run typecheck`
  covers them (verification 4), and `bun test apps/cli/src/cad-command.test.ts packages/core/src/cad/check.test.ts`
  passes (verification 1).

## Verification

1. `biome check packages/core/src/capture/cad-request.ts packages/core/src/capture/scene.ts packages/core/src/capture/scene.test.ts packages/core/src/capture/cad-request.test.ts packages/core/src/cad/wireframe.ts packages/core/src/cad/wireframe.test.ts packages/core/src/svg-export/theme.ts packages/core/src/svg-export/document.ts apps/cli/src/commands.ts apps/cli/src/native-engine.ts apps/cli/src/export-command.ts && bun test packages/core/src/capture packages/core/src/cad/wireframe.test.ts apps/cli/src/capture-cad.test.ts apps/cli/src/capture-command.test.ts apps/cli/src/cad-command.test.ts packages/core/src/cad/check.test.ts packages/ui-solid/src/cad/strict-index.test.ts`
   must exit 0.
2. `CARGO_TERM_QUIET=true cargo fmt -p nodetto-cli -- --check && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car1-a2 cargo test -p nodetto-cli`
   must exit 0.
3. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car1-a2 cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/car1-a2/release/nodetto-cli" bun test apps/cli/src/native-parity/export.test.ts apps/cli/src/native-parity/capture.test.ts`
   must exit 0.
4. `bun run typecheck && bun test packages/core/src/svg-export`
   must exit 0.

## Done when

- Native export uses Rust bounds with zero TS decodes.
- Native capture bytes are unchanged.
- Strict types hold.

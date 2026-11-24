# car2-a2-export-bounds: bounds-only mesh path for construction SVG export (R2-5 export)

- planId: car2-a2-export-bounds
- Wave: 3
- dependsOn:
  - car2-a2-native-host (`CommandIo.meshBounds`, `nmeshBounds`);
  - car2-b-wireframe (`wireframe.ts` and `document.ts` changes).
- Design: `design-docs/specs/design-ai-capture.md`, section 20.2 R2-5
  (Construction export, Instrumentation, Tests) and R2-9 (failure
  semantics).
- Progress log: `impl-plans/progress/car2-a2-export-bounds.md`

## Intent

Native construction SVG export of a CAD page gets mesh bounds from Rust
(`nmeshBounds`) instead of decoding the full mesh in the interpreter.
Without the option, Bun, the browser and the desktop keep the TypeScript
decode.

## Non-goals

- Do not edit `page-editing.ts`, which already forwards options
  unchanged.
- Do not touch `native-engine.ts`, `commands.ts` or `engine.rs`; they
  belong to a2-native-host.
- Do not change the projection or the segment order of the wireframe.

## Changes

1. `packages/core/src/svg-export/theme.ts`, `SvgExportOptions`: add
   `readonly meshBounds?: (data: string) => { readonly min: readonly
   [number, number, number]; readonly max: readonly [number, number,
   number] } | null;`.
2. `packages/core/src/svg-export/document.ts`, `renderPageSvg` CAD branch:
   pass `{ meshBounds: options.meshBounds }` as the third argument of
   `cadPageWireframe`.
3. `packages/core/src/cad/wireframe.ts`
   - New signature: `cadPageWireframe(elements, pageId, options?: {
     meshBounds?: ...; stats?: { decodes: number } })`.
   - `meshCorners` uses `options.meshBounds(data)` when it is given. Null
     is a failure, so the visitor returns false (R2-9). A thrown error is
     also a failure.
   - Otherwise it keeps the TypeScript decode and increments
     `stats.decodes`.
   - Project the eight corners from the millimetre bounds exactly as
     today. Today's `mm(value / 1000)` of quantized bounds and the Rust
     millimetre bounds are bit-equal.
4. `apps/cli/src/export-command.ts`: in the `exportPageSvg` options
   (`:533-538`), add `meshBounds: io.meshBounds?.bind(io)`, or an arrow
   function if `io` is a plain object.

## Pitfalls

- In TS today, the bounds of quantized integers are divided by 1000 after
  `pointBounds`. The Rust bounds are already in millimetres. Do not divide
  them again.
- Empty mesh: `nmeshBounds` returns null, which is a failure, matching
  R2-9.

## Tests

1. `packages/core/src/cad/wireframe.test.ts`
   - An asymmetric mesh with negative coordinates, together with a
     `meshBounds` that returns its exact millimetre bounds, gives segments
     and bounds equal to the run without the option.
   - With `meshBounds`, `stats.decodes === 0` and the hook is called once
     per mesh. Without it, `decodes === 1`.
   - `meshBounds` returning null, with a dependent cut, gives 0 segments.
2. `apps/cli/src/export-command.test.ts`: a fake `CommandIo` with a
   `meshBounds` spy. Exporting a CAD page with one inline mesh calls the
   spy once, and the SVG equals the export without `meshBounds`.
3. `apps/cli/src/native-parity/export.test.ts`: add a case that exports a
   CAD page with an asymmetric inline mesh. The native SVG is byte-equal to
   the in-process Bun export, following the file's existing parity
   pattern.

## Verification

- `bun test packages/core/src/cad/wireframe.test.ts packages/core/src/svg-export apps/cli/src/export-command.test.ts`
  must exit 0. The wireframe timing test may be retried up to three
  times.
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car2-a2-export-bounds cargo build --release -p nodetto-cli`,
  then
  `NODETTO_CLI_TEST_BINARY="$PWD/target/car2-a2-export-bounds/release/nodetto-cli" bun test apps/cli/src/native-parity/export.test.ts apps/cli/src/native-parity/cad.test.ts`.
  Both must exit 0.
- `bunx biome check --diagnostic-level=warn` on every touched TS file must
  exit 0.

## Done when

- The tests pass, and the existing SVG export tests pass unedited.
- The progress log reads `done`.

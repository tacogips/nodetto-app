# car2-a2-native-host: native nmeshCapture and nmeshBounds host functions (R2-D Hosts)

- planId: car2-a2-native-host
- Wave: 2
- dependsOn: car2-a1-rust-decoder (`decode_inline_with`, `DecodedMesh::to_packet`)
- Design: `design-docs/specs/design-ai-capture.md`, section 20.2 R2-D (the
  Hosts and entry-points bullets) and section 20.3 (staged decoder
  rollout).
- Progress log: `impl-plans/progress/car2-a2-native-host.md`

## Intent

Add the Rust host functions `nmeshCapture` and `nmeshBounds`, together
with their TypeScript readers and optional `CommandIo` members. The packet
writer and its reader land in this one plan.

No caller uses them yet. Native capture keeps forwarding `io.decodeMesh`
(Rust `nmeshDecode`) until plan a2-core-wiring switches it in wave 3.

## Non-goals

- Do not change `nmeshDecode`, its packet or `CommandIo.decodeMesh`. Those
  are the `cad check` path.
- Do not edit `capture-command.ts`, `capture-cad.ts`, `export-command.ts`
  or anything under `packages/`.
- Do not import `@nodetto/core` or `@nodetto/io` types into `commands.ts`
  if that creates a cycle. Declare the shapes structurally.

## Changes

1. `apps/cli/native/src/engine.rs`. Next to `"nmeshDecode"` (`:143-148`):
   - Add `"nmeshCapture" => byte_value(decode_inline_with(&string(args, 0,
     ctx)?, DecodeOptions { max_vertices, need_target }).ok_or_else(||
     host_error("Invalid mesh data."))?.to_packet(), ctx)`.
     - `max_vertices` comes from arg 1, a JS number converted to `u64`. A
       non-finite value or a value at or above 2^53 means unlimited.
     - `need_target` comes from arg 2, read with `to_boolean`.
   - Add `"nmeshBounds"`. It decodes with `max_vertices: 0, need_target:
     false` and returns 48 bytes (six `f64`, little-endian, min x y z then
     max x y z). It returns JS `null` for invalid data or empty bounds.
   - Add both names to the native function list at `:313`.
2. `apps/cli/src/native-engine.ts`. Next to `decodeMesh` (`:73-85`), add:
   - `decodeCaptureMesh(data, options)`. It calls
     `native.nmeshCapture(data, options.maxVertices ?? Infinity,
     options.needTarget === true)` and reads the 64-byte header with a
     `DataView` (little-endian). It returns `{ vertexCount, triangleCount,
     bounds, booleanTarget?, positions?, triangles? }`:
     - positions are `new Float64Array(buffer, 64, 3V)` when bit 0 is set;
     - triangles are `new Uint32Array(buffer, 64 + 24V, 3T)`;
     - `booleanTarget` is present only when bit 1 is set, with the value
       of bit 2;
     - `bounds` is set only when bit 3 is set.
   - `meshBounds(data)`. It calls `native.nmeshBounds` and returns null or
     `{ min: [a, b, c], max: [d, e, f] }` from a `Float64Array(buffer, 0,
     6)`.
3. `apps/cli/src/commands.ts`. Next to `decodeMesh?` (`:114-117`), which
   stays unchanged, add two optional members with structural types:
   - `decodeCaptureMesh?(data: string, options: { readonly maxVertices?:
     number; readonly needTarget?: boolean }): { readonly vertexCount:
     number; readonly triangleCount: number; readonly bounds: { readonly
     min: readonly [number, number, number]; readonly max: readonly
     [number, number, number] } | null; readonly booleanTarget?: boolean;
     readonly positions?: Float64Array; readonly triangles?: Uint32Array
     };`
   - `meshBounds?(data: string): { readonly min: readonly [number, number,
     number]; readonly max: readonly [number, number, number] } | null;`
4. `apps/cli/native/src/engine_tests.rs`. Add tests that evaluate JS in the
   engine context, imitating `:375-392`:
   - `native.nmeshCapture(<asymmetric mesh with negative coordinates>,
     Infinity, true)` read through the same offsets: positions at 64, the
     first index at `64 + 24V`, the six bounds equal the decoded extrema,
     and the flags are 0b1111 or 0b1011 depending on the eligibility
     value.
   - With `maxVertices = 0`: flags have bit 0 clear, and the packet length
     is exactly 64.
   - `native.nmeshBounds` of the same mesh gives six values equal to the
     header bounds. Invalid data gives `null`.
   - `native.nmeshDecode` returns exactly the legacy layout: vertex count
     at byte 0 and positions at byte 8.

## Pitfalls

- The packet buffer is a fresh `ArrayBuffer` from `byte_value`. The
  64-byte header keeps `Float64Array` at offset 64 aligned. Do not change
  the alignment.
- Never alter `"nmeshDecode"`, because `cad check` depends on it
  (`apps/cli/src/cad-command.ts:56`).

## Verification

- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car2-a2-native-host cargo test -p nodetto-cli`
  must exit 0, including the new engine tests.
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car2-a2-native-host cargo build --release -p nodetto-cli`
  must exit 0.
- `NODETTO_CLI_TEST_BINARY="$PWD/target/car2-a2-native-host/release/nodetto-cli" bun test apps/cli/src/native-parity/cad.test.ts apps/cli/src/native-parity/capture.test.ts`
  must exit 0. This shows that `cad check` and capture are unchanged.
- `rustfmt --edition 2021 apps/cli/native/src/engine.rs apps/cli/native/src/engine_tests.rs`
- `bunx biome check --diagnostic-level=warn apps/cli/src/native-engine.ts apps/cli/src/commands.ts`
  must exit 0.

## Done when

- The commands above exit 0, and `nmeshDecode` and `decodeMesh` are
  unchanged in `git diff`.
- The progress log reads `done`.

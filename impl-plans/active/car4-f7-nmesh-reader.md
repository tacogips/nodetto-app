# car4-f7-nmesh-reader

- planId: car4-f7-nmesh-reader; wave 1; dependsOn: none
- planPath: impl-plans/active/car4-f7-nmesh-reader.md
- progressPath: impl-plans/progress/car4-f7-nmesh-reader.md
- Finding: maintainability-nmesh-typescript-validation-owners (R4-7, medium).
- Design: `design-docs/specs/design-cad3d.md` section 21 R4-7.
- writePaths: `packages/nmesh/src/decode.ts`, `packages/nmesh/src/codec.test.ts`,
  `packages/io/src/nmesh/capture-decoder.ts`,
  `packages/io/src/nmesh/capture-decoder.test.ts`,
  `packages/io/src/nmesh/capture-decoder-budget.test.ts`,
  `tmp/car4-r4/car4-f7-nmesh-reader`, `impl-plans/progress/car4-f7-nmesh-reader.md`,
  `target`, `tmp/cad3d`
- sharedPaths: none; artifactRoots: `target`, `tmp/cad3d`

Follow the worker rules in `impl-plans/active/car4-00-overview.md`.

## Intent and context

`decodeNmesh` (`decode.ts:4-98`) and `inspectNmesh` (`:100-208`) duplicate every NMESH
v1 rule; the capture adapter reads the vertex count a third time
(`capture-decoder.ts:132-147`) to decide allocation. Make one reader own the rules and
make the adapter's budget follow `inspection.vertexCount`. No divergence exists today;
the failing-before tests assert the single-owner contract.

Non-goals: no change to `packages/nmesh/src/index.ts` exports, the Rust codec, error
codes or their order, `onAllocate` calls, `needTarget` behavior; `packages/io` never
imports `@nodetto/core`.

## Changes

- `decode.ts`: `export function readNmesh(bytes, mode: "full" | "inspect",
  onAllocate?)` (exported from the file for tests only, not from `index.ts`) applying, in
  today's order: length, magic, version, flags, unit, minimal varints, count-before-CRC,
  CRC, groups, `onAllocate` (full only, same two calls and lengths), positions against
  the per-axis previous value (equal to `positions[index - 3]`), coordinate limit,
  first-use indices, trailing bytes. Full mode fills `Int32Array`/`Uint32Array` and
  groups; inspect mode keeps only previous values and min/max. `decodeNmesh` and
  `inspectNmesh` become thin wrappers with unchanged signatures and results.
- `capture-decoder.ts`: delete the local varint loop; `over =
  inspection.vertexCount > (options.maxVertices ?? Number.POSITIVE_INFINITY)`; keep the
  rest of the flow and allocation calls.

## Pitfalls

- Error precedence: count check before CRC; truncated vs range on the fifth varint byte.
- Inspect mode must not allocate position arrays.
- `mock.module` is process-global in Bun: the budget test must wrap the real module and
  alter only a sentinel payload unused by any other test.

## Tests

- `codec.test.ts` (imitate `expectCode` and `inspector preserves corruption errors` at
  `:380`): over the existing corruption corpus and valid fixtures, `readNmesh` in both
  modes, `decodeNmesh` and `inspectNmesh` agree on error codes, counts and bounds
  (fails before: no `readNmesh`); `onAllocate` sequence for a valid mesh unchanged.
- New `capture-decoder-budget.test.ts`: `mock.module("@nodetto/nmesh", ...)` wrapping
  the real module so `inspectNmesh` reports `vertexCount + 1` only for one sentinel
  payload; dynamic-import the adapter; with `maxVertices` equal to the true count the
  geometry is omitted (fails before: adapter used its own count).
- `capture-decoder.test.ts`: a mesh whose vertex count needs a two-byte varint (>= 128
  vertices) with `maxVertices` equal to the count (geometry kept) and one below
  (geometry omitted, counts and bounds reported); allocation calls as today.

## Verification (each exits 0 and runs tests)

1. `bunx biome check --diagnostic-level=warn packages/nmesh/src/decode.ts packages/nmesh/src/codec.test.ts packages/io/src/nmesh/capture-decoder.ts packages/io/src/nmesh/capture-decoder.test.ts packages/io/src/nmesh/capture-decoder-budget.test.ts && bun test packages/nmesh/src packages/io/src/nmesh`

## Done criteria

- One reader owns the rules; adapter follows inspection; all existing corruption and
  eligibility tests unchanged; progress log `done`.

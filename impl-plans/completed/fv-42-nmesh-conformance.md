# fv-42-nmesh-conformance

- planId: fv-42-nmesh-conformance
- planPath: impl-plans/active/fv-42-nmesh-conformance.md
- progressPath: impl-plans/progress/fv-42-nmesh-conformance.md
- wave: 5
- dependsOn: fv-18-nmesh-codec-model
- Design: sections 7 (nmesh row and conformance rules).
- writePaths: `packages/nmesh/src/codec.formal.test.ts`,
  `impl-plans/progress/fv-42-nmesh-conformance.md`, `tmp/fv-s942/fv-42-nmesh-conformance`,
  `target`, `tmp/cad3d`, `formal/.lake`
- sharedPaths: none
- artifactRoots: `target`, `tmp/cad3d`, `formal/.lake`

Follow `impl-plans/active/fv-00-overview.md`.

## Intent

Tie `packages/nmesh/src` to the Lean NMESH vectors. No product code changes.

## Changes

- `packages/nmesh/src/codec.formal.test.ts` (new): read
  `new URL("../../../formal/vectors/nmesh.json", import.meta.url)`, typed guard.
  - `encodeNmesh` cases: build `{ positions: Int32Array.from(...), triangles:
    Uint32Array.from(...), groups }` and compare `Array.from(bytes)`; errors compare
    `NmeshError.code`.
  - `decodeNmesh` cases: `decodeNmesh(Uint8Array.from(bytes))` -> compare
    `Array.from(positions)`, `Array.from(triangles)`, `groups`; or the error code.
  - `toInline`/`fromInline` cases: exact string and bytes, or the error code.
  Imitate imports in `packages/nmesh/src/codec.test.ts` (from `./index.ts`).

## Pitfalls

- Test files are exempt from `isolation.test.ts`, but keep imports relative
  (`./index.ts`) and `node:fs` only.
- Compare typed arrays as plain arrays.

## Tests

- Every vector case matches (one `test` per `fn` group iterating the cases, with the
  case index in failure messages).

## Acceptance criteria

- [x] The test passes; `isolation.test.ts` still passes.

## Verification (each must exit 0)

1. `cd formal && mise exec -- lake build Nodetto.Nmesh.Codec > ../tmp/fv-s942/fv-42-nmesh-conformance/build.log 2>&1`
2. `bun test packages/nmesh/src/codec.formal.test.ts packages/nmesh/src/isolation.test.ts > tmp/fv-s942/fv-42-nmesh-conformance/test.log 2>&1`
3. `bunx biome check packages/nmesh/src/codec.formal.test.ts`

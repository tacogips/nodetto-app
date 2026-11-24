# car1-m-stl-refusal: early inline refusal in canonicalize (F12)

- planId: car1-m-stl-refusal. Wave 1. dependsOn: none. Gate: none.
- Design: `design-docs/specs/design-cad3d.md` 19 F12.
- Progress log: `impl-plans/progress/car1-m-stl-refusal.md`.

## Intent

An STL whose surviving triangle count already proves that the inline
payload cannot fit is refused before sorting and encoding, with the
existing `nmesh.inline` error.

## Non-goals

- Do not edit `packages/nmesh/src/index.ts`, `decode.ts` (plan a1),
  `stl-import.tsx` or `mesh-io.ts`.
- No change to accepted bytes.

## Changes

1. `packages/nmesh/src/canonical.ts`, `canonicalize(mesh, options?: { inline?: boolean })`:
   - After the weld and degenerate-removal loop (around `:93-112`) and
     before `ordered.sort`, throw `new NmeshError("nmesh.inline")` when
     `inline` is set and `ordered.length > maxInlineTriangles`.
   - `maxInlineTriangles` is computed in the codec files, not in io. It is
     the largest triangle count whose smallest possible encoding still
     fits `NMESH_INLINE_MAX_CHARS` after base64 and `NMESH_INLINE_PREFIX`
     (`armor.ts`):
     - header bytes plus at least `MIN_TRIANGLE_BYTES` per triangle;
     - derive `MIN_TRIANGLE_BYTES` from `encode.ts` (index codes are
       varints of at least one byte each, so at least 3);
     - export the constant from `encode.ts` for `canonical.ts` only.

     Rounding must keep the bound conservative.
2. `packages/io/src/cad-mesh.ts` `stlToInlineMesh`: call
   `canonicalize(readStl(bytes), { inline: true })`. `toInline` stays the
   exact final guard.

## Pitfalls

- Count only surviving triangles: after welding and degenerate removal,
  never raw facets.
- `canonical.ts` has no later deduplication, so the count is final.
- `packages/io` imports only `@nodetto/nmesh` through
  `packages/io/src/nmesh/index.ts`. Never import a package-internal path
  or `@nodetto/core`.

## Tests

- `packages/nmesh/src/codec.test.ts`:
  - an oversized generated plate (more surviving triangles than the
    cutoff) makes `canonicalize(mesh, { inline: true })` throw
    `nmesh.inline`. Before the fix it returns;
  - over generated random accepted meshes, `encodeNmesh(...).length` is
    at least `header + MIN_TRIANGLE_BYTES * triangles`.
- `packages/io/src/cad-mesh.test.ts`:
  - a high-facet input dominated by degenerate triangles still imports;
  - the inline bytes of existing accepted fixtures are unchanged.
- `packages/ui-solid/src/cad/mesh-io.test.ts`: the oversized plate shows
  the existing size message.

## Verification

1. `biome check packages/nmesh/src/canonical.ts packages/nmesh/src/encode.ts packages/nmesh/src/codec.test.ts packages/io/src/cad-mesh.ts packages/io/src/cad-mesh.test.ts packages/ui-solid/src/cad/mesh-io.test.ts && bun test packages/nmesh/src/codec.test.ts packages/io/src/cad-mesh.test.ts packages/ui-solid/src/cad/mesh-io.test.ts packages/nmesh/src/isolation.test.ts`
   must exit 0.
2. `bun run typecheck && bun test packages/nmesh packages/io/src/cad-mesh.test.ts`
   must exit 0.

## Done when

- The early refusal happens before the sort.
- Degenerate-heavy input still imports.
- Accepted bytes are identical.

## Implementation status

- Source and regression coverage implemented; focused gate passed.
- Full plan gate remains blocked by concurrent TypeScript errors and the package measurement test writing outside authorized artifact roots; see progress log.
- Formal review and integration remain downstream.

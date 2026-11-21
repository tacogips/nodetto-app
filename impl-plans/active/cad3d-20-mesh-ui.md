# M20 cad3d-20-mesh-ui

- dependsOn: M13 (`cad.mesh`), M10 (`CadIds`, `authoring.ts`), M19 (viewport)
- Design: sections 9, 12, 13
- writePaths: `packages/ui-solid/src/cad/mesh-io.ts` (new) and its test,
  `packages/ui-solid/src/cad/CadViewport.tsx` (file drop and import action
  only), `packages/ui-solid/src/ExportDialog.tsx`,
  `apps/desktop/src/shell/export-handlers.ts` and its test,
  `packages/core/src/layer-name.ts` (name for `cad.mesh`)

## Contract

```ts
// packages/ui-solid/src/cad/mesh-io.ts
export function stlToMeshCommands(pageId: PageId, bytes: Uint8Array, name: string, ids: CadIds,
  after?: string): { commands: Command[] } | { error: string };
export function bodiesToStl(bodies: readonly CadDisplayBody[], options?: { includeReference?: boolean }): Uint8Array;
```

## Behavior

- `stlToMeshCommands`: `readStl`, `canonicalize`, `encodeNmesh`,
  `toInline`; always stores the canonical form. Errors are user messages:
  unreadable file, more than the triangle limit, or "mesh too large for an
  inline body (limit 1 MiB encoded); simplify it first". One
  `createElement` at the end of history (one undo step).
- `bodiesToStl`: non-reference bodies whose feature is not hidden, through
  `writeBinaryStl`; an imported mesh is an ordinary body and is included;
  the PCB board (reference) is excluded unless `includeReference`.
- UI: dropping an `.stl` file on the CAD viewport or choosing the import
  action in the CAD palette applies `stlToMeshCommands` and shows the error
  text in the viewport status strip. `ExportDialog` offers "STL (3D model)"
  only on a CAD page (next to the existing page-kind checks at
  `ExportDialog.tsx:142,198`); SVG, PNG and PDF stay (M18 gives them
  content). The desktop handler takes the bodies of the last engine result
  and saves the bytes through the existing binary save path in
  `export-handlers.ts`.

## Tests

- `mesh-io.test.ts`:
  - STL of a box to commands, applied on a CAD page, validates; the stored
    payload decodes to twelve triangles with the original coordinates
    within 1 micrometre.
  - Byte-identical re-export: STL A is imported into document 1, the
    result is evaluated with the real kernel and exported with
    `bodiesToStl` (STL B); STL B is imported into document 2 and exported
    again (STL C); B and C are byte identical, and the `cad.mesh.data`
    strings of the two imports of B are identical.
  - An oversized sphere mesh returns the size error and no command; a
    corrupt file returns an error; the commands on a freeform page fail
    with `page.contentKind` (rule R).
  - `bodiesToStl` skips a reference body and includes it with the option.
- `export-handlers.test.ts`: the STL branch is offered for a CAD page only
  and writes the bytes it was given.

## Acceptance criteria

- Import is one undo step; export contains exactly the non-reference
  bodies.

## Verification (each must exit 0)

1. `sh -c 'bun run typecheck && bun test packages/ui-solid/src/cad apps/desktop/src/shell/export-handlers.test.ts packages/ui-solid/src/export-dialog-document.test.ts'`
2. `sh -c 'mkdir -p tmp/cad3d/m20; bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess > tmp/cad3d/m20/strict.log 2>&1; ! grep -E "^packages/(core|ir)/src/" tmp/cad3d/m20/strict.log | grep -vqE "\.test\.tsx?\(" && bun test packages/ui-solid/src/cad/mesh-io.test.ts'`
3. `sh -c 'bunx biome check packages/ui-solid/src/cad packages/core/src/layer-name.ts && bun test packages/ui-solid/src/cad/mesh-io.test.ts'`

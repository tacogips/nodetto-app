# M13 cad3d-13-mesh-import-export (type and evaluation)

- dependsOn: M7 (worker host), M12 (NMESH, STL)
- Design: sections 3.2 (`cad.mesh`), 7.1, 7.3 (inline armour, validator), 13
- writePaths: `packages/ir/src/cad.ts`, `packages/ir/src/registry/cad.ts`,
  `packages/ir/src/cad.test.ts`, `packages/ir/src/registry.test.ts`
  (append `cad.mesh`), `packages/io/src/__fixtures__/cad3d.jsonl`,
  `packages/core/src/cad/evaluate.ts` and its test,
  `packages/core/src/shapes/cad.ts`,
  `packages/cad-kernel/src/worker-host.ts` and its test,
  `packages/cad-kernel/package.json` (dependency `@nodetto/io`)

## Contract

```ts
// packages/ir/src/cad.ts
export interface CadMeshSemantic { name: string; data: string; suppressed?: boolean }
export const CAD_MESH_DATA_MAX_CHARS = 1_048_576 + 7; // "nmesh1:" + payload
// packages/core/src/cad/evaluate.ts
export interface CadEvaluateOptions { decodeMesh?: (data: string) => ToolMesh } // throws on invalid data
export function evaluateCadPage(elements, kernel, memo, options?: CadEvaluateOptions): CadEvaluation;
// CadEvaluation gains: readonly displayOnly: readonly { id: ElementId; mesh: ToolMesh }[]
```

## Behavior

- `cad.mesh` joins `CAD_ELEMENT_TYPES` (category `node`, keep flag, no
  references). Validator: `name` string; `data` string with
  `data.length <= CAD_MESH_DATA_MAX_CHARS` checked first, then one
  `RegExp.test` with `/^nmesh1:[A-Za-z0-9+\/]+={0,2}$/` (the pattern of
  `packages/ir/src/image.ts:16-24`; no loop in TypeScript, no decode).
- Evaluation: a `cad.mesh` creates an ordinary body (`reference: false`),
  so it can be named in `bodies` and is exported. `decodeMesh` missing
  gives status `cad.mesh.unsupported`; a throw gives `cad.mesh.invalid`.
  When the kernel rejects the mesh as non-manifold the feature gets status
  `cad.mesh.open`, no kernel body exists, and the decoded triangles are
  returned in `displayOnly` so the viewport still draws them as reference
  geometry; the `CadKernel` port is not changed. Features naming such a
  body get `cad.body.missing`. Content key = `contentKey` of the data
  string. The single face name is `<id>:mesh`.
- Worker host passes `decodeMesh` built from `fromInline`, `decodeNmesh`
  and `toTriangleMesh` of `@nodetto/io/nmesh`, converts `displayOnly`
  entries with `displayBody(id, true, ...)` and appends them to `bodies`.
- Default semantic in `shapes/cad.ts`: a tetrahedron payload produced once
  by the test helper and pasted as a string constant.
- Fixture: append one tiny `cad.mesh` (the same tetrahedron) to
  `cad3d.jsonl`.

## Tests

- IR: validator accepts the fixture payload; rejects wrong prefix, an
  illegal character, over-long data, empty payload. `registry.test.ts`
  exact list gains `cad.mesh`; golden round trip stays byte identical;
  validating a maximum-length payload takes under 50 ms in Bun.
- `evaluate.test.ts` (recording kernel): one `solid` for a mesh body;
  missing decoder and throwing decoder give the two statuses; unchanged
  data is not re-solidified; a kernel that throws on `solid` gives
  `cad.mesh.open` and one `displayOnly` entry; a cut naming the mesh body
  issues a boolean.
- `worker-host.test.ts` (real kernel): a document whose mesh is a box
  (payload built in the test with `canonicalize`, `encodeNmesh`,
  `toInline`) returns a body whose bounding box equals the box within
  1 micrometre; cutting it with an extrude reduces the measured volume by
  the analytic amount; an open mesh (one triangle removed) returns a
  reference display body and status `cad.mesh.open`.

## Acceptance criteria

- `packages/core` still has no dependency on `@nodetto/io` at run time
  (decoder is injected); asserted by reading `packages/core/package.json`.

## Verification (each must exit 0)

1. `sh -c 'bun run typecheck && bun test packages/ir/src packages/io/src/jsonl packages/core/src/cad packages/cad-kernel apps/cli/src/edit/label-field.test.ts'`
2. `sh -c 'mkdir -p tmp/cad3d/m13; bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess > tmp/cad3d/m13/strict.log 2>&1; ! grep -E "^packages/(core|ir)/src/" tmp/cad3d/m13/strict.log | grep -vqE "\.test\.tsx?\(" && bun test packages/core/src/cad/evaluate.test.ts'`
3. `sh -c 'bunx biome check packages/ir/src/cad.ts packages/ir/src/registry/cad.ts packages/core/src/cad packages/cad-kernel && bun test packages/cad-kernel/src/worker-host.test.ts'`

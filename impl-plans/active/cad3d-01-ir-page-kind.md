# M1 cad3d-01-ir-page-kind

- dependsOn: none
- Design: sections 3.1 to 3.3, 4 (rule R, IR row), 7.2, 16
- writePaths: `packages/ir/src/types.ts`, `packages/ir/src/cad.ts` (new),
  `packages/ir/src/page-content.ts` (new), `packages/ir/src/registry/cad.ts`
  (new), `packages/ir/src/registry/definition.ts` (one optional field),
  `packages/ir/src/registry.ts`, `packages/ir/src/semantics.ts`,
  `packages/ir/src/validate.ts`, `packages/ir/src/index.ts`,
  `packages/ir/src/cad.test.ts` (new), `packages/ir/src/page-content.test.ts`
  (new), `packages/ir/src/registry.test.ts`, `packages/ir/src/validate.test.ts`,
  `packages/io/src/__fixtures__/cad3d.jsonl` (new),
  `packages/io/src/jsonl/golden.test.ts`, `packages/core/src/shapes/cad.ts`
  (new), `packages/core/src/shapes/index.ts`, `apps/cli/src/types-command.ts`
- Compile fallout: any other exhaustive `Record<PageKind, ...>` that `tsc`
  reports may get a minimal `cad3d` entry; list each in the commit message.

## Intent

Introduce the page kind and the first CAD element types, and make rule R part
of document validation. Imitate `packages/ir/src/pcb.ts` and
`packages/ir/src/registry/pcb.ts`.

## Contract

```ts
// packages/ir/src/cad.ts
export const CAD_PAGE_KIND = "cad3d";
export const CAD_ELEMENT_TYPES = [
  "cad.sketch", "cad.line", "cad.arc", "cad.circle", "cad.extrude",
] as const;
export type CadElementType = (typeof CAD_ELEMENT_TYPES)[number];
export function isCadElementType(type: string): type is CadElementType;
export function isCadTypeName(type: string): boolean; // type.startsWith("cad.")
export type CadXY = readonly [number, number];
export interface CadFaceRef { readonly feature?: ElementId;
  readonly role: "start" | "end" | "side"; readonly entity?: ElementId }
export type CadPlane =
  | { readonly base: "xy" | "yz" | "zx"; readonly offset?: number }
  | { readonly face: CadFaceRef };
export interface CadSketchSemantic { name: string; plane: CadPlane }
export interface CadLineSemantic { sketch?: ElementId; a: CadXY; b: CadXY; construction?: boolean }
export interface CadArcSemantic { sketch?: ElementId; a: CadXY; m: CadXY; b: CadXY; construction?: boolean }
export interface CadCircleSemantic { sketch?: ElementId; c: CadXY; r: number; construction?: boolean }
export const CAD_OPERATIONS = ["new", "add", "cut", "intersect"] as const;
export interface CadExtrudeSemantic { name: string; sketch?: ElementId;
  loops?: readonly ElementId[]; distance: number; symmetric?: boolean;
  op: (typeof CAD_OPERATIONS)[number]; bodies?: readonly ElementId[]; suppressed?: boolean }
export function isOnCadGrid(value: number): boolean; // roundNm(value) === value, finite
// packages/ir/src/page-content.ts
export function pageAcceptsElementType(kind: string, type: string): boolean;
// packages/ir/src/registry/definition.ts, new optional field on ElementTypeDefinition
readonly keepsExternalReferences?: boolean; // consumed by the clipboard in M2
```

## Behavior

- `PAGE_KINDS` gains `"cad3d"` (last). Update the comment: kinds do not
  restrict content except `cad3d` (rule R). `PAGE_MODES` is not touched (M6).
- `pageAcceptsElementType`: for a `cad.` type, true only when `kind` is
  `cad3d`; for any other type on a `cad3d` page, true only when the type is
  registered with category `resource`; otherwise true.
- Registry definitions: category `node` (as `packages/ir/src/registry/pcb.ts:439`;
  `resource` would hide the elements from layers and autosave);
  `keepsExternalReferences: true`; key order as the design table;
  `references()` returns `sketch`, `plane.face.feature`,
  `plane.face.entity`, `loops[i]`, `bodies[i]` with dotted paths in the
  style of `packages/ir/src/registry/containers.ts:122`. Sketch entities use
  `onReferenceDeleted: "cascade"`, sketch and extrude use `"detach"`.
- `validateSemantic` accepts every detached shape of the design section 3.2
  table: no reference field is required; `sketch`, `plane.face.feature`,
  `plane.face.entity` may be absent; `bodies` and `loops` may be absent or
  empty for every `op`. It rejects: wrong types, unknown enum values, a
  reference field that is present but not a non-empty string, non-finite or
  off-grid numbers, `r <= 0`, `distance === 0`, `|coordinate| > 10000`, arc
  points that are not pairwise distinct, a `plane` that is neither form.
- `validateDocument`: for every element whose page exists, error
  `page.contentKind` at `elements[i].page` when
  `pageAcceptsElementType(page.kind, element.type)` is false.
- `packages/core/src/shapes/cad.ts`: one `ShapeUtil` per CAD type with
  `canResize: false`, `getBounds` returning `null`, `hitTest` false,
  `defaultVisual` `{}` and a `defaultSemantic` that passes the validator
  without any reference (for example a line from (0,0) to (10,0), an
  extrude with `distance: 10, op: "new"`), registered in `shapes/index.ts`
  (pattern: `pcb.board` in `packages/core/src/shapes/pcb.ts:49-52`).
- Fixture `cad3d.jsonl`: self-authored document with one `cad3d` page, two
  sketches (one on `{"face":{...,"role":"end"}}`), lines, one arc, one
  circle, two extrudes (`new`, and `cut` with a negative distance), one
  `design.token` on the CAD page, in canonical order.

## Tests

- `page-content.test.ts`: truth table (cad type on cad page true; `shape.geo`,
  `image.raster`, `frame` on cad page false; `design.token`,
  `design.text-style`, `design.guide`, `presentation.slide`,
  `review.comment` on cad page true; `cad.line` on `freeform`, `pcb` false;
  unknown `cad.future` on cad page true; unknown `x.y` on cad page false).
- `cad.test.ts`: each validator accepts the fixture payloads and each
  detached shape of design 3.2 (absent `sketch`, `bodies: []` with `op:
  "cut"`, `loops: []`, face without `feature`, side face without `entity`);
  rejects an off-grid number, zero distance, `sketch: ""`, a bad plane.
  Every CAD definition has category `node` and the keep flag.
- `validate.test.ts`: `page.contentKind` both directions; every existing
  golden fixture still validates without that code.
- `registry.test.ts`: extend the exact sorted list with the five types.
- `golden.test.ts`: add `"cad3d"` to `GOLDEN`; round trip is byte identical.
- `apps/cli/src/edit/label-field.test.ts` passes unchanged.

## Acceptance criteria

- Contract exported from `@nodetto/ir`; tests above pass.
- No change to `SCHEMA_VERSION`, `MIGRATIONS` or `PAGE_MODES`.
- The whole `bun test` run passes; log in `tmp/cad3d/m1/full.log`.

## Verification (each must exit 0)

1. `sh -c 'bun run typecheck && bun test packages/ir/src packages/io/src/jsonl apps/cli/src/edit/label-field.test.ts packages/ui-solid/src/canvas/canvas-background.test.ts'`
2. `sh -c 'bunx biome check packages/ir/src packages/io/src/jsonl/golden.test.ts packages/core/src/shapes/cad.ts apps/cli/src/types-command.ts && bun test packages/ir/src/page-content.test.ts'`
3. `sh -c 'mkdir -p tmp/cad3d/m1; bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess > tmp/cad3d/m1/strict.log 2>&1; ! grep -E "^packages/(core|ir)/src/" tmp/cad3d/m1/strict.log | grep -vqE "\.test\.tsx?\(" && bun test packages/ir/src/cad.test.ts'`
4. `sh -c 'mkdir -p tmp/cad3d/m1 && bun test > tmp/cad3d/m1/full.log 2>&1'`

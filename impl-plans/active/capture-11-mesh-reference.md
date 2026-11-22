# M11 capture-11-mesh-reference

- dependsOn: M18 (the compositing order of shading, edges and hatch
  that reference styling is inserted into; the pair and census rules
  that exclude open meshes; the body notes of `describeBodies`)
- Design: sections 6.1 (meshes), 6.4 (mesh intervals), 6.5 (reference
  bodies), 6.7
- writePaths: `packages/core/src/capture/scene.ts` and its test,
  `packages/core/src/capture/cad-request.ts` and its test (the decoder
  option), `apps/cli/src/capture-help/cad.ts`,
  `crates/capture/src/mesh.rs` (new), `crates/capture/src/raster.rs`,
  `crates/capture/src/shade.rs`, `crates/capture/src/interference.rs`,
  `crates/capture/src/lattice.rs`,
  `crates/capture/src/lib.rs`, `crates/capture/tests/mesh.rs` (new),
  `apps/cli/src/capture-cad.ts` and its test,
  `apps/cli/src/native-parity/capture.test.ts`
- Pre-authorised: `buildCadCaptureModel` gains an optional third
  argument; the M5 test that expects a mesh feature in `skipped` is
  changed to expect it there only when no decoder is given.

## Contract

```ts
// scene.ts
export type CaptureMeshDecoder = (data: string) => { positions: Float64Array; triangles: Uint32Array };
export function buildCadCaptureModel(elements: readonly Element[], pageId: PageId,
  options?: { readonly decodeMesh?: CaptureMeshDecoder }): CadCaptureModel;
// cad-request.ts: CadCaptureRequest gains
readonly decodeMesh?: CaptureMeshDecoder;
// CadCaptureModel.tools becomes readonly (CaptureTool | CaptureMeshTool)[]
```

```rust
// mesh.rs
pub struct MeshView { /* per mesh and ray family: projected triangles binned in a grid */ }
impl MeshView {
  pub fn new(mesh: &Mesh, tool: u32, family: &RayFamily, window: Option<Window>) -> MeshView;
  pub fn closed(&self) -> bool;
  pub fn intervals(&self, ray: &Ray, scratch: &mut Vec<Boundary>, out: &mut Intervals);
  pub fn first_hit(&self, ray: &Ray) -> Option<Boundary>;   // for open meshes
  pub fn bounds(&self) -> ([f64; 3], [f64; 3]);
}
```

## Behavior

- Model: a `cad.mesh` feature with a decoder becomes a mesh tool and a
  body whose first step is the union with it; later features may target
  it like any body. A decoder that throws gives the status
  `cad.mesh.invalid` for that feature (the code the evaluator uses for a
  failed decode, `packages/core/src/cad/evaluate.ts`, mesh branch) and no
  body. The CLI
  passes, through `CadCaptureRequest.decodeMesh`,
  `(data) => toTriangleMesh(decodeNmesh(fromInline(data)))` from
  `@nodetto/io/nmesh` (the decoder of `packages/cad-kernel/src/worker-host.ts:47-49`),
  converting positions to `Float64Array` when needed.
- Closedness: every undirected edge is used by exactly two triangles and
  no triangle is degenerate; found by sorting the edge list (no hash
  map). A mesh that fails is open.
- `MeshView::new`: project every vertex on the two axes perpendicular to
  the family direction; bin triangles into a uniform grid over the
  projected bounds (`window` restricts it to the picture for the camera
  family) with about two triangles per cell on average, at most 1,048,576
  cells.
- `intervals` (closed meshes): test the triangles of the ray's cell with
  a half-open edge rule (an edge function value of exactly zero counts
  for the edge whose direction is up, or horizontal and leftward, in the
  projected plane), so a ray through a shared edge or vertex counts each
  crossing once; sort crossings; pair them; an odd count drops the last
  crossing. Face id is 0; the normal is the triangle's.
- Open meshes: the body is not solid. It is drawn from `first_hit` with
  reference styling, steps other than its creator are ignored, it is
  excluded from `candidates`, and its `BodyReport.open` is true.
- Reference styling (design 6.5): for a sample whose nearest body is a
  reference body or an open mesh, the colour is `mix(behind, shade,
  reference_opacity / 255)` where `behind` is the shaded colour of the
  nearest body that is neither, or the background. Edges of reference
  bodies are drawn as for other bodies. The interference overlay is
  applied afterwards, unchanged. Body state (design 6.7): a solid body
  is `Drawn` when it is the nearest solid on some sample, whatever
  reference bodies or open meshes lie in front of it; a reference body
  or open mesh is `Drawn` when it is nearest overall on some sample.
- CLI text: an open mesh is listed in `bodies:` as `<name> [open mesh,
  not checked]` (the note `describeBodies` already knows); the JSON body
  entry has `"open": true`. The help part `cad.ts` gains two sentences
  on meshes and reference bodies.

## Tests

- `scene.test.ts`: a mesh feature with a decoder gives a mesh tool and a
  body; a cut targeting the mesh appends a step; a throwing decoder
  gives `cad.mesh.invalid`; without a decoder the feature is in
  `skipped`.
- `tests/mesh.rs` (meshes built in code: a cube of 12 triangles, a
  tetrahedron, a cube with one triangle removed, a 64 x 32 sphere made
  with square roots only):
  - cube: closed; a ray through the centre gives one interval of the
    edge length; rays through a face diagonal (shared edge) and through a
    corner give one interval or none, never an odd count; 10,000 rays on
    a lattice that hits vertices and edges all give even counts;
  - sphere: interval lengths match the chord length within the
    tessellation error;
  - open cube: `closed()` is false; `first_hit` returns the nearest
    triangle;
  - a prism cut out of the cube mesh shows the background through the
    hole in a rendered picture; the cube mesh and a box body that overlap
    are reported by `analyse_pair` within 2% of the exact overlap volume;
  - an open mesh that overlaps a body is not reported and its body is
    drawn mixed with what is behind;
  - a reference body in front of a body: the pixel is the 45% mix of the
    two shades, checked against the two single-body renders, and the
    body behind is `Drawn`, not `Hidden`; behind an opaque body it is
    `Hidden`;
  - a stepped mesh (two parallel treads and a riser) seen from behind
    the step, so the riser is hidden: edge pixels separate the two
    treads although their ids and normals are equal (the chord rule of
    design 6.5); a 64 x 32 sphere has edge pixels only on its outline;
  - release only: a mesh of 200,000 triangles renders at 1024 x 768 in
    under 3,000 ms on one thread (printed to `tmp/capture/m11/`);
  - the triangle grid holds at most `4 * triangles + cells` listings and
    exposes its average occupancy for the work estimate.
- `capture-cad.test.ts`: the decoder is passed; open mesh text.
- `native-parity/capture.test.ts`: a document made in the test with one
  `cad.mesh` cube (NMESH written with the repository's encoder) and one
  extrude that cuts it captures natively with exit 0, lists one body,
  and two runs give equal bytes; a document with a
  `cad.pcb` reference body captures and lists the board.

## Acceptance criteria

- Imported meshes and PCB reference bodies appear in the picture and
  take part in cuts and in interference where they are solids.
- An open mesh is shown and labelled, never treated as a solid.

## Verification (each must exit 0)

1. `sh -c 'CARGO_TERM_QUIET=true cargo fmt --all -- --check && CARGO_TERM_QUIET=true cargo clippy -p nodetto-capture --all-targets -- -D warnings && CARGO_TERM_QUIET=true cargo test -p nodetto-capture'`
2. `sh -c 'mkdir -p tmp/capture/m11 && CARGO_TERM_QUIET=true cargo test --release -p nodetto-capture --test mesh -- --nocapture > tmp/capture/m11/mesh.txt 2>&1 && grep -Eq "test result: ok\. [1-9][0-9]* passed; 0 failed; 0 ignored" tmp/capture/m11/mesh.txt'`
3. `sh -c 'bun run typecheck && bun run lint:ts && bun test packages/core/src/capture apps/cli/src/capture-cad.test.ts'`
4. `sh -c 'mkdir -p tmp/capture/m11; bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess > tmp/capture/m11/strict.log 2>&1; ! grep -E "^packages/(core|ir)/src/" tmp/capture/m11/strict.log | grep -vqE "\.test\.tsx?\(" && bun test packages/core/src/capture/scene.test.ts'`
5. `sh -c 'CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity/capture.test.ts'`

## Progress

Pending.

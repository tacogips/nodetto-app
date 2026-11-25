# car14-p2c-bracket-scene-control

- planId: car14-p2c-bracket-scene-control; wave 2
- dependsOn: car14-p2b-ts-attachment-sides, car14-p5-pcb-profile-cache
- progressPath: impl-plans/progress/car14-p2c-bracket-scene-control.md
- Finding: `maintainability-capture-face-contact-hides-shell-overlap`
  (high): the capture-level scene control.
- Design: `design-docs/specs/design-ai-capture.md` 31.1 R14-2 (TypeScript
  scene control), 31.2 (evidence ownership).
- Worker rules: `car14-00-overview.md`.
- Evidence: `tmp/car14-r14/car14-p2c-bracket-scene-control/`.

## Intent and context

This plan adds a test only. It proves that capture treats the
overlapping bracket mesh as display-only end to end:
- a cut that targets the mesh and a plate reports `cad.body.missing`;
- both bodies keep union-only steps;
- the scene bytes equal the uncut control.

It runs after p2b, which made the decoder reject the mesh, and after p5,
which also edits `scene.test.ts`.

Evidence (design 31.2): cite p2b's
`tmp/car14-r14/car14-p2b-ts-attachment-sides/fail-before.log` in the
progress log. Record only passing runs on current source.
- Do not revert `capture-decoder.ts` or any other source.
- Do not check out older commits.
- Do not try to make this test fail.

Non-goals:
- No production edits.
- Do not edit the existing test "touching shell cuts survive capture as a
  whole" (`packages/core/src/capture/scene.test.ts`, near `:1811`).
- Do not edit p5's shared-board test.

## Changes (`packages/core/src/capture/scene.test.ts`)

Re-read the file fresh; p5 has edited it. Add one test after "touching
shell cuts survive capture as a whole":
`touching bracket with a second overlap stays display-only`.

1. Fixture builders, local to the new test:
   - Use the same bracket outline, top triangles, block and two
     triangulations (A and B) as car14-p2b. Write them literally; do not
     import them from the io test.
   - Build `{ positions, triangles }` meshes like `contactBox` does (near
     `:1760`), then
     `toInline(encodeNmesh(canonicalize(readStl(writeBinaryStl([bracket, block])))))`.
2. Documents, for each triangulation. Imitate the existing test's
   `uncut`/`elements` structure exactly:
   - the mesh `cadElement("mesh", "cad.mesh", "a0", { name, data })`;
   - the plate sketch at `xy` offset 5 with `rectangle(0, 0, 10, 10)`,
     extruded 5 as `new`;
   - the opening sketch with `rectangle(1, 1, 2, 2)`;
   - the cut, which exists only in `elements`: distance 10,
     `op: "cut"`, `bodies: ["mesh", "plate"]`.
3. Assertions, with `options = { decodeMesh: decodeCaptureMeshWith }`:
   - `buildCadCaptureModel(elements, ...)` reports a `cad.body.missing`
     error.
   - `model.bodies.map((b) => b.steps.at(-1)?.op)` equals
     `["union", "union"]`.
   - With the same request as the existing test (320x240, dark, `iso`),
     the `prepareCadCapture` bytes for `elements` equal those for
     `uncut`.

## Tests

- Triangulation A -> `cad.body.missing`, union-only, equal bytes.
- Triangulation B -> the same.
- The existing touching-shell test still passes: edge, face and crossed
  contact cut both bodies; the separated case cuts; open and overlap
  report `cad.body.missing`.

## Verification (each exits 0)

1. `bunx biome check packages/core/src/capture/scene.test.ts`
2. `bun test packages/core/src/capture/scene.test.ts`

## Done criteria

Implementation completed; formal review is pending.

- Commands 1-2 exit 0, and the new test is listed as passed.
- The progress log cites p2b's fail-before log path and records the
  passing logs and exit codes.
- The diff stays inside writePaths.
- The progress log reads `done`.

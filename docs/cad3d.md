# 3D CAD pages

Add a page in **3D CAD** mode to model a part alongside your drawings and
PCB pages. CAD pages accept sketches, features and document resources.
Drawings and PCB shapes stay on their own pages. The 3D editor uses the
diagram canvas colour preference.

## Sketch and extrude

1. Choose **Sketch** to start on a base plane. To sketch on a planar face,
   first select the face. Use the inspector to change a base plane or offset.
2. Draw a closed profile with lines, rectangles, circles and three-point arcs.
   Mark reference geometry as construction so it stays out of the profile.
3. Select the sketch and choose **Extrude**. Drag the signed handle or edit
   the distance in the inspector. The inspector also controls symmetry,
   suppression, the operation and target bodies. Extrude can create a body,
   add to it, cut from it, or intersect it.
4. Use the Layers panel to select, rename or reorder features. Keep features
   after the shapes they reference. The feature list and viewport describe
   missing references and invalid profiles. The normal Undo and Redo actions
   apply to committed edits.

Drag to orbit, Shift-drag or middle-drag to pan, scroll to zoom, and
double-click the viewport to fit the model. A page that has visible sketches
but no solid body yet fits those sketches instead, both when it opens and on
double-click. Hidden sketches do not affect the fit. A page with neither
fits a default box around the origin.

## Reference a PCB

Choose **PCB board** on a CAD page and select a board from the same
document. A document with one eligible board inserts it directly. The
reference follows the source board's visible Edge.Cuts and its thickness.
The CAD inspector can relink the reference or override its thickness.
Sketches on the two board caps follow the reference when it changes.
Use the separate CAD solids for enclosure geometry. Deleting the source
board detaches the reference, and Undo restores the link.

## Exchange and construction views

- Drop one STL file into the viewport or use **Import STL**. Nodetto reads
  binary and ASCII STL in millimetres. A closed mesh can participate in
  solid operations. In capture, closed shells may touch along an edge or face when their bounding boxes have disjoint interiors; other touching shells stay display-only. An open mesh can be viewed as reference geometry.
- Choose **Export > STL (3D model)** to save visible solid bodies as binary
  STL. PCB references and open mesh references are excluded.
- Whole-page SVG, PNG and PDF exports show a labelled **Construction view**.
  It projects the extrusion tools and PCB outlines and marks imported
  meshes with bounding boxes. The path includes the cap outlines and the
  joins between sketch entities. To exchange the final Boolean geometry,
  use STL. The CLI can export the construction view without a 3D kernel.
- `nodetto-cli capture` renders a shaded picture of the solids from a chosen
  view and reports overlapping bodies; see [Capture](capture.md).

## Files, Git and collaboration

A Nodetto document is UTF-8 JSONL. Each page and element occupies its own
record. CAD pages use kind `cad3d`. The `cad.sketch`, `cad.line`, `cad.arc`,
`cad.circle`, `cad.extrude`, `cad.pcb` and `cad.mesh` element records store
authored geometry and references. Ordinary parametric CAD regenerates its
display mesh on open. Imported geometry stores a canonical NMESH v1
payload as `nmesh1:` followed by base64 in its mesh record. NMESH uses
micrometre integer coordinates, delta encoding, grouped triangles and
a CRC-32 integrity check. One imported mesh occupies one line.

A parameter edit normally changes its feature's line. The Nodetto merge
driver matches records by ID and combines independent edits. A conflict on
the same authored field is reported for resolution. Configure the driver in
each clone. [CLI and live co-editing](cli.md#drawing-with-ai-agents-and-live-co-editing)

In `.gitattributes`:

```text
*.jsonl merge=nodetto
```

In the clone:

```bash
git config merge.nodetto.name "nodetto three-way merge"
git config merge.nodetto.driver "nodetto-cli merge %O %A %B --output %A"
```

## Limits and planned work

- Model coordinates stay within 10 m of the origin. CAD pages have a limit
  of 20,000 elements, a loop can have up to 20,000 vertices, and a body can
  have up to 2,000,000 triangles. Imported mesh payloads have an inline cap
  of about 1 MiB. CAD parameters use a one-nanometre grid.
- The solid kernel uses faceted surfaces. Build closed, non-self-intersecting
  profiles within the model limits. If WebGL2, workers or WASM are
  unavailable, the viewport shows a message and the panels remain editable.
- Phase 2 covers revolve, patterns, parameter expressions, tessellation and
  display settings, external mesh attachments and optional cached meshes,
  planar/faceted STEP and 3MF export, component heights and body-as-tool
  Boolean operations.
- Phase 3 covers sketch constraints, fillets and chamfers, exact curved
  surfaces and STEP import.

## Hosted CAD follow-up

The local desktop release supports CAD pages. Cloud authoring is gated on
the hosted rollout. The remaining hosted work is to:

1. Add CAD records and page repair to the sync Worker.
2. Gate older clients when a document contains CAD pages.
3. Serve the WASM with the correct content type, host the worker and update
   the hosted CSP and notices.
4. Review message-size and storage limits for imported meshes and future
   attachments.
5. Decide whether to generate CAD thumbnails on the server.

[Technical design](../design-docs/specs/design-cad3d.md)

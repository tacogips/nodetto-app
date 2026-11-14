# Flowchart example

Select **Mode → Flowchart**, or expand the **Flowchart** category in General.
The palette offers Start, End, Process, Decision, Input / Output and Database.
Draw Flow arrows between shapes and edit their labels to show conditions such as
Yes and No. On flowchart pages, new arrows use orthogonal routing by default;
routing, waypoints and labels remain editable in the existing connector inspector.

With Flow or Connector selected, hovering a shape reveals four connection points
on its outline. Drag from a point and release near another to snap (12 screen
pixels). The chosen sides stay attached through moves, resizing and rotation.
In Select, the quick-connect controls sit outside resize handles. Connector
endpoints can be dragged to another point on the same shape or a different shape;
dropping inside its body restores automatic attachment.

The same points apply to geometric shapes, generic nodes, text/notes, images,
frames, UI controls, UML nodes, state nodes and BPMN nodes. ERD field mappings keep
their row anchors, and sequence messages retain their timeline attachment rules.
For CLI operations, set `semantic.fromPort` and `semantic.toPort` to `top`, `right`,
`bottom` or `left`. Omitted fields keep automatic attachment. The example pins
Yes to the decision's right tip and No to its bottom tip.

The shapes use the portable `shape.geo` representation and flows use
`edge.generic`, so the existing selection, resizing, text editing, undo,
copy/paste, JSONL and collaboration behavior applies. The new page kind is
`flowchart`; it is a page classification, not a content restriction.

Create the decision and retry example with the native CLI from this repository:

```sh
cat > /tmp/request-flowchart.jsonl <<'JSONL'
{"kind":"document","schemaVersion":1,"id":"request-flowchart","title":"Request flowchart"}
{"kind":"page","id":"p1","name":"Request processing","pageKind":"flowchart"}
JSONL
nodetto-cli edit /tmp/request-flowchart.jsonl --ops examples/flowchart/request.ops.json
nodetto-cli validate /tmp/request-flowchart.jsonl
nodetto-cli export /tmp/request-flowchart.jsonl --format png --output /tmp/request-flowchart.png
nodetto-cli export /tmp/request-flowchart.jsonl --format mermaid --mermaid-kind flowchart --output /tmp/request-flowchart.mmd
```

SVG, PNG and PDF retain the authored layout. Mermaid retains the graph,
shape notation and branch labels, with layout computed by Mermaid. It exports
supported geometric shapes and generic nodes; flows to excluded elements produce
warnings. Mermaid flowchart import is not included.

Use `types --kind flowchart` for the CLI type catalog. The same `edit` operations
are available through MCP.

## Free and partially connected lines

Select a line and drag either endpoint handle onto empty canvas to detach it;
drag it near a shape point to reattach. Endpoint handles have a 24-pixel grab
area. With Connector selected, dragging from empty canvas creates a standalone
line. Double-click a line segment to insert an intermediate point; drag the point
to reshape the line. Existing manual intermediate points retain their page
positions while detaching or reconnecting an end. Fully detached lines also
support dragging, nudging and copy/paste.

Each end has exactly one representation: a shape ID (`from` / `to`, optionally
`fromPort` / `toPort`), or a page coordinate (`fromPoint` / `toPoint`). Shapes and
ports determine attached coordinates; those coordinates are not saved twice.
A line can have one attached and one free end. Manual intermediate points use
`routingWaypoints`, encoded as `u` along the start/end centre basis and `v` in
page units perpendicular to it. They remain part of the same line element.
ERD, UML, BPMN, state and prototype connectors keep their required semantic
endpoints; free drawing uses `edge.generic`.

For example, this CLI operation creates a free polyline from `(100,100)` through
`(250,200)` to `(400,100)`:

```json
{
  "op": "add",
  "page": "p1",
  "type": "edge.generic",
  "semantic": {
    "fromPoint": { "x": 100, "y": 100 },
    "toPoint": { "x": 400, "y": 100 },
    "routing": "manual",
    "routingWaypoints": [{ "u": 0.5, "v": 100 }]
  }
}
```

Run `edit --ops examples/flowchart/free-lines.ops.json` on an empty flowchart page
`p1` for attached, partially attached and standalone examples. When editing JSONL
through CLI updates, remove the old endpoint key with `null` when switching
representations (for example `"to": null, "toPort": null, "toPoint": {...}`).
SVG, PNG and PDF retain free-line geometry. Mermaid and D2 omit free ends with
an export warning because they require graph-node endpoints.

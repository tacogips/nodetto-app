# Flowchart example

Select **Mode → Flowchart**, or expand the **Flowchart** category in General.
The palette offers Start, End, Process, Decision, Input / Output and Database.
Draw Flow arrows between shapes and edit their labels to show conditions such as
Yes and No. On flowchart pages, new arrows use orthogonal routing by default;
routing, waypoints and labels remain editable in the existing connector inspector.

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

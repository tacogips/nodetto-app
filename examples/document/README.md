# Document examples

The paper uses two A4 frames, Markdown, code and a diagram. The deck uses
three widescreen frames in horizontal flow. Run either example from the repository root:

```sh
cat > /tmp/document.jsonl <<'JSONL'
{"kind":"document","schemaVersion":1,"id":"document-example","title":"Document example"}
{"kind":"page","id":"p1","name":"Document","pageKind":"freeform"}
JSONL
nodetto-cli edit /tmp/document.jsonl --ops examples/document/paper.ops.json
nodetto-cli validate /tmp/document.jsonl
nodetto-cli export /tmp/document.jsonl --format pdf --document --output /tmp/document.pdf
nodetto-cli export /tmp/document.jsonl --format markdown --output /tmp/document.md
```

For the deck, start with a fresh seed and substitute `examples/document/deck.ops.json`.
Markdown assets are written to `/tmp/document.assets/`.

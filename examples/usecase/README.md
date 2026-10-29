# Lending desk use cases

In the editor, select **Mode → UML use case**. Place Actor, Use case and System
boundary nodes, then drag Association, Include, Extend or Generalization
between them. The common Connector tool and the connect handles create an
association between any two use-case nodes. Select a relationship and open its
**Use-case relationship** properties to change its kind or add a label; Include
and Extend show «include» / «extend» above the label. The Package tool draws a
UML package (a rectangle with a name tab).

Actors are stick figures with their name below, use cases are ellipses, and a
system boundary is an unfilled rectangle titled at the top. A system boundary is
picked by its border and title strip only, so the use cases inside it stay
clickable. This is an authoring tool; it does not enforce UML well-formedness
rules such as which ends an include may join.

To create the same diagram with the native CLI, run these commands from the
repository root:

```sh
cat > /tmp/lending.jsonl <<'JSONL'
{"kind":"document","schemaVersion":1,"id":"lending","title":"Lending desk"}
{"kind":"page","id":"p1","name":"Use cases","pageKind":"uml"}
JSONL
nodetto-cli edit /tmp/lending.jsonl --ops examples/usecase/lending.ops.json
nodetto-cli validate /tmp/lending.jsonl
nodetto-cli export /tmp/lending.jsonl --format svg --output /tmp/lending.svg
nodetto-cli export /tmp/lending.jsonl --format png --output /tmp/lending.png
nodetto-cli export /tmp/lending.jsonl --format pdf --output /tmp/lending.pdf
nodetto-cli export /tmp/lending.jsonl --format drawio --output /tmp/lending.drawio
```

`types --kind uml`, `types usecase.node`, and `types usecase.relationship`
describe the fields. `connect` between two use-case nodes creates an
association; pass `"semantic": {"kind": "include"}` (or `extend`,
`generalization`) for the other kinds, and `label` sets the optional label.
Mermaid has no use-case diagram, so a page holding only use-case notation
offers no Mermaid export; use JSONL, SVG, PNG, PDF or draw.io instead.

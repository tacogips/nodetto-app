# State transition flow

In the editor, select **Mode → State transition**. Place State, Initial, Final
and Choice nodes, then drag the Transition tool between them. Drag back onto the
same state to create a self-transition. Select a transition and open its
**State transition** properties to edit the trigger, guard and effect; its label
is `trigger [guard] / effect`. Empty fields make an unlabeled transition.

Ordinary states use UML rounded rectangles. Initial nodes are filled circles,
final nodes are bullseyes, and choices are diamonds. This is an authoring tool;
it does not execute guards or actions or enforce complete UML state-machine
well-formedness. Composite states, history, and fork/join notation are not
provided by this feature.

To create the same flow with the native CLI, run these commands from the
repository root:

```sh
cat > /tmp/state-flow.jsonl <<'JSONL'
{"kind":"document","schemaVersion":1,"id":"state-flow","title":"State flow"}
{"kind":"page","id":"p1","name":"Flow","pageKind":"state"}
JSONL
nodetto-cli edit /tmp/state-flow.jsonl --ops examples/state-transition/flow.ops.json
nodetto-cli validate /tmp/state-flow.jsonl
nodetto-cli export /tmp/state-flow.jsonl --format svg --output /tmp/state-flow.svg
nodetto-cli export /tmp/state-flow.jsonl --format png --output /tmp/state-flow.png
nodetto-cli export /tmp/state-flow.jsonl --format pdf --output /tmp/state-flow.pdf
nodetto-cli export /tmp/state-flow.jsonl --format mermaid --mermaid-kind stateDiagram-v2 --output /tmp/state-flow.mmd
```

`types --kind state`, `types state.node`, and `types state.transition` describe
the fields. `connect` automatically creates a state transition between state
nodes; its `label` sets the trigger, and `semantic` accepts `guard` and `effect`.
JSONL retains node identities, geometry, routing and all transition fields.
Mermaid export uses `stateDiagram-v2`; Mermaid state import is not supported.

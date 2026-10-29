# UML use case mode

Choose **UML use case** in **Mode**. The left palette exposes Actor, Use case,
System boundary, Association, Include, Extend, Generalization and Package,
followed by Text and Frame. Common geometry remains available under More
shapes. General and All tools also include these tools under **UML use case**.

Select Actor, Use case or System boundary and click the canvas. Each kind is
placed at its own default size: a 64 x 112 actor, a 160 x 72 use case and a
400 x 320 system boundary. An actor is a stick figure with its name below the
figure; a use case is an ellipse with its name centered; a system boundary is
an unfilled rectangle with its name at the top. A system boundary is picked by
its border band and title strip only, like a frame, so use cases placed inside
it stay clickable even when the boundary is stacked above them.

Drag Association, Include, Extend or Generalization between actors, use cases
or system boundaries. An association is a plain line, include and extend are
dashed lines with an open arrowhead at the target and an «include» / «extend»
label, and a generalization is a solid line with a hollow triangle at the
parent. The common Connector tool and connect handles create an association
when both endpoints are use-case nodes. The inspector edits a node's name and
kind, and a relationship's kind, optional label and shared connector routing.
Double-click a node to rename it, or a relationship to edit its label; clearing
the label removes it.

Package is a geometric shape: a rectangle with a name tab on its top-left. Its
label is drawn in the body like other shapes, and it is available in every mode
under More shapes.

## Data and operations

- `usecase.node` stores `name` and a closed `kind` (`actor`, `usecase`,
  `system`). `usecase.relationship` stores endpoint IDs, a closed `kind`
  (`association`, `include`, `extend`, `generalization`), an optional `label`
  and the shared connector routing fields. Relationship endpoints must be
  use-case nodes on the same page.
- The UML package is the `package` kind of `shape.geo`.
- JSONL round-trips these types canonically. SVG, PNG and PDF render the same
  notation as the canvas. draw.io export writes UML actors, ellipses, an
  unfilled container for a system boundary and a folder shape for packages;
  draw.io folder shapes import back as packages.
- Deleting a node deletes its incident relationships; undo restores them.
  Read-only documents cannot author these tools.

## Scope

This is diagram notation and authoring, not a UML metamodel validator. Use
cases do not become members of a system boundary; the boundary is drawn around
them. Extension points and multiplicities are not modeled. Mermaid has no
use-case diagram, so a page with only use-case notation offers no Mermaid
export, and a package on a flowchart export becomes a process rectangle with a
warning. D2 exports packages with its `package` shape.

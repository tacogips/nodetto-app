# Editing diagrams

## Flowcharts and ERD relations

The **Flowchart** mode and shape category provide Start, End, Process, Decision,
Input / Output, Database, Document, Manual input, Delay, Predefined process,
Internal storage, Off-page connector, Card and labeled Flow arrows. See the
[CLI flowchart example](../examples/flowchart/README.md) for a decision and retry
flow and Mermaid export.

The ERD category provides separate **Relation** and **Foreign key** tools.
Relation draws a dashed field-to-field join path for index and query planning;
it does not emit a database constraint or inferred uniqueness in DDL. Foreign
key draws a solid enforced relation and exports its constraint. The **Foreign
key** switch in the relation inspector converts between them, preserving table
and column mappings. Constraint-only settings are removed when enforcement is
disabled. Existing JSONL uses `erd.relation` with `logical: true` for the
unenforced variant; absence of the flag remains an enforced foreign key.

View, Materialized view, Function, Procedure, Relation and Foreign key each have
distinct palette icons and explanatory tooltips.

## State transition diagrams

Select **State transition** mode to draw states, initial/final markers, choices,
and directed transitions, including self-transitions. Transition properties edit
`trigger [guard] / effect`. The same types work through CLI `edit` and MCP;
SVG, PNG, PDF and Mermaid exports include the notation.

See the [CLI state flow example](../examples/state-transition/README.md) for a
reproducible drawing batch and the supported notation.

## Sequence authoring

Use Actor, Service, or Seq DB in the shared toolbar to place ordered sequence
participants on an empty page. The Edge tool creates a timeline message when
both endpoints are participants, appends it below existing messages, and grows
unlocked lifelines in the same undoable edit. Participant inspectors can add
activation bars spanning that participant's messages; activations remain
attached when the participant moves. Message labels and sync, async, or return
kinds remain editable, with return messages dashed consistently on the canvas
and in SVG, Mermaid, and D2 output. Locked participants reject message or
activation creation rather than allowing a partial edit. Drag a participant
horizontally or a message vertically to rewrite its canonical fractional order;
crossing several peers is one undo step, Escape cancels the entire reorder, and
the inspector provides Move left/right and Earlier/later buttons for precise or
keyboard-driven changes. Reorders converge through Yjs and peer-local undo
preserves concurrent semantic edits.

## BPMN operation flows

Choose **BPMN** in **Mode** to open or create a BPMN page, then use its palette for
participants, lanes, tasks, events, gateways, data, and flows. Semantic types
and payloads are stored separately from geometry in JSONL; see the [BPMN
format](bpmn/format.md) and [lint rule reference](bpmn/lint-rules.md).

The editor prevents sequence flows across participants and message flows
within one participant, incoming sequence flows to start events, and outgoing
sequence flows from end events. When a connection gesture can be interpreted
as a different legal flow, the editor corrects it. The BPMN problems panel
lists lint findings and selects the associated element.

Pools, lanes, expanded sub-processes and groups are painted beneath the
connector layer, like frames, so sequence and message flows stay visible
above them on the canvas and in SVG export. They are not routing obstacles,
so flows route directly inside lanes and across pools. Tasks, events,
gateways and data objects stay above the flows. User, service, manual, send,
receive, script and business-rule tasks show distinct marker icons at the
top-left (send is filled, receive is hollow). Canvas and export draw them
from the same notation module.

Open a `.bpmn` file for detached import, or use **Import BPMN...** and
**Export → BPMN**. XML-only or unsupported content
is retained with import warnings. Use `nodetto-cli lint` for CI checks and
`nodetto-cli bpmn import|export` for BPMN 2.0 XML interchange. The [AI review
guideline](bpmn/ai-review-rules.md) is an original starting point for
`.claude/rules/`; [purchase-request.jsonl](bpmn/purchase-request.jsonl)
is the example document.

## Tidy layout and overlap removal

Arrange > Tidy layout (Cmd/Ctrl+Option+L) re-flows the current page, or the
selection when two or more layers are selected, into a clean left-to-right
layered layout: connectors decide the layers (an ERD relation places the
referenced table before the referencing one), barycenter sweeps reduce
crossings, and each box is pulled level with the boxes it connects to without
ever overlapping. Unconnected layers and separate clusters are packed
compactly. Frames are arranged inside-out: each frame's contents are laid out
first, the frame is refitted around them, and it then moves as one box,
carrying its contents. Locked layers stay put as obstacles, auto-layout frames
keep their own layout and sequence diagrams are left alone. Arrange > Remove
overlaps instead nudges only overlapping layers apart along the shorter axis,
growing frames that must contain them. Both are one undo step, deterministic,
snap to whole units and are fixed points: running them again moves nothing.
Connectors re-route automatically. `nodetto-cli arrange` runs the same command
headlessly.

On pages with connectors, frames are painted beneath the connector layer and
no longer count as routing obstacles, so relations inside and across framed
groups stay visible and take direct routes; the layers inside the frames
remain obstacles.

## Logical ERD references

A relation's Constraint > Logical reference option marks a join path the
database does not enforce (for example application-level references in a
schema without foreign keys). It is drawn dashed, keeps its field-to-field
column anchors and cardinality, exports as a dotted Mermaid relationship and a
dashed D2 connection, and Database DDL emits no foreign key or uniqueness for
it. Turning it on drops the constraint-only settings (referential actions and
timing).

## Page ordering

Page options include Move left and Move right. New pages append to the document;
duplicates appear immediately after their source. Ordering is undoable, persists
in JSONL and synchronizes between clients without moving artwork or changing
the active page. Legacy documents keep ID order until an ordering operation
assigns explicit keys; loading alone does not rewrite them.
Opening a document activates its first displayed page. Deleting the active page
opens the next surviving tab, or the nearest previous tab if none follows it,
and restores that page's local pan/zoom. Remote deletion follows the same rule;
undoing deletion restores the tab without forcing collaborators to switch pages.

## Copy and paste styles

Copy style and Paste style are available in the selection menu and through
Cmd/Ctrl+Alt+C and Cmd/Ctrl+Alt+V. Copy one layer, then apply its literal
appearance to another selection in one undo step. Content and geometry stay
intact; style-token and typography links detach, while size and layout-token
bindings remain. Locked targets are skipped. This clipboard stays in the editor
session and is independent of the element clipboard.
An unstyled source clears custom styling. Paste is disabled when no editable
target would change; token/comment resources are excluded. Collaborative undo
preserves simultaneous content edits from another client.

## Exact zoom

The canvas zoom percentage is editable, including arithmetic such as `100 / 3`.
Exact zoom retains the page point at the viewport center and is limited to
10-800%. Separate 100%, Fit and Selection buttons reset or frame the desired
content. Zoom remains local to each page and does not edit the document.

## Numeric inspector fields

Numeric inspector fields accept arithmetic such as `390 - 32` or `(24 + 8) * 2`.
Enter or blur commits the result within the field's limits; Escape restores the
stored value. Up/Down changes one step and Shift changes ten steps. Expressions
support `+`, `-`, `*`, `/`, parentheses and scientific notation, without units or
percentages. Invalid expressions and overflow leave the design unchanged.

Selecting multiple layers exposes collective X/Y and width/height fields.
Position edits move the selection; size edits scale its layers and spacing from
the selection's top-left corner. Preserve selection proportions couples the two
dimensions. Artboard children follow constraints and auto layout, and database
table/class heights remain derived. Unsupported resize selections show a reason.

## Page navigation

Review comments can be filtered across all pages and searched by feedback,
author, target or page name. Show on canvas opens the thread's page and centers
its location while retaining that page's zoom. Thread numbers remain local to
each page; the all-pages list includes page names for context.

Navigate the page strip with Left/Right arrows or Home/End. F2 renames the
focused page; Down opens its options. Within page options, Up/Down and Home/End
move between actions, Escape returns to the page, and Tab leaves the menu.
Only the selected page and its options enter the normal tab order.
Each page remembers its pan and zoom for the current editing session. Returning
to a page restores its view; an unvisited page starts at 100% and the origin.
Remote page updates retain your active page, views and surviving layer selection.
Deleted layers and layers moved to another page leave the selection.
Opening a document resets
view memory. These preferences are local and never saved into the design.

## Connector routing

Generic edges, database relations, and UML associations can use either straight
or orthogonal routing. Orthogonal routes choose the dominant endpoint axis by
default, or can be pinned to horizontal-first or vertical-first in the
inspector. Drag the selected connector's middle handle to reposition its
channel; the whole gesture is one undo step and Escape restores the original
bend. Routing survives JSONL and collaboration, participates in segment-aware
picking, and is shared by the canvas and SVG export. Orthogonal routes avoid
visible intervening layers by default with a 12-unit clearance; the inspector
can disable avoidance when an exact manual channel is more important. Detours
are recomputed deterministically instead of storing derived waypoints. Manual
routing supports up to 32 ordered checkpoints with direct canvas dragging,
numeric along/offset editing, insertion, removal and reordering. Double-click a
connector segment to insert a projected checkpoint directly; straight and
orthogonal routes retain their visible internal vertices when converted to a
manual route. Checkpoints use an endpoint-relative basis, so moving or copying
both endpoints carries the authored path while moving one endpoint reshapes it
predictably. Manual edits are atomic, cancellable, JSONL/Yjs portable, pickable
and exported through the same polyline geometry. Browser pointer QA remains
unfinished.

## Shapes, arrowheads and connector styles

The **General** shape category has the draw.io basics: rectangle, ellipse,
diamond, cylinder, triangle, hexagon, parallelogram, star, trapezoid, pentagon,
octagon, cross, block arrow, chevron, cloud, callout, folded note, cube, double
arrow, right triangle and person. The **Flowchart** category has the standard
flowchart symbols: start/end, process, decision, input/output, database,
document, manual input, delay, predefined process, internal storage, off-page
connector, card, paper tape, stored data, display, loop limit, collate, sort,
summing junction, or, multi-document, direct data and sequential data. Any
geometric shape keeps a centred, styled label and fill/gradient paint, and can
be flipped horizontally or vertically (**Shift+H** / **Shift+V**, the context
menu's Arrange submenu, or the inspector) without mirroring its label.

Connector ends can be None, Arrow, Triangle, Dot, Open arrow, Diamond, Open
diamond, Circle, Bar or Crow's foot. In the Style section, **Bends** rounds the
corners of a route and **Crossings** makes a connector hop over (Arc jump) or
break around (Gap) connectors painted beneath it. Both are paint-only, so they
are copied by Copy style and exported to SVG, PNG, PDF and draw.io.

## File saving

Settings > Files > File saving switches between Automatic (the default) and Manual.
The preference is remembered across launches. Automatic saving creates a JSONL
file in the app data directory's `documents` folder after the first shape is
created; an empty document creates no file. An imported document is named
after its source file, such as `board.jsonl` for `board.kicad_pcb`, with a
number added when that name is taken. These documents appear in File > Recent. File > Save as chooses a different location and copies referenced
images into its `artifacts/` directory before saving JSONL. Move or share both
the JSONL file and this directory together. Missing attachments are reported;
saving never deletes files needed by undo or other documents.

Manual saving writes only with File > Save or Cmd/Ctrl+S. Switching back to
Automatic saves pending edits after the usual quiet period. Quitting waits for
pending automatic writes; unsaved manual edits or failed saves require a discard
decision. Outside file changes continue to appear live in either mode.

To straighten a bent connector, select it and choose **Straighten** on the
selection toolbar or **Straighten connector** in its context menu. Double-click
a bend handle to remove just that point; removing the final bend makes the line
straight. A focused bend handle also supports Delete/Backspace. Undo restores
the removed points.

The toolbar has File and Settings icons with hover labels. File offers New,
Open, Reload from disk, Export, Save and Save As icons; Recent lists previous
files. macOS also exposes these actions in its native File menu, including
Cmd+O to open, Cmd+S to save and Cmd+R to reload. Reload asks before discarding
unsaved changes. BPMN import appears in BPMN mode, and BPMN export remains in
the shared Export dialog.

Shape creation lives in the left pane. Pan with right-click drag; H/V remain
available as shortcuts. Filename and save status sit directly above the page
tabs within the viewer column. Pane corners have small collapse chevrons.

General is the default mode and appears first in the mode selector. Its palette
includes basic shapes, UML classes/components, ERD tables and sequence
participants without switching modes; Freehand is available under More shapes.
Settings opens a dialog with categories down the left: General, Appearance,
Canvas, Snapping, Files and Shortcuts, plus Collaboration when cloud features
are available. Grid/rulers, snapping, pane visibility, appearance and autosave
delay are remembered across launches. The same view preferences stay
synchronized with the canvas controls.

## Appearance

Settings > Appearance has three choices, each applied immediately:

- **Theme**: System (the default), Light or Dark. It restyles the toolbar,
  side panes, inspector, layers, dialogs, menus, page tabs, zoom controls and
  rulers. System follows the macOS appearance and updates when it changes, and
  the native title bar follows the chosen theme.
- **Canvas**: Light (the default), Dark or Match theme for diagram pages.
- **PCB canvas**: Dark (the default), Light or Match theme for PCB pages, so
  copper, silkscreen and outline colours read as they do on a board.

The canvas settings change only the canvas background, dot grid and rulers.
Element colours stored in the document are never changed, elements without a
stored colour keep their usual default paint (dark strokes and text) on a dark
canvas, and SVG, PNG, PDF
and JSONL exports are the same in every theme.

## Multiline nodes and scoped schema export

Generic node labels support line breaks and wrapping. Edit the label in the
Inspector's multiline field, or use Shift+Enter in the inline editor to insert
a line break. Enter commits an inline edit. Canvas and SVG-derived exports use
the same line layout.

To export one database frame from an ERD page, choose its frame in the Database
DDL panel's scope selector, or run:

```bash
nodetto-cli ddl diagram.jsonl --page Schema --frame "Orders" --dialect postgresql
```

`--frame` accepts the frame's name, full id or unique id prefix of at least six
characters, matched only among frames on the selected page. Ids are generated
and never change, so prefer names in scripts.

The scope follows frame ownership, including nested frames and groups. Relations
that cross the scope produce a warning and no foreign key. Database objects
whose authored dependencies are excluded are omitted with a warning. Review
raw SQL definitions for unauthored external dependencies. Whole-page export
remains the default; `--strict`, `--output` and `--check` also work with frames.

ERD columns with `autoIncrement: true` accept `identityGeneration: "always"` or
`"by-default"` (the default). PostgreSQL exports the matching IDENTITY clause;
MySQL and SQLite retain their portable auto-increment behavior. The column
inspector and PostgreSQL definition editor preserve this policy. PostgreSQL
built-in type aliases, including integer, floating-point, character, bit, serial
and time-zone aliases, share canonical type handling across dialects.

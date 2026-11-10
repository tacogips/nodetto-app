// Help text. The top-level overview fits one screen; each command has its own
// page with every option, exit code and an example, printed by
// `nodetto-cli help <command>` or `nodetto-cli <command> --help`.

import { TABLE_HELP } from "./table-command.ts";

export const OVERVIEW = `nodetto-cli - read, draw, check and convert nodetto documents (.jsonl)
Usage: nodetto-cli <command> [options]

Look at a document
  nodetto-cli open <file>         Open a file in the desktop app
  nodetto-cli pages <doc>         List page numbers, short IDs, names and kinds
  nodetto-cli inspect <doc>       Compact outline (or JSON) of pages and elements
  nodetto-cli types [<type>]      Element types and the fields each one takes
  nodetto-cli validate <doc>      Check that a document parses and is valid
  nodetto-cli diff <old> <new>    What changed between two versions
Draw and edit
  nodetto-cli shapes [<words>]    Palette shapes by shape ID (--category uml)
  nodetto-cli draw <doc> <shape>  Draw one shape or connector by its shape ID
  nodetto-cli edit <doc>          Apply add/update/move/delete operations (JSON)
  nodetto-cli table create|set     Spreadsheet tables from CSV/TSV or JSON; edit cells
  nodetto-cli arrange <doc>       Arrange one page: tidy, overlaps, layered or route
Render
  nodetto-cli export <doc>        Export a page or selected artwork
Convert and check
  nodetto-cli merge <base> <ours> <theirs>  Merge document versions
  nodetto-cli ddl <doc>           Database DDL from an ERD page
  nodetto-cli format <doc>        Canonical JSONL formatting
  nodetto-cli lint <doc|bpmn>     Lint BPMN, breadboard, architecture, freeform, flowchart, ERD, state and UML pages
  nodetto-cli bpmn import|export  BPMN 2.0 XML conversion
  nodetto-cli drawio import       draw.io (.drawio) to nodetto JSONL
  nodetto-cli gerber ...          Gerber and drill files to a PCB page and back
  nodetto-cli pcb import|gerber   KiCad board to a PCB page, Gerber and drill export
  nodetto-cli breadboard ...      BOM, netlist, PCB Gerber and KiCad import

MCP server
  nodetto-cli mcp                 Serve all CLI operations over stdio
  nodetto-cli authorize [folder]  Grant project-folder access for the Store CLI

Global --quiet suppresses warning lines.

Run "nodetto-cli help <command>" or "nodetto-cli <command> --help" for details.
AI loop: inspect -> shapes/types -> edit --snapshot -> export (look at the PNG)
-> diff <snapshot> <doc> later; the app shows and merges the edits live.`;

const EXIT_CODES = `Exit codes: 0 success, 1 out of date (--check), 2 usage or input error,
3 warnings with --strict.`;

export const COMMAND_HELP: Readonly<Record<string, string>> = {
  table: TABLE_HELP,
  authorize: `Usage: nodetto-cli authorize [project-folder]

Open the macOS folder picker and remember access to the selected project folder.
The Mac App Store CLI runs in its own sandbox and needs this explicit grant to
read/write project files. Select the folder containing your diagrams, assets
and exports. Restart a running MCP server after granting a new folder.

The native CLI provides this command. Homebrew/direct-download builds have
normal terminal file access and do not require folder authorization.`,
  mcp: `Usage: nodetto-cli mcp

Start a local Model Context Protocol server over stdio. Stdout is reserved for
MCP JSON-RPC; diagnostics go to stderr. Connect with an MCP client's command
configuration: {"command":"nodetto-cli","args":["mcp"]}.

Every document command has a nodetto_<command> tool. nodetto_cli accepts any
CLI command, including help and --version. Pass argument tokens in args and
supply stdin for edit --ops -. Results contain exitCode, stdout and stderr.
Paths resolve from the server's working directory; absolute paths are advised.
The native CLI accepts --cwd <folder> before any command, including mcp, to
select the project directory explicitly (useful for the sandboxed Store build).
The server can read/write files and launch the desktop app like the CLI.
Stop by disconnecting the client (closing stdin).`,

  open: `Usage: nodetto-cli open <file> [--page <page> | --page-number <n>] [--app <application>]

Open an existing local file in the Nodetto desktop app. Relative paths resolve
from the current directory. On macOS this also opens files in a running app.
The command returns after the OS accepts the request; it does not wait for edits.

  --page         Show this page: short ID, full ID or exact name.
  --page-number  Show the page at this 1-based position, numbered as the
                 pages command lists them.
  --app          macOS app name or .app path (default: nodetto). On Linux and
                 Windows, the Nodetto executable name or path (default:
                 nodetto / nodetto.exe).

A page is checked against the file before launching. The app receives it as a
nodetto://open?path=<absolute path>&page=<page id> link; such links (also with
pageNumber=<n> instead of page) open the same way from a browser or chat on
macOS and with the Linux Debian package. If the file is already open, the app
switches pages without reloading.

Example:
  nodetto-cli open design.jsonl
  nodetto-cli open design.jsonl --page-number 3
  nodetto-cli open design.jsonl --page AbC123xyz_- --app "/Applications/Nodetto.app"

${EXIT_CODES}`,

  pages: `Usage: nodetto-cli pages <doc.jsonl> [--format text|json] [--kind <page kind>]

List pages in display order, including page number, stable short ID, full ID,
name, diagram kind and editing mode. The number is a current display position,
not an ID. A page's mode is the tool palette the app shows on it; a page that
never chose one follows its kind, and the edit operation set-page-mode
changes it.

  --format  text (default) or json (an array of page summaries).
  --kind    Only pages of this kind (freeform, erd, uml, sequence, state,
            flowchart, architecture, bpmn, breadboard or pcb). Original
            display numbers are retained.

Short IDs are stable 11-character URL-safe aliases derived from stored page
IDs. They survive renaming, reordering, saving and reopening. Full IDs and
existing references stay unchanged; listing a document never rewrites it.
Every --page option and edit page reference accepts a short ID, full ID or
exact name. Ambiguous aliases/names require a full ID.
Page and element ids are auto-assigned, opaque and never change. rename-page
changes only the display name; names are the human-facing key for --page and
--frame in ddl.

Examples:
  nodetto-cli pages mixed.jsonl
  nodetto-cli pages mixed.jsonl --kind erd --format json
  nodetto-cli export mixed.jsonl --page <short-id> --format pdf --output schema.pdf

${EXIT_CODES}`,

  inspect: `Usage: nodetto-cli inspect <doc.jsonl> [--page <short-id|id|name>] [--format outline|json]
                           [--type <prefix>] [--text <text> [--regex] [--ignore-case]]
                           [--ids short|full]

Print what the document contains.

  --format outline  (default) One line per page and element, indented under its
                    frame or container: type, id, name or label, position @x,y,
                    size WxH and the essential semantic fields (columns, relation
                    ends, message text). Styling is omitted. Cheap to read for AI.
  --format json     The exact element records, for precise reads.
  --page            Only this page (short ID, full ID or name). Default: every page.
                    Page headings include stable short IDs; JSON includes shortId.
  --type            Only elements whose type starts with this prefix
                    (for example erd.table, bpmn., frame).
  --text            Only elements whose display text (labels, names, notes,
                    table and column names) contains this text; --regex reads
                    it as a regular expression, --ignore-case ignores case.
                    The replace-text edit operation changes the matches.
  --ids short       (default) Shortest unique id prefix of at least six
                    characters. Every command that takes an element id accepts
                    such a prefix. --ids full prints complete ids.

Example:
  nodetto-cli inspect schema.jsonl --page Schema
  document "Shop"
    page p1 "Schema" erd (2 elements)
      erd.table t-users users @0,0 w280
        column id varchar(36) pk
        column email varchar(320) not-null

${EXIT_CODES}`,

  types: `Usage: nodetto-cli types [<type>] [--kind <page kind>] [--format text|json]

Without a type, list the element types grouped by the page kinds that use them.
With a type, print its semantic fields (name, type, required, default), its
visual fields and a minimal "add" operation for nodetto-cli edit.
"nodetto-cli types sequence.message" describes self-messages.

  --kind     Only types typically drawn on this page kind (freeform, erd,
             uml, sequence, state, flowchart, architecture, bpmn, breadboard
             or pcb).
  --format   text (default) or json.

For sequence.participant, text includes a Rendering: line and JSON has a rendering
key: actor is a stick figure, db a cylinder, and service a rounded box.

Palette shapes (a flowchart decision, a use-case actor, an iPhone artboard) are
listed by "nodetto-cli shapes"; several shapes can share one element type.

Example:
  nodetto-cli types erd.table

${EXIT_CODES}`,

  edit: `Usage: nodetto-cli edit <doc.jsonl> --ops <file.json|-> [--arrange] [--dry-run]
                        [--snapshot <file>] [--format text|json]

--quiet suppresses warning lines; repeated warnings collapse as
" (and <n> more like this)". --strict still exits 3 where supported.

Apply a batch of operations through the editor's command layer, so the result is
exactly what the app would produce. The batch is all-or-nothing: an invalid
operation prints its index and reason and nothing is written. The document is
written atomically; if the file changed on disk while the batch was being
applied (for example the human saved in the app), the batch is applied again
to the new contents (up to three times) so no human edit is overwritten.

References resolve exact id, @ref, name:<text>, then a unique id prefix.
name: matches label text exactly, case-sensitively after trimming. Scope is the
operation's page, the source page for connect's to, the element page for
semantic references, or the whole document. Missing or ambiguous names list
candidates. Reference fields inside semantic are resolved; other text is not.
update, convert and delete accept id or where (not both). where has at least one of
page, type, from, to, parent and name; all keys must match. expect is an integer
at least 0, only with where. Mismatch aborts without writing; zero matches
without expect is an error, while expect:0 is a no-op.
select requires a fresh ref and exactly one of id or where; where requires
exactly one match (expect defaults to 1 and must be 1). It binds @ref without
marking a page touched. Reports include operation <i> (<op>): matched <n>
element(s), or JSON matches with operation, op, count and ids. --quiet never
hides matches. Unknown operation fields are rejected with valid fields listed.
Example: {"op":"delete","where":{"type":"bpmn.sequenceFlow",
 "from":"name:Approve","to":"name:Update status"},"expect":1}

convert takes type and/or palette shape, optional semantic and label. For a chosen
shape.geo geometry, use semantic.geo, for example:
{"op":"convert","id":"@a","type":"shape.geo","semantic":{"geo":"diamond"}}
It keeps id, index, bounds, membership and connectors; text maps to the target field.
Fields it cannot carry are dropped and reported as convert.fieldDropped warnings.
--dry-run lists dropped fields and affected connectors using the same checks.
Edges, frames, groups and locked elements cannot convert. Invalid semantics,
changed bounds or incompatible connector endpoints fail the batch without writing;
resize first when a target requires different bounds.
delete reconnectTo moves direct connectors to the target, preserving ports, labels
and routing; invalid endpoints or targets fail atomically. Connectors attached only
to a cascaded uml.port are removed without being moved or reported, even if a
later reconnect operation cascades that port. Non-edge references follow their
existing cascade or detach rule.

update label maps: text.note -> text; frame -> name; node.generic -> label;
state.node -> name; erd.table -> tableName; state.transition -> trigger;
BPMN flows -> name; edge.generic -> label. label wins over semantic on update.

carryMembers is a boolean on update; the default is true. Move and resize
normally carry as follows; false keeps members at their absolute positions:
  frame              descendants; resize also follows constraints; layout frames
                     re-layout and reject false. Geometric membership is rechecked.
  bpmn.participant   descendants; lanes follow the pool, other members re-parent.
  bpmn.lane          descendants; height restacks siblings, which carry members.
                     Non-lane members re-parent; x, y and width changes reject false.
  bpmn.subProcess    descendants re-parent.
  breadboard.board   plugged parts remain in place, plugged only if holes still align.
  group              has no box; false is rejected. Other elements do not carry.
UML packages and architecture groups/zones drawn as frames carry; shape.geo,
usecase system boundaries and bpmn.group do not. Attachments always follow:
uml.port, bpmn.boundaryEvent and PCB tracks follow their hosts.
For a pool or lane with child lanes, false rejects heights below the lanes'
minimum; pool width must be greater than 30 per lane depth and at least the
nested lanes' extent. These geometry errors exit 2 without writing.

Operations (a JSON array, or JSON Lines; --ops - reads stdin):
  set-cells updates spreadsheet table cells in one operation.
  {"op":"add","page":"p1","type":"erd.table","ref":"orders",
   "semantic":{"tableName":"orders","columns":[{"name":"id","dataType":"uuid","pk":true}]}}
  {"op":"add","page":"p1","type":"node.generic","semantic":{"label":"Pay"},
   "place":{"rightOf":"@orders","gap":80,"align":"center"}}
  {"op":"add","page":"p1","shape":"flowchart:decision","label":"Paid?","ref":"q"}
  {"op":"connect","from":"@a","to":"@b","label":"next"}
  {"op":"connect","shape":"uml.component:dependency","from":"@api","to":"@db"}
  {"op":"connect","from":"@orders","to":"users","fromColumn":"user_id",
   "toColumn":"id","cardinality":"*:1"}
  {"op":"update","id":"t-users","semantic":{"tableName":"accounts"},"visual":{"x":40}}
  {"op":"append","id":"@orders","field":"columns","items":[{"name":"total","dataType":"integer"}]}
  {"op":"remove-item","id":"@orders","field":"columns","item":"total"}
  {"op":"move","id":"t-users","x":40,"y":80}
  {"op":"convert","id":"@a","shape":"flowchart:database"}
  {"op":"delete","id":"@a","reconnectTo":"@b"}
  {"op":"delete","id":"01M4WD"}
  {"op":"scale","page":"p1","factor":1.25}
  {"op":"replace-text","find":"example.dev","replace":"example.info"}
  {"op":"group","ids":["@gw","@cache"],"ref":"edge","name":"Edge tier"}
  {"op":"ungroup","id":"@edge"}
  {"op":"order","id":"@panel","to":"back"}
  {"op":"order","id":"@panel","before":"@widget"}
  {"op":"add-page","name":"Flow","kind":"bpmn","ref":"flow","after":"p1"}
  {"op":"move-page","id":"p3","before":"p2"}
  {"op":"rename-page","id":"p1","name":"Shop schema"}
  {"op":"set-page-mode","id":"p1","mode":"erd"}
  {"op":"delete-page","id":"p2"}

  - "id", "from", "to" and place targets accept a unique id prefix, or "@ref"
    for an element added earlier in the batch with "ref"; "page" accepts an id,
    a short ID, a name or "@ref".
  - add: given semantic fields are merged over the type's defaults (run
    "nodetto-cli types <type>"). Without x/y or "place", the element goes to the
    right of the page content, centred on the previous auto-placed element.
    place: one of rightOf, leftOf, below, above, with optional gap (default 80)
    and align "start" (default) or "center".
  - add with "shape" instead of "type" draws a palette shape by its shape ID
    (run "nodetto-cli shapes"): the shape's own defaults apply first, then
    "semantic" and "visual", and "label" sets its text. connect with "shape"
    uses that connector (for example erd.foreign-key or usecase:include) and
    fails when it cannot join the two elements.
  - "page" may be left out when the document has a single page.
  - connect: picks the connector the app's connect tool would: ERD relation
    (fromColumn/toColumn by name or id, cardinality default *:1), UML
    association or component connector, state transition, sequence message on
    the next timeline row, BPMN flow (BPMN rules apply), otherwise a generic edge with an arrow.
    "label" sets the label (trigger for states, name for BPMN); "type" and
    "semantic" override. A table or state may connect to itself (a
    self-referencing foreign key or a self-transition). A sequence participant
    may connect to itself, creating a self-call loop on the next timeline row.
    Its semantic.kind is sync, async or return.
    connect accepts "visual", "routing" and "routingAvoidObstacles". Routing
    precedence: explicit field > page default > page convention > existing default.
    A convention requires every routing-capable peer to have the same stored
    straight or orthogonal routing and obstacle setting. Set a default with
    {"op":"set-page-routing","id":"p1","routing":"orthogonal","routingAvoidObstacles":true};
    routing null clears it. add-page accepts connectorRouting; manual is rejected.
    Stored visual routing is honored, though semantic is the supported location.
    Arrange writes semantic routingLane, labelPosition, labelOffsetX and labelOffsetY.
  - scale enlarges or shrinks "ids" (with the contents of their frames and
    groups) or every element of "page" by "factor", keeping the layout:
    positions and sizes scale about "origin" ({"x","y"}; default the top-left
    of their bounds), text sizes scale with them, paths stretch with their
    box and connectors follow; free connector ends move too.
  - replace-text replaces "find" with "replace" inside display text (labels,
    names, notes, table and column names) of "ids", one "page" or, without
    either, the whole document; never in ids or references. "regex": true
    reads "find" as a regular expression ($1 works in "replace"),
    "ignoreCase": true ignores case. The report lists every change; use
    --dry-run to preview.
  - group wraps two or more elements on one page in a group ("name" sets its
    layer name); ungroup dissolves a group and keeps its members.
  - order selects targets with "id" or "where"/"expect"; multiple targets move
    as one block. Specify exactly one of "to" ("back", "front", "backward",
    "forward"), "before" (directly beneath the anchor), or "after" (directly
    above). Group members reorder within their group; ungrouped targets reorder
    on the page with frame contents and group members. Frames and BPMN pools,
    lanes, groups and expanded sub-processes paint beneath what they enclose,
    so front does not lift them above their contents and back does not put
    enclosed content behind them. Sending content behind its frame also ends
    implicit ownership, so it no longer moves with the frame.
  - Semantic fields an element type does not define are kept but reported as
    semantic.unknownField warnings naming the operation; --format json lists
    them under "warnings". The batch still applies.
  - update deep-merges objects; arrays are replaced whole (use append and
    remove-item for single list items); null removes a key. This applies to
    visual and semantic; removing a required field is an error.
  - update style.strokeDashArray: [] means solid: it removes strokeDashArray
    and dash unless the patch sets dash. null removes only strokeDashArray,
    so a stored dash still applies. add rejects an empty strokeDashArray.
  - add and update reject unknown visual.style keys and suggest valid keys.
  - visual.style.verticalAlign (top, middle, bottom; default middle) positions
    node.generic and shape.geo labels. add and update write boxLabelAlign: true
    with it. Without the marker box labels stay centered; handwritten JSONL
    must include it. Setting verticalAlign on a box bound to a text style
    removes its link unless the patch sets textStyle. boxLabelAlign: true alone
    keeps the link and follows the style value; verticalAlign: null removes both
    keys.
  - List items that need ids (columns, indexes, attributes) get generated ids.
  - add-page appends the page unless it gives "before" or "after" (a page) or
    "order" (a base62 fractional key, compared with the pages' "order"
    fields); move-page takes the same fields to reorder an existing page.
    add-page also takes "mode", and set-page-mode sets a page's editing mode
    (the tool palette the app shows on it; null follows the page kind):
    flow, app, web, erd, class, component, usecase, sequence, state,
    flowchart, bpmn, breadboard, pcb or all.

  --arrange   Run Tidy layout on every page the batch touched.
  --dry-run   Validate and report without writing.
  --snapshot  Also write the result to this file, as the baseline for a later
              "nodetto-cli diff <snapshot> <doc>".
  --format    text (default) or json report on stdout.

Exit codes: 0 applied, 2 usage, input or operation error, 4 the file kept
changing during the write (retry later).`,

  shapes: `Usage: nodetto-cli shapes [<words>...] [--category <category>] [--connectors|--no-connectors]
                          [--format text|json]
       nodetto-cli shapes <shape-id> [--format text|json]

List the shapes of the app's palette under their shape IDs, grouped by
category. Draw one with "nodetto-cli draw <doc> <shape-id>" or with
{"op":"add","shape":"<shape-id>"} in nodetto-cli edit.

  <words>          Only shapes whose ID, label, category or element type
                   contains every word (case-insensitive), e.g. actor.
  --category       Only this category, by ID or label: general, flowchart,
                   uml-class, uml-component, uml-use-case, uml-sequence,
                   uml-state, erd, bpmn, breadboard, pcb, artboard,
                   ui-control or screen. A prefix before a hyphen selects a
                   family: "uml" lists every UML category.
  --connectors     Only connectors (drawn between two elements).
  --no-connectors  Only shapes placed on their own.
  --format         text (default) or json.

With one shape ID, print what it creates: the element type, the semantic and
visual defaults it starts from, and ready-to-use draw and edit commands.

Examples:
  nodetto-cli shapes --category uml
  nodetto-cli shapes actor
  nodetto-cli shapes usecase:actor

${EXIT_CODES}`,

  draw: `Usage: nodetto-cli draw <doc.jsonl> <shape-id> [--page <short-id|id|name>] [--label <text>]
                        [--at <x>,<y>] [--size <width>x<height>] [--right-of <id>]
                        [--below <id>] [--dry-run] [--format text|json]
       nodetto-cli draw <doc.jsonl> <connector-shape-id> --from <id> --to <id> [--label <text>]

--quiet suppresses warning lines; repeated warnings collapse as
" (and <n> more like this)". --strict still exits 3 where supported.

Draw one palette shape by its shape ID ("nodetto-cli shapes" lists them), the
way picking it from the app's palette does. It runs one nodetto-cli edit
operation, so validation, atomic writing and live reload in the app are the
same.

  --page      Page to draw on; may be left out when the document has one page.
  --label     The shape's text (its name, label or text field).
  --at        Top-left corner in canvas units. Default: right of the page
              content.
  --size      Width and height, for example 200x80.
  --right-of  Place 80 units right of this element (id prefix).
  --below     Place 80 units below this element (id prefix).
  --from/--to Elements a connector joins; required for connector shapes.
  --dry-run   Validate and report without writing.
  --format    text (default) or json report, as nodetto-cli edit prints.

Examples:
  nodetto-cli draw shop.jsonl usecase:actor --label Customer
  nodetto-cli draw shop.jsonl geo:actor --label Visitor   # a stick figure on any page
  nodetto-cli draw shop.jsonl usecase:usecase --label "Place order" --right-of 01M4WD
  nodetto-cli draw shop.jsonl usecase:association --from 01M4WD --to 01M4X2

Exit codes: 0 drawn, 2 usage, input or operation error, 4 the file kept
changing during the write (retry later).`,

  diff: `Usage: nodetto-cli diff <before.jsonl> <after.jsonl> [--format text|json] [--exit-code]

Show elements and pages added (+), changed (~, with the changed fields) and
removed (-) between two versions, as outline lines. An agent keeps the version
it wrote ("edit --snapshot") and later diffs it against the file to see what
the person changed in the app.

  --format     text (default) or json.
  --exit-code  Exit 1 when there are changes (like git diff --exit-code).

Example:
  nodetto-cli diff .nodetto-last.jsonl flow.jsonl
  page p1 "Schema"
    ~ erd.table 01M4WD accounts @40,0 240x80  [semantic.tableName, visual.x]
  0 added, 1 changed, 0 removed.

${EXIT_CODES}`,

  export: `Usage: nodetto-cli export <doc.jsonl> --format <format> [--page <short-id|id|name>]
                          [--element <id>] [--output <file>] [--font-dir <dir>] [--padding <n>]
                          [--background <#rrggbb|transparent>] [--scale <n>]
                          [--pdf-page artwork|a4|letter]
                          [--orientation portrait|landscape] [--margin <mm>]
                          [--mermaid-kind erDiagram|classDiagram|sequenceDiagram|stateDiagram-v2|flowchart]
                          [--code-format <output>]

--quiet suppresses warning lines. Repeated document-load and text-layout
warnings collapse as " (and <n> more like this)"; other format warnings print
one per line. --strict still exits 3 where supported.

Render one page exactly as the app's page export does.
Text exports (SVG, Mermaid, D2, draw.io) depend only on canonical content and
referenced attachment bytes, independent of branch, time, time zone, locale,
working directory, absolute path and Bun or native. PNG and PDF depend on fonts.

  --format       svg, png, pdf, html, mermaid, d2, drawio or code (required).
                 html writes a website ZIP; code uses --element and --code-format;
                 drawio writes an editable draw.io file of every page.
                 SQL: use nodetto-cli ddl. BPMN XML: use nodetto-cli bpmn export.
  --page         Export only this page by short ID, full ID or exact name.
                 Required when the document has several pages (unless --element
                 implies one; drawio exports all pages without it). Use pages to
                 list short IDs, full IDs, names and kinds.
  --element      Render only this element's area (a frame renders everything
                 inside it). Accepts a unique id prefix; implies its page.
                 Use it to check one part of a large diagram.
  --output       Output file. PNG, PDF and HTML require it; text formats print
                 to stdout when omitted.
  --mermaid-kind Mermaid diagram kind; defaults to the first available kind on
                 the selected page. Does not include any other document pages.
  --code-format  Code panel output (default css): css, json, linked, palette,
                 typography, layout, html, code-css, code-linked, manifest,
                 responsive-html, responsive-css, responsive-linked,
                 responsive-manifest, swiftui, compose, mobile-assets,
                 adaptive-swiftui, adaptive-compose, adaptive-manifest,
                 accessibility-audit. Generated code requires an artboard.
  --padding      Space around the content in canvas units, 0-256 (default 16).
  --background   Six-digit hex color, or transparent. Default: #ffffff for PNG
                 and PDF, transparent for SVG.
  --scale        Raster density: 0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3 or 4 (default 1 for
                 PNG, 2 for the image embedded in a PDF). Limited to 8192 pixels
                 per side and 32 megapixels; without --scale a drawing that is
                 too large is rendered at the largest scale that fits.
  --pdf-page     artwork (page fits the drawing, default), a4 or letter.
  --orientation  portrait (default) or landscape, for a4 and letter.
  --margin       PDF margin in millimetres, 0-50 (default 10; artwork ignores it).

  --font-dir     Extra directory of fonts for PNG and PDF (for example CJK
                 fonts). Common system sans and mono faces are always loaded.

PNG and PDF load fallback fonts when base fonts lack a glyph. If no font has
a glyph, stderr reports warning: glyph-missing <id>: with its code points
where coverage can be determined. SVG is unchanged.
PNG text uses those fonts, so metrics can differ slightly from the app.

SVG, PNG and PDF exports of a whole architecture, freeform or flowchart page
print text-layout lint findings on stderr as
warning: <rule-id> <element-id>: <message>. The exported output and exit code
are unchanged. See nodetto-cli help lint.

Example (check a drawing):
  nodetto-cli export flow.jsonl --page Flow --format png --output /tmp/flow.png
  nodetto-cli export mixed.jsonl --page Schema --format svg --output schema.svg
  nodetto-cli export mixed.jsonl --page Schema --format mermaid --output schema.mmd
  nodetto-cli export mixed.jsonl --format drawio --output mixed.drawio
  nodetto-cli export design.jsonl --element artboard-id --format code --code-format swiftui

${EXIT_CODES}`,

  ddl: `Usage: nodetto-cli ddl <document.jsonl> [--dialect postgresql|mysql|sqlite]
                       [--page <short-id|id|name>] [--output <file.sql>]
                       [--check <file.sql>] [--strict]
                       [--frame <id|short-id|name>]

--quiet suppresses warning lines; repeated warnings collapse as
" (and <n> more like this)". --strict still exits 3 where supported.

Print the deterministic schema DDL the editor's Database DDL panel generates for
one ERD page. Without --page, the document must contain exactly one page with
ERD tables.

  --frame    Export only this frame and its nested contents on the selected page.
             Matches an exact id, then an exact name, then a unique id prefix
             of at least 6 characters. Unknown or ambiguous values exit 2 and
             list candidate frames (short id, name, full id).
             Cross-scope references produce warnings and are omitted.
             memberIds lists are authoritative except lists naming only frames;
             open frames (no list or only frames) also include fully contained,
             unclaimed tables by position regardless of z-order or nested edges.
             Ambiguous exclusions warn with the table name; --strict exits 3.
             Canvas ownership can differ from DDL scope.
  --dialect  postgresql (default), mysql or sqlite.
  --output   Write the SQL to a file instead of stdout.
  --check    Compare the generated SQL with an existing file; exit 1 when it is
             out of date.
  --strict   Exit 3 when the export reports warnings.

CHECK and generated-column expressions must be one row-local SQL expression of
at most 65536 characters; line breaks are exported as spaces. PostgreSQL output
also accepts "::" casts, the "~" regular-expression operators and ARRAY[...].
Unsafe or longer expressions are omitted with a warning that names the reason
(for MySQL and SQLite this includes PostgreSQL-only syntax). Expressions that
call functions or operators the target dialect lacks (for example
num_nonnulls() or ILIKE on SQLite) are kept and reported as warnings.
Caveat: a unary "~" (bitwise NOT) is valid in MySQL and SQLite but is still
omitted there, with a warning that calls it a regular-expression operator.

Page and element ids are auto-assigned, opaque and never change. rename-page
changes only the display name; names are the human-facing key (for example,
--page "Shop schema" --frame "orders store").

${EXIT_CODES}`,

  merge: `Usage: nodetto-cli merge <base> <ours> <theirs> [--output <file>]

Three-way merge keeps ours on conflict; arrays are atomic. If ours deleted a
record changed by theirs it stays deleted; if theirs deleted ours' changed
record ours stays. An integrity pass restores ours' missing pages and references
or drops dangling records, then validates. Errors write nothing. Conflict lines
on stderr are never hidden by --quiet; canonical output is written on conflict.

Git driver (.gitattributes and once per clone):
  *.jsonl merge=nodetto
  git config merge.nodetto.name "nodetto three-way merge"
  git config merge.nodetto.driver "nodetto-cli merge %O %A %B --output %A"

Exit codes: 0 clean, 1 conflicts (output written), 2 usage or input error.`,

  arrange: `Usage: nodetto-cli arrange <document.jsonl> [--mode tidy|overlaps|layered|route]
  [--direction LR|TB] [--page <short-id|id|name>] [--frames <id|name,...>]
  [--ids <id,...>] [--reset-manual] [--write] [--check]

Tidy is the default; overlaps removes overlaps, layered lays out columns and
route separates connectors and places labels; layered selects a better member order
when available, without a general crossing guarantee. Both repair remaining segment
overlaps, including by moving ports. Labels use the nearest free candidate to their
connector or loop: a fixed position and offset with zero collision score. If none is
free, the lowest-scoring candidate is used. Moved labels are reported on stderr. Self-loops prefer top, right, bottom, left; movable ends can be reassigned
to free a side, otherwise the least-used side is shared. --direction applies to tidy and layered. --frames
is layered only; --ids is route only; --reset-manual is layered or route only.
Stored ports and routes count as manual and are preserved unless rerun with
--reset-manual. --write rewrites the file; --check exits 1 if anything changes.
Without --page the document must have exactly one page.

Page kind                         layered / route / lint --metrics
state, flowchart, freeform,       frames as columns / yes / yes
architecture, uml, erd
bpmn                              pools and lanes as rows / yes / yes
sequence                          excluded: participant and message order define geometry
breadboard                        excluded: physical holes and electrical wires
pcb                               excluded: physical footprints and tracks
ERD column ends get no ports and are not spread. On bpmn, columns are global;
--frames and --direction TB exit 2 because pools are horizontal. Nested lanes
may get full boxes rewritten and retain order. Layered refuses to write when
lane heights cannot fill their pool, sub-process contents cannot be kept clear
of sub-processes in other lanes, or collapsed pool contents cannot fit the
planned width and clear sub-processes in other pools.
With lanes nested at most one level, layered moves units and changes pool boxes
and lane heights but keeps lane positions. A lane can end outside its pool when
the pool box does not change; sub-process or collapsed pool contents can change
parent or offset.
Example: nodetto-cli arrange flow.jsonl --mode layered --frames Stage0 --write
Example: nodetto-cli arrange flow.jsonl --mode route --ids edge1 --reset-manual

${EXIT_CODES}`,

  format: `Usage: nodetto-cli format <document.jsonl> [--write] [--check]

Print the canonical JSONL form.

  --write  Rewrite the file in place.
  --check  Exit 1 when the file is not canonical.

${EXIT_CODES}`,

  validate: `Usage: nodetto-cli validate <document.jsonl> [--strict]

--quiet suppresses warning lines; repeated warnings collapse as
" (and <n> more like this)". --strict still exits 3 where supported.

Parse and validate a document; print warnings and errors and a one-line summary.
Warnings include semantic.unknownField for a semantic field the element type
does not define (kept, but ignored by this build). --strict exits 3 when there
are warnings.

${EXIT_CODES}`,

  lint: `Usage: nodetto-cli lint <document.jsonl|file.bpmn> [--page <short-id|id|name>]
                        [--config <file>] [--format text|json] [--fix] [--metrics]
                        [--font-dir <dir>]

--fix wraps text and moves colliding labels; .bpmn exits 2.
--metrics reports edge crossings, label overlaps and segmentOverlaps; it never changes the exit code.
Text: metrics <page name>: <n> edge crossing(s), <m> edge-label overlap(s), <k> overlapping segment pair(s).
JSON contains edgeCrossings, labelOverlaps and segmentOverlaps per page and in summary.
Metrics cover bpmn, erd, state, uml, flowchart, architecture and freeform.
Rules: bpmn and breadboard: existing rules and image-missing; architecture and
freeform: text layout and image-missing; flowchart: text layout, node-overlap
and image-missing; erd, state and uml: node-overlap and image-missing; other
pages with images: image-missing.
node-overlap and image-missing rules cover diagram pages and attachments.
ERD frame-straddle warns when a table crosses a frame edge, naming both;
this warning does not change the exit code.
Lint BPMN, breadboard, architecture, freeform, flowchart, ERD, state and UML pages from a
nodetto document or BPMN XML.
Text output is empty when clean; --format json always prints a report. A
.bpmnlintrc in the working directory is used when --config is not given and a
BPMN page is linted. --font-dir adds fonts for glyph coverage. glyph-missing
is a warning naming the element and code points on any page kind where coverage
can be determined. A document with no lintable page and no missing glyph keeps
the existing error.

Architecture, freeform and flowchart pages are checked for text layout with
warning rules:
label-overflow reports a node or shape label line clipped or spilling outside
its box; label-collision reports an edge label box overlapping another edge
label or an element; note-overflow reports note text cut off or running into
or close to the element below. Messages give measured and available sizes.
East Asian wide and fullwidth characters (CJK, kana, hangul, fullwidth forms)
are measured at 1 em, so the lint reports lines that real fonts clip even when
export geometry fits. These stable rule ids can be used in check scripts;
findings match export geometry, except for that wide-character width.

Exit codes: 0 clean, 1 error findings, 2 usage, parse or config errors.`,

  breadboard: `Usage: nodetto-cli breadboard bom <document.jsonl> [--page <short-id|id|name>]
                                  [--output <file.csv> | --check <file.csv>] [--strict]
       nodetto-cli breadboard netlist <document.jsonl> --format kicad|spice
                                      [--page <short-id|id|name>]
                                      [--output <file> | --check <file>] [--strict]
       nodetto-cli breadboard gerber <document.jsonl> --output <file.zip>
                                     [--page <short-id|id|name>] [--board <id>]
                                     [--outline board|used] [--strict]
       nodetto-cli breadboard import <file.kicad_sch|file.net> [--output <file.jsonl>] [--strict]

--quiet suppresses warning lines. Repeated warnings from loading a document
collapse as " (and <n> more like this)"; warnings from this command's own
conversion print one per line. --strict still exits 3 where supported.

Export a breadboard bill of materials or netlist, export a board as PCB
fabrication files, or import a KiCad 6+ schematic/netlist into a new
breadboard document.

gerber writes a ZIP of Gerber (RS-274X, X2) and Excellon drill files that
board houses such as JLCPCB, PCBWay and Elecrow accept as an upload. The PCB
keeps the breadboard layout: used holes become plated holes, strips become
bottom-layer traces, wires become top-layer traces where their path is clear
and jumper wires drawn on the silkscreen otherwise.

  --page    Select one breadboard page by short ID, full ID or exact name.
  --board   Select a board by element id or unique id prefix (gerber only).
  --outline Board outline for gerber: board (default) or used, trimmed to the
            used area plus a margin.
  --format  Required for netlist: kicad or spice.
  --output  Write generated output to a file; required for gerber.
  --check   Compare generated output with a file; exit 1 when out of date.
  --strict  Exit 3 when warnings are reported.

Examples:
  nodetto-cli breadboard bom prototype.jsonl --output bom.csv
  nodetto-cli breadboard netlist prototype.jsonl --format kicad
  nodetto-cli breadboard gerber prototype.jsonl --output prototype-pcb.zip
  nodetto-cli breadboard gerber prototype.jsonl --outline used --output prototype-pcb.zip
  nodetto-cli breadboard import circuit.net --output staged.jsonl

${EXIT_CODES}`,

  bpmn: `Usage: nodetto-cli bpmn import <file.bpmn> [--output <doc.jsonl>] [--strict]
       nodetto-cli bpmn export <document.jsonl> [--page <short-id|id|name>]
                               [--output <file.bpmn> | --check <file.bpmn>] [--strict]

--quiet suppresses warning lines; repeated warnings collapse as
" (and <n> more like this)". --strict still exits 3 where supported.

Import or export BPMN 2.0 XML.

  --strict  Exit 3 when import or export reports warnings.
  --check   (export) Exit 1 when the file is out of date.

${EXIT_CODES}`,

  gerber: `Usage: nodetto-cli gerber import <file|archive.zip>... [--output <doc.jsonl>]
                                 [--into <doc.jsonl>] [--page-name <name>] [--strict]
       nodetto-cli gerber export <doc.jsonl> --output <board.zip> [--page <page>] [--strict]

--quiet suppresses warning lines. Repeated warnings from loading a document
collapse as " (and <n> more like this)"; warnings from this command's own
conversion print one per line. --strict still exits 3 where supported.

Draw a board's fabrication files on a freeform page: Gerber RS-274X layers
(copper, solder mask, silkscreen, paste, outline) and Excellon drill files,
given one by one or as a ZIP archive. Each layer becomes a named group of
filled vector paths in board coordinates (10 page units per millimetre, the
top view, with the board's bottom-left at the lower left). Layers are named
from their Gerber X2 file function, else from KiCad, Protel or Eagle file
names. Solder mask, paste, bottom silkscreen and inner layers start hidden.

  --output     Write a new document with the PCB page.
  --into       Add the PCB page to this existing document.
  --page-name  Page name (default: the archive or file name, or "PCB").
  --strict     Exit 3 when the import reports warnings.

export writes an imported page back as a ZIP of Gerber and drill files, one
per layer group under its imported file name, drawn from the page as it is
now: moved, resized, rotated, deleted and added paths and shapes in a layer
group reach the files; other elements are reported and left out. Nothing is
checked: spacing, connections and drill sizes are up to you.

  --output     The ZIP archive to write (required).
  --page       The page with Gerber layers (required when there are several).
  --strict     Exit 3 when the export reports warnings.

Example:
  nodetto-cli gerber import board-gerbers.zip --output board.jsonl
  nodetto-cli gerber import gerber/*.g* gerber/board.drl --into keyboard.jsonl --page-name PCB
  nodetto-cli gerber export board.jsonl --output board-edited.zip

${EXIT_CODES}`,

  pcb: `Usage: nodetto-cli pcb import <file.kicad_pcb> [--output <doc.jsonl>] [--strict]
       nodetto-cli pcb gerber <doc.jsonl> --output <file.zip>
                               [--page <short-id|id|name>] [--strict]

--quiet suppresses warning lines. Repeated warnings from loading a document
collapse as " (and <n> more like this)"; warnings from this command's own
conversion print one per line. --strict still exits 3 where supported.

Import a KiCad board as a PCB page, or export a PCB page as Gerber and drill
files in a ZIP archive.

  --output  (import) Write the nodetto document; (gerber) required ZIP path.
  --page    Select a PCB page when the document contains more than one.
  --strict  Exit 3 when import or export reports warnings.

Examples:
  nodetto-cli pcb import board.kicad_pcb --output board.jsonl
  nodetto-cli pcb gerber board.jsonl --output board.zip

${EXIT_CODES}`,

  drawio: `Usage: nodetto-cli drawio import <file.drawio> [--output <doc.jsonl>] [--strict]

--quiet suppresses warning lines; repeated warnings collapse as
" (and <n> more like this)".
--strict still exits 3 where supported.

Convert a draw.io (diagrams.net) file, compressed or not, into a nodetto
document with one freeform page per diagram. Shapes without a nodetto
equivalent are imported as rectangles and reported as warnings; images are
skipped. Export with: nodetto-cli export <doc> --format drawio.

  --strict  Exit 3 when the import reports warnings.

${EXIT_CODES}`,
};

/** Detailed help for one command, or the overview for an unknown name. */
export function helpFor(command: string | undefined): string {
  return (command !== undefined && COMMAND_HELP[command]) || OVERVIEW;
}

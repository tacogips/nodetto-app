// Help text. The top-level overview fits one screen; each command has its own
// page with every option, exit code and an example, printed by
// `nodetto-cli help <command>` or `nodetto-cli <command> --help`.

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
  nodetto-cli arrange <doc>       Tidy the layout of one page

Render
  nodetto-cli export <doc>        Export a page or selected artwork

Convert and check
  nodetto-cli ddl <doc>           Database DDL from an ERD page
  nodetto-cli format <doc>        Canonical JSONL formatting
  nodetto-cli lint <doc|bpmn>     Lint BPMN and breadboard pages
  nodetto-cli bpmn import|export  BPMN 2.0 XML conversion
  nodetto-cli drawio import       draw.io (.drawio) to nodetto JSONL
  nodetto-cli gerber ...          Gerber and drill files to a PCB page and back
  nodetto-cli pcb import|gerber   KiCad board to a PCB page, Gerber and drill export
  nodetto-cli breadboard ...      BOM, netlist, PCB Gerber and KiCad import

MCP server
  nodetto-cli mcp                 Serve all CLI operations over stdio
  nodetto-cli authorize [folder]  Grant project-folder access for the Store CLI

Run "nodetto-cli help <command>" or "nodetto-cli <command> --help" for details.
AI loop: inspect -> shapes/types -> edit --snapshot -> export (look at the PNG)
-> diff <snapshot> <doc> later; the app shows and merges the edits live.`;

const EXIT_CODES = `Exit codes: 0 success, 1 out of date (--check), 2 usage or input error,
3 warnings with --strict.`;

export const COMMAND_HELP: Readonly<Record<string, string>> = {
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
                           [--type <prefix>] [--ids short|full]

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

  --kind     Only types typically drawn on this page kind (freeform, erd,
             uml, sequence, state, flowchart, architecture, bpmn, breadboard
             or pcb).
  --format   text (default) or json.

Palette shapes (a flowchart decision, a use-case actor, an iPhone artboard) are
listed by "nodetto-cli shapes"; several shapes can share one element type.

Example:
  nodetto-cli types erd.table

${EXIT_CODES}`,

  edit: `Usage: nodetto-cli edit <doc.jsonl> --ops <file.json|-> [--arrange] [--dry-run]
                        [--snapshot <file>] [--format text|json]

Apply a batch of operations through the editor's command layer, so the result is
exactly what the app would produce. The batch is all-or-nothing: an invalid
operation prints its index and reason and nothing is written. The document is
written atomically; if the file changed on disk while the batch was being
applied (for example the human saved in the app), the batch is applied again
to the new contents (up to three times) so no human edit is overwritten.

Operations (a JSON array, or JSON Lines; --ops - reads stdin):
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
  {"op":"delete","id":"01M4WD"}
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
    self-referencing foreign key or a self-transition).
  - update deep-merges objects; arrays are replaced whole (use append and
    remove-item for single list items); null removes a key.
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

Render one page exactly as the app's page export does.

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

PNG text uses those fonts, so metrics can differ slightly from the app.

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

Print the deterministic schema DDL the editor's Database DDL panel generates for
one ERD page. Without --page, the document must contain exactly one page with
ERD tables.

  --frame    Export only this frame and its nested contents on the selected page.
             Matches an exact id, then an exact name, then a unique id prefix
             of at least 6 characters. Unknown or ambiguous values exit 2 and
             list candidate frames (short id, name, full id).
             Cross-scope references produce warnings and are omitted.
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

Page and element ids are auto-assigned, opaque and never change. rename-page
changes only the display name; names are the human-facing key (for example,
--page "Shop schema" --frame "orders store").

${EXIT_CODES}`,

  arrange: `Usage: nodetto-cli arrange <document.jsonl> [--mode tidy|overlaps]
                           [--direction LR|TB] [--page <short-id|id|name>]
                           [--write] [--check]

Run the editor's Tidy layout (default) or Remove overlaps on one page and print
the canonical result. Without --page, the document must have exactly one page.

  --mode       tidy (default) or overlaps.
  --direction  LR or TB layout direction for tidy.
  --write      Rewrite the file in place.
  --check      Exit 1 when arranging would move anything.

${EXIT_CODES}`,

  format: `Usage: nodetto-cli format <document.jsonl> [--write] [--check]

Print the canonical JSONL form.

  --write  Rewrite the file in place.
  --check  Exit 1 when the file is not canonical.

${EXIT_CODES}`,

  validate: `Usage: nodetto-cli validate <document.jsonl>

Parse and validate a document; print warnings and errors and a one-line summary.

${EXIT_CODES}`,

  lint: `Usage: nodetto-cli lint <document.jsonl|file.bpmn> [--page <short-id|id|name>]
                        [--config <file>] [--format text|json]

Lint BPMN and breadboard pages from a nodetto document or BPMN XML. Text output
is empty when clean; --format json always prints a report. A .bpmnlintrc in the
working directory is used when --config is not given and a BPMN page is linted.

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

Import or export BPMN 2.0 XML.

  --strict  Exit 3 when import or export reports warnings.
  --check   (export) Exit 1 when the file is out of date.

${EXIT_CODES}`,

  gerber: `Usage: nodetto-cli gerber import <file|archive.zip>... [--output <doc.jsonl>]
                                 [--into <doc.jsonl>] [--page-name <name>] [--strict]
       nodetto-cli gerber export <doc.jsonl> --output <board.zip> [--page <page>] [--strict]

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

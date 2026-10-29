# Import and export

## Database schema export

Layer search includes database columns and types, default/generated expressions,
index names, check constraints, UML attributes/methods/parameters and image
descriptions. Results show the matching detail and retain their parent hierarchy.
Internal IDs, embedded image data and extension metadata are not searched.
Enable All pages to search across the document; results retain their hierarchy
and show page names. Selecting a result opens its page. Go selects the layer and
fits its visible artwork to the canvas; hidden layers remain hidden.
Shift-click selects the visible range from the last selected anchor; Ctrl/Cmd-click
toggles individual layers, and Ctrl/Cmd+Shift-click adds a range. Ranges stay on
one page and exclude filtered-out rows and collapsed descendants. Hidden or
locked layers that appear in the list can still be selected for inspection.
Double-click a layer name or focus it and press F2 to rename it in place.
Enter or blur saves; Escape cancels. Clearing restores the content/type label
without changing visible text or database names. Concurrent name changes,
locks and document reloads reject stale drafts instead of overwriting them.
For multiple selected layers, Rename selected layers in the inspector previews
patterns using `{name}`, `{type}` and `{n}`, with a numbering start and minimum
digit count. Numbering follows expanded layer-panel order and skips locked
layers and resources. Only explicitly selected layers on the active page are
renamed; selected containers do not implicitly rename their children. Apply is
one undo step. An empty pattern clears editor-only names without changing
visible text, table names or other semantic content.
Optional Find in name and Replace with fields perform case-sensitive literal
replacement on the existing layer name before `{name}` expansion. Every match
is replaced; an empty Find skips replacement. Regex syntax, dollar signs and
placeholder-looking replacement text remain literal.
With a layer name focused, Up/Down and Home/End select visible rows; hold Shift
to extend the selection. Right expands a container or selects its first child;
Left collapses it or selects its parent. Filtered paths remain expanded, and
parent/child navigation never crosses a page boundary.

ERD shapes include Table, View, Materialized view, Function, and Procedure.
Select a database object and open its inspector tab to edit its query/body,
result columns or parameters, return type, language, and dependencies. New
objects remain editable drafts and show a warning until required definitions
are supplied. Dependencies refer to other database shapes on the same page;
SQL export orders definitions after their dependencies and warns about missing
or cyclic references. Foreign keys accept tables only, including endpoint
dragging and CLI edits. Use ordinary connectors for other relationships.

Views export to PostgreSQL, MySQL, and SQLite. Materialized views export to
PostgreSQL; functions and procedures export to PostgreSQL or MySQL. Unsupported
objects are omitted with an export warning. Routine bodies are authored SQL:
PostgreSQL uses SQL or PL/pgSQL dollar-quoted bodies; MySQL uses mysql-client
`DELIMITER` blocks. Function parameters currently use IN mode and scalar return
types from the existing SQL type mapper. Queries and bodies are preserved, not
translated between dialects.

Pages containing ERD tables or database objects enable the SQL export tab.
It generates deterministic PostgreSQL, MySQL, or SQLite SQL for every table on
the current page, including primary keys, nullability, relation-derived foreign
keys, one-to-one uniqueness, safe default expressions, and named or generated
ordered composite indexes. Columns can also carry a portable computed
expression; the editor marks them with a function (f-hook) glyph, keeps them
mutually exclusive with defaults and primary keys, and emits `GENERATED ALWAYS AS (...) STORED` for all
three targets after a conservative row-local expression safety check. Stable-ID
table check constraints accept portable,
single-expression SQL predicates of up to 65,536 characters; line breaks are
exported as spaces and string literals may contain any printable text except
backslashes. PostgreSQL output also accepts `::` casts, the `~` / `~*` / `!~` /
`!~*` regular-expression operators and `ARRAY[...]`; MySQL and SQLite omit
expressions that use them. Expressions are omitted with a warning naming the
reason if they are longer or contain unsafe syntax. Check and generated expressions that call functions or operators the target dialect
lacks (for example PostgreSQL's `num_nonnulls()` or `ILIKE` on SQLite) are kept
and reported as warnings, so `--strict` fails before the migration does.
Column defaults accept literals and `CURRENT_DATE/TIME/TIMESTAMP`; PostgreSQL
also accepts `gen_random_uuid()`, `uuid_generate_v4()`, `CURRENT_USER`,
`SESSION_USER` and `CURRENT_ROLE`, which other dialects omit with a warning.
PostgreSQL and MySQL foreign keys are emitted after all tables so forward
references and cycles remain executable; SQLite keeps
them inline. The panel supports copy and `.sql` download and reports incomplete
endpoints, many-to-many relations that need junction tables, duplicate names,
unsafe/custom types, defaults or generated expressions, and other review items.
Mermaid and D2 explicitly warn when generated expressions cannot be represented
instead of silently flattening them. Export is read-only
and the generated migration should be reviewed before it is applied.

## Mermaid import and export

The **Export → Mermaid** tab exports the current page's semantic ER, UML class or
sequence layers as deterministic Mermaid source. Choose any diagram family
present on a mixed page, copy the source for Markdown/documentation, or download
an `.mmd` file. ER export includes columns, supported keys and cardinality;
class export includes members, visibility, stereotypes, multiplicities and
association kinds; sequence export preserves participant/message order,
sync/async/return arrows and activation intervals. Stable aliases keep renamed
layers and duplicate display names safe. Unsupported cross-page endpoints and
lossy composite unique indexes are surfaced as warnings rather than generating
dangling syntax. The same adapter imports `erDiagram`, `classDiagram`, and
`sequenceDiagram` files into validated, editable IR with deterministic initial
layouts and line-addressed warnings for unsupported statements. Desktop Open
and the hosted file picker accept `.mmd`/`.mermaid`. Imports are intentionally
dirty and detached, so autosave cannot replace Mermaid source with JSONL; Save
asks for a Nodetto document path.

## draw.io import and export

Open a `.drawio` or `.dio` file (compressed or not) in the desktop app, the
hosted file picker, or with `nodetto-cli drawio import`. Each draw.io page
becomes a freeform page: shapes, text, containers (as frames), labels, colours,
gradients, fonts, rotation, flips, connectors with their endpoints, waypoints,
orthogonal routing, arrowheads, rounded bends and line jumps carry over. Shapes
from other draw.io libraries become labelled rectangles and images are skipped,
both reported as import notes. Imports are detached, so autosave never rewrites
the draw.io file.

**Export → draw.io** (or `nodetto-cli export <doc> --format drawio`) writes an
editable `.drawio` file of every page, or only the current one. Geometric shapes
use draw.io's own shapes with matching proportions and round-trip exactly; ERD
tables and UML classes become draw.io lists with one row per column or member.
UML components, interfaces and ports use draw.io component, interface and square shapes.
Use-case actors and stick figures (`geo:actor`) become `umlActor`, use cases
become ellipses and systems become container rectangles.
Types without a draw.io counterpart are written as labelled rectangles and
listed in the export panel.

Shape kinds map onto draw.io shape names (the `shape=` style value, or a named
style such as `ellipse`) in both directions; the exporter writes the first name
in each row. Shapes nodetto can only approximate (draw.io's double rectangle
and its 4/6/8-point stars) import as the listed kind
with an import note.

| nodetto kind | draw.io shape names |
| --- | --- |
| rect | `rounded=0`/`rounded=1`, `label`, `mxgraph.flowchart.process`, `mxgraph.flowchart.terminator` (as a stadium) |
| ellipse | `ellipse`, `doubleEllipse`, `mxgraph.flowchart.start_1`, `start_2`, `on-page_reference` |
| diamond | `rhombus`, `mxgraph.flowchart.decision` |
| triangle | `triangle`, `mxgraph.flowchart.extract_or_measurement`, `merge_or_storage` (flipped) |
| hexagon | `hexagon`, `mxgraph.flowchart.preparation` |
| parallelogram | `parallelogram`, `mxgraph.flowchart.data` |
| cylinder | `cylinder3`, `cylinder`, `cylinder2`, `datastore`, `mxgraph.flowchart.database` |
| star, pentagon, octagon, cross | `mxgraph.basic.polygon` on export; `mxgraph.basic.star`, `pentagon`, `octagon2` on import |
| trapezoid | `trapezoid`, `mxgraph.flowchart.manual_operation` (flipped) |
| arrow | `singleArrow`, `mxgraph.arrows2.arrow` |
| double-arrow | `doubleArrow` |
| chevron | `step` |
| cloud | `cloud` |
| callout | `callout`, `wedgeCallout` |
| note | `note`, `note2` |
| cube | `cube` |
| document | `document`, `mxgraph.flowchart.document`, `document2` |
| multi-document | `mxgraph.flowchart.multi-document` |
| manual-input | `manualInput`, `mxgraph.flowchart.manual_input` |
| delay | `delay`, `or` (draw.io's AND gate), `mxgraph.flowchart.delay` |
| predefined-process | `process`, `process2`, `mxgraph.flowchart.predefined_process` |
| internal-storage | `internalStorage`, `mxgraph.flowchart.internal_storage` |
| off-page | `offPageConnector`, `mxgraph.flowchart.off-page_reference` |
| card | `card`, `mxgraph.flowchart.card` |
| tape | `tape`, `mxgraph.flowchart.paper_tape` |
| stored-data | `dataStorage`, `mxgraph.flowchart.stored_data` |
| display | `display`, `mxgraph.flowchart.display` |
| loop-limit | `loopLimit`, `mxgraph.flowchart.loop_limit` |
| collate | `collate`, `mxgraph.flowchart.collate` |
| sort | `sortShape`, `mxgraph.flowchart.sort` |
| summing-junction | `sumEllipse`, `mxgraph.flowchart.summing_junction` |
| or | `orEllipse`, `mxgraph.flowchart.or_2` |
| direct-data | `mxgraph.flowchart.direct_data` |
| sequential-data | `tapeData`, `mxgraph.flowchart.sequential_data` |
| right-triangle | `mxgraph.basic.orthogonal_triangle` |
| person | `actor`, `mermaidPerson` |
| actor | `umlActor` |

## D2 export

The **Export → D2** tab provides source for architecture documentation
and version-controlled engineering diagrams. Generic flow shapes, nested
frames/groups and connectors export alongside native D2 SQL tables, UML
classes, and sequence diagrams. Copy the source or download `.d2`; unsupported
freehand/image fidelity, dangling references, ambiguous membership, composite
indexes, and non-portable styles are reported before handoff.

## HTML import and website export

Open an `.html` or `.htm` file to import its static layout into an editable web
artboard. Local stylesheets and raster images resolve beneath that HTML file's
directory. Text, frames, images, buttons, inputs, textareas, selects, checkboxes
and switches become editable layers. The source HTML/CSS is never overwritten.
Import notes identify omitted resources and features. Capture uses a 1440px
viewport; scripts, remote resources, embedded documents, SVG/canvas/media,
web fonts and dynamic/responsive behavior are omitted. Local CSS background
images become editable image layers; multiple backgrounds and tiling are
approximated or reported in import notes.

General, Web and App palettes include UI controls with editable labels, values,
options, checked and disabled states. The same controls appear in HTML, SVG,
prototype previews and native code handoff.

Export > HTML packages every top-level artboard on the current page as separate
HTML/CSS files, plus an index and shared image files in a ZIP. Unzip and open
`index.html`. The CLI supports the same export:

```sh
nodetto-cli export design.jsonl --format html --output website.zip
```

Use `--element <frame-id>` for one artboard. These are static pages; application
logic and prototype navigation are not generated. Missing images stop export
with an error.

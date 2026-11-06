# Command line (`nodetto-cli`)

`nodetto-cli` is a native Rust executable over the same diagram engine the editor
uses, so repositories can keep a nodetto document as the source of truth and
check generated artifacts in CI or pre-commit hooks:

```bash
nodetto-cli ddl schema.jsonl --dialect postgresql --strict --output schema.sql
nodetto-cli ddl schema.jsonl --dialect postgresql --strict --check schema.sql
nodetto-cli format schema.jsonl --check     # or --write
nodetto-cli arrange schema.jsonl --write    # Tidy layout; --mode overlaps, --check
nodetto-cli validate schema.jsonl
nodetto-cli lint process.jsonl --format text
nodetto-cli bpmn import process.bpmn --output process.jsonl
nodetto-cli bpmn export process.jsonl --page process --check process.bpmn
nodetto-cli breadboard bom board.jsonl --check board.bom.csv
nodetto-cli breadboard netlist board.jsonl --format kicad --output board.net
nodetto-cli breadboard netlist board.jsonl --format spice --output board.cir
nodetto-cli breadboard gerber board.jsonl --output board-pcb.zip
nodetto-cli breadboard gerber board.jsonl --outline used --output board-pcb.zip
nodetto-cli breadboard import circuit.kicad_sch --output board.jsonl
nodetto-cli gerber import board-gerbers.zip --output board.jsonl
nodetto-cli gerber export board.jsonl --output board-edited.zip
```

`ddl` emits exactly what the inspector's Database DDL panel generates for one
ERD page (`--page <id or name>` when several pages contain tables). `--check`
exits 1 when the file is out of date, `--strict` exits 3 when the export
reports warnings, and usage or parse errors exit 2. In a checkout, run it with
`CARGO_TERM_QUIET=true cargo run -p nodetto-cli -- <command>`;
`mise run build-cli` builds the Rust sidecar that the macOS bundle ships.
The executable embeds the shared diagram engine in Boa, a JavaScript interpreter written in Rust.
The JS interpreter uses no QuickJS C runtime or FFI bindings.
It needs no Node.js or Bun installation and uses no JIT. Bun bundles the shared
engine at build time; the TypeScript CLI remains a reference for parity tests. `lint` checks BPMN,
breadboard, architecture, freeform and flowchart pages. On architecture, freeform and flowchart pages it reports the text-layout warnings
`label-overflow`, `label-collision` and `note-overflow` with measured and available sizes.
East Asian wide and fullwidth characters are measured at 1 em, so the lint also reports lines that real fonts clip.
It exits 0 when there are no
error-level findings (warnings may still be printed), 1 when error-level
findings exist, and 2 for usage, parse, or config errors; it has no `--strict`
option. A whole-page SVG, PNG or PDF export of an architecture, freeform or flowchart page prints the same findings as `warning:` lines on stderr.
`lint --font-dir <dir>` adds fonts for coverage. `glyph-missing` is a warning
naming the element and code points on any page kind where coverage can be
determined. A document with no lintable page and no missing glyph keeps the
existing error.

`bpmn import` and `bpmn export` exit 3 with `--strict` when they report
warnings. `bpmn export --check` exits 1 on drift; usage or parse errors exit 2.
`breadboard bom --check` and `breadboard netlist --check` exit 1 on drift;
`breadboard bom`, `netlist`, `gerber` and `import`, and `gerber import` and
`export`, exit 3 with `--strict` when they report warnings, and 2 for usage or
input errors.

## PCB boards (KiCad)

Import a board into a PCB page, then export Gerber and drill files or the
board as an image:

```bash
nodetto-cli pcb import board.kicad_pcb --output board.jsonl
nodetto-cli pcb gerber board.jsonl --output board.zip
nodetto-cli export board.jsonl --format svg --output board.svg
```

See [KiCad PCB boards](pcb/kicad-pcb.md) for supported content, editing and
export details.

## Drawing with AI agents and live co-editing

`nodetto-cli` also lets an AI agent (or any script) draw, check its work as an
image, and keep editing alongside a person who has the same file open in the
desktop app. `nodetto-cli --help` is a one-screen overview; `nodetto-cli help
<command>` (or `<command> --help`) gives full usage.

```bash
nodetto-cli inspect flow.jsonl                  # compact indented outline (or --format json)
nodetto-cli types erd.table                     # fields, defaults and an example "add" op
nodetto-cli shapes --category uml               # palette shapes by shape ID; words filter, e.g. shapes actor
nodetto-cli draw flow.jsonl flowchart:decision --label "In stock?"   # one shape by its shape ID
nodetto-cli draw flow.jsonl erd.foreign-key --from 01M4WD --to 01M4X2  # a connector shape
nodetto-cli edit flow.jsonl --ops ops.json --snapshot .last.jsonl  # add/connect/update/..., all-or-nothing
nodetto-cli diff .last.jsonl flow.jsonl         # what the person changed since the agent's last write
nodetto-cli export flow.jsonl --page Flow --format png --output /tmp/flow.png
nodetto-cli export schema.jsonl --element f-orders --format png --output /tmp/frame.png
nodetto-cli export flow.jsonl --format pdf --pdf-page a4 --output flow.pdf
```

- `inspect` prints one line per element, nested under its frame or container,
  with short unique ids, geometry and the identifying semantic fields (table
  columns, relation ends, labels) and no styling, which costs an agent far
  fewer tokens than the JSONL.
- `shapes` lists every shape of the app's palette under its shape ID, grouped
  by category (general, flowchart, UML class/component/use case/sequence/state,
  ERD, BPMN, breadboard, PCB, artboards, UI controls, screens). Words filter by
  ID, label, category or element type, `--category uml` selects every UML
  category, and `--connectors`/`--no-connectors` select connectors or placed
  shapes. `shapes <shape-id>` shows the element type and defaults it creates.
- `draw <doc> <shape-id>` draws one shape the way the palette does, with the
  shape's own defaults (a flowchart decision is a labelled diamond, an iPhone
  artboard has the device size), `--label`, `--at x,y`, `--size WxH`,
  `--right-of` or `--below`. Connector shapes take `--from` and `--to`. In
  `edit` batches, `{"op":"add","shape":...}` and
  `{"op":"connect","shape":...}` do the same.
- `edit` also scales a page or chosen elements while keeping the layout
  (`{"op":"scale","page":"p1","factor":1.25}`: positions, sizes and text sizes
  together, paths and connectors following), replaces part of the display
  text across the document (`{"op":"replace-text","find":"example.dev",
  "replace":"example.info"}`, with `regex` and `ignoreCase`; `--dry-run`
  previews every change), and groups or ungroups elements
  (`{"op":"group","ids":[...]}`, `{"op":"ungroup","id":...}`), or changes
  stacking order (`{"op":"order","id":"@panel","to":"back"}`).
  For `order`, select targets with `id` or `where`/`expect`; multiple targets
  move as one block. Specify exactly one of `to` (`back`, `front`, `backward`,
  `forward`), `before` (directly beneath an anchor), or `after` (directly above
  it). Group members reorder within their group; ungrouped targets reorder on
  the page with frame contents and group members. Frames and BPMN pools, lanes,
  groups and expanded sub-processes paint beneath what they enclose: `front`
  cannot lift them above their contents, and `back` cannot put enclosed content
  behind them. Sending content behind its frame ends implicit ownership, so it
  no longer moves with the frame. Painting beneath does not grant ownership;
  order the frame `to: back` or `before` the node to give it ownership.
  `inspect --text <text>` lists the elements whose labels, names or notes
  contain the text.
- `edit` operations reference elements by unique id prefix or by `@ref` names
  given earlier in the batch; list items such as columns get generated ids, and
  ERD relation ends may name a column instead of its id. Validation errors name
  the operation and the field. If the file changes during the write (the person
  saved before the final re-read), the batch is applied again to the new
  contents. This optimistic check is not a filesystem compare-and-swap; changes
  after that check can still race the atomic replacement.
- `export` renders SVG with the editor's serializer, PNG with resvg using system
  fonts (embedded in the compiled sidecar), and PDF with the app's page layout.
  It also exports HTML website ZIPs, Mermaid, D2, draw.io files (every page
  unless `--page` is given), and every output in the Code panel
  (`--format code --element <id> --code-format <output>`). SQL uses `ddl`,
  and BPMN XML uses `bpmn export`; both accept `--page`. Breadboard BOMs,
  netlists and PCB Gerber ZIPs use `breadboard bom`, `breadboard netlist` and
  `breadboard gerber`. `drawio import`, `bpmn import`, `breadboard import`
  and `gerber import` convert those files to JSONL.
  PNG and PDF load fallback fonts when base fonts lack a glyph. When coverage
  can be determined, a glyph no font has produces `warning: glyph-missing
  <id>: ...` on stderr with code points. SVG is unchanged.
- The desktop app applies outside changes to an open file live, keeping the
  camera and selection. With no unsaved local edits it does not write the file.
  With unsaved local edits it merges three ways at element and field level (a move
  and a rename of the same table both survive) and autosaves the result, keeping
  untouched lines byte-identical and relative image references unchanged; only
  the same field changed on both sides, or a file that
  now holds a different document, raises the "File changed on disk" banner. A
  `convert` also raises it when a local edit conflicts with the conversion, the
  merge would not validate, or a dependent no longer suits the new type.

In `edit update`, `visual` and `semantic` objects deep-merge, arrays replace,
and null removes a key; removing a required field is an error. For
`strokeDashArray`, `[]` means solid: it removes both `strokeDashArray` and
`dash` unless the patch sets `dash`. Null removes only `strokeDashArray`, so a
stored `dash` still applies; `add` rejects `[]`. Unknown `visual.style` keys in
`add` and `update` are rejected with suggestions.

For `node.generic` and `shape.geo` labels, `visual.style.verticalAlign` accepts
`top`, `middle` (default), or `bottom`. `add` and `update` write
`boxLabelAlign: true` with it; without that marker the label stays centered,
so hand-written JSONL must include the marker. Setting `verticalAlign` on a box
bound to a text style removes its link unless the patch also sets `textStyle`.
`boxLabelAlign: true` alone keeps the link and follows the style value;
`verticalAlign: null` removes both keys.

The app's **Export** dialog has a **Page** selector showing each page's name and
kind. Formats are grouped into Artwork, Diagram source, and Web & developer
in a dropdown. Select the ERD page of a mixed ERD/sequence document to export only that
page. Changing this selector also switches the editor's current page. SVG, PNG,
and PDF support the whole current page, selected artwork, or an artboard.

Each page also has a stable 11-character short ID shown in the page properties,
the export page selector, and CLI output. It is derived from the full stored ID;
renaming and reordering do not change it, and existing JSONL files do not need
migration. Internal page IDs and element references remain unchanged. A single JSONL file
contains multiple pages. Reordering changes fractional `order` keys and can move
page metadata lines in the file; element lines stay sorted by page ID and element
ID, independently of display order. Legacy pages without valid unique order keys
are assigned those keys on their first explicit ordering operation.

Use `nodetto-cli pages mixed.jsonl` to list page numbers, short IDs, names,
kinds, editing modes and full IDs, or add `--format json` for scripts. `--kind
erd` filters the listing. Numbers represent current display positions; use IDs
in scripts. Each page remembers the editing mode (tool palette) last chosen on
it; `{"op":"set-page-mode","id":"<page>","mode":"usecase"}` changes it and
`add-page` accepts `"mode"`.

Every CLI `--page` option and edit page reference accepts a short ID, full ID,
or exact name. A document with several pages requires `--page` unless
`--element` identifies the owning page. Ambiguous aliases or names require a
full ID. For example:

```bash
nodetto-cli export mixed.jsonl --page Schema --format svg --output schema.svg
nodetto-cli export mixed.jsonl --page Schema --format png --output schema.png
nodetto-cli export mixed.jsonl --page Schema --format pdf --output schema.pdf
nodetto-cli export mixed.jsonl --page Schema --format mermaid --mermaid-kind erDiagram --output schema.mmd
nodetto-cli export mixed.jsonl --page Schema --format d2 --output schema.d2
nodetto-cli ddl mixed.jsonl --page Schema --output schema.sql
```

Sequence documents can omit optional geometry: participant order determines
default columns, and message order determines spaced timeline rows. Lifelines
and activation bars extend to the messages. Explicit saved positions remain
authoritative, and adding messages or reordering participants works with the
same resolved geometry without rewriting the imported document on open.
A sequence participant can connect to itself to create a self-call loop on the
next timeline row, with its label beside the loop. The message kind can be
`sync`, `async`, or `return`; following rows and lifelines leave room for the
loop. In the app, drag with the Message tool from a lifeline back to the same
lifeline to create a self-call. A click creates nothing, and a generic
connector-tool drag does not create one.

```json
{"op":"connect","from":"@a","to":"@a","label":"check","semantic":{"kind":"sync"}}
```

See [the design](../design-docs/specs/design-cli-ai-drawing.md).

Use `nodetto-cli validate doc.jsonl --strict` to exit 3 when validation reports warnings. `edit` reports newly introduced `semantic.unknownField` warnings per operation, for example `warning operation 0 (add): <id> (uml.component) semantic.kind: unknown semantic field (semantic.unknownField)`. JSON output includes a `warnings` array with `operation`, `op`, `element`, `type`, `path`, `code`, and `message`. Draw a stick figure with `nodetto-cli draw doc.jsonl geo:actor --label "Visitor"`.

## MCP server

Run `nodetto-cli mcp` to expose every CLI operation to an MCP client over
stdio. Configure your client with:

```json
{
  "mcpServers": {
    "nodetto": {
      "command": "/absolute/path/to/nodetto-cli",
      "args": ["mcp"]
    }
  }
}
```

For a source checkout, build with `CARGO_TERM_QUIET=true cargo build -p nodetto-cli`
and use `/absolute/path/to/nodetto-app/target/debug/nodetto-cli` as `command`.
The desktop bundle includes the same native MCP server.

The server exposes `nodetto_inspect`, `nodetto_types`, `nodetto_edit`,
`nodetto_arrange`, `nodetto_export`, `nodetto_diff`, `nodetto_validate`,
`nodetto_format`, `nodetto_ddl`, `nodetto_lint`, `nodetto_bpmn`, and
`nodetto_open`, and `nodetto_authorize`. Each takes an `args` array containing the arguments after its
command name. All options work exactly as in the terminal. `nodetto_help`
accepts `[]` for the overview or `["edit"]` for detailed command help;
`nodetto_cli` accepts the complete CLI argument array, including a command
name, `--help`, or `--version`.

For example, call `nodetto_edit` with:

```json
{
  "args": ["/absolute/path/to/flow.jsonl", "--ops", "-", "--snapshot", "/tmp/baseline.jsonl"],
  "stdin": "[{\"op\":\"add\",\"page\":\"Flow\",\"type\":\"node.generic\",\"semantic\":{\"label\":\"Hello MCP\"}}]"
}
```

The optional `stdin` field supplies the text for `--ops -`; it never reads
from the protocol stream. Tool results contain `exitCode`, `stdout`, and
`stderr` in both structured content and a JSON text block. Nonzero CLI exit
codes set MCP `isError`, including drift (1), invalid input (2), strict
warnings (3), and edit contention (4). An unsuccessful call leaves the
server available for further calls.

Paths resolve from the server process's working directory. Use absolute
paths when the client's working directory is uncertain. Export SVG text or
write SVG, PNG, PDF, and HTML ZIP output with the same CLI options. Binary
exports are written to `--output` on the local filesystem. The server has
the same local file access and desktop launching capability as the CLI.
Stdout carries only MCP messages; disconnecting the client stops the server.


### Layout, selection, and merging

`arrange --mode tidy|overlaps|layered|route` accepts `--direction LR|TB` for tidy and layered, `--page`, `--write` and `--check` (exit 1 when anything would change). `--frames` orders layered columns; `--ids` selects route connectors; `--reset-manual` applies only to layered and route. Stored ports and routes count as manual and are preserved until reset. `edit --arrange` still runs tidy.

| Page kind | Layered | Route, labels, ports, loops | Metrics |
| --- | --- | --- | --- |
| state, flowchart, freeform, architecture, uml | Frames as columns | Yes | Yes |
| erd | Frames as columns | Yes; column ends have no ports and are not spread | Yes |
| bpmn | Pools and lanes as rows | Yes | Yes |
| sequence | Excluded: participant and message order define geometry | Excluded, same reason | No |
| breadboard | Excluded: physical holes and electrical wires | Excluded, same reason | No; crossings are physical |
| pcb | Excluded: physical footprints and tracks | Excluded, same reason | No |

On BPMN pages columns are global; `--frames` and `--direction TB` exit 2 because pools are horizontal. Nested lanes may get full boxes rewritten and keep their order. Layered refuses to write if lane heights cannot fill the pool, if sub-process contents cannot remain clear of sub-processes in other lanes, or if collapsed pool contents cannot fit the planned width and clear sub-processes in other pools. When lanes are nested at most one level, it moves units and changes pool boxes and lane heights but keeps lane positions. A lane can end outside its pool when the pool box does not change, and sub-process or collapsed pool contents can change parent or offset.

```sh
nodetto-cli arrange flow.jsonl --mode layered --frames Stage0 --write
nodetto-cli arrange flow.jsonl --mode route --ids edge1 --reset-manual
nodetto-cli lint flow.jsonl --fix
nodetto-cli lint flow.jsonl --metrics --format json
```

`connect` accepts `visual`, `routing`, and `routingAvoidObstacles`. Precedence is explicit field > page default > page convention > existing default. A convention exists only when every routing-capable peer has the same stored straight or orthogonal routing and obstacle setting; absent or manual routing prevents a convention. Set a page default with `{"op":"set-page-routing","id":"p1","routing":"orthogonal","routingAvoidObstacles":true}`; use `routing: null` to clear it. `add-page` accepts `connectorRouting` with the same fields. Manual page defaults are rejected. Routing stored under `visual` is honored, but `semantic` is the supported location.

Layered chooses a better measured member order when available; it does not guarantee fewer crossings on every page. Route and layered separate routes, repair remaining segment overlaps including by moving port positions, place labels, and report moved label IDs on stderr. They write semantic `routingLane`, `labelPosition`, `labelOffsetX` and `labelOffsetY`. Rerun with `--reset-manual` after moving elements. Self-loops prefer top, right, bottom, then left; movable ends are reassigned to free a side when possible, otherwise the least-used side is shared. A moved label takes the nearest free position to its own connector or loop. A free label position means one of the fixed candidate positions and offsets has zero collision score; when none does, the lowest-scoring candidate remains visible in metrics.

`lint --fix` wraps text using CJK break rules and moves colliding labels in one write; `.bpmn` exits 2. `--metrics` reports `edgeCrossings`, `labelOverlaps` and `segmentOverlaps` per page and in the JSON summary. Text reports crossings, edge-label overlaps and overlapping segment pairs. Metrics never change exit codes.

| Page kind | Lint rules |
| --- | --- |
| bpmn, breadboard | Existing kind rules and `image-missing` |
| architecture, freeform | Text layout and `image-missing` |
| flowchart | Text layout, `node-overlap`, `image-missing` |
| erd | `node-overlap`, `frame-straddle`, `image-missing` |
| state, uml | `node-overlap`, `image-missing` |
| Any other kind with images | `image-missing` |

Edit references resolve exact id, `@ref`, `name:<text>`, then unique id prefix. Name matching is case-sensitive, exact after trimming, and scoped to the operation page, source page of a connect, the element page for semantic references, or the whole document. Missing or ambiguous names list candidates. `update`, `convert` and `delete` accept either `id` or `where`: its `page`, `type`, `from`, `to`, `parent`, `name` keys combine with AND and at least one is required. `expect` is an integer at least zero, allowed only with `where`; a mismatch aborts without writing, zero matches without `expect` is an error, and `expect: 0` is a no-op. `select` binds one existing element using a fresh `ref` and either `id` or `where`; its `expect` defaults to and must be 1. Text reports `operation <i> (<op>): matched <n> element(s)` and JSON has `matches` with operation, op, count and ids. `--quiet` never hides matches. Unknown top-level fields are rejected with valid fields listed.

```json
{"op":"delete","where":{"type":"bpmn.sequenceFlow","from":"name:Approve","to":"name:Update status"},"expect":1}
{"op":"select","ref":"ok","id":"name:Approve"}
```

`update` accepts `label`, applied after semantic fields: `text.note` → `text`, `frame` → `name`, `node.generic` → `label`, `state.node` → `name`, `erd.table` → `tableName`, `state.transition` → `trigger`, BPMN flows → `name`, `edge.generic` → `label`.

`carryMembers` is a boolean on `update` and defaults to true. Setting it false on a box update retains members' absolute positions:

| Kind | Default / false behavior |
| --- | --- |
| `frame` | Moves descendants; resize follows constraints or layout. False holds members, rechecks geometric membership and rejects layout frames. |
| `bpmn.participant` | Moves descendants and relays lanes; false still moves lanes, holding and re-parenting other members. |
| `bpmn.lane` | Moves descendants; height restacks siblings and carries their members. False holds non-lane descendants and re-parents them; changing x, y or width is rejected. |
| `bpmn.subProcess` | Moves descendants; false holds and re-parents them. |
| `breadboard.board` | Moves plugged parts; false holds them, retaining plugs only where holes still align. |
| `group` | Has no box; false is rejected. |

UML packages and architecture groups/zones drawn as frames carry; `shape.geo`, `usecase.node` system boundaries and `bpmn.group` do not. Other non-containers reject `carryMembers`. Attachments always follow their host: `uml.port`, `bpmn.boundaryEvent` and PCB tracks. Pool or lane updates with false reject heights below the child-lane minimum; pool width must exceed 30 per lane depth and fit nested lanes. Errors exit 2 without writing.

Repeated document-load, validate, edit, draw and export text-layout warnings collapse as ` (and <n> more like this)`. Repeated BPMN import/export, draw.io import and DDL warnings also collapse. Gerber, PCB, breadboard and other export-format warnings print one per line. Global `--quiet` suppresses warnings, not matches, conflicts, errors or lint findings. `--strict --quiet` still exits 3 for warnings.

For a Git merge driver, add to `.gitattributes` and configure each clone:

```text
*.jsonl merge=nodetto
```

```sh
git config merge.nodetto.name "nodetto three-way merge"
git config merge.nodetto.driver "nodetto-cli merge %O %A %B --output %A"
```

`merge` keeps ours on conflicting fields and treats arrays atomically. Ours-deleted versus theirs-modified stays deleted; theirs-deleted versus ours-modified keeps ours. An integrity pass restores ours' missing pages and references or drops dangling records, then validates. Conflict lines go to stderr even with `--quiet`. Exit 0 means clean, 1 conflict with canonical output written, and 2 input or validation error with nothing written.

SVG, Mermaid, D2 and draw.io text exports depend only on canonical content and referenced attachment bytes, independent of branch, time, time zone, locale, working directory, absolute path and Bun versus native. PNG and PDF depend on fonts. Treat generated SVG as build output and regenerate after merging; for example, an executable `.git/hooks/post-merge` can contain:

```sh
#!/bin/sh
nodetto-cli export flow.jsonl --page Flow --format svg --output flow.svg
```

### Conversion, frame scope and participant rendering

The `convert` edit operation accepts `id` or `where` with `expect`, and `type` and/or palette `shape`, with optional `semantic` and `label`. `visual` is not accepted; use a later `update` for visual changes. To choose a `shape.geo` geometry, use `semantic.geo`, for example `{"op":"convert","id":"@a","type":"shape.geo","semantic":{"geo":"diamond"}}`. It keeps the id, resolved bounds, index, membership and connectors; equivalent text maps to the target field. Fields it cannot carry are dropped and reported as `convert.fieldDropped` warnings. `--dry-run` reports dropped fields and affected connectors. Edges, frames, groups and locked elements cannot convert. Invalid semantics, incompatible connectors or changed bounds fail atomically; resize first if necessary.

`delete` with `reconnectTo` moves direct connectors to another element while retaining ports, labels and routes; incompatible endpoints or targets fail atomically. Connectors attached only to a cascaded `uml.port` are removed without being moved or reported, including when a later reconnect operation cascades the port. Non-edge references follow their existing cascade or detach rule.

For `ddl --frame`, `memberIds` lists are authoritative except non-empty lists containing only frames, so `memberIds: []` is a closed frame. Open frames (no list or only frames) also include fully contained, unclaimed tables by position, regardless of z-order or nested positional frame edges. A straddling table excluded from a selected frame or another ambiguous exclusion produces a named warning; `--strict` exits 3. Canvas ownership may differ from DDL scope. `lint` reports `frame-straddle` as a warning naming the table and frame without changing its exit code.

Sequence participant rendering uses a stick figure with the name below for `actor`, a cylinder for `db`, and a rounded box for `service`, in export and on the canvas; all retain their lifelines. `types sequence.participant` describes this in text and its JSON `rendering` key.

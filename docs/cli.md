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
engine at build time; the TypeScript CLI remains a reference for parity tests. `lint` checks BPMN
and breadboard pages. It exits 0 when there are no
error-level findings (warnings may still be printed), 1 when error-level
findings exist, and 2 for usage, parse, or config errors; it has no `--strict`
option. `bpmn import` and `bpmn export` exit 3 with `--strict` when they report
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
- The desktop app applies outside changes to an open file live, keeping the
  camera and selection. With unsaved local edits it merges three ways at element
  and field level (a move and a rename of the same table both survive) and
  autosaves the result; only the same field changed on both sides, or a file that
  now holds a different document, raises the "File changed on disk" banner.

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

See [the design](../design-docs/specs/design-cli-ai-drawing.md).

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

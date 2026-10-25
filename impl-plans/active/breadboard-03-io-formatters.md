# breadboard-03-io-formatters

- planId: breadboard-03-io-formatters
- planPath: impl-plans/active/breadboard-03-io-formatters.md
- wave: 2; dependsOn: breadboard-01-ir-contract
- design: design-docs/specs/design-breadboard.md sections 8.1-8.5
  (BOM, KiCad netlist, SPICE, Mermaid and D2), user-QA Q4 and Q5
- progress log: impl-plans/progress/breadboard-03-io-formatters.md
- protocol: overview "Per-worker protocol", gates G1 and G2
- G1 ownRegex: `^packages/io/src/breadboard/|^packages/io/src/d2/export\.ts`

## Intent

Write three pure, deterministic text formatters over the ir
`BreadboardNetlist` model:
- BOM CSV
- KiCad-style S-expression netlist
- SPICE netlist

Also make D2 export skip breadboard elements with one warning per page,
and pin with a test that Mermaid exports nothing for a breadboard page.
The CLI (plan 16) and the desktop (plan 17) build the model with core and
call these.

## Non-goals

- No dependency on `@nodetto/core`. io depends only on ir.
- No import code (plan 04). No CLI or UI.
- No date, timestamp, path or locale-dependent output.

## writePaths

- packages/io/src/breadboard/bom.ts (new)
- packages/io/src/breadboard/kicad-netlist.ts (new)
- packages/io/src/breadboard/spice-netlist.ts (new)
- packages/io/src/breadboard/index.ts (new)
- packages/io/src/breadboard/formatters.test.ts (new)
- packages/io/src/breadboard/skip.test.ts (new: D2 and Mermaid)
- packages/io/src/d2/export.ts
- impl-plans/progress/breadboard-03-io-formatters.md

## sharedPaths

- packages/io/src/index.ts

## sharedPathNotes

- packages/io/src/index.ts: append one export block for
  `exportBreadboardBomCsv`, `exportBreadboardKicadNetlist`,
  `exportBreadboardSpiceNetlist` and `type BreadboardFormatterResult` from
  `./breadboard/index.ts`, placed after the drawio block (around index.ts:60).
  Plan 04 appends its own block in the same wave. Use fresh-read and
  pre/post hashes, and never touch its lines.

## Contracts (pinned; plans 16, 17, 18 rely on them)

```ts
export interface BreadboardFormatterResult { readonly text: string; readonly warnings: readonly string[] }
export function exportBreadboardBomCsv(netlist: BreadboardNetlist): BreadboardFormatterResult;
export function exportBreadboardKicadNetlist(netlist: BreadboardNetlist): BreadboardFormatterResult;
export function exportBreadboardSpiceNetlist(netlist: BreadboardNetlist): BreadboardFormatterResult;
```

Warning strings are nodetto's own wording:
- `"<ref>: unannotated reference"`
- `"<ref>: duplicate reference"`
- SPICE only: `"<ref>: value \"<v>\" is not a number"`

## File-level changes

### bom.ts (design 8.2)

- Header line `Item,Qty,References,Value,Part,Footprint`.
- Group key is (type, value, description, footprint).
- Groups are ordered by their first reference, using `compareReferences`
  from ir. References in a group are in that order, joined by `", "`.
- `Item` runs from 1. `Part` is the description.
- RFC 4180 quoting: quote a field that contains a comma, quote, CR or LF,
  and double the quotes.
- Lines end with LF and the file ends with a trailing newline.
- The model already excludes boards, wires and netlist cards (Q4).

### kicad-netlist.ts (design 8.3)

- Emit the structure shown in design 8.3, with
  `(export (version "E") (design (source "<title>") (tool "nodetto")) (components ...) (nets ...))`.
- Each `comp` has `ref`, `value`, `footprint` and
  `(libsource (lib "nodetto") (part "<partName>") (description "<description>"))`.
- Each `net` has `(code "<n>") (name "<name>")`, then one
  `(node (ref) (pin) (pinfunction "<pinName>"))` per node.
- Two-space indentation, one `comp` or `net` per line group, all strings
  quoted, with `\` and `"` escaped.
- No date. Component and net order come from the model as given.

### spice-netlist.ts (design 8.4)

Follow design 8.4 line by line:
- the title comment
- `GND` written as `0`
- value formatting with suffixes `p n u m k Meg G`: pick the largest
  suffix whose mantissa is at least 1, with at most 6 significant digits
- element names
- per-type lines, including the potentiometer split into two halves of
  v/2 named `RRV1A`/`RRV1B`, the battery `VBT1 n+ n- DC <volts>`, the IC
  `XU1 ... <sanitised value>` plus its comment, and the button and header
  comment lines
- `.model` lines only for the models used, then `.end`

An unparseable value writes the element line as a `*` comment and adds
the warning. Node names other than `0` are the net names with characters
outside `[A-Za-z0-9_]` replaced by `_`.

### d2/export.ts

Skip `isBreadboardElementType` elements before the generic-node fallback
(d2/export.ts:558-570). Push one warning per page that had any skipped
element, with message exactly
`"Breadboard elements are not exported to D2."`, using the existing
`D2ExportWarning` shape.

## Pitfalls

- Do not import from `@nodetto/core`. That would be a package cycle.
- Determinism: never sort with `localeCompare`. Use `compareReferences`
  and plain code-point comparisons.
- SPICE suffix: `M` means milli in SPICE, so mega must be written `Meg`.
  1e-3 -> `1m`, 1e6 -> `1Meg`, 4700 -> `4.7k`, 0 -> `0`.
- KiCad pin numbers are written as quoted strings (`(pin "2")`).
- Do not change D2 output for any non-breadboard element. Existing D2
  tests must stay green unchanged.

## Tests (input -> expected), on hand-built `BreadboardNetlist` values

`formatters.test.ts`:
- BOM: two `220` resistors R2 and R1 plus an LED D1 -> 2 rows. Row 1 is D1
  (prefix D sorts before R); row 2 is `"R1, R2"` with Qty 2.
- BOM: a value `1,5k` -> the field is quoted. A value with `"` -> the quote
  is doubled.
- KiCad: the exact expected text for a 2-component, 2-net model (inline
  expected string). A reference containing `"` -> escaped as `\"`.
- KiCad: the output contains no digit sequence shaped like a date or time
  (regex `\d{4}-\d{2}-\d{2}`).
- SPICE: 4.7k resistor -> `R1 ... 4.7k`. 100n capacitor -> `100n`. 1M
  resistor -> `1Meg`. GND net -> node `0`.
- SPICE: potentiometer `10k` -> `RRV1A n1 nW 5k` and `RRV1B nW n3 5k`.
- SPICE: transistor pinout `EBC` -> `Q1 <C> <B> <E> QNPN` with the right
  nodes, plus `.model QNPN NPN`.
- SPICE: a resistor value `abc` -> a commented line and a warning
  mentioning R1.
- An unannotated `R?` -> warning `"R?: unannotated reference"`. Two `R1`
  -> a duplicate warning.
- Every output ends with exactly one `\n` and contains no `\r`.

`skip.test.ts`:
- a document with one breadboard page with a resistor and a wire -> D2
  output has no node for them and exactly one warning with the pinned
  message
- a document with a freeform node and a breadboard page -> the freeform
  node is unchanged
- Mermaid export of a breadboard-only document -> no Mermaid content, using
  the existing exporter's empty-result convention

## Verification

```
cd /Users/taco/gits/tacogips/nodetto-app-breadboard
mkdir -p tmp/breadboard-mode-s485/breadboard-03-io-formatters
bun test packages/io/src/breadboard                                     # exit 0, >0 pass, 0 fail
bun test packages/io > tmp/breadboard-mode-s485/breadboard-03-io-formatters/io.log 2>&1   # G2 (existing d2/mermaid tests stay green)
bun run typecheck > tmp/breadboard-mode-s485/breadboard-03-io-formatters/typecheck.log 2>&1   # G1
bunx biome check packages/io/src/breadboard packages/io/src/d2/export.ts packages/io/src/index.ts   # exit 0
grep -rn "@nodetto/core" packages/io/src/breadboard   # no output
```

## Done criteria

- The three functions are exported from `@nodetto/io` (index.ts block present once).
- The D2 warning text is exactly as pinned.
- All verification lines pass, with exit codes and counts in the progress log.

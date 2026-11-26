# schematic-12-io-formatters

- planId: schematic-12-io-formatters; wave 4; dependsOn: schematic-04-ir-sweep-netlist-model
- design: section 7.2 (text format, KiCad writer widening, partName table)
- progress log: impl-plans/progress/schematic-12-io-formatters.md

## Intent

Netlist text formatter for schematic pages and reuse of the existing KiCad
netlist writer via a widened structural input type.

## Non-goals

No breadboard target projection (plan 13), no io main index export (plan 13).

## writePaths

- packages/io/src/schematic/netlist-text.ts (new)
- packages/io/src/schematic/index.ts (new)
- packages/io/src/breadboard/kicad-netlist.ts
- packages/io/src/breadboard/bom.ts
- packages/io/src/schematic/formatters.test.ts (new)
- impl-plans/progress/schematic-12-io-formatters.md
- target
- tmp/cad3d

artifactRoots: target, tmp/cad3d. sharedPaths: none.

## Changes

- `kicad-netlist.ts`: add exported `KicadNetlistInput` (documentTitle;
  components with reference, value, footprint, partName, description; nets
  `BreadboardNetlistNet[]`) and type the `exportBreadboardKicadNetlist`
  parameter with it. Output unchanged.
- `bom.ts:referenceWarnings` parameter typed as `{components: readonly
  {reference: string}[]}`. Output unchanged.
- `schematic/netlist-text.ts`: `exportSchematicNetlistText(netlist:
  SchematicNetlist): {text, warnings}` with lines `# nodetto schematic
  netlist 1`, `# document <title>`, `# page <name>`, `component <ref>
  <value> <partName>`, `net <code> <name> <ref>.<pin> ...`. Quote a token
  when empty or containing whitespace, `"`, `#` or `\`, escaping `\` and `"`.
  LF, trailing newline. Warnings from `referenceWarnings`.
- `schematic/index.ts`: export `exportSchematicNetlistText` and
  `exportSchematicKicadNetlist = exportBreadboardKicadNetlist`.

## Pitfalls

- Quoting via a single linear pass per token (no regex in loops over many
  tokens is acceptable only as one `/[\s"#\\]/` test per token).
- Breadboard formatter tests must stay unedited and passing.

## Tests (formatters.test.ts)

- text output for a 2-component, 2-net netlist equals an exact string.
- value `1 k` and empty value are quoted; `"` and `\` escaped.
- duplicate and `R?` references produce warnings.
- KiCad writer on a SchematicNetlist emits `(libsource (lib "nodetto") (part "SW_Push") ...)` and `(footprint "")`.

## Verification

- `bun test packages/io/src/schematic/formatters.test.ts packages/io/src/breadboard/formatters.test.ts` exits 0.
- `bunx biome check <owned .ts files>` exits 0.

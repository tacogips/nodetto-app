# schematic-27-core-pcb-parity

- planId: schematic-27-core-pcb-parity; wave 6; dependsOn: schematic-21-core-netlist-names
- design: section 8.2 (rules table, `pageId`, empty board)
- progress log: impl-plans/progress/schematic-27-core-pcb-parity.md

## Intent

Live schematic-to-PCB parity findings for a PCB page against the first
schematic page.

## Non-goals

No CLI/UI wiring (plans 33, 37, 42). Must not import `packages/core/src/pcb`.

## writePaths

- packages/core/src/schematic/pcb-parity.ts (new)
- packages/core/src/schematic/pcb-parity.test.ts (new)
- impl-plans/progress/schematic-27-core-pcb-parity.md
- target
- tmp/cad3d

artifactRoots: target, tmp/cad3d. sharedPaths: none.

## Contract

```ts
export type SchematicPcbParityRuleId = "pcb-parity-missing-connection" | "pcb-parity-extra-connection" |
  "pcb-parity-missing-part" | "pcb-parity-extra-part" | "pcb-parity-value-mismatch";
export function firstSchematicPageId(document: Document): PageId | undefined;
export function schematicPcbParityFindings(document: Document, pcbPageId: PageId, schematicPageId: PageId):
  readonly SchematicErcFinding[]; // finding shape from plan 22 with ruleId widened to include these ids
```
If the finding type cannot widen without editing erc.ts, declare
`SchematicPcbParityFinding` with the same fields and these rule ids.

## Rules

Exactly design 8.2: footprint Map by reference (first visible in element
order), pad Map by number, empty pad net -> singleton; missing pad -> missing
connection on that footprint with `pin`; split PCB groups -> one finding per
extra group; PCB net spanning >= 2 schematic nets -> extra connection (error);
missing part on the schematic element with `pageId`; extra part; value
mismatch via `parseComponentValue`. Linear in pads + nodes.

## Tests

One positive and one negative per rule; R1.1-R2.1 with R2 lacking pad 1 ->
missing connection on R2 pin 1; empty PCB page -> one missing-part per
component with schematic element id and `pageId`; matched board -> none.

## Verification

- `bun test packages/core/src/schematic/pcb-parity.test.ts` exits 0.
- `bunx biome check <owned .ts files>` exits 0.

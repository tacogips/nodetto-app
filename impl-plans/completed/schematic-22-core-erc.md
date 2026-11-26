# schematic-22-core-erc

- planId: schematic-22-core-erc; wave 5; dependsOn: schematic-18-core-connectivity
- design: section 6 (five rules, finding shape, sort order)
- progress log: impl-plans/progress/schematic-22-core-erc.md

## Intent

`lintSchematicPage` with the five ERC rules surfaced by the problems panel
and `nodetto-cli lint`.

## writePaths

- packages/core/src/schematic/erc.ts (new)
- packages/core/src/schematic/erc.test.ts (new)
- impl-plans/progress/schematic-22-core-erc.md
- target
- tmp/cad3d

artifactRoots: target, tmp/cad3d. sharedPaths: none.

## Contract

```ts
export type SchematicErcRuleId = "unconnected-pin" | "single-pin-net" | "dangling-wire-end" | "duplicate-reference" | "shorted-power-nets";
export const SCHEMATIC_ERC_RULE_IDS: readonly SchematicErcRuleId[];
export interface SchematicErcFinding { readonly ruleId: SchematicErcRuleId; readonly severity: "error" | "warning";
  readonly elementId: ElementId; readonly pin?: number; readonly elementIds: readonly ElementId[]; readonly message: string; readonly pageId?: PageId }
export function lintSchematicPage(document: Document, pageId: PageId): readonly SchematicErcFinding[];
```
(`pageId` is used by PCB parity findings, plan 27.)

## Rules

Exactly design section 6: severities (warning, warning, warning, error,
error), no-connect exemption, missing-junction hint via
`wireEndOnPathOf`, one shorted-power finding per net. Sort by element order,
rule id, pin, message. Messages are nodetto's own and name reference and pin.

## Tests

Positive and negative case per rule; no-connect exemption; hint message for
an end on a bend; power pin counts as a connection for rules 1-2.

## Verification

- `bun test packages/core/src/schematic/erc.test.ts` exits 0.
- `bunx biome check <owned .ts files>` exits 0.

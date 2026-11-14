# breadboard-01-ir-contract

- planId: breadboard-01-ir-contract
- planPath: impl-plans/completed/breadboard-01-ir-contract.md
- wave: 1; dependsOn: none
- design: design-docs/specs/design-breadboard.md sections 3.1, 3.2, 3.3,
  3.5, 3.6 (and user-QA Q1, Q6, Q7)
- progress log: impl-plans/progress/breadboard-01-ir-contract.md
- protocol: follow impl-plans/active/breadboard-00-overview.md "Per-worker
  protocol", gates G1 and G2
- G1 ownRegex: `^packages/ir/src/(types|semantics|registry|breadboard|index)\.ts|^packages/ir/src/breadboard\.test\.ts|^packages/io/src/jsonl/golden\.test\.ts`

## Completion (session-490)

- Status: COMPLETE. Accepted by test-integrity, adversarial and the
  session-490 serial integration review (comm-009184, all 18 plans on the
  combined tree); archived to `impl-plans/completed/` in Step 8.
- Combined-tree verification: `mise exec -- bun run typecheck` exit 0;
  `mise exec -- bun test --path-ignore-patterns 'tmp/**'` exit 0 (2501 pass,
  18 skip, 0 fail); `CARGO_TERM_QUIET=true mise run lint` exit 0;
  `CARGO_TERM_QUIET=true mise exec -- cargo test --workspace` exit 0.
  Evidence (local, untracked): `tmp/breadboard-mode-s485/reconcile-s490/`.
- Open item owned by `breadboard-00-overview`, which stays in
  `impl-plans/active/`: `CARGO_TERM_QUIET=true mise run verify` exited 1
  because its `bun test` also collects git-ignored scratch copies under
  `tmp/breadboard-mode-s485/breadboard-05-collab/`
  (RECON-S490-W1-VERIFY-TMP-SCRATCH).
- The sections below are the dispatch-time plan.

## Intent

Add the `breadboard` page kind and the 13 typed `breadboard.*` element
types to the IR, with structural validation, key order, JSONL golden
coverage and the shared pure models that io and core both need:
- value parsing
- the netlist model
- the import plan and diagnostics

Every later plan compiles against the names pinned here. `@nodetto/io` cannot
import core, so these shared models must live in ir.

## Non-goals

- No electrical checks in `validateSemantic`. ERC is plan 07.
- No catalogue, pin tables or geometry. These belong to plan 02.
- No migration, no `SCHEMA_VERSION` change and no change to any existing
  type definition.

## writePaths

- packages/ir/src/types.ts
- packages/ir/src/semantics.ts
- packages/ir/src/registry.ts
- packages/ir/src/breadboard.ts (new)
- packages/ir/src/breadboard.test.ts (new)
- packages/ir/src/index.ts
- packages/ir/src/registry.test.ts
- packages/io/src/jsonl/golden.test.ts
- packages/io/src/__fixtures__/breadboard.jsonl (new)
- apps/cli/src/types-command.ts (checkpoint amendment: only the TYPICAL entry)
- impl-plans/progress/breadboard-01-ir-contract.md

## sharedPaths

none

## Contracts (pinned; every later plan relies on them)

`types.ts`: append `"breadboard"` as the last entry of `PAGE_KINDS`.

`semantics.ts`, following the BPMN block (`BPMN_ELEMENT_TYPES` at
semantics.ts:803, `isBpmnElementType` at 821, `SemanticByType` at 845):

```ts
export const BREADBOARD_PITCH = 10;
export const BREADBOARD_ELEMENT_TYPES = [
  "breadboard.board", "breadboard.wire", "breadboard.resistor", "breadboard.led",
  "breadboard.capacitor", "breadboard.diode", "breadboard.transistor",
  "breadboard.button", "breadboard.potentiometer", "breadboard.ic",
  "breadboard.header", "breadboard.battery", "breadboard.netlist",
] as const;
export type BreadboardElementType = (typeof BREADBOARD_ELEMENT_TYPES)[number];
export const BREADBOARD_PART_TYPES = [/* the 10 types from resistor to battery, same order */] as const;
export type BreadboardPartType = (typeof BREADBOARD_PART_TYPES)[number];
export function isBreadboardElementType(type: string): type is BreadboardElementType;
export function isBreadboardPartType(type: string): type is BreadboardPartType;
export const BREADBOARD_REFERENCE_PREFIX: Readonly<Record<BreadboardPartType, string>>;
// R, D (led), C, D (diode), Q, SW, RV, U, J, BT
export const BREADBOARD_BOARD_SIZES = ["full", "half", "mini"] as const;
export const BREADBOARD_WIRE_COLORS = ["red","black","blue","green","yellow","orange","white","gray"] as const;
export const BREADBOARD_LED_COLORS = ["red","green","yellow","blue","white","orange"] as const;
export const BREADBOARD_CAPACITOR_STYLES = ["ceramic", "electrolytic"] as const;
export const BREADBOARD_TRANSISTOR_POLARITIES = ["npn", "pnp"] as const;
export const BREADBOARD_TRANSISTOR_PINOUTS = ["EBC","ECB","BEC","BCE","CEB","CBE"] as const;
export const BREADBOARD_TOLERANCES = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 20] as const;
export const BREADBOARD_NETLIST_FORMATS = ["kicad_sch", "kicad_net"] as const;
```

The semantic interfaces are named `Breadboard<Kind>Semantic`, with Kind one
of Board, Wire, Resistor, Led, Capacitor, Diode, Transistor, Button,
Potentiometer, Ic, Header, Battery or Netlist. Their fields come from
design 3.2:
- Parts have `reference: string`, `value: string` and then their
  parameters:
  - Resistor: `span`, `bands: 4 | 5`, `tolerance?`
  - Led: `color`
  - Capacitor: `style`, `span`
  - Diode: `span`
  - Transistor: `polarity`, `pinout`
  - Ic: `pinCount`
  - Header: `pinCount`
  - Button, Potentiometer and Battery: no extra fields
- Board: `size`.
- Wire: `color`, `points: readonly {x: number; y: number}[]`.
- Netlist: `source: string`, `format`,
  `parts: readonly {reference; value; type: BreadboardPartType}[]`,
  `nets: readonly {name: string; nodes: readonly {reference: string; pin: number}[]}[]`.

Also export `type BreadboardPartSemantic` as the union of the 10 part
semantics. Add every type to `SemanticByType`.

`breadboard.ts` (new), as in design 3.5:

```ts
export function parseComponentValue(text: string): number | undefined;
export interface BreadboardNetlistComponent { elementId; type: BreadboardPartType; reference; value; description; footprint; partName: string; pins: readonly {number: number; name: string}[] }
export interface BreadboardNetlistNode { reference: string; pin: number; pinName: string }
export interface BreadboardNetlistNet { code: number; name: string; nodes: readonly BreadboardNetlistNode[] }
export interface BreadboardNetlist { pageId; pageName; documentTitle; components: readonly BreadboardNetlistComponent[]; nets: readonly BreadboardNetlistNet[] }
export interface BreadboardImportDiagnostic { severity: "error" | "warning"; code: string; message: string; line?: number; column?: number; reference?: string }
export interface BreadboardImportPart { reference; value; type: BreadboardPartType; parameters: Readonly<Record<string, unknown>> }
export interface BreadboardImportPlan { title; format: "kicad_sch" | "kicad_net"; source; parts: readonly BreadboardImportPart[]; target: BreadboardNetlistSemantic }
export interface BreadboardImportResult { plan?: BreadboardImportPlan; diagnostics: readonly BreadboardImportDiagnostic[] }
export function compareReferences(a: string, b: string): number; // natural reference order, design 5.1
```

`partName` carries the catalogue part name (design 3.4) to the KiCad
writer. `compareReferences` implements the design 5.1 natural order:
- compare the alphabetic prefix, then the number numerically
- an unannotated `R?` sorts after numbered references with the same prefix
- otherwise use plain string order

Callers break remaining ties by element id. It lives here because core
(netlist, annotation) and io (importers, BOM) both sort by it.

## File-level changes

### registry.ts

Add 13 `ElementTypeDefinition`s next to the BPMN ones (imitate
`bpmnDefinition` at registry.ts:1955 and its use in `DEFINITIONS` at 2326).
A small local helper `breadboardDefinition(type, keys, validate)` is fine.
For every definition:
- `category: "node"`
- `onReferenceDeleted: "detach"`
- `references: () => []`
- `keyOrder` per design 3.2 "Key order":
  - parts: `reference`, `value`, then the parameters in table order
  - board: `size`
  - wire: `color`, `points` with children `{keys: ["x","y"]}`
  - netlist: `source`, `format`, `parts` (children `reference`, `value`,
    `type`), `nets` (children `name`, `nodes`; grandchildren
    `reference`, `pin`)

Validation (structural only), using `checks.ts` helpers (`checkString`,
`checkNumber`, `checkEnum`, `checkArray`, `checkObject`):
- `reference` must be a non-empty string. `value` is a string and may be
  empty.
- Integer ranges:
  - resistor and diode `span` 2..10
  - capacitor `span` 1..5
  - ic `pinCount` 4..40, even; an odd value is the error code
    `breadboard.pinCountOdd`
  - header `pinCount` 1..40
  - `bands` is 4 or 5
  - `tolerance` is optional and must be in `BREADBOARD_TOLERANCES`
- Wire: `points` is an array of objects with finite `x` and `y`. Fewer than
  2 points is the error `breadboard.wirePoints`.
- Netlist:
  - non-empty `source`
  - `format` in the enum
  - every `parts[].type` passes `isBreadboardPartType`
  - non-empty `reference` strings
  - every `nodes[].pin` is a positive integer

Error codes must follow the existing `error(code, path, message)` pattern.

### index.ts

Export every symbol listed under Contracts from `semantics.ts` and
`breadboard.ts`, in one block next to the BPMN exports.

### apps/cli/src/types-command.ts (checkpoint amendment)

Adding `breadboard` to `PAGE_KINDS` makes the exhaustive
`TYPICAL: Readonly<Record<PageKind, readonly string[]>>` record fail to
typecheck (TS2741 at line 38). No other plan owned this file. Add exactly one
`breadboard` entry after `bpmn`, listing the 13 `breadboard.*` type strings
in registry order followed by `"text.note"`. Change nothing else in the file;
plan 16 adds the breadboard CLI command in its own files.

### packages/io/src/__fixtures__/breadboard.jsonl

A canonical golden document with one `breadboard` page and at least one
element of each of the 13 types, including:
- a wire with a bend point (3 points)
- a resistor with `bands: 5` and `tolerance: 1`
- an IC with `pinCount: 8`
- a netlist card with 2 parts and 1 net

It must be written in registry key order with canonical rounding, so that
`serializeDocument(parseDocument(text)) === text` byte for byte. Generate
it once with a throwaway script under `tmp/breadboard-mode-s485/breadboard-01-ir-contract/`
(never committed). Commit only the `.jsonl`.

### golden.test.ts / registry.test.ts

- `golden.test.ts`: append `"breadboard"` to `GOLDEN` (line 20). Change
  nothing else.
- `registry.test.ts` "registers the design table plus assets and token
  resources" (line 48): add the 13 type strings to the expected list.
  Change nothing else.

## Pitfalls

- `BREADBOARD_PART_TYPES` excludes board, wire and netlist. Annotation,
  BOM and ERC depend on this.
- Do not make `value` required to be non-empty: the design allows an empty
  value.
- `parseComponentValue`:
  - `M` is mega and `m` is milli
  - `u` and the micro sign U+00B5 are equal, but source files stay ASCII,
    so write the micro sign in source only as the JavaScript Unicode escape
    for code point 00B5 (a backslash, the letter u, then `00b5`), never as
    the literal character
  - RKM codes: `4k7` = 4700, `2R2` = 2.2, `1R` = 1, `0R` = 0
  - trailing units `R`, `ohm`, `F`, `V`, `H` are accepted case-sensitively
    as written in the design
  - `"abc"`, `""` and `"1..2"` return `undefined`
- Do not touch `SCHEMA_VERSION`, `migrations.ts` or any existing
  definition. Existing golden fixtures must reserialize unchanged.
- The ASCII checks (overview "ASCII gates") cover the new files, including
  the fixture, and the added lines of the modified files. Pre-existing
  non-ASCII text in `semantics.ts` or `types.ts` is not touched and does
  not fail the check.

## Tests (input -> expected), in `packages/ir/src/breadboard.test.ts`

- `validateSemantic` for each of the 13 types: a valid default semantic ->
  no issues; a wrong enum -> an issue at the field path
- ic `pinCount: 7` -> `breadboard.pinCountOdd`; ic `pinCount: 42` -> a range
  issue
- wire with 1 point -> `breadboard.wirePoints`
- netlist with `type: "breadboard.board"` in parts -> an issue; `pin: 0`
  -> an issue
- `parseComponentValue`:
  - `220` -> 220
  - `4.7k` -> 4700
  - `4k7` -> 4700
  - `10u` -> 1e-5
  - `100n` -> 1e-7
  - `1M` -> 1e6
  - `1m` -> 0.001
  - `2R2` -> 2.2
  - `0R` -> 0
  - `5V` -> 5
  - ` 10k ` -> 10000
  - `220ohm` -> 220
  - `abc` -> undefined
  - `""` -> undefined
- `compareReferences`: sorting `["R10","R2","R?","C1","R1"]` gives
  `["C1","R1","R2","R10","R?"]`
- `isBreadboardPartType("breadboard.wire")` -> false;
  `BREADBOARD_ELEMENT_TYPES.length` -> 13; `BREADBOARD_PART_TYPES.length`
  -> 10
- `PAGE_KINDS` includes `"breadboard"`

## Verification

```
cd /Users/taco/gits/tacogips/nodetto-app-breadboard
mkdir -p tmp/breadboard-mode-s485/breadboard-01-ir-contract
bun test packages/ir/src/breadboard.test.ts packages/ir/src/registry.test.ts packages/io/src/jsonl/golden.test.ts   # exit 0, >0 pass, 0 fail
bun test packages/ir packages/io/src/jsonl > tmp/breadboard-mode-s485/breadboard-01-ir-contract/ir-io.log 2>&1      # G2: exit 0
bun run typecheck > tmp/breadboard-mode-s485/breadboard-01-ir-contract/typecheck.log 2>&1                            # G1: no ownRegex match
bunx biome check packages/ir/src packages/io/src/jsonl/golden.test.ts   # exit 0
perl -ne 'if (/[^\x00-\x7F]/) { print "$ARGV:$.\n"; $bad = 1 } close ARGV if eof; END { exit($bad ? 1 : 0) }' packages/ir/src/breadboard.ts packages/ir/src/breadboard.test.ts packages/io/src/__fixtures__/breadboard.jsonl   # new files: exit 0, no output
git diff -U0 -- packages/ir/src/types.ts packages/ir/src/semantics.ts packages/ir/src/registry.ts packages/ir/src/index.ts packages/ir/src/registry.test.ts packages/io/src/jsonl/golden.test.ts | perl -ne 'if (/^\+(?!\+\+)/ && /[^\x00-\x7F]/) { print; $bad = 1 } END { exit($bad ? 1 : 0) }'   # added lines in modified files: exit 0, no output
git diff --stat -- packages/ir/src/migrations.ts   # empty (SCHEMA_VERSION untouched)
```

## Done criteria

- `grep -c '"breadboard\.' packages/io/src/__fixtures__/breadboard.jsonl` >= 13, and every one of the 13 type strings appears in the fixture.
- `grep -n '"breadboard"' packages/io/src/jsonl/golden.test.ts` shows the GOLDEN entry.
- All verification lines pass, with exit codes and counts in the progress log.

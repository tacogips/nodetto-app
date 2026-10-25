# breadboard-04-io-kicad

- planId: breadboard-04-io-kicad
- planPath: impl-plans/completed/breadboard-04-io-kicad.md
- wave: 2; dependsOn: breadboard-01-ir-contract
- design: design-docs/specs/design-breadboard.md sections 8.6 (intro),
  8.6.1-8.6.4, 1 (licensing boundary), 11 (KiCad fixtures)
- progress log: impl-plans/progress/breadboard-04-io-kicad.md
- protocol: overview "Per-worker protocol", gates G1 and G2
- G1 ownRegex: `^packages/io/src/kicad/`

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

Write nodetto's own KiCad readers, from scratch:
- an iterative S-expression reader that never throws
- a root-sheet `.kicad_sch` importer
- a KiCad S-expression `.net` importer
- the deterministic symbol-to-catalogue mapping table

Their output is the ir `BreadboardImportResult`. Plan 09 (core) lays the
plan out as a document. Plans 16 and 17 wire it into the CLI and the
desktop.

License boundary (strict): `.reference/kicad` may be read only to
understand behaviour. Copy no code, comments, keyword tables, symbols,
library data, demos or QA files. Translate nothing line by line. The
fixtures are tiny hand-written files and must contain only what the tests
need.

## Non-goals

- No layout or Document building. That is plan 09.
- No dependency on `@nodetto/core`.
- Legacy `.sch` is not parsed: it is only detected. Hierarchical sheets,
  buses, hidden power-pin net joining, `.kicad_pcb` and writing KiCad files
  are all out of scope.

## writePaths

- packages/io/src/kicad/sexpr.ts (new)
- packages/io/src/kicad/schematic.ts (new)
- packages/io/src/kicad/netlist.ts (new)
- packages/io/src/kicad/symbol-map.ts (new)
- packages/io/src/kicad/index.ts (new: `importKicad`)
- packages/io/src/kicad/sexpr.test.ts (new)
- packages/io/src/kicad/schematic.test.ts (new)
- packages/io/src/kicad/netlist.test.ts (new)
- packages/io/src/kicad/symbol-map.test.ts (new)
- packages/io/package.json
- test-fixtures/kicad (new directory: `README.md`, `led-button.kicad_sch`, `led-button.net`, `unknown-symbols.net`, `malformed.kicad_sch`, `legacy.sch`)
- impl-plans/progress/breadboard-04-io-kicad.md

## sharedPaths

- packages/io/src/index.ts

## sharedPathNotes

- packages/io/src/index.ts: append one export block, for `importKicad`,
  `readSexpr` and the types `SexprNode`, `SexprList` and `SexprAtom`, from
  `./kicad/index.ts`. Plan 03 appends its own block in the same wave. Use
  fresh-read and pre/post hashes, and never touch its lines.

## Contracts (pinned; plans 09, 16, 17, 18 rely on them)

```ts
export function importKicad(text: string, options: { fileName: string }): BreadboardImportResult;
export function readSexpr(text: string): { root?: SexprList; diagnostics: BreadboardImportDiagnostic[] };
export type SexprNode = SexprList | SexprAtom;
export interface SexprList { kind: "list"; items: readonly SexprNode[]; line: number; column: number }
export interface SexprAtom { kind: "atom"; text: string; quoted: boolean; line: number; column: number }
```

`package.json` `exports` gains `"./kicad": "./src/kicad/index.ts"`. Do not
touch dependencies. `bun.lock` must not change.

The import plan:
- `plan.title` is `fileName` without its last extension.
- `plan.source` is `fileName`.
- `plan.format` is `"kicad_sch"` or `"kicad_net"`.
- `plan.parts` are in `compareReferences` order.
- `plan.target.parts` mirror `plan.parts` (reference, value, type).
- `plan.target.nets` are ordered as in design 5.1. Nodes are sorted by
  component order, then pin. Nets are sorted by their first node.

Diagnostic codes (exact strings):
- errors: `sexpr.empty`, `kicad.unknownRoot`, `kicad.legacyFormat`
- warnings:
  - reader: `sexpr.unterminatedString`, `sexpr.unclosedList`,
    `sexpr.unexpectedClose`, `sexpr.trailingContent`, `sexpr.tooDeep`
  - values and symbols: `kicad.invalidNumber`, `kicad.unsupportedAngle`,
    `kicad.missingLibSymbol`, `kicad.unsupportedSymbol`,
    `kicad.skippedSymbol`, `kicad.pinNamesMissing`, `kicad.unmappedPin`
  - references: `kicad.duplicateReference`, `kicad.missingReference`
  - structure: `kicad.bus`, `kicad.hierarchicalSheet`

Only the three error codes leave `plan` undefined.

## File-level changes

### sexpr.ts (design 8.6.1)

- Iterative tokenizer and parser with an explicit stack. No recursion
  anywhere in the reader.
- Tokens are `(`, `)`, double-quoted strings and bare atoms.
  - String escapes: `\" \\ \n \r \t`; any other escaped character stands
    for itself.
  - A bare atom ends at whitespace, a parenthesis or a quote.
- Positions are 1-based line and column of the token start.
- Depth limit 256: a list opened deeper is consumed but dropped, with one
  `sexpr.tooDeep` warning at its position.
- Recovery cases, each with a positioned warning:
  - unterminated string at end of input
  - unclosed lists, auto-closed at end of input (one warning)
  - a stray top-level `)` is skipped
  - content after the first top-level list is ignored (one warning)
- No list at all is the error `sexpr.empty`.
- Helpers, exported for the importers only (not from the io index):
  `child(list, head)`, `children(list, head)`, `atomAt(list, i)` and
  `numberAt(list, i, diagnostics)`. `numberAt` returns `undefined` and adds
  `kicad.invalidNumber` for a non-finite value.

### index.ts

`importKicad` works as follows:
- If the trimmed text starts with `EESchema`, return the error
  `kicad.legacyFormat`.
- Otherwise run `readSexpr` and look at the root list's first atom:
  - `kicad_sch` goes to `importSchematic`
  - `export` goes to `importNetlist`
  - anything else is the error `kicad.unknownRoot`
- Reader diagnostics come first, then importer diagnostics, each in
  discovery order.

### symbol-map.ts (design 8.6.4)

```ts
export interface KicadSymbolInput { lib: string; name: string; reference: string; value: string; pins: readonly { number: string; name?: string }[] }
export type KicadSymbolMapping =
  | { kind: "part"; type: BreadboardPartType; parameters: Record<string, unknown>; pinMap: ReadonlyMap<string, number>; diagnostics: BreadboardImportDiagnostic[] }
  | { kind: "skip"; diagnostics: BreadboardImportDiagnostic[] };
export function mapKicadSymbol(input: KicadSymbolInput): KicadSymbolMapping;
```

Implement rows 1-15 of the design table in order: first match wins,
prefix tests are case-sensitive, and the reference prefix is the leading
letters of the reference. Rules:
- The pin count is the number of distinct pin numbers.
- A row whose pin requirement fails falls through to row 14, with
  `kicad.unsupportedSymbol`.
- Name-based pin maps:
  - LED and diode: `A` -> 1 and `K` -> 2 when both names are present.
    Otherwise identity, with `kicad.pinNamesMissing`.
  - Electrolytic capacitor and battery: `+` -> 1 and `-` -> 2 when both
    are named, otherwise identity.
  - Transistor `pinout`: the names of pins 1-3 when they are a
    permutation of E, B and C. Otherwise `EBC`, with
    `kicad.pinNamesMissing`.
- `SW_Push` with 2 pins maps `1 -> 1` and `2 -> 3`.
- Row 1 (`lib === "nodetto"`) maps our own catalogue part names with an
  identity pin map:
  - `span` comes from a `Resistor_P<n>` footprint, when the caller passes
    one; add an optional `footprint?: string` input field for this
  - `pinCount` comes from the pin count
  - LED colour comes from the value when it is a colour name
- Default parameters for every type match design 3.2 defaults
  (resistor `span` 4, `bands` 4; capacitor ceramic `span` 1; electrolytic
  `span` 1; diode `span` 4).
- Pin numbers that are not positive integers, or are not in the pin map,
  are reported by the caller with `kicad.unmappedPin`.

### schematic.ts (design 8.6.2)

`importSchematic(root, fileName, diagnostics)`:
- Library symbols: read `lib_symbols` and collect the pins of each
  sub-symbol named `<name>_<unit>_<style>`:
  - unit 0 applies to all units
  - style 0 or 1, unless the instance sets an alternate body style
  - a symbol with a `(power)` child is a power symbol
- Instances: each top-level `symbol` item.
  - The library key is `lib_name`, else `lib_id`.
  - Read `(at x y angle)`, `(mirror x|y)` and `(unit n)`.
  - The reference comes from the first nested `instances` path reference,
    else from a top-level `symbol_instances` entry whose path ends with the
    symbol uuid, else from the `Reference` property.
  - The value is the `Value` property.
  - A missing library symbol gives `kicad.missingLibSymbol` and the
    instance is skipped.
  - Instances with the same reference merge into one part (multi-unit).
- Pin transform, in this exact order:
  1. negate y
  2. rotate CCW on screen by the angle, in quarter turns. A non-multiple
     of 90 is rounded to the nearest quarter turn, with
     `kicad.unsupportedAngle`.
  3. mirror: `x` negates y, `y` negates x
  4. translate
  Compare points as integers after `Math.round(mm * 10000)`.
- Connectivity: union-find over integer points.
  - Wire ends join each other.
  - Any point (wire end, pin, junction, label anchor) on a wire segment,
    interior included, joins that wire.
  - Crossing wire interiors never join.
  - Coincident pins join.
  - Labels (`label`, `global_label`, `hierarchical_label`) attach their
    text at their anchor, and equal texts join.
  - A power symbol's pin attaches its value as a priority name.
  - `PWR_FLAG`-valued power symbols and symbols whose reference starts
    with `#` are never parts. A `PWR_FLAG` symbol is ignored entirely.
  - `bus` and `bus_entry` give `kicad.bus` once per file. `sheet` gives
    `kicad.hierarchicalSheet` once per file.
- Net names, in priority order: the power value, then the alphabetically
  first label, then `N_<ref>_<pin>` of the first node. Make names unique
  with `_<n>`.
- Keep only nodes of imported parts, so every mapped pin is in exactly one
  net. Unconnected pins form one-node nets. Drop empty nets.

### netlist.ts (design 8.6.3)

`importNetlist(root, fileName, diagnostics)`:
- `components/comp`: read `ref`, `value` and `libsource lib/part`.
  - A duplicate ref is skipped with `kicad.duplicateReference`.
  - A missing ref is skipped with `kicad.missingReference`.
- `libparts/libpart`: optional pin numbers and names per (lib, part).
- `nets/net`: `name` is kept verbatim. Each node has `ref`, `pin` and an
  optional `pinfunction`.
  - Nodes whose ref is not an imported part are dropped.
  - Pin names come from `pinfunction`, else from libparts.
  - The pin count comes from libparts, else from the largest numeric node
    pin.
- Pins with no net get one-node nets named `N_<ref>_<pin>`.
- Re-sort nets and nodes as in design 5.1. File `code` values are not
  kept.

### test-fixtures/kicad (hand-written)

- `README.md`: states that the files are hand-written for nodetto tests,
  contain no KiCad library, demo or QA content, and are licensed with the
  repository.
- `led-button.kicad_sch`: the overview's "Fixed example topology".
  - Minimal `lib_symbols` with pins only: `R` (pins 1,2), `LED` (pin 1
    named K, pin 2 named A), `SW_Push` (pins 1,2), `Battery` (pins `+`
    number 1, `-` number 2), plus `+5V` and `GND` power symbols with
    `(power)` and one pin each, and a `PWR_FLAG` power symbol.
  - One local label `SW_OUT` on the switch-output wire.
  - One junction on a T.
  - R1 at angle 90. One symbol (D1) with `(mirror y)`.
  - Under 150 lines.
- `led-button.net`: the same circuit as a KiCad-style netlist.
  - comps BT1, D1, R1, SW1 with `libsource` lib `Device`/`Switch` and
    part `Battery`, `LED`, `R`, `SW_Push`
  - `libparts` with pin names
  - nets `+5V`, `GND`, `SW_OUT`, `LED_A`, and no other net
  - Every pin of the four parts is connected, so plan 18's exact parity
    check against the example stays clean. Design 11 puts a single-node
    net in this file. It moves to `unknown-symbols.net` instead, because an
    extra part here would make the example report `parity-missing-part`.
- `unknown-symbols.net`:
  - L1 (part `L`, 2 pins) -> header, with pin 2 alone in a single-node net
  - U1 (part `MyChip`, 8 pins) -> IC
  - X1 (no pins) -> skipped
  - a node with pin `A1` -> unmapped
  - a duplicate comp R1
- `malformed.kicad_sch`: a valid-looking head, one unterminated string and
  two unclosed lists.
- `legacy.sch`: the single line `EESchema Schematic File Version 4`.

## Pitfalls

- Never throw. Wrap nothing in try/catch to hide bugs. Instead, make every
  accessor tolerate missing or odd items.
- Do not recurse over the tree beyond depth 256. Tree walkers may recurse
  because the reader bounds depth.
- KiCad library Y is up and the schematic Y is down. Getting the order of
  steps wrong misplaces pins on rotated or mirrored symbols. The fixture
  covers rotation and mirroring.
- `PWR_FLAG` must not merge nets.
- `.net` pin numbers are strings. Parse with `/^[1-9]\d*$/`.
- Determinism: sort everything that reaches the plan with
  `compareReferences` or the design 5.1 order.
- Do not add any KiCad symbol name to the mapping beyond the design
  table's prefixes.

## Tests (input -> expected)

`sexpr.test.ts`:
- `(a "b c" (d 1.5))` -> the tree shape, with `quoted` true for `b c` and
  positions line 1, cols 1/4/10
- escapes `"x\"y\\z\n"` -> the text `x"y\z` plus a newline
- unterminated string -> a warning and a root
- `((a)` -> `sexpr.unclosedList`
- `) (a)` -> `sexpr.unexpectedClose`
- `(a) (b)` -> `sexpr.trailingContent`
- `""` -> the error `sexpr.empty`
- 300 nested lists -> `sexpr.tooDeep`, no throw
- 200 random byte strings (fixed seed LCG) -> never throws

`symbol-map.test.ts`, one test per design row 1-15:
- `R` 2 pins -> resistor span 4
- `R` with 3 pins -> falls to row 14 (IC is impossible with 3 pins, so
  header with 3 pins) with `kicad.unsupportedSymbol`
- `LED` with K=1, A=2 -> pinMap 1->2, 2->1
- `LED` without names -> identity plus `kicad.pinNamesMissing`
- `Q_NPN_CBE` with names C,B,E -> npn, pinout `CBE`
- `SW_Push` -> 1->1, 2->3
- `Conn_01x05` -> header pinCount 5
- `CP` -> electrolytic
- `R_Potentiometer` -> potentiometer
- `Battery` with names -> +/- mapped
- `MyChip` with 8 pins and reference `U1` -> IC (row 12)
- unknown with 3 pins and reference `X3` -> header 3 (row 14)
- 0 pins -> skip
- lib `nodetto` part `DIP` with 8 pins -> IC pinCount 8, identity

`schematic.test.ts`:
- `led-button.kicad_sch` -> parts BT1, D1, R1, SW1 with values 5V, red,
  220, PUSH and types battery, led, resistor, button
- target nets partition = {BT1.1, SW1.1}, {SW1.3, R1.1}, {R1.2, D1.1},
  {D1.2, BT1.2}; net names include `+5V`, `GND` and `SW_OUT`
- rotated R1 and mirrored D1 still connect, as asserted by the partition
- `PWR_FLAG` creates no part and does not merge GND and +5V
- inline schematic with two crossing wires and no junction -> two nets;
  with a junction at the crossing -> one net
- inline schematic with a `bus` and a `sheet` -> one `kicad.bus` and one
  `kicad.hierarchicalSheet`
- an instance whose lib symbol is missing -> `kicad.missingLibSymbol`, and
  the part is skipped
- two instances `U1` unit 1 and unit 2 -> one part with the united pins
- an instance at angle 45 -> `kicad.unsupportedAngle`, treated as 0
- a wire `(xy abc 1)` -> `kicad.invalidNumber`, and that wire is skipped
- `malformed.kicad_sch` -> warnings and a defined plan
- `legacy.sch` through `importKicad` -> `kicad.legacyFormat`, plan
  undefined

`netlist.test.ts`:
- `led-button.net` -> the same parts and net partition as the schematic
  test; net names verbatim
- `unknown-symbols.net` -> L1 header, U1 IC 8, X1 skipped with
  `kicad.skippedSymbol`, `kicad.unmappedPin` for A1, and
  `kicad.duplicateReference` for the second R1
- an inline netlist with a node ref `#PWR01` that is not a comp -> the
  node is dropped
- the single-node net of L1 pin 2 in `unknown-symbols.net` is kept
- a `comp` without `ref` -> `kicad.missingReference`
- `importKicad("(foo)")` -> `kicad.unknownRoot`, plan undefined

## Verification

```
cd /Users/taco/gits/tacogips/nodetto-app-breadboard
mkdir -p tmp/breadboard-mode-s485/breadboard-04-io-kicad
bun test packages/io/src/kicad                                                    # exit 0, >0 pass, 0 fail
bun test packages/io > tmp/breadboard-mode-s485/breadboard-04-io-kicad/io.log 2>&1   # G2
bun run typecheck > tmp/breadboard-mode-s485/breadboard-04-io-kicad/typecheck.log 2>&1   # G1
bunx biome check packages/io/src/kicad packages/io/src/index.ts packages/io/package.json   # exit 0
find packages/io/src/kicad test-fixtures/kicad -type f -print0 | xargs -0 perl -ne 'if (/[^\x00-\x7F]/) { print "$ARGV:$.\n"; $bad = 1 } close ARGV if eof; END { exit($bad ? 1 : 0) }'   # new files: exit 0, no output
git diff -U0 -- packages/io/package.json packages/io/src/index.ts | perl -ne 'if (/^\+(?!\+\+)/ && /[^\x00-\x7F]/) { print; $bad = 1 } END { exit($bad ? 1 : 0) }'   # added lines: exit 0, no output
wc -l test-fixtures/kicad/*   # every fixture under 150 lines
grep -rn "@nodetto/core" packages/io/src/kicad   # no output
git diff --quiet -- bun.lock   # exit 0
```

## Done criteria

- `grep -n '"./kicad"' packages/io/package.json` prints one line.
- Every diagnostic code string above appears in at least one test (`grep -c`).
- All verification lines pass, with exit codes and counts in the progress log.

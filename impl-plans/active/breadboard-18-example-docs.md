# breadboard-18-example-docs

- planId: breadboard-18-example-docs
- planPath: impl-plans/active/breadboard-18-example-docs.md
- wave: 6; dependsOn: breadboard-03-io-formatters, breadboard-04-io-kicad, breadboard-07-core-connectivity-erc, breadboard-08-core-notation-svg, breadboard-09-core-import-layout, breadboard-10-core-ratsnest-parity, breadboard-16-cli
- design: design-docs/specs/design-breadboard.md section 11 (example,
  golden outputs, docs, `export-golden.test.ts`, `kicad-golden.test.ts`,
  docs test), 8.3 (round trip)
- progress log: impl-plans/progress/breadboard-18-example-docs.md
- protocol: overview "Per-worker protocol", gates G1 and G2
- G1 ownRegex: `^packages/core/src/breadboard/(export-golden|kicad-golden|docs)\.test\.ts`

## Intent

Ship the original LED + resistor + button example and its golden BOM,
KiCad netlist and SPICE outputs. Add the cross-package tests:
- the example document through core and io, against the goldens
- the KiCad fixtures as targets for the example
- a round trip of our own `.net` export
- the ratsnest dropping to zero once the board is built
- the docs rule table equal to the rule ids

Add user documentation and a README section.

## Non-goals

- No product code changes. If a golden test reveals a defect in another
  plan's code, stop, record it under Open issues with the failing output,
  and do not edit that code.
- Do not edit the KiCad fixtures. Plan 04 owns them. If they do not match
  the fixed topology, record it.

## writePaths

- examples/breadboard (new directory: `led-button.jsonl`, `led-button.bom.csv`, `led-button.net`, `led-button.cir`, `README.md`)
- packages/core/src/breadboard/export-golden.test.ts (new)
- packages/core/src/breadboard/kicad-golden.test.ts (new)
- packages/core/src/breadboard/docs.test.ts (new)
- docs/breadboard (new directory: `format.md`, `erc-rules.md`, `kicad-import.md`)
- README.md
- impl-plans/progress/breadboard-18-example-docs.md

## sharedPaths

none

## File-level changes

### examples/breadboard/led-button.jsonl

One `breadboard` page "LED and button" holding a half board, BT1 `5V`, SW1
`PUSH`, R1 `220`, D1 red LED and the wires. It must realise the overview's
"Fixed example topology" exactly:
- BT1: pin 1 in a `T+` hole and pin 2 in the `T-` hole directly above it.
- SW1 across the centre channel. Pins 1 and 2 are in one column (rows e
  and f), and pins 3 and 4 are two columns to the right.
- A wire runs from a `T+` hole to SW1's pin-1 column strip.
- R1 runs from SW1's pin-3 strip to a free column.
- D1 anode (pin 1) is in R1's pin-2 strip, and D1 cathode (pin 2) is in
  the next column.
- A wire runs from D1's cathode strip to a `T-` hole.

Build it with the plan 07 `test-builder.ts` in a throwaway script under
`tmp/breadboard-mode-s485/breadboard-18-example-docs/`. Serialise it with
`serializeDocument` and commit only the JSONL. Then confirm all of the
following:
- `bun apps/cli/src/main.ts lint examples/breadboard/led-button.jsonl`
  exits 0 with empty stdout
- the nets are `GND`, `VCC`, `N_D1_1` and `N_R1_1`
- the BOM has 4 rows

### Golden outputs

Generate with the CLI, then review each by eye against design 8.2-8.4:
- `breadboard bom examples/breadboard/led-button.jsonl --output examples/breadboard/led-button.bom.csv`
- `breadboard netlist examples/breadboard/led-button.jsonl --format kicad --output examples/breadboard/led-button.net`
- `breadboard netlist ... --format spice --output examples/breadboard/led-button.cir`

`examples/breadboard/README.md` describes the circuit, the commands and
the expected results.

### export-golden.test.ts

Imitate `packages/core/src/bpmn/docs-example.test.ts`:
1. Parse the example.
2. Run `computeBreadboardConnectivity`, then `toBreadboardNetlist`, then
   each io formatter.
3. Compare with the three golden files byte for byte. Read them with
   `Bun.file(...).text()` via paths relative to the repo root (resolve
   from `import.meta.dir`).
4. Assert that `lintBreadboardPage` returns `[]`.
5. Assert that the SVG export of the example contains 400
   `breadboard-board-hole`, 4 `breadboard-resistor-band-` and 1
   `breadboard-led-flat`.

### kicad-golden.test.ts

- Run `importKicad` on `test-fixtures/kicad/led-button.kicad_sch` and on
  `led-button.net`. Add a `breadboard.netlist` element with the plan's
  `target` to a copy of the example page. `lintBreadboardPage` must then
  return no findings at all, parity or ERC.
- Run `importKicad` on `examples/breadboard/led-button.net` (our own
  export). The target parts must equal the example components (reference,
  value, type). The target net partition must equal the example
  connectivity partition, and the names must be `GND`, `VCC`, `N_D1_1`
  and `N_R1_1`.
- Run `layoutBreadboardImport` on the `led-button.net` fixture plan.
  `computeBreadboardRatsnest` must be non-empty, and the lint must
  include `pin-not-in-hole` and `parity-missing-connection`. Then give
  each part the example's `visual` for the same reference and add the
  example's wires. The ratsnest must be `[]` and there must be no
  `parity-missing-connection`.

### docs.test.ts

- Parse `docs/breadboard/erc-rules.md` rows that start with
  ``| `<rule-id>` |``. The set of ids must equal `BREADBOARD_ERC_RULE_IDS`
  (13).
- `docs/breadboard/format.md` contains every one of the 13
  `breadboard.*` type strings.
- `docs/breadboard/kicad-import.md` contains the strings `sexpr.empty`,
  `kicad.unknownRoot` and `kicad.legacyFormat`, and the heading
  "Symbol mapping".

### docs/breadboard

- `format.md`: the types, one sample record per type (copied from the
  example or the golden fixture), the lattice and the hole ids.
- `erc-rules.md`: one row per rule with id, severity and an original
  one-line description (ERC and parity), plus a note on the lint exit
  codes for imported pages (user-QA Q8 and Q9).
- `kicad-import.md`:
  - the supported subset
  - the symbol mapping table, in our own words, matching design 8.6.4
  - the staging layout
  - the diagnostic codes
  - the CLI `breadboard import` and desktop open entry points
  - a statement that KiCad files are read from scratch with no KiCad code

### README.md

- Add a "Breadboard circuit pages" section after "draw.io import and
  export" (README.md:573). It covers creating a page, parts, wires,
  rotation, nets, ERC and parity, exports, KiCad import and the ratsnest,
  and links to `docs/breadboard/` and `examples/breadboard/`.
- Add `breadboard bom|netlist|import` and the extended `lint` to the CLI
  table in "Command line (`nodetto-cli`)" (README.md:100).

## Pitfalls

- The example must not reuse any Fritzing or KiCad sample. It is an
  original circuit authored here.
- Goldens are LF-only with one trailing newline. Do not hand-edit them
  after generation. Regenerate instead.
- Keep docs ASCII. No emojis.

## Tests (input -> expected)

The tests in the three files above, each as one or more `test(...)`
cases. Total: at least 7 passing tests.

## Verification

```
cd /Users/taco/gits/tacogips/nodetto-app-breadboard
mkdir -p tmp/breadboard-mode-s485/breadboard-18-example-docs
bun test packages/core/src/breadboard/export-golden.test.ts packages/core/src/breadboard/kicad-golden.test.ts packages/core/src/breadboard/docs.test.ts   # exit 0, >= 7 pass, 0 fail
bun apps/cli/src/main.ts lint examples/breadboard/led-button.jsonl; echo "exit=$?"   # exit=0, empty stdout
bun apps/cli/src/main.ts breadboard bom examples/breadboard/led-button.jsonl --check examples/breadboard/led-button.bom.csv; echo "exit=$?"   # exit=0
bun apps/cli/src/main.ts breadboard netlist examples/breadboard/led-button.jsonl --format kicad --check examples/breadboard/led-button.net; echo "exit=$?"   # exit=0
bun apps/cli/src/main.ts breadboard netlist examples/breadboard/led-button.jsonl --format spice --check examples/breadboard/led-button.cir; echo "exit=$?"  # exit=0
bun test packages/core > tmp/breadboard-mode-s485/breadboard-18-example-docs/core.log 2>&1   # G2
bun run typecheck > tmp/breadboard-mode-s485/breadboard-18-example-docs/typecheck.log 2>&1   # G1
bunx biome check packages/core/src/breadboard/export-golden.test.ts packages/core/src/breadboard/kicad-golden.test.ts packages/core/src/breadboard/docs.test.ts   # exit 0
find examples/breadboard docs/breadboard packages/core/src/breadboard/export-golden.test.ts packages/core/src/breadboard/kicad-golden.test.ts packages/core/src/breadboard/docs.test.ts -type f -print0 | xargs -0 perl -ne 'if (/[^\x00-\x7F]/) { print "$ARGV:$.\n"; $bad = 1 } close ARGV if eof; END { exit($bad ? 1 : 0) }'   # new files: exit 0, no output
git diff -U0 -- README.md | perl -ne 'if (/^\+(?!\+\+)/ && /[^\x00-\x7F]/) { print; $bad = 1 } END { exit($bad ? 1 : 0) }'   # added README lines: exit 0 (pre-existing README non-ASCII is not checked)
```

## Done criteria

- `wc -l < examples/breadboard/led-button.bom.csv` = 5 (header plus 4 rows).
- `grep -c '(net ' examples/breadboard/led-button.net` = 4.
- All verification lines pass, with exit codes and counts in the progress log.

# breadboard-07-core-connectivity-erc

- planId: breadboard-07-core-connectivity-erc
- planPath: impl-plans/active/breadboard-07-core-connectivity-erc.md
- wave: 3; dependsOn: breadboard-02-core-foundation
- design: design-docs/specs/design-breadboard.md sections 5.1, 5.2
  (`breadboardNetHighlight`, `breadboardNetMembers`), 6 (rules 1-8,
  finding shape, sort order), 13, 14
- progress log: impl-plans/progress/breadboard-07-core-connectivity-erc.md
- protocol: overview "Per-worker protocol", gates G1 and G2
- G1 ownRegex: `^packages/core/src/breadboard/(connectivity|erc|test-builder)(\.test)?\.ts`

## Intent

Derive nets from board strips, wires, pins and part bonds with a pure,
deterministic engine. Project the result to the ir `BreadboardNetlist`.
Provide the highlight and net-member sets. Implement ERC rules 1-8 as
`lintBreadboardPage`. Every later consumer goes through these: the UI,
the CLI, the formatters, ratsnest and parity.

## Non-goals

- No parity rules or ratsnest. Those are plan 10, which adds one call into
  `lintBreadboardPage` later.
- No rendering or UI.
- No ERC config or severity overrides.

## writePaths

- packages/core/src/breadboard/connectivity.ts (new)
- packages/core/src/breadboard/connectivity.test.ts (new)
- packages/core/src/breadboard/erc.ts (new)
- packages/core/src/breadboard/erc.test.ts (new)
- packages/core/src/breadboard/test-builder.ts (new; test-only helper, not exported from the barrel)
- impl-plans/progress/breadboard-07-core-connectivity-erc.md

## sharedPaths

- packages/core/src/breadboard/index.ts

## sharedPathNotes

- packages/core/src/breadboard/index.ts: append exactly
  `export * from "./connectivity.ts";` and `export * from "./erc.ts";`.
  Never export `test-builder.ts`.

## Contracts (pinned; plans 10, 12, 13, 14, 16, 17, 18 rely on them)

```ts
export function computeBreadboardConnectivity(document: Document, pageId: PageId): BreadboardConnectivity;
export function toBreadboardNetlist(document: Document, pageId: PageId, connectivity: BreadboardConnectivity): BreadboardNetlist;
export interface BreadboardHighlight { pins: readonly BreadboardPinRef[]; holes: readonly Vec[]; wireIds: readonly ElementId[]; strips: readonly { boardId: ElementId; strip: string }[] }
export function breadboardNetHighlight(connectivity: BreadboardConnectivity, target: BreadboardPinRef | { wireId: ElementId }): BreadboardHighlight;
export function breadboardNetMembers(document: Document, pageId: PageId, connectivity: BreadboardConnectivity, target: BreadboardPinRef | { wireId: ElementId }): readonly ElementId[]; // parts with a pin on the net, then wires, element index order
export function lintBreadboardPage(document: Document, pageId: PageId): readonly BreadboardErcFinding[];
// test-builder.ts (tests only, also used by plans 10 and 18)
export function buildBreadboardDocument(spec: BreadboardTestSpec): Document; // board(s), parts with pin-1 lattice points + rotation, wires as lattice point lists, optional netlist card
```

`lintBreadboardPage` must have exactly one marked spot where plan 10
appends parity findings. Collect the rule 1-8 findings into a local array,
then sort once at the end. Put the comment `// parity findings (plan 10)`
on the line just before the sort. Plan 10 inserts one statement there.

## File-level changes

### connectivity.ts (design 5.1, steps 1-4)

- Ignore `visual.hidden` elements and netlist cards.
- Lattice index: boards in z-order (fractional index ascending). For an
  overlapping hole the topmost board wins. A point matches a lattice point
  when it is within 0.5 page units on both axes.
- Connection points are all part pins (`breadboardPins`) and both wire
  ends (`breadboardWireEnds`).
- Union-find:
  - a point on a hole joins that strip
  - points on the same lattice point join each other
  - the two ends of a wire join
  - a part's bond groups join (`breadboardBondGroups`)
- Build `BreadboardNet` lists deterministically. Net ids follow the order
  of each net's first connection point in element index order.
- `pinOnHole` and `wireEndOnHoleOrPin` answer from the occupancy maps.
- Mini boards have no rails. The channel splits `top` and `bot` strips.

### toBreadboardNetlist (design 5.1 projection)

- Components: visible parts sorted by `compareReferences`, ties broken by
  element id. Each carries `description`, `footprint`, `partName` and the
  catalogue pins (number and name).
- Nets: every net with at least one part pin. An unconnected pin forms a
  one-node net. Nodes are sorted by component order, then pin. Nets are
  sorted by their first node, with codes 1..n.
- Names:
  - the net of the first battery's pin 2 is `GND`
  - the net of its pin 1 is `VCC`, unless it is the same net as `GND`
  - every other net is `N_<reference>_<pin>` of its first node
  - collisions get `_<code>` appended
- `documentTitle` is the document title. `pageName` is the page name.

### erc.ts (design 6, rules 1-8)

Implement the design 6 table exactly. Messages are nodetto's own wording
and name the reference and the pin.
- Supply classification:
  - positive: a battery `+` pin or a `T+`/`B+` rail strip
  - negative: a battery `-` pin or a `T-`/`B-` rail strip
  - both: shorted, excluded from rules 4 and 5
- Rule 4 "reach":
  - a walk across resistor pins 1-2, all potentiometer pins, and button
    pair {1,2} to pair {3,4}
  - it never passes through another supply net
  - LEDs, diodes and capacitors are never traversed
  - polarity is reported only when the anode reaches only negative nets
    and the cathode reaches only positive nets
- Rule 5: zero-ohm links only (button pairs, other LEDs and diodes in
  either direction, the LED itself excluded). Any resistor or potentiometer
  in the series path suppresses the finding.
- Rule 6 skips pins already reported by rule 1.
- Rule 7: exact string match against an earlier part on the same page.
- Rule 8: one finding per offending end. The message says which end
  (first or last point).
- Rule 3: report on the first wire or part in element order on the
  offending net, or on the board if the net has neither. `elementIds`
  holds that element, then every other wire or part on the net.
- Finding fields:
  - `elementIds`: `[elementId]` plus the related elements (rule 2: the
    part; rule 3: as above; others: `[elementId]`)
  - severity from `BREADBOARD_ERC_SEVERITY`
- Sort by element index order, then rule id (`BREADBOARD_ERC_RULE_IDS`
  order), then pin, then message.

### test-builder.ts

A compact spec builder, imitating `packages/core/src/bpmn/lint/test-builder.ts`.
It places parts by their pin-1 lattice point and rotation, computing
`visual.x/y` from the catalogue, so tests never hand-compute boxes.

## Pitfalls

- Determinism: union-find roots depend on insertion order. Always derive
  output order from element index order, never from root ids or `Map`
  iteration.
- A wire end on an off-board part pin is a valid connection (design 13).
  Rule 8 reports only ends that touch neither a hole nor a pin.
- Do not merge the two halves of a column across the channel.
- Hidden elements are ignored everywhere, including rule 7.
- Rule 2 uses "same net", which also covers "same strip".
- Keep the functions pure. No Editor or Store mutation.

## Tests (input -> expected)

`connectivity.test.ts`:
- two resistor leads in column 1 rows a and c -> same net (`col:1:top`)
- a1 and f1 -> different nets (channel split)
- a part pin on `T+3` and a wire from `T+20` to a10 -> one net with the
  rail strip and the column strip
- mini board -> no rail strips exist and a pin there joins nothing
- a part rotated 90 -> pins land on the expected holes
- a wire end on a battery pin placed off-board -> joined
- button pins 1 and 2 -> joined by the bond even across the channel
- a hidden wire -> ignored
- two overlapping boards -> the topmost owns the hole
- `toBreadboardNetlist`:
  - components R10, R2, `R?`, C1 -> order C1, R2, R10, `R?`
  - battery nets named GND/VCC
  - other nets `N_<ref>_<pin>`
  - a name collision gets `_<code>`
  - an unconnected pin is a one-node net
- `breadboardNetMembers` for a resistor pin -> the parts on that net plus
  its wires, in element order
- `breadboardNetHighlight` for a wire -> includes the wire id, the holes
  and the strips

`erc.test.ts`, one positive and one negative test per rule 1-8, built
with `test-builder.ts`:
- `pin-not-in-hole`: a resistor half off the board -> finding with pin 2;
  fully inserted -> none
- `shorted-part`: both resistor leads in one strip -> finding; different
  strips -> none
- `rail-short`: a wire from T+ to T- -> finding on the wire with
  `elementIds` holding the wire; no such wire -> none
- `reversed-polarity`:
  - LED anode on GND and cathode on VCC through a resistor -> finding
  - forward LED -> none
  - an LED whose anode is on a floating strip -> none (not determinable)
- `led-no-series-resistor`: an LED directly between T+ and T- -> warning;
  with a series resistor -> none
- `unconnected-pin`: a resistor alone on the board -> warnings on both
  pins; a resistor with each lead shared with another part -> none
- `duplicate-reference`: two R1 -> one finding on the second; R1 and R2
  -> none
- `wire-end-off-hole`: a wire end in empty page space -> finding; on a
  hole -> none
- ordering: two findings on one element sort by rule id order; running
  the lint twice gives identical output

## Verification

```
cd /Users/taco/gits/tacogips/nodetto-app-breadboard
mkdir -p tmp/breadboard-mode-s485/breadboard-07-core-connectivity-erc
bun test packages/core/src/breadboard/connectivity.test.ts packages/core/src/breadboard/erc.test.ts   # exit 0, >= 16 ERC tests, 0 fail
bun test packages/core > tmp/breadboard-mode-s485/breadboard-07-core-connectivity-erc/core.log 2>&1   # G2
bun run typecheck > tmp/breadboard-mode-s485/breadboard-07-core-connectivity-erc/typecheck.log 2>&1   # G1
bunx biome check packages/core/src/breadboard/connectivity.ts packages/core/src/breadboard/connectivity.test.ts packages/core/src/breadboard/erc.ts packages/core/src/breadboard/erc.test.ts packages/core/src/breadboard/test-builder.ts   # exit 0
```

## Done criteria

- `for r in pin-not-in-hole shorted-part rail-short reversed-polarity led-no-series-resistor unconnected-pin duplicate-reference wire-end-off-hole; do grep -q "\"$r\"" packages/core/src/breadboard/erc.test.ts || echo missing $r; done` prints nothing.
- `grep -c 'parity findings (plan 10)' packages/core/src/breadboard/erc.ts` = 1.
- All verification lines pass, with exit codes and counts in the progress log.

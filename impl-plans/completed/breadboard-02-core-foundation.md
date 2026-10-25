# breadboard-02-core-foundation

- planId: breadboard-02-core-foundation
- planPath: impl-plans/completed/breadboard-02-core-foundation.md
- wave: 2; dependsOn: breadboard-01-ir-contract
- design: design-docs/specs/design-breadboard.md sections 3.3, 3.4, 4.1,
  3.2 (target netlist "first in element order"), 6 (finding shape, rule
  ids), 5.3 (RatsnestLine shape)
- progress log: impl-plans/progress/breadboard-02-core-foundation.md
- protocol: overview "Per-worker protocol", gates G1 and G2
- G1 ownRegex: `^packages/core/src/breadboard/(catalogue|board|types|index)(\.test)?\.ts`

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

This plan provides the pure core data that every other core plan builds on:
- the part catalogue (pin tables, boxes, bonds, names)
- the board layout (holes, strips, labels)
- the shared core types for connectivity, findings, ratsnest and probes
- the target-netlist lookup

It also creates the `packages/core/src/breadboard/` barrel. The wave-3
plans can then work side by side against fixed signatures.

## Non-goals

- No Editor changes, snapping, rendering, connectivity algorithm or ERC.
- No user-defined parts.

## writePaths

- packages/core/src/breadboard/catalogue.ts (new)
- packages/core/src/breadboard/catalogue.test.ts (new)
- packages/core/src/breadboard/board.ts (new)
- packages/core/src/breadboard/board.test.ts (new)
- packages/core/src/breadboard/types.ts (new)
- packages/core/src/breadboard/index.ts (new)
- impl-plans/progress/breadboard-02-core-foundation.md

## sharedPaths

- packages/core/src/index.ts

## sharedPathNotes

- packages/core/src/index.ts: append exactly one line,
  `export * from "./breadboard/index.ts";`, next to the existing
  `export * from "./bpmn/index.ts";` (core index.ts:362). Follow the
  fresh-read and pre/post hash rule.

## Contracts (pinned)

`catalogue.ts`:

```ts
export interface BreadboardPinDef { number: number; name: string; dx: number; dy: number } // pitches, rotation 0
export interface BreadboardPagePin { number: number; name: string; x: number; y: number }   // page units
export function breadboardPinDefs(type: BreadboardPartType, semantic: BreadboardPartSemantic): readonly BreadboardPinDef[];
export function breadboardLocalBox(type, semantic): {x; y; width; height};  // pitches, relative to pin 1, rotation 0
export function breadboardBox(element: Element): Box | undefined;           // page box of the unrotated element (parts, boards, netlist card)
export function breadboardPins(element: Element): readonly BreadboardPagePin[]; // page positions through visual.rotation about the box centre
export function breadboardWireEnds(element: Element): readonly [Vec, Vec] | undefined;
export function breadboardWirePoints(element: Element): readonly Vec[];       // page positions = visual + points[i]
export function breadboardBondGroups(type: BreadboardPartType): readonly (readonly number[])[]; // button: [[1,2],[3,4]], others []
export function breadboardPartName(type, semantic): string;   // Resistor, LED, Capacitor, CapacitorPolarized, Diode, TransistorNPN, TransistorPNP, PushButton, Potentiometer, DIP, Header, Battery
export function breadboardDescription(type, semantic): string; // "Resistor 5%", "LED red", "Capacitor electrolytic", "Transistor NPN EBC", "DIP-8 IC", "Pin header 1x4"
export function breadboardFootprint(type, semantic): string;  // "nodetto:Resistor_P4", "nodetto:DIP-8", ... design 3.4
export function breadboardDefaultSemantic(type: BreadboardElementType): unknown; // design 3.2 defaults column
export const NETLIST_CARD_SIZE = { width: 16, height: 4 } as const; // pitches
```

`board.ts`:

```ts
export interface BreadboardHole { id: string; x: number; y: number; strip: string } // board pitches from box top-left
export interface BreadboardBoardLayout { columns; railHoles; width; height; holes: readonly BreadboardHole[]; labels: readonly {text; x; y}[]; channelY?: {from; to} }
export function boardLayout(size: "full" | "half" | "mini"): BreadboardBoardLayout; // memoised per size
export function boardHoles(element: Element): readonly (BreadboardHole & {pageX: number; pageY: number})[];
```

Hole ids are `a1` and `j30` for terminal holes and `T+1` and `B-25` for
rail holes. Strip ids are `col:<c>:top`, `col:<c>:bot`, `rail:T+`,
`rail:T-`, `rail:B+` and `rail:B-`.

`types.ts` (types plus two constants and one function):

```ts
export interface BreadboardPinRef { elementId: ElementId; pin: number }
export interface BreadboardNet { id: number; pins: readonly BreadboardPinRef[]; strips: readonly {boardId: ElementId; strip: string}[]; wireIds: readonly ElementId[] }
export interface BreadboardConnectivity {
  nets: readonly BreadboardNet[];
  netOfPin(ref: BreadboardPinRef): number | undefined;
  netOfWire(id: ElementId): number | undefined;
  pinOnHole(ref: BreadboardPinRef): boolean;
  wireEndOnHoleOrPin(id: ElementId, end: 0 | 1): boolean;
}
export type BreadboardErcRuleId =
  | "pin-not-in-hole" | "shorted-part" | "rail-short" | "reversed-polarity"
  | "led-no-series-resistor" | "unconnected-pin" | "duplicate-reference" | "wire-end-off-hole"
  | "parity-missing-connection" | "parity-extra-connection" | "parity-missing-part"
  | "parity-extra-part" | "parity-value-mismatch";
export const BREADBOARD_ERC_RULE_IDS: readonly BreadboardErcRuleId[]; // the 13 ids above, in this order
export const BREADBOARD_ERC_SEVERITY: Readonly<Record<BreadboardErcRuleId, "error" | "warning">>; // design 6 and 6.1 tables
export interface BreadboardErcFinding { ruleId; severity: "error" | "warning"; elementId: ElementId; pin?: number; elementIds: readonly ElementId[]; message: string }
export interface RatsnestEnd { elementId: ElementId; pin: number; x: number; y: number }
export interface RatsnestLine { targetNet: string; from: RatsnestEnd; to: RatsnestEnd }
export interface BreadboardProbe { pageId: PageId; elementIds: readonly ElementId[]; pin?: BreadboardPinRef }
export function breadboardTargetNetlist(document: Document, pageId: PageId): { element: Element; semantic: BreadboardNetlistSemantic } | undefined; // first visible breadboard.netlist in element index order
```

`index.ts`: exactly these lines, in this order, so later plans append
below them:

```ts
export * from "./types.ts";
export * from "./catalogue.ts";
export * from "./board.ts";
```

## File-level changes

### catalogue.ts

Implement the design 3.4 pin table exactly. Pin offsets are in pitches
from pin 1; y grows down. Then:
- The local box is the pin bounding box grown by 0.5 pitch on every side,
  unioned with the body extent column.
- `breadboardBox` reads only the catalogue. A stale stored
  `visual.width/height` is ignored (design 3.3):
  - parts: `visual.x/y` is the box top-left; pin 1 is at
    `visual + (-localBox.x, -localBox.y) * PITCH`
  - board: the `boardLayout` size
  - netlist card: `NETLIST_CARD_SIZE`
- `breadboardPins` applies `visual.rotation` clockwise about the box
  centre, the same transform as the renderers
  (`packages/core/src/svg-export.ts` rotate about the box centre; see
  `packages/core/src/rotation.ts`). Imitate the existing rotation helpers
  rather than inventing a new convention.
- Transistor pin names come from `pinout` letters in order. Electrolytic
  capacitor pins are named `+`/`-`. Ceramic capacitor pins are named `1`
  and `2`.

### board.ts

Implement the design 4.1 table and formulas exactly:
- columns at `x = c + 1`
- rows and rails at the stated y values
- rail hole `k` at `x = s + (k-1) + floor((k-1)/5)` with
  `s = 2 + floor((N - (R + R/5 - 1)) / 2)`
- the mini board has no rails
- labels: row letters at both ends of every row, column numbers at 1 and
  at every multiple of 5, and `+`/`-` at both rail ends

`boardHoles` maps to page space as `visual + hole * PITCH` and honours
`visual.rotation` if present (design 3.3 says imported rotation is still
honoured).

### breadboardTargetNetlist

Filter the page's elements by `type === "breadboard.netlist"` and not
`visual.hidden`, sort by fractional `index` and return the first. Use
the store or document access patterns from
`packages/core/src/bpmn/model.ts:buildBpmnModel`.

## Pitfalls

- Hole counts are pinned by tests: full 830, half 400, mini 170. Check them
  as `10 * N + 4 * R`. Full: 10*63 + 4*50 = 830. Half: 10*30 + 4*25 = 400.
  Mini: 10*17 = 170.
- The row e to row f distance is 3 pitches. The button's pins 1/2 and the
  IC rows must straddle the channel (IC pin n/2+j at dy = -3).
- The battery's pin 2 is at (0,-1), with the body extent at x -3..0.
- Do not compute pins from stored `visual.width/height`.
- Rotation 90/180/270 must map integer pin offsets to integer lattice
  offsets. Round results to 1e-6 to kill floating noise, but do not snap
  them.

## Tests (input -> expected)

`catalogue.test.ts`:
- resistor span 4 at visual (0,0), rotation 0 -> pin 1 at (5,5) (box
  top-left plus 0.5 pitch), pin 2 - pin 1 = (40, 0), and the box is
  50 x 10.
- LED -> pins named `A` (1) and `K` (2), with dx 1.
- button -> 4 pins, pins 1 and 2 dy 3 apart; bond groups `[[1,2],[3,4]]`.
- ic pinCount 8 -> pin 5 at (3,-3) and pin 8 at (0,-3).
- transistor pinout `CBE` -> pin names `C`, `B`, `E`.
- every part at rotation 90, 180 and 270 -> all pin-to-pin-1 offsets are
  integer multiples of 10, and pin 1 rotates about the box centre.
- `breadboardPartName`, `breadboardDescription` and `breadboardFootprint`
  for each type match the design 3.4 strings.
- `breadboardDefaultSemantic` for each type passes the ir
  `validateSemantic` with no issues.

`board.test.ts`:
- holes per size -> 830, 400, 170
- `a1` and `e1` are in `col:1:top`, `f1` is in `col:1:bot`, `a1` and `f1`
  are in different strips
- half board `T+1..T+5` are consecutive and `T+6` is 2 pitches after
  `T+5` (rail gap)
- the mini board has no `rail:*` strip
- `boardHoles` of a board at visual (100, 50) -> `a1` page position =
  (100, 50) + local * 10
- `breadboardTargetNetlist` with two netlist cards -> returns the lower
  index; with only a hidden card -> undefined
- `BREADBOARD_ERC_RULE_IDS.length === 13`, and the severity table matches
  design 6 and 6.1

## Verification

```
cd /Users/taco/gits/tacogips/nodetto-app-breadboard
mkdir -p tmp/breadboard-mode-s485/breadboard-02-core-foundation
bun test packages/core/src/breadboard/catalogue.test.ts packages/core/src/breadboard/board.test.ts   # exit 0, >0 pass, 0 fail
bun test packages/core > tmp/breadboard-mode-s485/breadboard-02-core-foundation/core.log 2>&1        # G2
bun run typecheck > tmp/breadboard-mode-s485/breadboard-02-core-foundation/typecheck.log 2>&1        # G1
bunx biome check packages/core/src/breadboard packages/core/src/index.ts   # exit 0
find packages/core/src/breadboard/catalogue.ts packages/core/src/breadboard/catalogue.test.ts packages/core/src/breadboard/board.ts packages/core/src/breadboard/board.test.ts packages/core/src/breadboard/types.ts packages/core/src/breadboard/index.ts -type f -print0 | xargs -0 perl -ne 'if (/[^\x00-\x7F]/) { print "$ARGV:$.\n"; $bad = 1 } close ARGV if eof; END { exit($bad ? 1 : 0) }'   # new files: exit 0, no output
git diff -U0 -- packages/core/src/index.ts | perl -ne 'if (/^\+(?!\+\+)/ && /[^\x00-\x7F]/) { print; $bad = 1 } END { exit($bad ? 1 : 0) }'   # added lines: exit 0, no output
```

## Done criteria

- `grep -c 'export \* from "./breadboard/index.ts";' packages/core/src/index.ts` = 1.
- `packages/core/src/breadboard/index.ts` contains exactly the three pinned lines.
- All verification lines pass, with exit codes and counts in the progress log.

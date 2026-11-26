# schematic-08-core-symbols

- planId: schematic-08-core-symbols; wave 2; dependsOn: schematic-01-ir-semantics
- design: sections 4.1 (symbol table, IC layout, transform order), 5.1
  (union-find module)
- progress log: impl-plans/progress/schematic-08-core-symbols.md

## Intent

The geometric source of truth: pin tables, boxes and page pin positions for
every schematic symbol, plus a small shared union-find used by connectivity.

## Non-goals

No notation, no snapping, no editor intents, no connectivity.

## writePaths

- packages/core/src/union-find.ts (new)
- packages/core/src/union-find.test.ts (new)
- packages/core/src/schematic/symbols.ts (new)
- packages/core/src/schematic/symbols.test.ts (new)
- impl-plans/progress/schematic-08-core-symbols.md
- target
- tmp/cad3d

artifactRoots: target, tmp/cad3d. sharedPaths: none.

## Contracts (pinned)

```ts
// union-find.ts
export class UnionFind { constructor(size: number); find(i: number): number; union(a: number, b: number): void }
// symbols.ts
export type PinDirection = "left" | "right" | "up" | "down";
export interface SchematicPinDef { readonly number: number; readonly name: string; readonly offset: Vec; readonly direction: PinDirection } // offset in page units from the box top-left, unrotated, unmirrored
export interface SchematicPagePin { readonly number: number; readonly name: string; readonly x: number; readonly y: number; readonly direction: PinDirection }
export function schematicPinDefs(element: Element): readonly SchematicPinDef[];
export function schematicLocalBox(element: Element): Box; // width/height in page units
export function schematicBox(element: Element): Box | undefined; // page box, axis aligned after rotation
export function schematicPins(element: Element): readonly SchematicPagePin[];
export function schematicAnchorPin(element: Element): SchematicPagePin | undefined; // pin 1, or first ic pins entry
export function schematicDefaultSemantic(type: SchematicPartType | "schematic.power", patch?: object): object;
export function schematicPartName(element: Element): string; // design 7.2 table
export function schematicDescription(element: Element): string;
```
`Vec`, `Box` from `packages/core/src/geometry.ts`.

## Rules (design 4.1)

- Pin offset tables in pitches relative to the anchor pin, then converted to
  box-local page units (box = pin bbox union body extent, grown by 0.5 pitch).
- Transform: box-local; if `visual.flipX` then `x -> width - x`; rotate
  clockwise about box centre by `visual.rotation` (0/90/180/270); translate by
  `visual.x/y`. Same transform as `packages/core/src/breadboard/catalogue.ts:breadboardPins`
  plus the flip step. Direction rotates and flips with the pin.
- IC layout formula exactly as design 4.1 (rows, cols, W >= 6, pins per side in
  array order, counter-clockwise numbering), stubs 2 pitches.
- `schematicPartName`: Resistor, Capacitor/CapacitorPolarized, Inductor,
  Diode, LED, TransistorNPN/PNP, MOSFET_N/P, SW_Push (both switch styles),
  Potentiometer, Battery, VoltageSource, Header, and for ic `DIP` when pins
  are exactly 1..n with n even 4..40, `Header` when exactly 1..n otherwise
  with n <= 40, else `IC_Generic`.

## Pitfalls

- Offsets and box centres must stay multiples of 5 page units so page pin
  keys are exact integers in hundredths (design 3.3).
- Unknown/hidden elements: return `[]`/`undefined`, never throw.
- UnionFind: path halving + union by size; arrays, no recursion.

## Tests

- union-find: unions merge, find idempotent, 100k chain stays fast (no
  recursion depth issue).
- symbols: pin tables per type match design 4.1; IC with L=3,R=2,T=1,B=0 has
  the formula positions; box multiples of 5; pins at 0/90/180/270 with and
  without flipX stay on the 10-unit lattice when `visual.x/y` are lattice
  values; anchor pin of ic is the first `pins` entry; partName for dense
  8-pin ic is `DIP`, sparse 1,3,7,9 is `IC_Generic`, 5 pins is `Header`.

## Verification

- `bun test packages/core/src/union-find.test.ts packages/core/src/schematic/symbols.test.ts` exits 0.
- `bunx biome check <owned .ts files>` exits 0.

# breadboard-08-core-notation-svg

- planId: breadboard-08-core-notation-svg
- planPath: impl-plans/completed/breadboard-08-core-notation-svg.md
- wave: 4; dependsOn: breadboard-02-core-foundation, breadboard-06-core-editing
  (SVG export takes every element box from
  `registry.getOrFallback(type).getBounds`, svg-export.ts:1828. The
  breadboard shape utils, including wire bounds derived from points, are
  registered by plan 06. Without them the generic fallback,
  shape-util.ts:98-103, reads the `visual.width/height` that wires do not
  have.)
- design: design-docs/specs/design-breadboard.md sections 7.1 (notation,
  artwork rules, netlist card), 7.3 (resistor bands), 1 (licensing)
- progress log: impl-plans/progress/breadboard-08-core-notation-svg.md
- protocol: overview "Per-worker protocol", gates G1 and G2
- G1 ownRegex: `^packages/core/src/breadboard/(notation|resistor-bands|svg-export-breadboard)(\.test)?\.ts|^packages/core/src/svg-export\.ts`

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

Write one shared notation module that turns every breadboard element into
`NotationPrimitive`s with stable roles. The SVG export (here) and the
canvas (plan 11) both draw them, so the two cannot diverge. All artwork is
original: flat shapes in our own colours.

## Non-goals

- No canvas code. That is plan 11.
- No net highlight or ratsnest in the SVG. Those are transient UI
  overlays and never exported.
- No PNG/PDF-specific change. They reuse the SVG renderer.

## writePaths

- packages/core/src/breadboard/notation.ts (new)
- packages/core/src/breadboard/notation.test.ts (new)
- packages/core/src/breadboard/resistor-bands.ts (new)
- packages/core/src/breadboard/resistor-bands.test.ts (new)
- packages/core/src/breadboard/svg-export-breadboard.test.ts (new)
- packages/core/src/svg-export.ts
- impl-plans/progress/breadboard-08-core-notation-svg.md

## sharedPaths

- packages/core/src/breadboard/index.ts

## sharedPathNotes

- packages/core/src/breadboard/index.ts: append exactly
  `export * from "./notation.ts";` and `export * from "./resistor-bands.ts";`.
  The wave-4 appenders to this barrel are plans 08 and 10. Follow the
  append-only, fresh-read and pre/post-hash protocol, and never touch
  plan 10's lines.

## Contracts (pinned; plan 11 relies on them)

```ts
// notation.ts; NotationPrimitive is imported from "../bpmn/notation.ts" (rect, circle, path, polygon, text)
export type BreadboardPrimitive = NotationPrimitive & { readonly role: string };
export interface BreadboardNotation { body: readonly BreadboardPrimitive[]; labels: readonly BreadboardPrimitive[] }
export function breadboardNotation(element: Element, box: Box, options?: { inert?: boolean }): BreadboardNotation;
export const BREADBOARD_COLORS: Readonly<Record<string, string>>; // our own palette constants
// resistor-bands.ts
export type BandColor = "black"|"brown"|"red"|"orange"|"yellow"|"green"|"blue"|"violet"|"grey"|"white"|"gold"|"silver";
export function resistorBands(value: string, bands: 4 | 5, tolerance?: number): readonly BandColor[] | null;
```

If `NotationPrimitive` has no room for a role field, attach the role in
the `BreadboardPrimitive` wrapper type as shown. Do not change
`packages/core/src/bpmn/notation.ts`.

Coordinate rules:
- `body` is in unrotated box-local coordinates. Both renderers draw it
  inside the element's existing rotation transform.
- `labels` are text primitives whose anchor is pre-rotated into box-local
  coordinates of the rotated frame. Both renderers draw them outside the
  rotation transform, so text stays upright at every rotation.

## File-level changes

### resistor-bands.ts (design 7.3)

- Parse the value with `parseComponentValue` from ir.
- 4-band uses 2 significant digits plus a multiplier. 5-band uses 3.
- The multiplier range is silver (10^-2) to white (10^9).
- A value not exactly representable returns `null`. Compare with a
  relative epsilon of 1e-9 after scaling, never with float equality.
- Tolerance band: grey 0.05, violet 0.1, blue 0.25, green 0.5, brown 1,
  red 2, gold 5, silver 10. 20% means no band.
- When `tolerance` is absent, use 5% for 4-band and 1% for 5-band.
- 0 ohm returns `["black"]`.
- The result is in reading order, from the pin-1 end.

### notation.ts (design 7.1 artwork rules)

One builder per type, with the roles listed in design 7.1:
- board: `board`, `board-hole` (one per hole, so a half board has 400),
  `board-channel`, `rail-plus`, `rail-minus`, `board-label`
- resistor: leads, body, bands `resistor-band-<i>` (none when
  `resistorBands` returns null), a light-blue body for 5-band
- LED: dome in the LED colour, `led-flat` chord on the cathode side
- capacitor: ceramic disc, or electrolytic with `cap-minus-stripe`
- diode: `diode-band`
- transistor: TO-92 D-shape with the flat face toward -y
- button, potentiometer
- IC: `ic-notch`, `ic-pin1`, legs
- header, battery with `+`/`-` marks
- wire: an outline stroke under a colour stroke 0.45 pitch wide with round
  caps and joins, and a `wire-end` square at each end
- netlist card: `netlist-card` and `netlist-label` texts ("Target
  netlist", the source, "<n> parts, <m> nets"); `inert: true` sets the
  opacity to 0.5
- labels: the reference above each part; an IC also shows reference and
  value on the body

### svg-export.ts

- In `renderShape` (svg-export.ts:1243), add an `isBreadboardElementType`
  branch before the type switch, next to the BPMN branch at line 1249.
  Write one SVG node per primitive with `class="breadboard-<role>"`,
  reusing `renderNotationPrimitive` (or a thin wrapper that adds the
  class).
- Draw `labels` outside the rotation wrapper. Follow how BPMN labels are
  emitted outside `elementGroup` (look for `bpmnLabelBox` near
  svg-export.ts:1942, and `impl-plans/completed/bpmn-r2-task-icons-labels.md`
  "single label origin"). Also add the labels' boxes to the export bounds
  the same way.
- Compute the inert flag per netlist card with `breadboardTargetNetlist`
  (from plan 02): a card is inert when it is not the active card.

## Pitfalls

- Do not invent new rotation math. The existing `elementGroup` rotation
  wrapper applies to the body.
- Wires have no stored width/height. Their box comes from the plan 06
  shape util bounds, and the body must be expressed relative to that box.
  Do not add bounds logic to svg-export.ts, and do not write
  `visual.width/height` on test wires to work around a missing util. If
  the util is missing, stop and record an Open issue.
- Never emit net highlight, ratsnest or hover state into the SVG.
- Keep every non-breadboard SVG output byte-identical. Existing
  `svg-export.test.ts` and BPMN SVG tests must pass unchanged.
- Colours are our own constants. Do not copy any palette from Fritzing
  or KiCad.

## Tests (input -> expected)

`resistor-bands.test.ts`:
- 4-band: `220` -> red, red, brown, gold
- 4-band: `4.7k` -> yellow, violet, red, gold
- 4-band: `1M` -> brown, black, green, gold
- 4-band: `0.47` -> yellow, violet, silver, gold
- 5-band `10k` with tolerance 1 -> brown, black, black, red, brown
- tolerance 20 -> no tolerance band
- `4k7` -> same as `4.7k`
- `0` -> `["black"]`
- `4.75k` 4-band -> null; `abc` -> null; `1e12` -> null

`notation.test.ts`:
- each of the 13 types -> a non-empty body, with the expected role set
- half board -> 400 `board-hole`; full -> 830; mini -> 170
- LED -> exactly 1 `led-flat`
- electrolytic -> 1 `cap-minus-stripe`
- IC -> 1 `ic-notch` and 1 `ic-pin1`
- resistor with an unrepresentable value -> 0 band primitives
- a part at rotation 90 -> labels are not rotated (their text primitive
  has no rotate transform) and are anchored above the rotated box
- `inert: true` -> card primitives with opacity 0.5

`svg-export-breadboard.test.ts` (build documents with the core-internal
`test-builder.ts` from plan 07, joined in wave 3, or with literal
elements, rendered through the default registry):
- a wire with no `visual.width/height` and points (0,0), (30,0), (30,20)
  at visual (100,100) -> the export bounds (viewBox or root box) enclose
  every wire point. This uses the plan 06 util bounds.
- a half board with a 220 resistor, an LED and a wire -> the SVG has 400
  `class="breadboard-board-hole"`, 4 `breadboard-resistor-band-`, 1
  `breadboard-led-flat` and 2 `breadboard-wire-end`
- a rotated LED -> its `breadboard-label` node is outside the element's
  rotated `<g transform="rotate(...)">`
- two netlist cards -> the second has opacity 0.5

## Verification

```
cd /Users/taco/gits/tacogips/nodetto-app-breadboard
mkdir -p tmp/breadboard-mode-s485/breadboard-08-core-notation-svg
bun test packages/core/src/breadboard/notation.test.ts packages/core/src/breadboard/resistor-bands.test.ts packages/core/src/breadboard/svg-export-breadboard.test.ts   # exit 0, >0 pass, 0 fail
bun test packages/core > tmp/breadboard-mode-s485/breadboard-08-core-notation-svg/core.log 2>&1   # G2 (svg-export.test.ts and bpmn svg tests unchanged and green)
bun run typecheck > tmp/breadboard-mode-s485/breadboard-08-core-notation-svg/typecheck.log 2>&1   # G1
bunx biome check packages/core/src/breadboard/notation.ts packages/core/src/breadboard/notation.test.ts packages/core/src/breadboard/resistor-bands.ts packages/core/src/breadboard/resistor-bands.test.ts packages/core/src/breadboard/svg-export-breadboard.test.ts packages/core/src/svg-export.ts   # exit 0
git diff --quiet -- packages/core/src/bpmn/notation.ts   # exit 0
find packages/core/src/breadboard/notation.ts packages/core/src/breadboard/notation.test.ts packages/core/src/breadboard/resistor-bands.ts packages/core/src/breadboard/resistor-bands.test.ts packages/core/src/breadboard/svg-export-breadboard.test.ts -type f -print0 | xargs -0 perl -ne 'if (/[^\x00-\x7F]/) { print "$ARGV:$.\n"; $bad = 1 } close ARGV if eof; END { exit($bad ? 1 : 0) }'   # exit 0, no output
git diff -U0 -- packages/core/src/svg-export.ts | perl -ne 'if (/^\+(?!\+\+)/ && /[^\x00-\x7F]/) { print; $bad = 1 } END { exit($bad ? 1 : 0) }'   # exit 0, no output
```

## Done criteria

- `grep -c 'isBreadboardElementType' packages/core/src/svg-export.ts` >= 1.
- All verification lines pass, with exit codes and counts in the progress log.

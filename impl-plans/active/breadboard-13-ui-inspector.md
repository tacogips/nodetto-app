# breadboard-13-ui-inspector

- planId: breadboard-13-ui-inspector
- planPath: impl-plans/active/breadboard-13-ui-inspector.md
- wave: 6; dependsOn: breadboard-06-core-editing, breadboard-07-core-connectivity-erc, breadboard-10-core-ratsnest-parity, breadboard-14-ui-problems
- design: design-docs/specs/design-breadboard.md sections 7.2 (inspector),
  7.5 (cross-probe table rows for inspector pin rows and the netlist card)
- progress log: impl-plans/progress/breadboard-13-ui-inspector.md
- protocol: overview "Per-worker protocol", gates G1 and G2
- G1 ownRegex: `^packages/ui-solid/src/inspector/(BreadboardSection\.tsx|breadboard-edits(\.test)?\.ts)|^packages/ui-solid/src/Inspector\.tsx`

## Intent

Add an inspector section for `breadboard.*` elements:
- edit reference, value, type parameters, wire colour and board size,
  with E24 suggestions for resistor values
- "Rotate left" and "Rotate right" buttons
- a pin list with net names that cross-probes ("Select net")
- for a netlist card, a read-only target view whose part and net rows
  cross-probe to the canvas

## Non-goals

- No editing of the target netlist (design 2 non-goal).
- No new Editor intents. Use the plan 06 intents only.

## writePaths

- packages/ui-solid/src/inspector/BreadboardSection.tsx (new)
- packages/ui-solid/src/inspector/breadboard-edits.ts (new: pure helpers)
- packages/ui-solid/src/inspector/breadboard-edits.test.ts (new)
- packages/ui-solid/src/Inspector.tsx
- impl-plans/progress/breadboard-13-ui-inspector.md

## sharedPaths

none

## Contracts

- `InspectorProps` gains `readonly viewport?: () => ViewportSize`
  (Inspector.tsx:97). `LazyInspector.tsx` forwards props with
  `{...props}` and needs no change. Plan 17 passes the desktop viewport.
- `breadboard-edits.ts`:
  ```ts
  export const E24_VALUES: readonly string[];  // 1.0 .. 9.1 mantissas, IEC 60063 public series
  export function resistorValueSuggestions(prefix: string): readonly string[]; // e.g. "4" -> ["4.3", "4.7", "43", "47", "430", "470", "4.3k", "4.7k", ...] max 12
  export function breadboardPinRows(document: Document, pageId: PageId, elementId: ElementId): readonly { pin: number; name: string; net: string }[]; // net names from toBreadboardNetlist
  export function breadboardNetProbe(document: Document, pageId: PageId, ref: BreadboardPinRef): BreadboardProbe;     // elementIds = breadboardNetMembers
  export function targetNetProbe(document: Document, pageId: PageId, netName: string): BreadboardProbe | null;      // resolved parts of the target net + first resolved pin
  export function targetPartProbe(document: Document, pageId: PageId, reference: string): BreadboardProbe | null;  // null for a missing part
  ```

## File-level changes

- `Inspector.tsx`:
  - add `<Match when={element().type.startsWith("breadboard.")}>` with
    `<BreadboardSection editor element viewport>` next to the BPMN match
    (Inspector.tsx:288)
  - add a section label: `"Breadboard"` for boards and wires, `"Part"`
    for parts, `"Target netlist"` for the card, next to the BPMN label
    (Inspector.tsx:173)
- `BreadboardSection.tsx`: imitate `inspector/BpmnSection.tsx`.
  - Field writes go through `editor.updateBreadboardSemantic`.
  - Rotate buttons call `editor.rotateBreadboardParts([id], -1 | 1)`.
  - Pin list:
    - clicking a row calls `editor.setBreadboardProbe({pageId, elementIds: [], pin})`
      with the selection left unchanged, per design 7.5 "inspector pin
      row"
    - "Select net" calls
      `focusBreadboardProbe(editor, breadboardNetProbe(...), viewport?.())`
  - Netlist card:
    - show the source and format
    - list parts with their `breadboardTargetStatus` (placed, missing,
      value mismatch) and nets with their nodes
    - an inert card shows "Inactive: another target netlist comes first on
      this page."
    - part and net rows call `focusBreadboardProbe` with
      `targetPartProbe` / `targetNetProbe`; a missing part row is a no-op

## Pitfalls

- A pin-row click must not change the selection. It only sets the probe.
  The inspector would otherwise switch to another element.
- The E24 series is a public engineering standard and is fine to include.
  Do not copy any vendor table.
- Do not edit `BpmnSection.tsx` or other sections.

## Tests (input -> expected), in `breadboard-edits.test.ts`

- `E24_VALUES.length` -> 24
- `resistorValueSuggestions("4")` -> includes `4.7` and `4.7k`, with at
  most 12 entries
- `breadboardPinRows` for an LED in a built document -> 2 rows (`A`, `K`)
  with net names matching `toBreadboardNetlist`
- `breadboardNetProbe` -> `elementIds` equals `breadboardNetMembers`, and
  `pin` is set
- `targetNetProbe` for a target net with 2 resolved parts -> 2 ids and the
  first resolved pin; an unknown net -> null
- `targetPartProbe` for a missing reference -> null

## Verification

```
cd /Users/taco/gits/tacogips/nodetto-app-breadboard
mkdir -p tmp/breadboard-mode-s485/breadboard-13-ui-inspector
bun test packages/ui-solid/src/inspector/breadboard-edits.test.ts   # exit 0, >0 pass, 0 fail
bun test packages/ui-solid > tmp/breadboard-mode-s485/breadboard-13-ui-inspector/ui.log 2>&1   # G2
bun run typecheck > tmp/breadboard-mode-s485/breadboard-13-ui-inspector/typecheck.log 2>&1     # G1
bunx biome check packages/ui-solid/src/inspector/BreadboardSection.tsx packages/ui-solid/src/inspector/breadboard-edits.ts packages/ui-solid/src/inspector/breadboard-edits.test.ts packages/ui-solid/src/Inspector.tsx   # exit 0
git diff --quiet -- packages/ui-solid/src/inspector/BpmnSection.tsx   # exit 0
```

## Done criteria

- `grep -n 'breadboard\.' packages/ui-solid/src/Inspector.tsx` shows the Match and the label.
- All verification lines pass, with exit codes and counts in the progress log.

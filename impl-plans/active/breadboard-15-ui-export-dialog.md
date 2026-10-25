# breadboard-15-ui-export-dialog

- planId: breadboard-15-ui-export-dialog
- planPath: impl-plans/active/breadboard-15-ui-export-dialog.md
- wave: 2; dependsOn: breadboard-01-ir-contract
- design: design-docs/specs/design-breadboard.md section 10 (ExportDialog)
- progress log: impl-plans/progress/breadboard-15-ui-export-dialog.md
- protocol: overview "Per-worker protocol", gates G1 and G2
- G1 ownRegex: `^packages/ui-solid/src/(ExportDialog\.tsx|breadboard-export(\.test)?\.ts)`

## Intent

Add a "Breadboard" format to the single desktop `ExportDialog`, in the
"Diagram source" group. It is enabled only on `breadboard` pages and only
when the host supplies a handler. Its panel has three buttons: "BOM
(CSV)", "KiCad netlist (.net)" and "SPICE netlist (.cir)". The desktop
(plan 17) implements the handler.

## Non-goals

- No file writing, no netlist building and no core or io calls. The host
  does those.
- No change to other formats' behaviour or order.

## writePaths

- packages/ui-solid/src/ExportDialog.tsx
- packages/ui-solid/src/breadboard-export.ts (new)
- packages/ui-solid/src/breadboard-export.test.ts (new)
- impl-plans/progress/breadboard-15-ui-export-dialog.md

## sharedPaths

none

## Contracts (pinned; plan 17 relies on them)

```ts
// breadboard-export.ts
export type BreadboardExportKind = "bom" | "kicad" | "spice";
export const BREADBOARD_EXPORTS: readonly { kind: BreadboardExportKind; label: string; extension: "csv" | "net" | "cir" }[];
// labels exactly: "BOM (CSV)", "KiCad netlist (.net)", "SPICE netlist (.cir)"
export function breadboardExportEnabled(pageKind: string | undefined, hasHandler: boolean): boolean;
// ExportDialog.tsx
export interface ExportDialogProps { /* existing fields */ readonly exportBreadboard?: (kind: BreadboardExportKind) => Promise<void> }
```

The prop is optional, so `apps/desktop/src/App.tsx` keeps compiling until
plan 17 passes it. `LazyExportDialog.tsx` forwards all props with
`{...props}` and needs no change.

## File-level changes

In `ExportDialog.tsx`:
- Add `"breadboard"` to `Format`.
- Add the formats entry
  `{ id: "breadboard", label: "Breadboard", enabled: breadboardExportEnabled(page()?.kind, props.exportBreadboard !== undefined) }`
  right after `bpmn` (line 104).
- Append `"breadboard"` to the "Diagram source" ids after `"bpmn"` (line
  115).
- Add the description "BOM and netlists for other circuit tools."
- Add a `<Match when={active() === "breadboard"}>` panel next to the BPMN
  one (line 262), with one button per `BREADBOARD_EXPORTS` entry. Each
  button calls `void props.exportBreadboard?.(kind)`.

Imitate the BPMN entry exactly.

## Pitfalls

- Do not make the prop required: that breaks App.tsx until wave 6.
- Keep the `satisfies` clause on the formats array valid.
- No new CSS file is needed. Reuse the existing panel button styling.

## Tests (input -> expected), in `breadboard-export.test.ts`

- `breadboardExportEnabled("breadboard", true)` -> true
- `breadboardExportEnabled("breadboard", false)` -> false
- `breadboardExportEnabled("bpmn", true)` -> false
- `breadboardExportEnabled(undefined, true)` -> false
- `BREADBOARD_EXPORTS` -> three entries, in the order bom, kicad, spice,
  with extensions csv, net, cir and the exact labels

## Verification

```
cd /Users/taco/gits/tacogips/nodetto-app-breadboard
mkdir -p tmp/breadboard-mode-s485/breadboard-15-ui-export-dialog
bun test packages/ui-solid/src/breadboard-export.test.ts   # exit 0, >0 pass, 0 fail
bun test packages/ui-solid > tmp/breadboard-mode-s485/breadboard-15-ui-export-dialog/ui.log 2>&1   # G2
bun run typecheck > tmp/breadboard-mode-s485/breadboard-15-ui-export-dialog/typecheck.log 2>&1     # G1 (App.tsx must still compile)
bunx biome check packages/ui-solid/src/ExportDialog.tsx packages/ui-solid/src/breadboard-export.ts packages/ui-solid/src/breadboard-export.test.ts   # exit 0
```

## Done criteria

- `grep -c '"breadboard"' packages/ui-solid/src/ExportDialog.tsx` >= 3 (Format, formats entry, group).
- `grep -n 'exportBreadboard?:' packages/ui-solid/src/ExportDialog.tsx` prints one line.
- All verification lines pass, with exit codes and counts in the progress log.

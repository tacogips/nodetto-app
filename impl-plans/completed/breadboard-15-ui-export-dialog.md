# breadboard-15-ui-export-dialog

- planId: breadboard-15-ui-export-dialog
- planPath: impl-plans/completed/breadboard-15-ui-export-dialog.md
- wave: 2; dependsOn: breadboard-01-ir-contract
- checkpoint amendment 2 (session 489, IR-S489-W6-TOOLCHAIN-01): this plan
  also owns mise.toml (the `[tools] bun` pin). Plans 11, 12 and 14 now
  depend on this plan so they rerun on the pinned toolchain.
- design: design-docs/specs/design-breadboard.md section 10 (ExportDialog)
- progress log: impl-plans/progress/breadboard-15-ui-export-dialog.md
- protocol: overview "Per-worker protocol", gates G1 and G2
- G1 ownRegex: `^packages/ui-solid/src/(ExportDialog\.tsx|breadboard-export(\.test)?\.ts)`

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
- mise.toml (checkpoint amendment 2: only the `[tools] bun` line)
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

### mise.toml (checkpoint amendment 2)

Integration finding IR-S489-W6-TOOLCHAIN-01: under `bun = "latest"` (bun
1.4.3 and 1.4.4) every Solid `.tsx` test import is compiled with the dev JSX
runtime and asks `solid-js/dist/solid.js` for `jsxDEV`, which it does not
export. Five existing ui-solid suites (Toolbar.test.ts among them) then fail
to load, so `bun test packages/ui-solid` can never exit 0 for plans 11, 12,
14 and 15. Bisection by the integration reviewer: bun 1.3.14 and 1.4.0 pass,
1.4.3 and 1.4.4 fail. Under bun 1.4.0 the combined tree gives ui-solid 499
pass / 0 fail and `bun test packages apps/cli` 2321 pass / 18 skip / 0 fail.
This is a toolchain regression, not a source defect, and no plan owned
mise.toml. This plan (the smallest and longest-blocked one) now owns it.

Change exactly one line: under `[tools]`, `bun = "latest"` becomes
`bun = "1.4.0"`. Leave every other tool, hook and task untouched. Then run
`mise install` (bun 1.4.0 is already in the local mise install cache, so
nothing new is downloaded into the repo) and confirm `bun --version` prints
`1.4.0` from the repo root before running any other verification line.

## Pitfalls

- Do not make the prop required: that breaks App.tsx until wave 6.
- Keep the `satisfies` clause on the formats array valid.
- No new CSS file is needed. Reuse the existing panel button styling.
- mise.toml: do not use another version, `latest`, or a range. Do not add a
  bunfig.toml, change a tsconfig `jsx` setting, edit bun.lock, add
  dependencies or change the solid-js version.
- Never edit, skip or narrow Toolbar.test.ts or the other four failing
  ui-solid suites, or apps/desktop/src/history-shortcuts.test.ts. They must pass
  unchanged on bun 1.4.0.
- Never record a bun 1.4.4 aggregate run as passed. If `bun --version` is
  not `1.4.0`, stop and report the blocker; do not run the gates.

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
mise install                                               # exit 0
test "$(bun --version)" = "1.4.0"                          # pinned toolchain active
git diff -U0 -- mise.toml                                  # exactly one -/+ pair: the bun line
bun test packages/ui-solid/src/breadboard-export.test.ts   # exit 0, >0 pass, 0 fail
bun test packages/ui-solid > tmp/breadboard-mode-s485/breadboard-15-ui-export-dialog/ui.log 2>&1   # G2, exit 0, 0 fail, no jsxDEV
! grep -n 'jsxDEV' tmp/breadboard-mode-s485/breadboard-15-ui-export-dialog/ui.log
git diff --quiet -- bun.lock packages/ui-solid/src/Toolbar.test.ts apps/desktop/src/history-shortcuts.test.ts
bun test apps/desktop/src/history-shortcuts.test.ts        # exit 0, 2 pass
bun run typecheck > tmp/breadboard-mode-s485/breadboard-15-ui-export-dialog/typecheck.log 2>&1     # G1 (App.tsx must still compile)
bunx biome check packages/ui-solid/src/ExportDialog.tsx packages/ui-solid/src/breadboard-export.ts packages/ui-solid/src/breadboard-export.test.ts   # exit 0
```

## Done criteria

- `grep -c '"breadboard"' packages/ui-solid/src/ExportDialog.tsx` >= 3 (Format, formats entry, group).
- `grep -n 'exportBreadboard?:' packages/ui-solid/src/ExportDialog.tsx` prints one line.
- `grep -c '^bun = "1.4.0"$' mise.toml` is 1 and `grep -c 'bun = "latest"' mise.toml` is 0.
- `bun test packages/ui-solid` exits 0 with 0 fail on bun 1.4.0.
- All verification lines pass, with exit codes and counts in the progress log.

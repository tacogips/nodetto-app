# Implementation plans

- `active/`: plans still in progress, plus dispatch manifests.
- `completed/`: plans whose implementation passed final verification.
- `progress/`: per-plan worker progress logs (evidence, kept after
  archival).

## Active

Breadboard circuit pages overview:
[breadboard-00-overview](active/breadboard-00-overview.md) lists waves
1-7, ownership, gates and final verification. Its 18 plans are complete
(see Completed below). The overview stays active until
`CARGO_TERM_QUIET=true mise run verify` exits 0 on the combined tree. The
session-490 run exited 1 because `bun test` collected git-ignored scratch
copies under `tmp/breadboard-mode-s485/breadboard-05-collab/`
(RECON-S490-W1-VERIFY-TMP-SCRATCH). The dispatch manifest
`breadboard-mode-s485-dispatch.json` stays in `active/`, and its `planPath`
values name the pre-archive `active/` locations.

`active/` also holds the historical dispatch manifests
`canvas-theme-s539-dispatch.json` (appearance settings),
`ddl-frame-dispatch.json`, the KiCad PCB manifests
(`kicad-pcb-s530-dispatch.json`, `kicad-pcb-s534-dispatch.json`,
`kicad-pcb-s536-dispatch.json`; s536 was the final dispatch, with plans
01-08 as its accepted dependencies) and the BPMN manifests
(`bpmn-operation-flow-s356-dispatch.json`,
`bpmn-operation-flow-s357-dispatch.json`,
`bpmn-operation-flow-s359-dispatch.json`,
`bpmn-render-fix-s360-dispatch.json`). Of the BPMN operation-flow
manifests, only s359 was the final dispatch. Their `planPath` values name
the pre-archive `active/` locations.

## Completed

Appearance settings (sessions 539-540; design:
`design-docs/specs/design-appearance.md`, user QA:
`design-docs/user-qa/appearance.md`). Covers the System/Light/Dark app
theme, the dark chrome token set, and the diagram and PCB canvas
backgrounds. All eight plans were accepted by the session-540 serial
integration review on the combined tree:
`BUN_OPTIONS=--jsx-runtime=classic CARGO_TERM_QUIET=true mise run verify`
exit 0 (2778 pass, 23 skip, 0 fail) and `CARGO_TERM_QUIET=true mise run
build` exit 0. The aggregate `--noUncheckedIndexedAccess` typecheck still
exits 2 with 91 errors, equal to the 28c9ded baseline and none in feature
files. The dispatch manifest `canvas-theme-s539-dispatch.json` stays in
`active/`, and its `planPath` values name the pre-archive `active/`
locations. Evidence: `tmp/canvas-theme-s539/<planId>/` and
`tmp/canvas-theme-s539/reconcile/s540-wave-00N/`.

| Plan | Scope |
|---|---|
| [appearance-00-overview](completed/appearance-00-overview.md) | Waves, ownership, pinned contracts, final verification |
| [appearance-01-preferences](completed/appearance-01-preferences.md) | `appearance.ts` contract, three new persisted preferences |
| [appearance-02-canvas-mode](completed/appearance-02-canvas-mode.md) | `canvasBackground` prop and `nodetto-canvas-dark` class in ui-solid |
| [appearance-03-chrome-tokens](completed/appearance-03-chrome-tokens.md) | Desktop chrome tokens and the dark `base.css` block |
| [appearance-04-canvas-css](completed/appearance-04-canvas-css.md) | Canvas token sets and the document paint pin |
| [appearance-05-ui-solid-chrome-css](completed/appearance-05-ui-solid-chrome-css.md) | ui-solid chrome CSS on `var(--token, <literal>)` fallbacks |
| [appearance-06-desktop-wiring](completed/appearance-06-desktop-wiring.md) | `main.tsx`, `App.tsx`, Settings Appearance category, Tauri `setTheme` capability, README |
| [appearance-07-theme-tokens-test](completed/appearance-07-theme-tokens-test.md) | `styles/theme-tokens.test.ts` |

KiCad PCB pages (sessions 530-536; design:
`design-docs/specs/design-kicad-pcb.md` revision 3, user QA:
`design-docs/user-qa/kicad-pcb.md`). Plans 01-03 were committed in
6865464, 04-06 and 08 in cf0c4d7, and 07 in 8181d51. Plans 09-13 were
accepted by the session-536 serial integration review on the combined
tree: `mise run verify` exit 0 (2738 pass, 0 fail) and `mise run
test-cli` exit 0 (139 pass). Evidence: `tmp/kicad-pcb-s530/<planId>/`,
`tmp/kicad-pcb-s534/<planId>/`, `tmp/kicad-pcb-s536/<planId>/` and
`tmp/kicad-pcb-s536/reconcile/wave-003/`.

| Plan | Scope |
|---|---|
| [kicad-pcb-00-overview](completed/kicad-pcb-00-overview.md) | Waves, ownership, gates, final verification |
| [kicad-pcb-01-ir-core-contracts](completed/kicad-pcb-01-ir-core-contracts.md) | `pcb` page kind, six `pcb.*` types, board geometry and page builder |
| [kicad-pcb-02-fabrication-writers](completed/kicad-pcb-02-fabrication-writers.md) | Additive Gerber layer and Excellon drill writer changes |
| [kicad-pcb-03-docs](completed/kicad-pcb-03-docs.md) | `docs/pcb/kicad-pcb.md`, `docs/cli.md`, README |
| [kicad-pcb-04-kicad-reader](completed/kicad-pcb-04-kicad-reader.md) | `.kicad_pcb` reader for KiCad 5 to 9, self-authored fixtures |
| [kicad-pcb-05-core-editing](completed/kicad-pcb-05-core-editing.md) | Footprint move and rotate with track follow, add track and via |
| [kicad-pcb-06-core-connectivity](completed/kicad-pcb-06-core-connectivity.md) | Copper connectivity, ratsnest, net highlight |
| [kicad-pcb-07-core-export](completed/kicad-pcb-07-core-export.md) | `exportPcbBoard`, `encodePcbBoardZip`, drill offset |
| [kicad-pcb-08-core-shapes](completed/kicad-pcb-08-core-shapes.md) | Shape utils for the six `pcb.*` types |
| [kicad-pcb-09-core-index-fixture-integration](completed/kicad-pcb-09-core-index-fixture-integration.md) | `pcb-board` barrel, core index line, fixture acceptance tests |
| [kicad-pcb-10-cli](completed/kicad-pcb-10-cli.md) | `nodetto-cli pcb import` and `pcb gerber`, native parity case |
| [kicad-pcb-11-ui-canvas](completed/kicad-pcb-11-ui-canvas.md) | Canvas views, overlay, Track and Via tools, Layers and Tool options panel, workspace |
| [kicad-pcb-12-ui-inspector-export](completed/kicad-pcb-12-ui-inspector-export.md) | Inspector PCB section with Select net, Export dialog PCB tab |
| [kicad-pcb-13-desktop-open](completed/kicad-pcb-13-desktop-open.md) | Desktop Open of `.kicad_pcb` as a detached document |

Breadboard circuit pages (sessions 485-490; design:
`design-docs/specs/design-breadboard.md` revision 2, user QA:
`design-docs/user-qa/breadboard-mode.md`). Accepted by the session-490
serial integration review (comm-009184) on the combined tree. Overview:
[breadboard-00-overview](active/breadboard-00-overview.md) (still active,
see above). Evidence: `tmp/breadboard-mode-s485/<planId>/` and
`tmp/breadboard-mode-s485/reconcile-s490/`.

| Plan | Scope |
|---|---|
| [breadboard-01-ir-contract](completed/breadboard-01-ir-contract.md) | `breadboard` page kind, 13 `breadboard.*` types, shared pure models, JSONL golden fixture |
| [breadboard-02-core-foundation](completed/breadboard-02-core-foundation.md) | Part catalogue, board layouts, pinned core types |
| [breadboard-03-io-formatters](completed/breadboard-03-io-formatters.md) | BOM CSV, KiCad-style netlist, SPICE netlist; Mermaid/D2 skip |
| [breadboard-04-io-kicad](completed/breadboard-04-io-kicad.md) | S-expression reader, `.kicad_sch` and `.net` importers, `@nodetto/io/kicad` |
| [breadboard-05-collab](completed/breadboard-05-collab.md) | Yjs round trip |
| [breadboard-06-core-editing](completed/breadboard-06-core-editing.md) | Hole-grid snapping, rotation, board carry, annotation |
| [breadboard-07-core-connectivity-erc](completed/breadboard-07-core-connectivity-erc.md) | Connectivity engine, net highlight, eight ERC rules |
| [breadboard-08-core-notation-svg](completed/breadboard-08-core-notation-svg.md) | Shared notation module, resistor bands, SVG export |
| [breadboard-09-core-import-layout](completed/breadboard-09-core-import-layout.md) | Staged off-board import layout |
| [breadboard-10-core-ratsnest-parity](completed/breadboard-10-core-ratsnest-parity.md) | Ratsnest and five schematic-parity rules |
| [breadboard-11-ui-shape-views](completed/breadboard-11-ui-shape-views.md) | Canvas views |
| [breadboard-12-ui-canvas-interaction](completed/breadboard-12-ui-canvas-interaction.md) | Workspace, palette, wire tool, keys, overlays |
| [breadboard-13-ui-inspector](completed/breadboard-13-ui-inspector.md) | Inspector fields, rotation, net highlight |
| [breadboard-14-ui-problems](completed/breadboard-14-ui-problems.md) | Problems panel and cross-probing |
| [breadboard-15-ui-export-dialog](completed/breadboard-15-ui-export-dialog.md) | BOM/KiCad/SPICE in the Export dialog; bun 1.4.0 pin |
| [breadboard-16-cli](completed/breadboard-16-cli.md) | `nodetto-cli lint` and `breadboard bom/netlist/import` |
| [breadboard-17-desktop](completed/breadboard-17-desktop.md) | Workspace following, panel mount, export wiring, KiCad open filter |
| [breadboard-18-example-docs](completed/breadboard-18-example-docs.md) | LED/button example, golden outputs, `docs/breadboard/`, README |

`ddl --frame` name and prefix resolution (design:
`design-docs/specs/design-cli-ai-drawing.md`, "Ids and names" and
"ddl --frame resolution"). One wave; both plans ran in parallel with
disjoint writePaths. Accepted by the integration review on the combined
tree. Evidence: `tmp/ddl-frame/<planId>/` and
`tmp/ddl-frame/reconciliation/wave-001/`.

| Plan | Scope |
|---|---|
| [ddl-frame-01-resolver](completed/ddl-frame-01-resolver.md) | Page-scoped frame resolver in `ddlCommand` and its regression tests |
| [ddl-frame-02-help-docs](completed/ddl-frame-02-help-docs.md) | `ddl` and `pages` help text, README example, help test |

BPMN rendering-defect fix (session-360; design: `design-docs/specs/design-bpmn.md`
6.1, 6.2, 6.4, 11, 13). One wave; both plans ran in parallel with
disjoint writePaths. Accepted by the session-360 integration review on
the combined tree. Evidence: `tmp/bpmn-render-fix-s360/<planId>/`.

| Plan | Scope |
|---|---|
| [bpmn-r1-connector-backdrops](completed/bpmn-r1-connector-backdrops.md) | Pools, lanes, expanded sub-processes and BPMN groups as connector backdrops; layer, routing and canvas-partition tests |
| [bpmn-r2-task-icons-labels](completed/bpmn-r2-task-icons-labels.md) | Original top-left task-type icons, unfilled group body, single label origin for canvas and export |

BPMN 2.0 operation flow (design: `design-docs/specs/design-bpmn.md`,
user QA: `design-docs/user-qa/bpmn-operation-flow.md`). Accepted by the
session-359 final verification.

| Plan | Scope |
|---|---|
| [bpmn-00-overview](completed/bpmn-00-overview.md) | Waves, ownership, gates, final verification |
| [bpmn-01-ir-core-contract](completed/bpmn-01-ir-core-contract.md) | IR registry types, semantics, validation, waypoint move |
| [bpmn-02-fixtures](completed/bpmn-02-fixtures.md) | Original purchase-request fixtures |
| [bpmn-03-core-editing](completed/bpmn-03-core-editing.md) | Connection legality, containment, pool/lane editing |
| [bpmn-04-core-notation-svg](completed/bpmn-04-core-notation-svg.md) | Shared notation module and SVG export |
| [bpmn-05-core-lint](completed/bpmn-05-core-lint.md) | bpmnlint-equivalent rules and config |
| [bpmn-06-io-bpmn-xml](completed/bpmn-06-io-bpmn-xml.md) | BPMN 2.0 XML import/export |
| [bpmn-07-collab](completed/bpmn-07-collab.md) | Yjs round trip |
| [bpmn-08-ui-solid-views](completed/bpmn-08-ui-solid-views.md) | Canvas views |
| [bpmn-09-ui-solid-palette](completed/bpmn-09-ui-solid-palette.md) | Palette and Add BPMN page |
| [bpmn-10-ui-solid-inspector](completed/bpmn-10-ui-solid-inspector.md) | Inspector BPMN section |
| [bpmn-11-ui-solid-problems-panel](completed/bpmn-11-ui-solid-problems-panel.md) | Problems panel |
| [bpmn-12-cli](completed/bpmn-12-cli.md) | `nodetto-cli lint` and `bpmn import/export` |
| [bpmn-13-core-integration-tests](completed/bpmn-13-core-integration-tests.md) | Cross-package fixture tests |
| [bpmn-14-docs](completed/bpmn-14-docs.md) | README and `docs/bpmn/` |
| [bpmn-15-desktop](completed/bpmn-15-desktop.md) | Desktop menus, `.bpmn` open, dialog filter, file association |

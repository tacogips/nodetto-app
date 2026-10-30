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
`shape-lateral-s544-dispatch.json` (shape lateral consistency),
`canvas-theme-s539-dispatch.json` (appearance settings),
`ddl-frame-dispatch.json`, the PCB SVG export manifest
`pcb-svg-s538-dispatch.json`, the KiCad PCB manifests
(`kicad-pcb-s530-dispatch.json`, `kicad-pcb-s534-dispatch.json`,
`kicad-pcb-s536-dispatch.json`; s536 was the final dispatch, with plans
01-08 as its accepted dependencies) and the BPMN manifests
(`bpmn-operation-flow-s356-dispatch.json`,
`bpmn-operation-flow-s357-dispatch.json`,
`bpmn-operation-flow-s359-dispatch.json`,
`bpmn-render-fix-s360-dispatch.json`,
`bpmn-export-ownership-s550-dispatch.json`). Of the BPMN operation-flow
manifests, only s359 was the final dispatch. Their `planPath` values name
the pre-archive `active/` locations. The text-layout lint manifests
(`text-layout-lint-s551-dispatch.json`, `text-layout-lint-s552-dispatch.json`,
`text-layout-lint-s555-dispatch.json`, `text-layout-lint-s556-dispatch.json`)
also stay in `active/`; s556 was the final dispatch.

## Completed

Text-layout lint (sessions 551, 552, 555 and 556; design:
`design-docs/specs/design-text-layout-lint.md`, owner decisions in
`design-docs/user-qa/text-layout-lint.md`; no GitHub issue). `nodetto-cli
lint` checks architecture, freeform and flowchart pages for
`label-overflow`, `label-collision` and `note-overflow`, and whole-page SVG,
PNG and PDF exports print the same findings as warnings without changing
the output. Label and note width count East Asian Wide and Fullwidth
graphemes at 1 em on the lint side only; export wrapping is unchanged.
Plans 01-05 delivered the architecture-only lint (s551; plan 05 was
blocked only by a binary-less parity run). Plans 06-08 started the
revision (s552), and 07 and 08 were accepted. Plans 09-11 were superseded
because their gates included a CLI command expected to fail until a later
plan landed (s552, s555). Plan 12 then covered the core rules review, CLI
lint and export, and the CLI test updates, and was accepted (s556). Plan
13 (native parity for wide labels, freeform and flowchart pages) was
blocked only by a binary-less skip run in its gate. Its parity run against
the release binary passed (17 pass, 0 fail), and it was verified and
archived by hand.

| Plan | Scope |
|---|---|
| [tll-00-overview](completed/tll-00-overview.md) | Architecture-only lint: waves, ownership and final verification |
| [tll-01-core-lint](completed/tll-01-core-lint.md) | Core rules and engine in `packages/core/src/text-layout-lint` |
| [tll-02-cli-help-docs](completed/tll-02-cli-help-docs.md) | CLI help and `docs/cli.md` for the architecture-only lint |
| [tll-03-cli-lint](completed/tll-03-cli-lint.md) | `lint` routing for architecture pages |
| [tll-04-cli-export](completed/tll-04-cli-export.md) | Export layout warnings on stderr |
| [tll-05-native-parity](completed/tll-05-native-parity.md) | Native CLI parity for lint and export, including dense pages |
| [tll-06-overview](completed/tll-06-overview.md) | Revision overview for the Q1 page kinds and Q2 wide width (superseded by 12-13 for the CLI side) |
| [tll-07-wide-width](completed/tll-07-wide-width.md) | Table-driven East Asian Wide/Fullwidth width in `packages/core/src/wide-text-width.ts` |
| [tll-08-help-docs](completed/tll-08-help-docs.md) | Help and docs for the revised rules and page kinds |
| [tll-09-core-rules](completed/tll-09-core-rules.md) | Superseded by tll-12 (core rule changes reviewed there) |
| [tll-10-cli-lint-export](completed/tll-10-cli-lint-export.md) | Superseded by tll-12 |
| [tll-11-native-parity](completed/tll-11-native-parity.md) | Superseded by tll-13 |
| [tll-12-core-cli-lint-export](completed/tll-12-core-cli-lint-export.md) | Core rules review, CLI lint and export page kinds, CLI test updates |
| [tll-13-native-parity](completed/tll-13-native-parity.md) | Native parity for wide labels, freeform and flowchart pages |

BPMN export ownership (session 550; design:
`design-docs/specs/design-bpmn.md` export ownership revision, sections 5.2,
5.3, 5.3.1, 8, 11 and 14; no GitHub issue). This work fixes two problems.
A boundary event with `attachedTo` but no `parent` was exported into an
extra unreferenced process. A sequence flow from such an event was emitted
twice, so the XML re-import failed. Parentless text annotations and groups
on pages with participants now go into `bpmn:collaboration`, and an export
that would repeat an id warns `Duplicate BPMN id <id> was emitted.` Wave 1
ran plans 01, 02 and 03; wave 2 ran plan 04, after 01-03. The session-550
serial integration review accepted all of them on the combined tree. Each
of these exited 0: `bun test packages/io/src/bpmn` (47 pass, 1
pre-existing skip, 0 fail), `bun test packages/io
apps/cli/src/bpmn-commands.test.ts` (282 pass, 1 skip, 0 fail),
`mise run lint-ts` and `CARGO_TERM_QUIET=true mise run check`. No native
CLI code changed, so `mise run test-cli` was not required. There is no
browser E2E suite. The dispatch manifest
`active/bpmn-export-ownership-s550-dispatch.json` keeps the pre-archive
`active/` `planPath` values. Evidence:
`tmp/bpmn-export-ownership-s550/<planId>/` and
`tmp/bpmn-export-ownership-s550/reconcile/wave-00N/`.

| Plan | Scope |
|---|---|
| [bpmn-export-ownership-00-overview](completed/bpmn-export-ownership-00-overview.md) | Waves, ownership, worker rules, serial reconciliation and final verification |
| [bpmn-export-ownership-01-import-collab-artifacts](completed/bpmn-export-ownership-01-import-collab-artifacts.md) | Import parentless text annotations, groups and associations from `bpmn:collaboration` |
| [bpmn-export-ownership-02-duplicate-id-guard](completed/bpmn-export-ownership-02-duplicate-id-guard.md) | `duplicateIdWarnings` over BPMN model and BPMNDI ids, excluding extension vocabularies |
| [bpmn-export-ownership-03-export-placement](completed/bpmn-export-ownership-03-export-placement.md) | Boundary events placed by their `attachedTo` host, collaboration artifacts, each sequence flow emitted once |
| [bpmn-export-ownership-04-roundtrip-integration](completed/bpmn-export-ownership-04-roundtrip-integration.md) | Guard wired into `exportBpmnXml`; boundary-event-plus-group round trip and safeguard tests |

Shape lateral consistency (sessions 544-548; design:
`design-docs/specs/design-shape-lateral-consistency.md`, user QA:
`design-docs/user-qa/shape-lateral-consistency.md`). Covers
`semantic.unknownField` warnings, the geo `actor` stick figure, exact
draw.io `umlActor` and native UML exports, and open `draw.path` contours.
Waves: 01 and 02; then 03, 04 and 05 (after 01); then 06 (after 04) and 07
(after 02 and 03). All eight plans were accepted by the session-548 serial
integration review on the combined tree:
`BUN_OPTIONS=--jsx-runtime=classic mise run verify` exit 0 (2888 pass, 23
skip, 0 fail). No browser E2E suite exists, so the stick-figure tile and
open-path editing have unit and SVG coverage only. The dispatch manifest
`active/shape-lateral-s544-dispatch.json` keeps the pre-archive `active/`
`planPath` values. Evidence: `tmp/shape-lateral-s544/<planId>/` and
`tmp/shape-lateral-s544/reconcile/session-548-wave-00N/`.

| Plan | Scope |
|---|---|
| [slc-00-overview](completed/slc-00-overview.md) | Waves, ownership, per-worker protocol, final verification |
| [slc-01-ir-drawing-contract](completed/slc-01-ir-drawing-contract.md) | `GEO_KINDS` actor, `PathContour.closed`, open-contour validation, outline rules |
| [slc-02-ir-unknown-field](completed/slc-02-ir-unknown-field.md) | `semantic.unknownField` warning, registry keyOrder audit, corpus audit test |
| [slc-03-geo-actor](completed/slc-03-geo-actor.md) | Stick figure geometry, tool, catalogue, palette, inspector label, D2 person |
| [slc-04-open-path-render](completed/slc-04-open-path-render.md) | Open contour geometry, stroke-only hit test, canvas and SVG rendering, consumer skips |
| [slc-05-drawio](completed/slc-05-drawio.md) | draw.io `umlActor` import and export, native UML component, interface and port export |
| [slc-06-open-path-edit](completed/slc-06-open-path-edit.md) | `PathWorldContour` closed flag through anchor drags, handles and the path inspector |
| [slc-07-cli-docs](completed/slc-07-cli-docs.md) | CLI per-operation warnings, `validate --strict`, TYPICAL, help and docs |

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

PCB pages in SVG, PNG and PDF export (session 538; design:
`design-docs/specs/design-pcb-svg-export.md`, user QA:
`design-docs/user-qa/pcb-svg-export.md`). Wave 1: plans 01 and 02; wave 2:
plan 03 (after 01); wave 3: plan 04 (after 03). Accepted by the
session-538 serial integration review on the combined tree:
`BUN_OPTIONS=--jsx-runtime=classic mise run verify` exit 0 (2756 pass, 23
skip, 0 fail) and `mise run test-cli` exit 0 (142 pass, native PCB parity
run, not skipped). Evidence: `tmp/pcb-svg-s538/<planId>/` and
`tmp/pcb-svg-s538/reconcile/`. The dispatch manifest
`active/pcb-svg-s538-dispatch.json` keeps the pre-archive `active/`
`planPath` values.

| Plan | Scope |
|---|---|
| [pcb-svg-01-core-view-model](completed/pcb-svg-01-core-view-model.md) | Move the PCB view model and colour table to `packages/core/src/pcb-board/view.ts`; ui-solid re-exports |
| [pcb-svg-02-docs](completed/pcb-svg-02-docs.md) | `docs/pcb/kicad-pcb.md`, `docs/cli.md`, README |
| [pcb-svg-03-svg-renderer](completed/pcb-svg-03-svg-renderer.md) | `renderPcbShape`, `renderShape` dispatch, board rect, core tests |
| [pcb-svg-04-cli-tests](completed/pcb-svg-04-cli-tests.md) | CLI SVG/PNG/PDF test and native parity of the PCB SVG |

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

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

`active/` also holds the historical BPMN dispatch manifests
(`bpmn-operation-flow-s356-dispatch.json`,
`bpmn-operation-flow-s357-dispatch.json`,
`bpmn-operation-flow-s359-dispatch.json`,
`bpmn-render-fix-s360-dispatch.json`). Of the first three, only s359 was
the final dispatch. Their `planPath` values name the pre-archive
`active/` locations.

## Completed

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

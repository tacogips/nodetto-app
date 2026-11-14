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
also stay in `active/`; s556 was the final dispatch. The CLI layout, merge
and lint manifests (`clm-s725-dispatch.json`, `clm-s731-dispatch.json`,
`clm-s732-dispatch.json`, `clm-s736-dispatch.json`,
`clm-s737-dispatch.json`, `clm-s740-dispatch.json`) also stay in `active/`
with their pre-archive `planPath` values; s740 was the final dispatch and
the earlier ones must not be dispatched again. The manifests `fss-s751-dispatch.json`, `seq-self-s750-dispatch.json`, `cpf-s748-dispatch.json`
and `ipd-s772-dispatch.json` (iPhone app design; final dispatch) also stay in `active/` with their
pre-archive `planPath` values. The spreadsheet table manifests
`tsh-s776-dispatch.json` and `tsh-s780-dispatch.json` also stay in
`active/` with their pre-archive `planPath` values; s780 was the final
dispatch, and s776 must not be dispatched again. The presentation manifest
`prs-s793-dispatch.json` also stays in `active/` with its pre-archive
`planPath` values.

## Completed

### iPhone app design

Precise layers, iOS kit, layout, prototyping, lint and comparison are implemented
(design: `design-docs/specs/design-iphone-app-design.md`; user QA:
`design-docs/user-qa/iphone-app-design.md`; no GitHub issue). The private
reproduction exists only under git-ignored `tmp/`. Evidence is under
`tmp/ipd-s772/<planId>/`; progress logs remain in `progress/`.

Final gates: workspace verify reported 3661 Bun passes, 73 skips and 0 failures;
CLI tests reported 496 Bun passes and 0 failures, with native parity executed
and not skipped. The CLI build and workspace typecheck passed. Logs:
`tmp/ipd-s772/ipd-28-finish/final/`. The adversarial review accepted the
finish unit; there is no browser E2E suite, so the desktop presentation,
prototype view and Compare with reference dialog are covered by unit and
integration tests only.

All 37 ipd plans (`ipd-00-baseline.md` through `ipd-29-desktop-snap-grid.md`,
including the split units `ipd-07a`, `ipd-07b`, `ipd-27a`, `ipd-27b`,
`ipd-27c`, `ipd-27k` and `ipd-27p`) are archived to `completed/` by the
workflow plan-archive node. The final dispatch manifest
`ipd-s772-dispatch.json` stays in `active/` with its pre-archive `planPath`
values, like the other historical manifests, and must not be dispatched again.

Presentation (slideshow) mode (session 793; design:
`design-docs/specs/design-presentation.md`; owner Q&A:
`design-docs/user-qa/presentation.md`; no GitHub issue, source is the session
793 runtime workflowInput). Pages are presented full screen in tab order,
read-only and fitted to the screen, with F5/Shift+F5, the File menu and header
Present actions, keyboard, mouse and control-bar navigation, and an optional
`Page.hiddenInPresentation` flag edited through the `updatePage` patch.
Integration review accepted the combined tree: `mise run verify` exit 0 (Bun
3641 pass, 0 fail; Rust 85 pass), typecheck, lint and `bun run build` clean.
Logs: `tmp/prs-s793/reconcile-wave-004/` and
`tmp/prs-s793/prs-06-wiring/final/`. There is no browser E2E suite; native
Tauri fullscreen and the DOM fullscreen exit still need a manual desktop smoke
test. Progress logs stay in `progress/`.

| Plan | Scope |
|---|---|
| [prs-00-overview](completed/prs-00-overview.md) | Waves, ownership and final verification |
| [prs-01-page-flag](completed/prs-01-page-flag.md) | `hiddenInPresentation` in IR, JSONL, Yjs and `updatePage` |
| [prs-02-core-presentation](completed/prs-02-core-presentation.md) | Slide list, navigation reducer, fit and slide source |
| [prs-03-fullscreen](completed/prs-03-fullscreen.md) | Tauri/DOM fullscreen helper and capability |
| [prs-04-presentation-view](completed/prs-04-presentation-view.md) | `PresentationView`, controller and key map |
| [prs-05-page-flag-ui](completed/prs-05-page-flag-ui.md) | Page tab menu item and inspector switch |
| [prs-06-wiring](completed/prs-06-wiring.md) | Desktop shortcuts, menus, fullscreen wiring, docs and README |

Spreadsheet table element `table.sheet` (sessions 776, 778 and 780; design:
`design-docs/specs/design-table-sheet.md`; owner Q&A:
`design-docs/user-qa/table-sheet.md`; no GitHub issue, source is the session
780 runtime workflowInput). The element is a typed grid with toolbox
creation, in-place cell editing, TSV clipboard, column and row resize, an
inspector section, `table.*` validation, SVG/PNG/PDF export and the CLI
commands `table create` and `table set`. `erd.table` is unchanged. Plans:
[tsh-00-overview](completed/tsh-00-overview.md),
[tsh-01a-ir](completed/tsh-01a-ir.md),
[tsh-01b-layout](completed/tsh-01b-layout.md),
[tsh-01c-edits](completed/tsh-01c-edits.md),
[tsh-01d-values](completed/tsh-01d-values.md),
[tsh-02-export](completed/tsh-02-export.md),
[tsh-03-view](completed/tsh-03-view.md),
[tsh-04a-navigation](completed/tsh-04a-navigation.md),
[tsh-04b-clipboard](completed/tsh-04b-clipboard.md),
[tsh-04c-resize](completed/tsh-04c-resize.md),
[tsh-05-inspector](completed/tsh-05-inspector.md),
[tsh-06-cli](completed/tsh-06-cli.md),
[tsh-07-docs](completed/tsh-07-docs.md) and
[tsh-08-wiring](completed/tsh-08-wiring.md). The superseded stubs
[tsh-01-model](completed/tsh-01-model.md) and
[tsh-04-cell-editing](completed/tsh-04-cell-editing.md) are archived with
them as history. Final gate logs (tsh-08-wiring): `mise run test` 3607
pass, 64 skip, 0 fail; `mise run test-cli` 448 pass, 0 fail on attempt 1;
typecheck, lint, `mise run build` and `mise run build-cli` clean. Logs:
`tmp/tsh-s780/tsh-08-wiring/resume/`. Integration logs:
`tmp/tsh-s780/reconcile-wave-006/`. Evidence roots: `tmp/tsh-s780/<planId>/`.
Progress logs remain in `progress/`. Browser E2E coverage does not exist in
this repository, so canvas interactions still need a manual desktop smoke
test.

Connector routing and arranging (design: `design-docs/specs/design-connector-routing-arranging.md`; no GitHub issue): overlap repair, nearest free label placement, routing parity and end-to-end coverage are finished. The combined `mise run verify` passed (Bun: 3484 pass, 64 skip, 0 fail; Rust: 85 pass, 0 fail, 0 ignored), and `mise run test-cli` passed (438 pass, 0 skip, 0 fail; native parity ran). Logs: `tmp/crl-s759/crl-10-finish/final/`. The uncontended target is at most 6 user seconds per arrange command; recorded means are layered 4.873 and route 3.890 seconds. Evidence roots: `tmp/crl-s749/<planId>/`, `tmp/crl-s753/<planId>/`, `tmp/crl-s754/<planId>/`, and `tmp/crl-s759/<planId>/`; progress logs remain in `progress/`.

The crl plans and manifests belong in `completed/` because the request named them, unlike other feature manifests in `active/`. Replaced manifests `crl-s749-dispatch.json`, `crl-s753-dispatch.json`, and `crl-s754-dispatch.json` are in `completed/`. The workflow plan-archive node moves `crl-09-parity-e2e.md`, `crl-10-finish.md`, and `crl-s759-dispatch.json` there after final verification.

File save stability (session 751; design:
`design-docs/specs/design-file-save-stability.md`; no GitHub issue). An
outside change to an open file no longer causes a save without unsaved in-app
changes, saves keep unchanged records byte-identical, and same-folder saves
leave relative image references alone. Save As keeps a reference when it still
resolves, otherwise copies the image and reports the copy. Integration review
accepted the combined tree. The final gate log records `mise run verify` exit 0
with 3292 pass, 51 skip, 0 fail. The fss-04 progress log records 85 Rust passes.
`mise run test-cli` was not required because no CLI code changed. There is no
browser E2E suite, and the reported scenario has not been run in the real
desktop app; session tests use a mock backend. Progress logs stay in
`progress/`. Evidence: `tmp/fss-s751/<planId>/` and
`tmp/fss-s751/serial-reconcile-wave-003/mise-verify.log`.

| Plan | Scope |
|---|---|
| [fss-00-overview](completed/fss-00-overview.md) | Waves, ownership and pinned contracts |
| [fss-01-preserving-serializer](completed/fss-01-preserving-serializer.md) | `serializeDocumentPreservingText` in `packages/io` |
| [fss-02-attachments](completed/fss-02-attachments.md) | Per-`src` attachment decisions and Save As copies |
| [fss-03-session](completed/fss-03-session.md) | Save gate, reconcile, snapshot loop, status note and session tests |
| [fss-04-docs-final](completed/fss-04-docs-final.md) | User docs and final verification |

Sequence self-messages (session 750; design:
`design-docs/specs/design-sequence-self-messages.md`, user QA:
`design-docs/user-qa/sequence-self-messages.md`; no GitHub issue). A sequence
participant can connect to itself in the Bun and native CLI and with the app's
message tool, for `sync`, `async` and `return`. A self-message draws as a loop
with its label beside it in SVG, PNG, PDF and on the canvas, and rows,
activations and lifelines leave room for the loop. Golden fixtures from base
commit 1e8f43d cover documents without self-messages. Wave 1 ran plan 01, wave
2 ran plans 02-05, and wave 3 ran plans 06 and 07. Serial reconciliation on the
combined tree recorded `mise run verify` exit 0 (3309 pass, 58 skip, 0 fail)
and `mise run test-cli` exit 0 on its first attempt (365 pass, 0 fail). Median
native user time was 1.13 s against 1.08 s for the pre-change binary, a ratio
of 1.05. There is no browser E2E suite, so the canvas has interaction and pure
helper tests only. Native raster tests have run only on macOS. Native PNG loses
label text for an unresolved named font such as Arial; this is a pre-existing
defect left for an owner decision. Plan 06 lines 62 and 66 keep wording that
its review brief superseded: independent edit runs are compared on everything
not generated, and its native PNG fixture uses the default font. Q1 and Q2 in
the user QA stay open on their defaults. Progress logs stay in `progress/`.
Evidence: `tmp/seq-self-s750/<planId>/` and
`tmp/seq-self-s750/reconcile-wave-005/`.

| Plan | Scope |
|---|---|
| [seq-self-01-contract](completed/seq-self-01-contract.md) | Pre-change goldens, loop geometry, row layout, route, label anchor and connect rule |
| [seq-self-02-export](completed/seq-self-02-export.md) | SVG loop, label placement and export viewBox bound |
| [seq-self-03-shape-bounds](completed/seq-self-03-shape-bounds.md) | Sequence shape bounds, rows, activations and lifelines |
| [seq-self-04-authoring](completed/seq-self-04-authoring.md) | Self-message planning in `planSequenceMessage` and authoring tests |
| [seq-self-05-canvas](completed/seq-self-05-canvas.md) | Canvas loop, label and message tool drag |
| [seq-self-06-cli](completed/seq-self-06-cli.md) | `types` note, CLI tests, native parity, PNG containment and timing |
| [seq-self-07-wiring](completed/seq-self-07-wiring.md) | Help text, `docs/cli.md` and help parity tests |

Element conversion, sequence participant shapes and ERD frame scope (session
748; design: `design-docs/specs/design-convert-participant-frame-scope.md`; no
GitHub issue). The work added the `convert` edit operation, `delete` with
`reconnectTo`, conversion checks in desktop reconciliation, stick figure and
cylinder participants in export and on the canvas, the `ddl --frame` table
scope rule, and the `frame-straddle` lint warning. The final gate logs record
`mise run verify` 3344 pass, 54 skip, 0 fail; `mise run test-cli` 392 pass, 0
fail on attempt 2, after attempt 1 hit native deadline timeouts; and native
parity 3 pass, 0 fail. Median CPU ratios against the pre-change binary are
update 0.989, ddl 1.010, lint 0.990 and svg 0.964. There is no browser E2E
suite, and actor and db participants have not been rendered on the desktop
canvas; a manual check of a sequence page with all three kinds is still worth
doing before release. Progress logs stay in `progress/`. Evidence:
`tmp/cpf-s748/<planId>/` and `tmp/cpf-s748/reconcile-wave-005/`.

| Plan | Scope |
|---|---|
| [cpf-00-overview](completed/cpf-00-overview.md) | Waves, ownership and final verification |
| [cpf-01-convert-command](completed/cpf-01-convert-command.md) | `convertElement` command and editor facade methods |
| [cpf-02-participant-export](completed/cpf-02-participant-export.md) | Participant notation, SVG export and `types` |
| [cpf-03-ddl-frame-scope](completed/cpf-03-ddl-frame-scope.md) | DDL scope resolver and `frame-straddle` rule module |
| [cpf-04-edit-convert-op](completed/cpf-04-edit-convert-op.md) | `convert` op, `delete` `reconnectTo` and report |
| [cpf-05-desktop-reconcile](completed/cpf-05-desktop-reconcile.md) | Conversion checks in `planOutsideChange` |
| [cpf-06-wiring](completed/cpf-06-wiring.md) | Core exports, lint hook, help, docs and README |
| [cpf-07-canvas-view](completed/cpf-07-canvas-view.md) | Canvas participant view |
| [cpf-08-native-parity](completed/cpf-08-native-parity.md) | Native parity tests and CPU timing |

CLI layout, merge and lint (sessions 725, 731, 732, 736, 737 and 740;
design: `design-docs/specs/design-cli-layout-merge-lint.md`; no GitHub
issue). The work added `arrange --mode layered|route`, the `merge` command
and Git merge driver, `lint --fix` and `lint --metrics`, the edit selectors
`name:<text>`, `where`, `expect` and `select`, `carryMembers`, global
`--quiet`, warning collapse, and page-scoped edit performance. Integration
review accepted the combined tree. The final gate logs record `mise run
verify` 3167 pass, 43 skip, 0 fail; `mise run test-cli` 289 pass, 0 fail;
and native parity 20 pass, 0 fail. Native marginal
ratios against the pre-change binary are batch 1.0000 and mixed 1.0303, and
the 120-unit layered median is 1.93x the 60-unit median. There is no browser
E2E suite. Owner question Q11 in `design-docs/user-qa/cli-layout-merge-lint.md`
stays open and non-blocking: the current depth-one behavior is kept and
documented, and E2 is not reported as fully met for its conflict inputs. An
answer that changes depth-one behavior needs a new plan. Warnings from the
Gerber, PCB and breadboard commands still print one per line. Progress logs
stay in `progress/`. Evidence: `tmp/clm-s740/<planId>/`.

| Plan | Scope |
|---|---|
| [clm-00-overview](completed/clm-00-overview.md) | Waves, ownership and continuation history |
| [clm-01-merge](completed/clm-01-merge.md) | Three-way merge engine and `merge` command |
| [clm-02-connector-edit-perf](completed/clm-02-connector-edit-perf.md) | Connector fields and page-scoped edit performance |
| [clm-03-lint-core](completed/clm-03-lint-core.md) | Core diagram lint rules |
| [clm-04-edit-usability](completed/clm-04-edit-usability.md) | Edit usability additions |
| [clm-06-route-arrange](completed/clm-06-route-arrange.md) | `arrange --mode route` and lint metrics |
| [clm-07-layered-core](completed/clm-07-layered-core.md) | Layered arrange core |
| [clm-08-lint-cli](completed/clm-08-lint-cli.md) | Diagram lint CLI |
| [clm-09-wiring](completed/clm-09-wiring.md) | Final gates, native timing and warning collapse repair |
| [clm-09a-help-docs](completed/clm-09a-help-docs.md) | Full help and documentation |
| [clm-09b-cli-tests](completed/clm-09b-cli-tests.md) | CLI-level and Git merge driver tests |
| [clm-09c-native-parity](completed/clm-09c-native-parity.md) | Native parity tests |
| [clm-10-layered-fixes](completed/clm-10-layered-fixes.md) | Layered title band, frame ranks and ERD support |
| [clm-11-container-carry](completed/clm-11-container-carry.md) | `carryMembers` per container kind |
| [clm-12-bpmn-layered](completed/clm-12-bpmn-layered.md) | BPMN layered arrange |
| [clm-13-edit-selectors](completed/clm-13-edit-selectors.md) | Edit selectors |
| [clm-14-lint-image-path](completed/clm-14-lint-image-path.md) | Lint image path normalization |
| [clm-15-bun-test-jsx](completed/clm-15-bun-test-jsx.md) | `bun test` JSX load fix |

Source module split (sessions 575, 579, 583, 589 and 598; design:
`design-docs/specs/design-source-module-split.md`; no GitHub issue). The
work split `packages/core/src/editor.ts`, `apps/cli/src/edit-command.ts`
and `apps/cli/src/native-parity.test.ts` into modules named for their
responsibility, with no behavior change. `editor.ts` is now 267 lines over
the `editor/facade/` chain, `edit-command.ts` is 156 lines over `edit/` and
`edit/operations/`, and the 17 native parity blocks live in
`apps/cli/src/native-parity/` (`harness.ts` plus documents, drawing,
export, pcb and text-layout topic files). No file in these areas exceeds
700 lines. sms-01 (9ef8639) passed both independent reviews in session
589. sms-02 (99df8d4) and sms-03 passed their test-integrity and
adversarial reviews and the serial integration review in session 598;
sms-02 needed no repair. Final gates on the combined tree, each inside the
three-attempt load-tolerant loop: `mise run verify` 2956 pass, 25 skip,
0 fail; `mise run test-cli` 183 pass, 0 fail, no skip; CPU time within
1.15x of nodetto-cli 0.8.5 (ratio 0.967). Parity blocks were counted and
their names compared with 99df8d4 statically. The five dispatch manifests
are in `completed/` with their pre-archive `active/` `planPath` values:
`source-module-split-s575-dispatch.json` was never dispatched,
`source-module-split-s579-dispatch.json` stopped on a provider error,
`source-module-split-s583-dispatch.json` stopped on load-bound test-cli
timeouts, `source-module-split-s589-dispatch.json` stopped on the
zero-test collection check after sms-01 passed review and sms-02 was
implemented, and `source-module-split-s598-dispatch.json` is the final
dispatch. Progress logs stay in `progress/`. Evidence:
`tmp/source-module-split-s598/<planId>/final/`.

| Plan | Scope |
|---|---|
| [sms-01-editor-facade](completed/sms-01-editor-facade.md) | `Editor` facade chain in `packages/core/src/editor/facade/` with planners in `editor/*.ts` |
| [sms-02-cli-edit](completed/sms-02-cli-edit.md) | `nodetto-cli edit` split into `edit/batch.ts`, `edit/apply-batch.ts`, `edit/report.ts` and `edit/operations/` |
| [sms-03-native-parity](completed/sms-03-native-parity.md) | Native parity tests split into `apps/cli/src/native-parity/` topic files |

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

## Slide area and copy shapes (sac-s826 / sac-s830)

Slide sizing, editing overlay and copying shapes between pages. Verification logs: `tmp/sac-s830/sac-08-wiring/final/`. Dispatch manifests remain in `active/`; the archive node moves the plans.

| Plan | Scope |
| --- | --- |
| [sac-00-overview](completed/sac-00-overview.md) | overview |
| [sac-01-slide-data](completed/sac-01-slide-data.md) | slide data |
| [sac-02-copy-shapes-core](completed/sac-02-copy-shapes-core.md) | copy shapes core |
| [sac-03-slide-rect-core](completed/sac-03-slide-rect-core.md) | slide rect core |
| [sac-04-slide-collab-duplicate](completed/sac-04-slide-collab-duplicate.md) | slide collab duplicate |
| [sac-05-cli-copy-shapes](completed/sac-05-cli-copy-shapes.md) | cli copy shapes |
| [sac-06-slide-area-overlay](completed/sac-06-slide-area-overlay.md) | slide area overlay |
| [sac-07-settings-and-picker-ui](completed/sac-07-settings-and-picker-ui.md) | settings and picker ui |
| [sac-08-wiring](completed/sac-08-wiring.md) | wiring |

## Pages list (pgl-s835)

Collapsible Pages list in the desktop left pane, with shared page actions
extracted from the tab menu. Design:
[design-page-list](../design-docs/specs/design-page-list.md). Verification
logs: `tmp/pgl-s835/reconcile-wave-005/`. The dispatch manifest
[pgl-s835-dispatch.json](active/pgl-s835-dispatch.json) remains in `active/`;
the archive node moves the plans.

| Plan | Scope |
| --- | --- |
| [pgl-01-page-actions](completed/pgl-01-page-actions.md) | shared page actions |
| [pgl-02-page-list](completed/pgl-02-page-list.md) | PageList component and DOM tests |
| [pgl-03-wiring](completed/pgl-03-wiring.md) | preference, App wiring, docs |

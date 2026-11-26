# schematic-00-overview

- Design (source of truth): `design-docs/specs/design-schematic.md`
  revision 12 (revision 8 accepted by Step 3, comm-022747; revisions 9-12
  answer continuation-run reviews up to comm-000004). Section numbers below
  refer to it.
- Issue: workflowInput opus-terra-design-and-implement-review-loop-session-933
  (no GitHub issue). Branch `feat/schematic-mode`, never pushed.
- User problem: add a `schematic` page kind (circuit diagrams) with symbols,
  orthogonal wires, junctions, net labels, connectivity, ERC, netlist export,
  KiCad import and breadboard/PCB parity, usable from the desktop editor, the
  SVG/PNG export and the Bun and native CLI.
- Evidence root: `tmp/schematic-s933/<planId>/` (outside the artifact roots
  `target` and `tmp/cad3d`). Never leave `*.test.ts` files under `target/` or
  `tmp/`.

## Continuation run (opus-terra-design-and-implement-review-loop-session-1)

- Done (confirm-only): 01-34, 36-38, 40, 43, 44. Their code is in the working
  tree. Implementers run the plan's own gate in the foreground, record exit
  codes and log paths in the progress log, and edit no source file. An empty
  checkpoint commit is expected.
- Plan 35: confirm-only as well, plus the progress-log refresh in its
  "Continuation status" section (SERIAL-W9-PLAN35-REDISPATCH).
- To implement: 47 -> 39 -> 41 -> 46 -> 45 (strict chain on core
  `shapes/schematic.ts` and ui-solid `circuit.ts`, `interaction.ts`,
  `interaction/types.ts`), and 42 (independent, after 34, 35 and 37).
- Never restart, revert or rewrite existing work.

## Plans and waves

Plans run in parallel only when their `writePaths` are disjoint. Plans that
edit the same file are chained with `dependsOn`.

| wave | plans (dependsOn) |
|---|---|
| 1 | 01 ir-semantics (-), 06 io-kicad-netlist-linear (-), 07 io-kicad-diagonal-lookup (-) |
| 2 | 02 ir-registry (01), 03 ir-coordinate (01), 08 core-symbols (01) |
| 3 | 04 ir-sweep-netlist-model (01,03), 05 ir-range-golden (02), 09 core-coordinates-snap (03,08), 10 core-shape-utils (08), 14 io-skip-collab (02), 19 core-notation (08) |
| 4 | 11 core-transform-extraction (08,09), 12 io-formatters (04), 15 io-kicad-schematic-contacts (04,06,07), 17 core-move-contract (02,09), 18 core-connectivity (04,08,09), 24 core-svg-export (19) |
| 5 | 13 io-breadboard-target (12), 16 core-editor-intents (02,11), 20 io-kicad-schematic-labels (15), 21 core-netlist-names (18), 22 core-erc (18), 23 core-connectivity-roundtrip (05,11,17,18) |
| 6 | 25 core-import-layout (02,21), 26 core-breadboard-target-intent (13,16,21), 27 core-pcb-parity (21) |
| 7 | 28 core-exports (10,16,17,22,23,24,25,26,27) |
| 8 | 29 core-tools-catalogue (28), 30 cli-move-absolute (28), 31 ui-shape-view (28), 32 ui-inspector (28), 33 cli-lint-types (28), 34 ui-export-dialog (13,28), 37 ui-problems-panel (13,28), 40 example-goldens (13,28) |
| 9 | 35 ui-workspace-palette (29), 36 ui-creation (29), 38 cli-schematic-command (13,20,33), 47 core-snap-exclude (09,10,28) |
| 10 | 39 ui-wire-tool (36,47), 42 desktop (34,35,37), 43 docs-readme (38), 44 native-parity (38,40) |
| 11 | 41 ui-keys-drag (39) |
| 12 | 46 ui-wire-point-edit (41) |
| 13 | 45 ui-wire-overlay (39,41,46) |

The exact `dependsOn` of each plan is in its own file and in the dispatch
manifest; the table is the earliest wave each plan can start.

## Shared files and their single owner chain

- `packages/ir/src/index.ts`: 01 -> 03 -> 04.
- `packages/io/src/kicad/index.ts`: 06 -> 15.
- `packages/io/src/kicad/schematic.ts`, `schematic.test.ts`: 15 -> 20.
- `packages/io/src/schematic/index.ts`: 12 -> 13.
- `packages/core/src/editor/facade/notation-editing.ts`: 16 -> 26.
- `packages/core/src/index.ts`: 28 -> 29.
- `packages/ui-solid/src/interaction/circuit.ts`: 39 -> 41 -> 46 (45 no
  longer edits it; revision 9 of the design, comm-000048).
- `packages/ui-solid/src/interaction/creation.ts`: 36 only (39 routes the
  wire tool from `pointer.ts` instead).
- `packages/ui-solid/src/interaction/pointer.ts`: 39 only (one branch passing
  `event.shiftKey`).
- `packages/ui-solid/src/interaction/lifecycle.ts`: 46 only.
- `packages/core/src/shapes/schematic.ts`, `schematic.test.ts`: 10 -> 47
  (optional excluded id, target key and `schematicContactsAt`; design
  revisions 10 and 12, comm-000050 and comm-000004).
- `packages/core/src/schematic/coordinates.ts`: 09 -> 47 (`keyCoordinate`,
  `localCoordinateForKey`); `packages/core/src/schematic/index.ts`: 28 -> 47.
- `packages/ui-solid/src/interaction/context.ts`: 36 only (the wire draft
  reuses the existing `state.wirePoints` and `ctx.wireDraft`).
- `packages/ui-solid/src/interaction.ts`, `packages/ui-solid/src/interaction/types.ts`:
  39 -> 46 (39 exposes `schematicWireNotice`, 46 exposes
  `nudgeSchematicWirePoint`, one field each). Plan 39 runs in wave 10 with
  42, 43 and 44, none of which touch them.
- `packages/ui-solid/src/Canvas.tsx`: 45 only.
- `apps/cli/src/types-command.ts`: 01 only (`TYPICAL` entry).
- `apps/cli/src/commands.ts`: 33 -> 38.
- `apps/cli/src/help.ts`: 38 only.
- `packages/ui-solid/src/index.ts`: 37 only.
- `README.md`: 43 only.

Every successor on a chained file reruns the earlier owners' tests in its
gate (rule from comm-022749 SCH-PLAN-003).

## Per-worker protocol (all plans)

1. Before each file edit: fresh read and pre-hash (`shasum -a 256`). After
   the edit: post-hash. Record both in the progress log. Before finishing,
   re-hash every owned file; if a hash differs from your last post-hash,
   another worker changed it: re-read, re-apply your intent, log the drift.
2. Before the first edit of a file, write a one-paragraph intent snapshot to
   `tmp/schematic-s933/<planId>/edit-<nnn>-intent.md` (file, change, reason).
   Never modify it afterwards.
3. Edit only your own progress log `impl-plans/progress/<planId>.md` with
   sections: Start (UTC), Files (path, pre-hash, post-hash), Commands (exact
   command, exit code, pass/fail counts, log path), Drift, Sibling
   diagnostics (non-blocking), Open issues, Done checklist (each done
   criterion with evidence).
4. Foreground commands only. Keep each verification command's exit status
   and write its full output to `tmp/schematic-s933/<planId>/<name>.log`.
5. No git write operations (`add`, `commit`, `stash`, `checkout`, ...).
6. Format and lint only owned files: `bunx biome check --write <files>`
   then `bunx biome check <files>` must exit 0. No repo-wide formatter.
   Rust files are not touched by any plan.
7. Per-plan gates are the focused `bun test <paths>` listed in the plan.
   Never run `bun run typecheck`, `bun run lint` or `mise run verify` as a
   plan gate. At most two `bun test` or `cargo` processes at once across
   workers.
8. A timing or deadline test that fails in a gate but passes alone counts as
   passing: record both logs.

## Global invariants (every plan)

- Additive only: `SCHEMA_VERSION` stays 1; existing page kinds, element
  types, file formats and tests of other modes are unchanged and passing.
  Existing breadboard, PCB, KiCad import, JSONL canonical tests keep their
  results.
- `packages/io` never imports `@nodetto/core`; `packages/core/src/pcb`
  imports only itself. No DOM or Node APIs in ir, core or io.
- Indexed reads typed for `noUncheckedIndexedAccess` (handle `undefined`).
- No new dependencies; `bun.lock` unchanged. No emojis. English only.
- Symbols, fixtures, rule texts and names are nodetto's own; nothing copied
  from KiCad, Fritzing or any other project.
- New performance behaviour is asserted with work counters, never
  wall-clock time.
- UI uses existing CSS tokens only (`--nodetto-ink`, `--nodetto-muted`,
  `--nodetto-surface`, `--nodetto-accent`), works in both themes and is
  keyboard reachable.

## Final integration gate (after all plans land; not a plan gate)

1. `bun run typecheck`
2. `bun run lint`
3. `CARGO_TERM_QUIET=true mise run verify`
4. `CARGO_TERM_QUIET=true mise run test-cli`
5. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR="$PWD/target/schematic-native-parity" cargo build --release -p nodetto-cli`
   then
   `NODETTO_CLI_TEST_BINARY="$PWD/target/schematic-native-parity/release/nodetto-cli" bun test apps/cli/src/native-parity`

Each command runs in the foreground; exit status and full log path are
recorded in the integration report.

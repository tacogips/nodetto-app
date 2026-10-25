# Breadboard circuit pages: implementation plan overview

Source of truth: `design-docs/specs/design-breadboard.md` revision 2
(accepted by the Step 3 design review, comm-008869). User decisions with
defaults are in `design-docs/user-qa/breadboard-mode.md`. Q1-Q6 were
accepted by the user. Q7-Q10 proceed with their defaults. Implement every
default.

Issue: no GitHub issue. Workflow input "Circuit breadboard drawing mode
(KiCad/Fritzing-inspired)" (intake comm-008852, resumed by comm-008865),
workflow execution `opus-luna-design-and-implement-review-loop-session-485`.

Branch: `feat/breadboard-mode` only. There are no worktrees, no private
branches and no concurrent git operations by workers. The orchestrator
commits the design and all plans serially before the implementation fanout
starts. `gitPush=false`: never push.

## Status (session-490)

- Plans breadboard-01 .. breadboard-18 are COMPLETE. The session-490 serial
  integration review (comm-009184) accepted all 18 on the combined tree.
  In Step 8 they are requested for archival to
  `impl-plans/completed/<planId>.md`; see `impl-plans/README.md`.
- This overview stays in `impl-plans/active/` because its "Final
  verification" block is not fully green. On the combined tree:
  `mise exec -- bun run typecheck` exit 0;
  `mise exec -- bun test --path-ignore-patterns 'tmp/**'` exit 0 (2501 pass,
  18 skip, 0 fail); `CARGO_TERM_QUIET=true mise run lint` exit 0;
  `CARGO_TERM_QUIET=true mise exec -- cargo test --workspace` exit 0;
  `CARGO_TERM_QUIET=true mise run verify` exit 1
  (`tmp/breadboard-mode-s485/reconcile-s490/mise-verify.log`).
- Remaining evidence (RECON-S490-W1-VERIFY-TMP-SCRATCH): the verify failure
  comes from the git-ignored scratch copies
  `tmp/breadboard-mode-s485/breadboard-05-collab/pre-edit-03.breadboard.test.ts`
  and `pre-edit-06.breadboard.test.ts`, which `bun test` collects. The
  orchestrator relocates them outside the test roots, reruns
  `CARGO_TERM_QUIET=true mise run verify` to exit 0 and the CLI example and
  ASCII gates below, and then archives this overview.

## User intent (one paragraph)

nodetto users lay out solderless-breadboard prototypes on a `breadboard`
page. They place a board, insert original-artwork parts into its 0.1 inch
holes, run coloured jumper wires and get KiCad-style checks: nets, net
highlight, annotation and ERC. They export a BOM, a KiCad-style netlist and
a SPICE netlist. They import a KiCad schematic or netlist as a target, then
build the board against it with a live ratsnest, schematic-parity rules and
cross-probing. Everything is original. Nothing is copied from KiCad,
Fritzing or any GPL or CC-BY-SA source.

## Plans and waves

| wave | planId | dependsOn | design sections |
|---|---|---|---|
| 1 | breadboard-01-ir-contract | none | 3.1-3.6 |
| 2 | breadboard-02-core-foundation | 01 | 3.3, 3.4, 4.1, 3.2 (target lookup), 6 (rule ids), 5.3 (types) |
| 2 | breadboard-03-io-formatters | 01 | 8.1-8.5 |
| 2 | breadboard-04-io-kicad | 01 | 8.6.1-8.6.4, 11 (fixtures) |
| 2 | breadboard-05-collab | 01 | 8.5 (collab) |
| 2 | breadboard-15-ui-export-dialog | 01 | 10 (ExportDialog); checkpoint amendment 2: owns the mise.toml bun pin |
| 3 | breadboard-06-core-editing | 02 | 4.2-4.4, 7.4, 5.2 (probe state) |
| 3 | breadboard-07-core-connectivity-erc | 02 | 5.1, 5.2, 6 |
| 3 | breadboard-09-core-import-layout | 02 | 8.6.5 |
| 4 | breadboard-08-core-notation-svg | 02, 06 | 7.1, 7.3 |
| 4 | breadboard-10-core-ratsnest-parity | 07 | 5.3, 6.1 |
| 5 | breadboard-11-ui-shape-views | 08, 15 | 7.1 (canvas) |
| 5 | breadboard-12-ui-canvas-interaction | 06, 07, 10, 15 | 7.2 (workspace, palette, wire tool, keys), 5.2, 5.3 (overlays) |
| 5 | breadboard-14-ui-problems | 06, 07, 10, 15 | 7.2 (problems panel), 7.5 |
| 5 | breadboard-16-cli | 03, 04, 07, 09, 10 | 9 |
| 6 | breadboard-13-ui-inspector | 06, 07, 10, 14 | 7.2 (inspector), 7.5 |
| 6 | breadboard-18-example-docs | 03, 04, 07, 08, 09, 10, 16 | 11 (example, golden, docs), README |
| 7 | breadboard-17-desktop | 04, 09, 12, 13, 14, 15 | 10, 7.2 (page following) |

Plan 17 is alone in wave 7 because it passes the Inspector `viewport`
prop that plan 13 adds in wave 6.

Plan files were `impl-plans/active/<planId>.md` at dispatch; plans 01-18
are now archived as `impl-plans/completed/<planId>.md`. The workflow's
`plan-archive` node moves them after final verification. Workers never move
plan files.

Mapping to design section 12 slices:
- slice 1 = 01
- slice 2 = 02 + 06
- slice 3 = 07
- slice 4 = 08
- slice 5 = 03 + 05
- slice 6 = 04
- slice 7 = 09 + 10
- slice 8 = 11, 12, 13, 14, 15
- slice 9 = 16
- slice 10 = 17
- slice 11 = 18

Cross-package tests (example golden outputs, KiCad round trip, docs rule
table) live in `packages/core` (plan 18). Only core can import both core
and io (it dev-depends on `@nodetto/io`), as `packages/core/src/bpmn/docs-example.test.ts`
does.

## Pinned cross-plan contracts (summary; each owning plan has the full shape)

- 01: `PAGE_KINDS` gains `"breadboard"`. `semantics.ts` gets the 13 types,
  their semantic interfaces, `BREADBOARD_ELEMENT_TYPES`,
  `BREADBOARD_PART_TYPES`, `isBreadboardElementType`,
  `isBreadboardPartType`, `BREADBOARD_REFERENCE_PREFIX`, the enum arrays and
  `BREADBOARD_PITCH = 10`. `packages/ir/src/breadboard.ts` gets
  `parseComponentValue`, `BreadboardNetlist`, `BreadboardImportDiagnostic`,
  `BreadboardImportPlan` and `BreadboardImportResult`.
- 02: `packages/core/src/breadboard/` with `catalogue.ts`
  (`breadboardCatalogue`, `breadboardPins`, `breadboardBox`,
  `breadboardBondGroups`, `breadboardPartName`, `breadboardDescription`,
  `breadboardFootprint`), `board.ts` (`boardLayout`, `boardHoles`), and
  `types.ts`. `types.ts` pins `BreadboardPinRef`, `BreadboardConnectivity`,
  `BreadboardErcRuleId`, `BREADBOARD_ERC_RULE_IDS` (13),
  `BreadboardErcFinding`, `RatsnestLine`, `BreadboardProbe` and
  `breadboardTargetNetlist`.
- 06: Editor methods `createBreadboardPart`, `rotateBreadboardParts`,
  `updateBreadboardSemantic`, `annotateBreadboard`, the probe state
  `breadboardProbe()`/`setBreadboardProbe()`, `snapBreadboardDelta`,
  `snapBreadboardPoint` and `breadboardPinAt`.
- 07: `computeBreadboardConnectivity`, `toBreadboardNetlist`,
  `breadboardNetHighlight`, `breadboardNetMembers`, `lintBreadboardPage`
  and the test helper `breadboard/test-builder.ts`.
- 08: `breadboardNotation`, `resistorBands` and the SVG export branch.
- 09: `layoutBreadboardImport`.
- 10: `computeBreadboardRatsnest`, `breadboardParityFindings` (called from
  `lintBreadboardPage`) and `breadboardTargetStatus`.
- 03: `exportBreadboardBomCsv`, `exportBreadboardKicadNetlist`,
  `exportBreadboardSpiceNetlist`, each `(netlist) => {text, warnings}`.
- 04: `importKicad(text, {fileName}) => BreadboardImportResult`, exported
  from `@nodetto/io` and `@nodetto/io/kicad`.
- 14: `focusBreadboardProbe`, `breadboardProblemRows` and
  `BreadboardProblemsPanel` (exported from `@nodetto/ui-solid`).
- 15: `ExportDialogProps.exportBreadboard?: (kind: BreadboardExportKind) => Promise<void>`.
- 13: `InspectorProps.viewport?: () => ViewportSize`.
- 12: `WorkspaceId` gains `"breadboard"`.

## Fixed example topology (plans 04, 09, 18 rely on it)

The example `examples/breadboard/led-button.jsonl` (plan 18) and the KiCad
fixtures `test-fixtures/kicad/led-button.kicad_sch` and `.net` (plan 04)
describe the same circuit with the same references and values:
- BT1 battery `5V`: pin 1 `+` on net VCC, pin 2 `-` on net GND
- SW1 push button `PUSH`: nodetto pin 1 on VCC, pin 3 on the switch-output
  net. In KiCad `SW_Push` terms these are pin 1 and pin 2.
- R1 resistor `220`: pin 1 on the switch-output net, pin 2 on the LED-anode
  net
- D1 LED `red`: pin 1 `A` on the LED-anode net, pin 2 `K` on GND. In the
  KiCad fixture, the `LED` symbol names its pins `K` (number 1) and `A`
  (number 2), so name-based mapping is exercised.

Expected nodetto net names for the example page (design 5.1): `GND`, `VCC`,
`N_D1_1` (D1.1, R1.2) and `N_R1_1` (R1.1, SW1.3). Component order is BT1,
D1, R1, SW1.

## Shared files and ownership rules

Shared barrel files take append-only lines. Protocol for every edit:
1. Re-read the file immediately before editing and record its sha256
   (`shasum -a 256 <file>`) as the pre-hash.
2. Append only your own lines at the end, or at the plan-stated anchor.
3. Record the post-hash.
4. Never reorder or delete another plan's line. If the content differs from
   what you expected, re-read and append again. Never overwrite from a
   stale copy.

| shared path | created/first edited by | later appenders |
|---|---|---|
| packages/core/src/index.ts | 02 (one line `export * from "./breadboard/index.ts";`) | none |
| packages/core/src/breadboard/index.ts | 02 (creates it with its own lines) | wave 3: 06, 07, 09; wave 4: 08, 10 (each appends only its own `export * from "./<module>.ts";` lines) |
| packages/io/src/index.ts | none before | 03 and 04 (each appends one export block) |
| packages/core/src/breadboard/erc.ts | 07 (owner) | 10 adds exactly one call to `breadboardParityFindings` inside `lintBreadboardPage` (wave 4, after 07 is joined) |

Every other path has exactly one owning plan (its writePaths). Do not edit
files outside your writePaths and sharedPaths. If you believe another file
must change, stop, record it under Open issues in your progress log and do
not edit it. The orchestrator re-assigns it serially.

## Test ownership contract (design 11.1)

1. Every plan owns at least one bun test file and lists a focused
   `bun test <owned files>` command that must show a positive pass count
   and 0 failures. Shell, grep and cargo checks do not count toward this.
2. Pinned-list tests and fixtures have exactly one owner:

| existing test / fixture | owner | action |
|---|---|---|
| packages/ir/src/registry.test.ts | 01 | add the 13 `breadboard.*` types to the expected list |
| packages/io/src/jsonl/golden.test.ts and new packages/io/src/__fixtures__/breadboard.jsonl | 01 | append `"breadboard"` to `GOLDEN` and add the canonical file |
| packages/collab/src/test-fixtures.ts (`allFixtures()`, looped by ydoc.test.ts with no count) | 05 | add a breadboard fixture |
| packages/ui-solid/src/workspaces.test.ts, interaction.test.ts, Toolbar.test.ts, viewer-actions.test.ts | none (12 must keep them unedited) | if one fails because it pins a list, stop and record it |
| apps/cli/src/commands.test.ts, mcp*.test.ts, native-parity.test.ts | none (16 must keep them unedited) | MCP derives from `COMMAND_HELP`; native parity picks the new fixture up automatically and is skipped without a binary |
| apps/desktop/src/file/session.test.ts | 17 | add KiCad open cases |
| apps/desktop/src-tauri/src/dialogs.rs tests | 17 | add `open_filter_includes_kicad` |

A worker that finds another failing pinned-list test stops, records it
under Open issues and does not edit it.

### ASCII gates (no emojis, no non-ASCII bytes)

Use perl, which ships with macOS. Do not use the `grep` bracket-class
form: on macOS it does not flag bytes above 0x7F. Pre-existing files such
as `packages/ir/src/semantics.ts`, `types.ts`, `README.md` and
`apps/cli/src/native-parity.test.ts` already contain non-ASCII text. So
the gates cover only new files and the lines a plan adds, and no plan
edits pre-existing non-ASCII text.

1. New files (list every new file or new directory the plan owns):
   `find <new paths> -type f -print0 | xargs -0 perl -ne 'if (/[^\x00-\x7F]/) { print "$ARGV:$.\n"; $bad = 1 } close ARGV if eof; END { exit($bad ? 1 : 0) }'`
   exits 0 with no output when clean.
2. Modified tracked files (list every modified file the plan owns):
   `git diff -U0 -- <modified files> | perl -ne 'if (/^\+(?!\+\+)/ && /[^\x00-\x7F]/) { print; $bad = 1 } END { exit($bad ? 1 : 0) }'`
   exits 0 with no output when clean.

Self-test before relying on a gate: `printf '+a\xc2\xb5\n' | perl -ne 'if (/^\+(?!\+\+)/ && /[^\x00-\x7F]/) { print; $bad = 1 } END { exit($bad ? 1 : 0) }'`
must exit 1. Record the result once in your progress log. Plans 01, 02,
04 and 18 spell the gates out in their Verification blocks. Every other
plan runs gate 1 over its new writePaths and gate 2 over its modified
writePaths and sharedPaths, and records both exit codes. Both must be 0. In source code,
write non-ASCII characters only as escapes.

## Parallel-wave gates (apply to every plan)

Evidence root: `tmp/breadboard-mode-s485/<planId>/`. It is local and
untracked. Create it with `mkdir -p`.

Gate G1, owner-scoped typecheck:
1. Run `bun run typecheck > tmp/breadboard-mode-s485/<planId>/typecheck.log 2>&1`
   and record the exit code.
2. Run `grep -E '<ownRegex>' tmp/breadboard-mode-s485/<planId>/typecheck.log`
   with the plan's `ownRegex`. It must print nothing. Any match blocks the
   plan.
3. A line that starts with `error TS` with no file blocks the plan.
4. List every other diagnostic in the progress log under "Sibling
   diagnostics (non-blocking)" with its path and TS code. It is
   non-blocking only when it is in a file owned by another plan of the same
   or a later wave and does not name a symbol you added, removed or
   changed. Otherwise it is yours and it blocks.
5. In a shared barrel, a diagnostic on an `export * from` line belongs to
   the plan that appended that line.

Gate G2, owner-scoped tests:
1. The focused owned `bun test <owned files>` line must exit 0 with a
   positive pass count and 0 failures. No exception.
2. Run every broader `bun test ...` line as
   `bun test ... > tmp/breadboard-mode-s485/<planId>/<name>.log 2>&1` and
   record its exit code and pass/fail counts.
3. A failing test file in your writePaths blocks. A failing file owned by
   no plan blocks when your change causes the failure. Record any other
   failing file under "Sibling test failures (non-blocking)".

The orchestrator's serial reconciliation after every wave join runs
whole-repo `bun run typecheck`, `bunx biome check .` and `bun test`. These
are strictly blocking there, and failures are routed to the owning plan.

## Per-worker protocol (all plans)

1. Before each file edit: fresh read and pre-hash. After the edit:
   post-hash. Record both in the progress log. Before finishing, re-hash
   every file you own. If a hash differs from your last post-hash, someone
   else changed it: re-read, re-apply your intent and log the drift.
2. Before the first edit of a file, write a one-paragraph intent snapshot
   to `tmp/breadboard-mode-s485/<planId>/edit-<nnn>-intent.md`: the file,
   what you will change and why. It must not be modified afterwards.
3. Each worker edits only its own progress log,
   `impl-plans/progress/<planId>.md`, with these sections:
   - Start (UTC time)
   - Files (path, pre-hash, post-hash)
   - Commands (exact command, exit code, test pass/fail counts, log path)
   - Drift
   - Sibling diagnostics (non-blocking)
   - Sibling test failures (non-blocking)
   - Open issues
   - Done checklist (each done criterion with evidence)
4. Run foreground commands only: no `&`, `nohup`, watchers or dev servers.
   Keep the final exit status of every verification command.
5. Do not run `git add`, `git commit`, `git stash`, `git checkout` or any
   other git write operation. `.reference/` is git-ignored and must never
   be read into fixtures, copied or committed.
6. Do not run repo-wide formatters. Format only your own files with
   `bunx biome check --write <your files>`. Rust is formatted only by plan
   17, with
   `CARGO_TERM_QUIET=true cargo fmt --manifest-path apps/desktop/src-tauri/Cargo.toml`.

## Global invariants (every plan)

- Existing page kinds, element types, fixtures and tests stay unchanged and
  passing. `SCHEMA_VERSION` stays 1 and no migration is registered.
- No new npm or cargo dependencies. `bun.lock` must not change. The
  `@nodetto/io` package.json `exports` edit (plan 04) does not touch the
  lockfile.
- License boundary (design 1): no code, comments, keyword tables, symbols,
  footprints, demos, QA files, artwork, rule wording or samples from
  KiCad, Fritzing or any GPL or CC-BY-SA source. `.reference/kicad` may be
  read for behaviour only. Every fixture is hand-written.
- No emojis anywhere. Strict TypeScript: no `any`, no `@ts-ignore`, no
  non-null assertions on untrusted data. Biome style: 2-space indent,
  double quotes.
- `packages/core/src/breadboard/test-builder.ts` (plan 07) is core-internal
  and is not exported. Tests outside `packages/core` (ui-solid, cli,
  desktop) build documents through Editor intents
  (`createBreadboardPart`, `apply`) or literal elements. They never import
  core source files by relative path.
- Determinism: never iterate a `Set` or `Map` built from unsorted input
  without sorting by element index order or the design's stated order.
- Breadboard behaviour in shared paths (Editor.apply, paste, move gesture,
  App.tsx) runs only behind breadboard type or page-kind guards. BPMN
  behaviour is unchanged.
- Public repo: no server code, auth, secrets, endpoints or deploy config.
- No version bumps, tags, pushes, releases or Homebrew changes.

## Serial reconciliation (orchestrator only, after each wave join)

1. Run whole-repo `bun run typecheck`, `bunx biome check .` and `bun test`,
   strictly blocking. Route failures to the owning plan or repair them
   serially.
2. Check that `packages/core/src/breadboard/index.ts` has every expected
   export line exactly once. Check that `packages/io/src/index.ts` has the
   03 and 04 blocks once.
3. After wave 2, check that `packages/io/package.json` `exports` has
   `./kicad`.
4. After wave 5:
   `bun apps/cli/src/main.ts breadboard import test-fixtures/kicad/led-button.net > /dev/null`
   must exit 0.
5. Commit the wave on branch `feat/breadboard-mode`, staging explicit
   paths only. Never use `git add -A`, and never include `.reference/` or
   `tmp/`.

## Final verification (orchestrator, after wave 7)

```
cd /Users/taco/gits/tacogips/nodetto-app-breadboard
bun run typecheck                                   # exit 0
bun test packages                                   # exit 0, 0 fail
mise run lint                                       # exit 0
bun apps/cli/src/main.ts lint examples/breadboard/led-button.jsonl                 # exit 0, empty stdout
bun apps/cli/src/main.ts breadboard bom examples/breadboard/led-button.jsonl --check examples/breadboard/led-button.bom.csv        # exit 0
bun apps/cli/src/main.ts breadboard netlist examples/breadboard/led-button.jsonl --format kicad --check examples/breadboard/led-button.net   # exit 0
bun apps/cli/src/main.ts breadboard netlist examples/breadboard/led-button.jsonl --format spice --check examples/breadboard/led-button.cir   # exit 0
bun apps/cli/src/main.ts breadboard import test-fixtures/kicad/legacy.sch          # exit 1
CARGO_TERM_QUIET=true mise run verify               # exit 0
# ASCII gate over everything the feature added, after the wave-7 commit:
git diff -U0 main -- packages apps docs examples test-fixtures design-docs impl-plans README.md | perl -ne 'if (/^\+(?!\+\+)/ && /[^\x00-\x7F]/) { print; $bad = 1 } END { exit($bad ? 1 : 0) }'   # exit 0, no output
# plus, for any still-untracked new path:
git ls-files --others --exclude-standard -z -- packages apps docs examples test-fixtures design-docs impl-plans | xargs -0 perl -ne 'if (/[^\x00-\x7F]/) { print "$ARGV:$.\n"; $bad = 1 } close ARGV if eof; END { exit($bad ? 1 : 0) }'   # exit 0, no output
git status --short | grep -c '.reference'          # 0
```

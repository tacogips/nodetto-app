# slc-00-overview: shape lateral consistency

- planId: slc-00-overview (coordination only; no writePaths)
- design (accepted by step3, DR-1 verified fixed):
  `design-docs/specs/design-shape-lateral-consistency.md`; user QA defaults:
  `design-docs/user-qa/shape-lateral-consistency.md` (Q1-Q7, implement the
  defaults)
- session: opus-terra-design-and-implement-review-loop-session-544; issue:
  none (workflowInput only); branch `fix/shape-lateral-consistency`;
  gitPush=false
- scratch root: `tmp/shape-lateral-s544/<planId>/` (git-ignored; never put
  `*.test.ts` files there)
- dispatch manifest: `impl-plans/active/shape-lateral-s544-dispatch.json`

## Intent

A user drew a person as a UML actor on an architecture page and hit four
gaps. Each one applies to every element type or shape:

1. Unknown semantic keys are silently accepted. Fix: a
   `semantic.unknownField` warning, CLI reporting, and a keyOrder audit.
2. There is no stick figure. Fix: geo kind `actor`.
3. draw.io `umlActor` is approximated. Fix: exact import and export, plus
   exact export for UML component, interface and port.
4. `draw.path` contours can only be closed. Fix: open contours
   (`closed: false`).

Read the design before starting. Section numbers below refer to it.

## Waves and ownership

| Wave | Plan | Depends on | Owns (summary) |
| --- | --- | --- | --- |
| 1 | slc-01-ir-drawing-contract | - | `GEO_KINDS` += `actor`, `PathContour.closed`, draw.path validation and keyOrder, `outline.ts` null rules, io round-trip test |
| 1 | slc-02-ir-unknown-field | - | `validate.ts` warning, keyOrder fixes (BPMN, database objects), validate tests, core audit test |
| 2 | slc-03-geo-actor | 01 | `geo-outline.ts` actor, `interface-code.ts`, `tools.ts`, `shape-catalogue.ts`, palette, inspector label, D2 |
| 2 | slc-04-open-path-render | 01 | `compound-path.ts` geometry and hit test, SVG export, canvas `CompoundPathView.tsx`, boolean, PCB and mobile consumers |
| 2 | slc-05-drawio | 01 | draw.io `style.ts`, `export-shape-style.ts`, `export-page.ts`, `drawio.test.ts`, `docs/import-export.md` |
| 3 | slc-06-open-path-edit | 04 | `compound-path-edit.ts` `PathWorldContour` contract, core index export, `compound-path.test.ts`, `CompoundPathHandles.tsx`, `PathSection.tsx` |
| 3 | slc-07-cli-docs | 02, 03 | `edit-command.ts` warnings, `validate --strict`, `help.ts`, `types-command.ts`, CLI test, `docs/cli.md`, `docs/editing.md` |

Why waves:

- Wave 1 pins the IR contracts (the `actor` enum value and the contour
  `closed` key) and the validator.
- Wave 2 plans each need the `GeoKind` `actor` or `PathContour.closed`.
- slc-06 changes the edit API signatures on top of slc-04's geometry, so
  that geometry can accept 2-point open contours first.
- slc-07 tests `edit` warnings (slc-02) and `draw geo:actor` (slc-03).

## Pinned cross-plan contracts

- `packages/ir/src/semantics/drawing.ts` (slc-01):
  - `GEO_KINDS` ends with `"person", "package", "actor"`;
  - `PathContour` is `{ readonly points: readonly FreehandPoint[];
    readonly closed?: boolean }`. Absent or `true` means closed.
- `DRAW_PATH.keyOrder.children.contours.keys` is `["points", "closed"]`
  (slc-01).
- `CompoundPathGeometry` (slc-04) gains `readonly closed: readonly
  boolean[]` (parallel to `contours`) and `readonly openPath: string`.
  `path` holds closed contours only. `contours` keeps its type,
  `readonly (readonly FreehandPoint[])[]`.
- `PathWorldContour` (slc-06, `packages/core/src/compound-path-edit.ts`,
  re-exported from `packages/core/src/index.ts`): `{ readonly points:
  readonly FreehandPoint[]; readonly closed: boolean }`.
- Warning (slc-02):
  - code `semantic.unknownField`, severity `warning`;
  - path `elements[<i>].semantic.<key>`, with nested array indices such as
    `elements[0].semantic.columns[2].x`;
  - message `unknown semantic field for <type>; preserved but ignored by
    this build`.
- `Tool.StickFigure = "geo:actor"` (slc-03). Catalogue label `"Stick
  figure"`, default visual `{ width: 60, height: 110 }`.

## Per-worker protocol (every plan)

1. Before editing a file, read it fresh and record its sha256
   (`shasum -a 256 <path>`) in your progress log. Record it again after the
   edit.
2. Before the first edit, write an intent snapshot (what you will change and
   why) to the progress log.
3. If a file you own changed since your last read, or a file you do not own
   changed in a way that breaks your work, stop and record the drift. Do not
   overwrite another plan's edits. Repair happens serially after the wave
   joins.
4. Edit only your `writePaths`, and your `sharedPaths` exactly as the plan
   allows. No state-changing git commands (`add`, `commit`, `stash`,
   `checkout`, `reset`). Read-only `git diff` and `git status` are fine.
5. No workspace-wide formatters. Format only your own files with
   `bunx biome format --write <files>`.
6. Edit only your own progress log, `impl-plans/progress/<planId>.md`.
   Record each verification command, its exit code, the log path under the
   scratch root, and the important output lines.
7. Run commands in the foreground. No `&` or `nohup`. Do not pipe a
   verification command into `tee` or `head`. Redirect output to a log and
   print `echo "exit=$?"`.
8. Shared-input gates are commands that read files a same-wave sibling may
   be editing: `bunx tsc -p tsconfig.json --noEmit` (repo-wide), and
   `bun test packages/core`, `packages/io`, `packages/ui-solid` or
   `apps/cli/src` beyond your own test files.
   - A run counts as a pass only when every same-wave sibling whose files
     it reads has `STATUS: done` as the last line of its progress log.
   - If a failure traces to a sibling's file, record the error and the
     owning plan. Do not edit that file.
   - If the sibling is still not done when you finish, record the gate as
     `pending-join` with the owner. Serial reconciliation reruns every
     `pending-join` gate after the wave joins.
9. Known transient failures. After wave 1, `GEO_KINDS` contains `actor`
   but `geo-outline.ts` has no actor case until slc-03. So
   `packages/core/src/svg-export.test.ts` ("every geo kind ...
   `<polygon`") and `packages/core/src/shapes/geo-outline.test.ts` ("every
   polygon kind stays inside ...") fail for `actor` until slc-03 is done.
   Record them as `pending-join` owned by slc-03; never fix them elsewhere.
10. When all of your work and checks are complete, write `STATUS: done` as
    the last line of your progress log, and nothing after it.

## Global non-goals (every plan)

- No schema version bump. No change to closed-contour rendering, the
  closed-contour error message, the geo `person` outline, or any existing
  draw.io mapping not listed in design section 3.
- Existing JSONL must serialize byte-identically. No fixture under
  `packages/io/src/__fixtures__` or `examples/` may be edited.
- None of these (user-qa defaults): arrowheads on open paths, an
  open/closed toggle UI, a label band for the stick figure, native-type
  reconstruction on draw.io import, sequence lifeline export.
- No server, auth, secret or deployment code. English only, no emojis. Test
  data uses neutral invented names. Run bun tests with
  `BUN_OPTIONS=--jsx-runtime=classic`; run any cargo command with
  `CARGO_TERM_QUIET=true`.

## Final verification (serial, after wave 3, owned by reconciliation)

- `bunx tsc -p tsconfig.json --noEmit` exits 0.
- `bunx biome check <every file changed by the slc plans>` exits 0.
- `BUN_OPTIONS=--jsx-runtime=classic bun test packages/ir packages/core packages/io apps/cli/src`
  exits 0.
- `BUN_OPTIONS=--jsx-runtime=classic bun test packages/ui-solid` exits 0.
- `BUN_OPTIONS=--jsx-runtime=classic CARGO_TERM_QUIET=true mise run verify`
  exits 0.
- Every `pending-join` gate in any slc progress log is rerun and passes.
- `git diff --quiet -- packages/io/src/__fixtures__ examples` exits 0.
- `git status --short` shows no change outside the union of the plans'
  writePaths and sharedPaths, plus `impl-plans/` and the design docs.
- `impl-plans/README.md` gets a "Shape lateral consistency" entry during
  finalization. This is reconciliation work, not a worker task.

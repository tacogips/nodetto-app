# capture: AI-friendly page capture, overview

- Design: `design-docs/specs/design-ai-capture.md` (revision 4; section 8.5
  is the completion order and file ownership of this overview)
- Base commit of the remaining work: `be8fa5d` on `feat/ai-capture`
- Evidence root: `tmp/capture/<mNN>/` (ignored by git); revision 4 plans
  write to fresh directories named in each plan

## Goal

Ship the slice of design section 2.2: `nodetto-cli capture` and the MCP tool
`nodetto_capture` for every page kind as PNG or JPG, a kernel-free shaded
3D CAD picture with a camera, interference in text and image, deterministic
bytes, the desktop Export dialog entry, and documentation.

## Non-goals

Design sections 2.3 and 2.4, cad3d milestones M18 and M21, and all work in
the private nodetto-cloud repository (design section 14).

## Milestones

Accepted and not redone: M1, M2, M19, M3, M4, M5, M6, M7, M8, M9, M13.
Remaining work, revision 4 (design 8.5). Ids are stable; 21 is skipped so
it is not confused with cad3d M21.

| Stage | Id | Plan | Scope | dependsOn |
| --- | --- | --- | --- | --- |
| Wave 1 | M10 | capture-10-interference | Repair of `be8fa5d`: shared tool views, streamed level 0, total inputs, `tool_view` seam, wave-2 module stubs | - |
| Wave 1 | M20 | capture-20-interference-cli | Request contract, draw-bit rule, default constant, option parser, shared mesh decoder | - |
| Wave 1 | M22 | capture-22-report-text | Report parser for all 6.3 keys, `describeInterference`, `describeBodies`, help part `interference.ts` | - |
| Wave 1 | M15 | capture-15-desktop-ui | Export dialog entry, current view, JPG for 2D artwork (no `App.tsx`) | - |
| Wave 2 | M17 | capture-17-interference-overlay | `overlay.rs` marking and hatch units, `add_view_pairs` | M10 |
| Wave 2 | M18 | capture-18-body-census | `census.rs`, one-body lattice mode, help part `cad.ts` | M10 |
| Wave 2 | M11 | capture-11-mesh-reference | `mesh.rs`, `tool_view` mesh arm, model decoder option | M10, M20 |
| Wave 2 | M12 | capture-12-scale-budget | `tiles.rs` lists, work estimate, `WORK_LIMIT` | M10 |
| Wave 2 | M14 | capture-14-desktop-backend | Tauri command, backend method, handler, `App.tsx` wiring | M15, M20, M22 |
| Wiring | M23 | capture-23-wiring | Picture pass, CLI registration and printing, fixture, render, CLI and native tests | M17, M18, M11, M12, M14, M20, M22 |
| Closing | M16 | capture-16-docs-final | Docs, measured budgets, progress table, final gates | M23 |

## Write ownership

One writer per file per stage; within a stage no file has two writers.
Files written in more than one stage, in stage order:

| File | Writers |
| --- | --- |
| `crates/capture/src/lib.rs` | M10 (module lines), M23 |
| `crates/capture/src/raster.rs`, `report.rs` | M10 (only if the repair needs it), M23 |
| `crates/capture/src/shade.rs` | M23 |
| `crates/capture/src/lattice.rs` | M10, M18, M11 (tool-bounds call sites only, CAP-R4-05) |
| `crates/capture/src/interference.rs` | M10, M17, M11 (tool-bounds call sites only, CAP-R4-05) |
| `crates/capture/src/tool_view.rs` | M10 (new), M11, M23 (picture-family constructor only if needed) |
| `crates/capture/src/overlay.rs`, `census.rs`, `mesh.rs`, `tiles.rs` | M10 (empty stub), then M17, M18, M11, M12; M23 (`mesh.rs` facet seam, CAP-R4-06; `tiles.rs` admission and tile-major layout, CAP-R4-08) |
| `crates/capture/tests/render.rs` | M10 (report assertions), M23 (digest and the three authorised assertions) |
| `packages/core/src/capture/cad-request.ts` and test | M20, M11 (forward `decodeMesh` only) |
| `packages/core/src/capture/scene.ts` and test | M11 |
| `packages/core/src/capture/report.ts`, `describe.ts`, `index.ts` | M22 |
| `apps/cli/src/capture-help/interference.ts` | M22 |
| `apps/cli/src/capture-help/cad.ts` | M18 |
| `packages/io/src/nmesh/index.ts`, `capture-decoder.ts` | M20 |
| `apps/cli/src/capture-command.ts`, `capture-cad.ts`, tests, fixture, `native-parity/capture.test.ts` | M23 |
| `apps/desktop/src/App.tsx` | M14 |
| `apps/desktop/src/shell/export-handlers.ts` | M14, M23 (optional `interference` option only, CAP-R4-07) |
| `apps/desktop/src/shell/export-handlers.test.ts` | M14, M23 (new cases only) |
| `design-docs/specs/design-ai-capture.md`, this overview's progress table | M16 |
| Evidence roots | M23 `tmp/capture` and `target`; M16 `tmp` and `target` (CAP-R4-07) |

Session 883 dispatch: `capture-s883-dispatch.json` (wave 1
capture-23-wiring, wave 2 capture-16-docs-final). The s868 manifest must
not be dispatched again. The plan author edited this ownership table
before dispatch; M16 edits only the progress table.

## Rules for every implementer

- Read the design sections named in the plan first. The design wins over a
  plan; report a disagreement in the progress log and commit message.
- English only, no emojis, strict TypeScript, no `any`. Cargo runs with
  `CARGO_TERM_QUIET=true` and `CARGO_TARGET_DIR=target/capture-<mNN>`.
  Format only the files you own (`rustfmt --edition 2021 <files>`,
  `bunx biome format --write <files>`); never run `cargo fmt --all` or a
  repository-wide format in a wave.
- Write only the paths your plan lists. Before each edit read the file
  fresh; record its `git hash-object` before and after in the progress
  log. If a file changed under you (a sibling, or a hash that differs from
  your last write), stop editing it and record the drift; reconciliation
  is serial after the wave joins. Never use git stash, branches or
  worktrees.
- A typecheck, clippy or test failure located only in a file that a
  same-wave sibling owns is recorded in the progress log and re-run after
  that sibling lands; do not edit the sibling's file.
- `packages/core` and `packages/ir` never import DOM, Worker, Node,
  `@nodetto/io` or `@nodetto/cad-kernel`. Plans that touch `packages/core`
  run the strict index gate.
- Code run in Boa (`packages/core`, `apps/cli/src`, `packages/io`): no regex
  over whole documents, no per-point allocation in geometry loops, no deep
  recursion, bulk typed-array copies.
- `crates/capture`: `#![forbid(unsafe_code)]`; no panic on any input;
  only `+ - * /` and `sqrt` on geometry; no trigonometry, `mul_add`,
  `powf`, `powi`. Dependencies only `png`, `jpeg-encoder`. Tests that
  assert a time or are heavy carry
  `#[cfg_attr(debug_assertions, ignore = "release only")]` and run in a
  `--release` command.
- Third-party projects are references only; own code, own fixtures with
  neutral names (Plate, Block, Puck, Pin, Cover, Bracket). Never use names,
  data or text from user screenshots or issues.
- Never leave a `*.test.ts` under `tmp/`.
- No existing assertion is weakened, no deadline relaxed, unless the plan
  names the exact pre-authorised change. A timing test may be retried up
  to three attempts under load, then run alone; all results are logged.
- Every verification command must exit 0 and run at least one test.
- Progress: each plan appends to the `## Progress` section of its own plan
  file only: date, commands, exit status, log path, hashes, drift.
- Local commits only; no attribution lines; never push or rewrite history.

## Progress

| Milestone | Status |
| --- | --- |
| M1 | accepted |
| M2 | accepted |
| M19 | accepted |
| M3 | accepted |
| M4 | accepted |
| M5 | accepted |
| M6 | accepted |
| M7 | accepted |
| M8 | accepted |
| M9 | accepted |
| M13 | accepted |
| M10 | implemented at `be8fa5d`, repair pending |
| M20 | pending |
| M22 | pending |
| M15 | pending |
| M17 | pending |
| M18 | pending |
| M11 | pending |
| M12 | pending |
| M14 | pending |
| M23 | pending |
| M16 | pending |

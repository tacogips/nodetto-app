# capture: AI-friendly page capture, overview

- Design: `design-docs/specs/design-ai-capture.md` (revision 3)
- Base commit: `ebcac57` on `feat/ai-capture`
- Evidence root: `tmp/capture/<mNN>/` (ignored by git)
- Spike evidence (not committed): `tmp/capture/spike/` (JavaScript and Rust
  prototypes, timing logs, pictures; `r2.log` and `rs/src/bin/r2.rs` for
  revision 2), `tmp/capture/design/` (base check logs)

## Goal

Ship the slice of design section 2.2: `nodetto-cli capture` and the MCP tool
`nodetto_capture` for every page kind as PNG or JPG, a kernel-free shaded
3D CAD picture with a camera, interference in text and image, deterministic
bytes, the desktop Export dialog entry, and documentation.

## Non-goals

Design sections 2.3 and 2.4, cad3d milestones M18 and M21, and all work in
the private nodetto-cloud repository (design section 14).

## Milestones

One implementer session each. Ids are stable across plan revisions, so the
milestones split off in revision 2 carry the ids M17 to M20; the order of
work follows `dependsOn`, not the id.

| Id | Plan | Scope | dependsOn |
| --- | --- | --- | --- |
| M1 | capture-01-base-repair | Make the base pass its own checks (two upstream hunks) | - |
| M2 | capture-02-output-safety | Exclusive image writes, per-user capture directory, digest, in both hosts | M1 |
| M19 | capture-19-core-basics | 2D scale rule and theme token mirror (TypeScript core) | M1 |
| M3 | capture-03-cli-2d-png | `capture` command for 2D pages as PNG, help parts, MCP tool, both hosts | M2, M19 |
| M4 | capture-04-encoders-jpg | Crate `nodetto-capture` with PNG and JPEG encoders, JPG for 2D pages, notices | M3 |
| M5 | capture-05-camera-scene | Camera, kernel-free CAD capture model with the loop rule (TypeScript) | M19 |
| M6 | capture-06-scene-binary | NCS1 writer (TypeScript) and reader (Rust), shared fixtures | M4, M5 |
| M7 | capture-07-ray-intervals | Interval algebra and prism ray evaluation (Rust) | M6 |
| M8 | capture-08-shaded-image | Shaded picture: depth, ids, edges, anti-aliasing, threads | M7 |
| M9 | capture-09-cli-3d | CAD pages in the CLI: request function, camera options, host operation, text, budget | M8 |
| M10 | capture-10-interference | Interference analysis in the crate: stated cell, refinement, ray budget | M8 |
| M20 | capture-20-interference-cli | Interference text, options and exit code in the CLI | M9, M10 |
| M17 | capture-17-interference-overlay | Hatched overlay, agreement of text and picture | M20 |
| M18 | capture-18-body-census | Body states and emptied-body errors | M17 |
| M11 | capture-11-mesh-reference | Imported meshes, open meshes, translucent reference bodies | M18 |
| M12 | capture-12-scale-budget | Per-tile candidates, work limit, large-page budget | M11 |
| M13 | capture-13-mcp | MCP instructions and `--inline` image content in both servers | M3 |
| M14 | capture-14-desktop-backend | Tauri command, export backend method, handler | M11 |
| M15 | capture-15-desktop-ui | Export dialog entry, current view, JPG for 2D artwork | M14 |
| M16 | capture-16-docs-final | Documentation, measured budgets, full verification | M12, M13, M15 |

Pairs that `dependsOn` does not order, and may therefore run side by
side: M2 with M19; M5 with M2, M3, M4 and M13; M4 with M13; M9 with M10;
M12 with M14 and M15; M13 with every milestone after M3 except M16. None
of these pairs has a write path in common; the table below was checked
pair by pair against the `writePaths` of the plans. Every other pair is
ordered.

## Write paths shared by more than one milestone

Every sharing pair is ordered by `dependsOn`.

| File | Milestones, in order |
| --- | --- |
| `apps/cli/native/src/engine.rs`, `engine_tests.rs`, `apps/cli/src/native-engine.ts` | M2, M3, M4, M9 |
| `apps/cli/src/commands.ts` | M2, M3 |
| `apps/cli/src/capture-command.ts` and its test | M3, M4, M9, M20 |
| `apps/cli/src/capture-cad.ts` and its test | M9, M20, M17, M18, M11 |
| `apps/cli/src/native-parity/capture.test.ts` | M3, M4, M9, M20, M17, M18, M11, M12 |
| `apps/cli/src/__fixtures__/capture-plate-default.ncs1` | M9, M20, M17 |
| `apps/cli/src/help.ts` | M3, M13 |
| `apps/cli/src/capture-help/jpg.ts` | M3 (empty part), M4 |
| `apps/cli/src/capture-help/cad.ts` | M3 (empty part), M9, M18, M11 |
| `apps/cli/src/capture-help/interference.ts` | M3 (empty part), M20, M17 |
| `apps/cli/src/capture-help/inline.ts` | M3 (empty part), M13 |
| `packages/core/src/capture/index.ts` | M19, M5, M6, M9, M20 |
| `packages/core/src/capture/scene.ts` and its test | M5, M11 |
| `packages/core/src/capture/cad-request.ts` and its test | M9, M20, M17, M11 |
| `packages/core/src/capture/describe.ts` and its test | M20, M18 |
| `Cargo.toml`, `Cargo.lock` | M4, M14 |
| `crates/capture/src/lib.rs` | M4, M6, M7, M8, M10, M17, M18, M11, M12 |
| `crates/capture/src/raster.rs` | M8, M17, M18, M11, M12 |
| `crates/capture/src/shade.rs` | M8, M17, M11 |
| `crates/capture/src/report.rs` | M8, M10, M18 |
| `crates/capture/src/interference.rs` | M10, M17, M11 |
| `crates/capture/src/lattice.rs` | M10, M18, M11 |
| `crates/capture/tests/render.rs` | M8, M17 |

M13 writes only `apps/cli/src/mcp.ts`, `mcp-image.ts`, their tests,
`apps/cli/native/src/mcp.rs`, `apps/cli/src/help.ts` (the `mcp` page) and
`apps/cli/src/capture-help/inline.ts`; no milestone after M3 other than
M13 writes any of them. M14 and M15 write only desktop and `ui-solid`
files plus `Cargo.lock`; M12 writes only crate files and the native
parity test. M9 writes no crate file and M10 only crate files.

## Rules for every implementer

- Read the design sections named in the plan first. The design wins over a
  plan when they disagree; report the disagreement in the commit message.
- English only, no emojis, strict TypeScript, no `any`. Cargo runs with
  `CARGO_TERM_QUIET=true`. Run `cargo fmt --all` after Rust changes.
- Work only in this worktree. Do not edit `design-docs/specs/design-cad3d.md`
  or any `impl-plans/active/cad3d-*.md`. Do not implement cad3d M18 or M21.
  Write only the paths your plan lists; if another path turns out to be
  necessary, stop and report instead of editing it (the table above is
  what keeps parallel milestones apart).
- `packages/core` and `packages/ir` never import DOM, Worker, Node or
  `@nodetto/cad-kernel` APIs. Every milestone that touches `packages/core`
  runs the strict index gate over the whole packages:
  `mkdir -p tmp/capture/<m>; bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess > tmp/capture/<m>/strict.log 2>&1; ! grep -E "^packages/(core|ir)/src/" tmp/capture/<m>/strict.log | grep -vqE "\.test\.tsx?\("`
  (each plan embeds it in a command that also runs a test).
- Code that the CLI runs in Boa (`packages/core`, `apps/cli/src`): no regex
  split over whole documents, no per-point allocation in loops over
  geometry, no recursion deeper than 64 frames, bulk typed-array copies
  instead of per-number `DataView` calls for geometry. `capture-command.ts`,
  `capture-cad.ts`, `capture-help*.ts` and everything under
  `packages/core` are part of the engine bundle and import no Node API.
- Deterministic arithmetic in `packages/core/src/capture` and
  `crates/capture`: only `+ - * /` and square root on geometry; no
  trigonometry, no `**`, no `mul_add`, no fast-math flags. M5 adds the
  TypeScript test that enforces the `Math` allow-list for the new directory.
- `crates/capture`: `#![forbid(unsafe_code)]`; no panic on any input
  (errors are values); dependencies only `png` and `jpeg-encoder`. Tests
  that assert a time or render more than 4 megapixels, 500 tools or
  100,000 triangles carry `#[cfg_attr(debug_assertions, ignore = "release
  only")]`; the plans run them with `cargo test --release`. M4 sets
  `opt-level = 2` for the crate in the development profile so the other
  tests stay fast in `cargo test --workspace`.
- Third-party projects are references only. Write own code and own
  fixtures with neutral names (Plate, Block, Puck, Pin, Cover, Bracket).
  Licence texts of dependencies are the only third-party files that may
  be copied. Never use names, data or text from user screenshots or issues.
- Never leave a `*.test.ts` file under `tmp/`: `bun test` collects it.
- Pre-authorised test edits are named in each plan with the exact
  permitted change. No other existing assertion is weakened and no
  existing deadline is relaxed; a new deadline that fails is fixed in code.
- Other workflow runs use this machine: a timing failure is re-run once
  alone (`bun test <file> -t "<name>"` or `cargo test <name>`) before it is
  reported, and both results are recorded in the evidence directory.
- Every verification command must exit 0 and runs at least one test.
- One local commit per milestone, no attribution lines, never push, never
  rewrite history.

## Tests with exact lists that this work meets

Found by grepping tests for `COMMAND_HELP`, `OVERVIEW`, the host operation
list, `EXPORT_FORMAT_GROUPS` and the docs at the base commit.

| Test | Effect | Milestone and permitted change |
| --- | --- | --- |
| `apps/cli/src/ai-commands.test.ts:93,471` overview splits into fewer than 40 segments (38 lines today is 39 segments) | a new overview line would fail it | M3: no test change; the overview goes to 37 lines (design 4.4), leaving one line of headroom for the cad3d merge |
| `apps/cli/src/mcp.test.ts:94-113`, `apps/cli/src/mcp-stdio.test.ts:53-71` tool list derived from `COMMAND_HELP` | new tool appears | M3 runs them unchanged |
| `apps/cli/src/help-app-design.test.ts:27` overview contains `compare`; `ai-commands.test.ts:94-101` overview contains `nodetto-cli export` | keep both strings | M3 runs them unchanged |
| `apps/cli/src/ai-commands.test.ts:472-473` no help text contains `Q11` | applies to the new help | M3 |
| `packages/ui-solid/src/export-dialog-document.test.ts:8-20` exact `EXPORT_FORMAT_GROUPS` | new dialog entry | M15: insert `"image3d"` after `"pdf"` in the Artwork ids; nothing else |
| `packages/ui-solid/src/test-dom/cad-mesh.dom.tsx:260-291` STL default and enabled formats on a CAD page | must keep passing | M15 runs it unchanged |
| `apps/desktop/src/styles/theme-tokens.test.ts` (export files read no appearance state, light values pinned) | new files are outside its lists | M19 and M15 run it unchanged |
| `packages/cad-kernel/src/dependency.test.ts:228-230` notices contain the WASM hash | notices gain a section | M4 runs it unchanged |
| Docs substring tests (`apps/cli/src/table-docs.test.ts`, `help-convert-frame.test.ts`, `document-examples.test.ts`, `packages/core/src/bpmn/docs-example.test.ts`) | docs gain a section | M16 runs them unchanged |

M1 and M16 run the whole `bun test` so an unlisted enumeration test is
found there.

## Final verification (M16)

1. `mise run verify`
2. `mise run test-cli` (native parity not skipped)
3. The strict index gate

## Progress

| Milestone | Status |
| --- | --- |
| M1 | accepted |
| M2 | accepted |
| M19 | accepted |
| M3 | accepted |
| M4 | implemented |
| M5 | accepted |
| M6 | pending |
| M7 | pending |
| M8 | pending |
| M9 | pending |
| M10 | pending |
| M20 | pending |
| M17 | pending |
| M18 | pending |
| M11 | pending |
| M12 | pending |
| M13 | implemented |
| M14 | pending |
| M15 | pending |
| M16 | pending |

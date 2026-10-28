# pcb-svg-04-cli-tests

- planId: pcb-svg-04-cli-tests
- planPath: impl-plans/active/pcb-svg-04-cli-tests.md
- wave: 3; dependsOn: pcb-svg-03-svg-renderer
- design: design-docs/specs/design-pcb-svg-export.md sections 1 (export
  paths), 7 (rows "CLI SVG, PNG, PDF" and "Native parity"), 10
- progress log: impl-plans/progress/pcb-svg-04-cli-tests.md
- scratch and logs: tmp/pcb-svg-s538/pcb-svg-04-cli-tests/ (git-ignored)

## Intent

Prove that `nodetto-cli export` (the "render" in the request) produces the
board for a PCB page as SVG, PNG and PDF, and that the native (Boa) CLI
writes the same SVG bytes as the TypeScript CLI. This plan adds tests only.
Production code is owned by plans pcb-svg-01 and pcb-svg-03.

## Repository context

- `apps/cli/src/pcb-commands.test.ts`: builds `fixtureDocument` from
  `test-fixtures/kicad/two-layer.kicad_pcb` (lines 19-29) and has
  `memoryIo` (text map `files`, binary map `binary`). Its page id is
  `"pcb-page-1"`.
- `apps/cli/src/export-command.ts:exportCommand(io, args, backend?)` is
  async and returns `{exitCode, stdout, stderr}`; `runCli` is synchronous
  and is not the entry point for export. Call `exportCommand` directly,
  as `apps/cli/src/export-command.test.ts` does.
- Capturing backend pattern: `export-command.test.ts` test "SVG, PNG and
  PDF export only the selected ERD page" (a `RasterBackend` whose
  `rasterize` pushes the SVG). Real backend pattern: test "real raster
  backends produce a PNG and single-page PDF" (`import * as raster from
  "./raster-backend.ts"`, PNG signature bytes `137 80 78 71 13 10 26 10`,
  `PDFDocument.load` from `pdf-lib`).
- `apps/cli/src/native-parity.test.ts` test "native pcb import and gerber
  match the TypeScript CLI" (line 689): the `both(args)` helper runs the TS
  CLI in `expectedDir` and the native binary in `actualDir` and compares
  exit code, stdout and stderr. These tests run only when
  `NODETTO_CLI_TEST_BINARY` is set (`mise run test-cli`).

## File-level changes

1. `apps/cli/src/pcb-commands.test.ts`: add one `test(...)` block, for
   example "export draws the PCB page as SVG, PNG and PDF". Write
   `serializeDocument(fixtureDocument)` to `board.jsonl` in a fresh
   `memoryIo`. Cases:
   - `exportCommand(io, ["board.jsonl", "--format", "svg"])` -> exit 0;
     stdout contains `data-layer="pcb-board"`, `data-type="pcb.track"`,
     `data-type="pcb.footprint"`, `data-type="pcb.via"`,
     `data-type="pcb.zone"`, `data-type="pcb.graphic"`; does not contain
     `unsupported:`.
   - formats `png` and `pdf` with a capturing `RasterBackend` (`rasterize`
     records the SVG and returns `new Uint8Array([1])`; `pngToPdf` returns
     `new Uint8Array([2])`) and `--output out.<format>` -> exit 0; the
     recorded SVG contains `data-type="pcb.track"` and
     `data-layer="pcb-board"` and no `unsupported:`.
   - real backend (`raster`) with `--format png --scale 1 --output out.png`
     -> exit 0; the first 8 bytes of `io.binary.get("out.png")` are the PNG
     signature. With `--format pdf --output out.pdf` -> exit 0;
     `PDFDocument.load` reports 1 page.
   Add the imports needed (`exportCommand`, `type RasterBackend` from
   `./export-command.ts`, `* as raster` from `./raster-backend.ts`,
   `PDFDocument` from `pdf-lib`). Do not change existing tests or helpers.
2. `apps/cli/src/native-parity.test.ts`, inside the existing test "native
   pcb import and gerber match the TypeScript CLI": after the
   `pcb gerber` call, add
   `both(["export", "board.jsonl", "--format", "svg"])`. `both` already
   compares stdout byte for byte. Also assert that the TS stdout of that
   call contains `data-layer="pcb-board"` (capture it, or rerun the TS
   command with `Bun.spawnSync` in `expectedDir`). Do not add a new
   `nativeTest`, and do not change the other tests.
3. `impl-plans/progress/pcb-svg-04-cli-tests.md` (new): progress log.

## Key points and pitfalls

- `export` needs `--output` for png and pdf; svg without `--output` writes
  to stdout.
- The PCB document must be written as text JSONL with
  `serializeDocument` (already imported in this file).
- The real raster test depends on `@resvg/resvg-js` and `pdf-lib`, which
  are already dependencies of `apps/cli` (used by
  `export-command.test.ts`); do not add dependencies or edit
  `package.json`/`bun.lock`.
- The PCB SVG has no `<text>`, so no font is needed; do not pass
  `--font-dir`.
- Do not edit production files (`export-command.ts`, `commands.ts`,
  `help.ts`) or any core/ui file. If a test fails because of production
  code, record the failing assertion in the progress log and stop.
- If native stdout differs from TS stdout, do not weaken the comparison.
  Save both outputs to the scratch dir, record the first differing offset
  in the progress log, and report it as a finding for plan pcb-svg-03.

## Verification (each must meet the expected result; save full logs in the scratch dir)

- `bun test apps/cli/src/pcb-commands.test.ts` -> all pass, including the
  new test.
- `bun test apps/cli/src/export-command.test.ts` -> all pass (unchanged).
- `CARGO_TERM_QUIET=true mise run test-cli > tmp/pcb-svg-s538/pcb-svg-04-cli-tests/test-cli.log 2>&1; echo $?`
  -> `0`; the log shows "native pcb import and gerber match the TypeScript
  CLI" passing (not skipped).
- `bun run typecheck` -> exit 0.
- `bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess 2>&1 | grep "error TS" | grep -E "apps/cli/src/(pcb-commands|native-parity)\.test\.ts"`
  -> no output.
- `bunx biome check apps/cli/src/pcb-commands.test.ts apps/cli/src/native-parity.test.ts`
  -> no errors.

## Done criteria

- The new CLI test and the extended native parity assertion exist and pass.
- `mise run test-cli` exits 0, with the complete log path recorded in the
  progress log.

## Non-goals

- No desktop test (the desktop PNG/PDF path calls the same
  `Editor.exportPageSvg`; record this trace in the progress log, as the
  design requires).
- No new CLI flags or help text.

## Worker protocol

- Before each edit, read the file fresh and record its SHA-256 in the
  progress log; after the edit, record the new SHA-256. On drift (the file
  changed since your read and not by you), stop editing that file and record
  it.
- Edit only the writePaths of this plan; write only your own progress log;
  no git commit, branch, stash or worktree commands; no workspace-wide
  formatting.

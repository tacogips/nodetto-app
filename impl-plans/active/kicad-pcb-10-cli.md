# kicad-pcb-10-cli

- planId: kicad-pcb-10-cli
- planPath: impl-plans/active/kicad-pcb-10-cli.md
- wave: 4; dependsOn: kicad-pcb-09-core-index-fixture-integration
- design: design-docs/specs/design-kicad-pcb.md section 8 (and 7.3 for the
  notes and warnings)
- progress log: impl-plans/progress/kicad-pcb-10-cli.md
- scratch: tmp/kicad-pcb-s530/kicad-pcb-10-cli/
- protocol: impl-plans/active/kicad-pcb-00-overview.md "Per-worker protocol"

## Intent

Add `nodetto-cli pcb import` and `nodetto-cli pcb gerber` to the TS CLI.
The native Rust CLI runs the same bundle, so no Rust change is needed.
Prove the two CLIs agree with a native parity case.

## Repository context (imitate)

- `apps/cli/src/breadboard-command.ts`:
  - `gerberCommand` (lines 246-298): option parsing, `--strict`,
    `writeBytes`, the warning and note output
  - `selectBreadboardPage` (line 87): `resolvePageQuery` and the error
    messages
  - `readDocument` (line 75)
  - `diagnosticsText` (line 108): KiCad diagnostic lines with locations
- `apps/cli/src/gerber-command.ts`: import-to-document output
  (`serializeDocument`, `writeOutput`, printing without `--output`).
- `apps/cli/src/commands.ts` line ~866: the `case "gerber":` dispatch;
  add `case "pcb":` next to it.
- `apps/cli/src/help.ts`: the `OVERVIEW` "Convert and check" block and
  `COMMAND_HELP` entries (the `gerber` and `breadboard` entries are the
  models, with usage, options, exit codes and examples).
- `apps/cli/src/breadboard-commands.test.ts` and `gerber-commands.test.ts`:
  `memoryIo` and `runCli` test style.
- `apps/cli/src/native-parity.test.ts` lines 649-735: `nativeTest`,
  `both(...)`, separate temporary dirs, ZIP byte comparison.
- `apps/cli/src/ai-commands.test.ts` line 103 compares `help` with
  `OVERVIEW`, so it updates automatically.

## Non-goals

- No `--into` or `--page-name` for `pcb import` (design 8).
- No Rust changes in `apps/cli/native`. No MCP changes: the MCP `run`
  tool passes any CLI arguments.
- Do not edit `types-command.ts` (plan 01 did) or the docs (plan 03).

## writePaths

- apps/cli/src/pcb-command.ts (new)
- apps/cli/src/pcb-commands.test.ts (new)
- apps/cli/src/commands.ts
- apps/cli/src/help.ts
- apps/cli/src/native-parity.test.ts
- impl-plans/progress/kicad-pcb-10-cli.md (new)

## sharedPaths

none

## Behaviour (exact)

- `pcb import <file.kicad_pcb> [--output <doc.jsonl>] [--strict]`:
  1. Exactly one positional argument, otherwise exit 2 with
     `pcb import expects one .kicad_pcb file path.` and the help.
  2. Read the text, then `importKicadPcb(text, {fileName: <base name>})`.
     Get the base name with `lastIndexOf` of `/` and `\`, not a regex
     split.
  3. Any error diagnostic -> exit 2, printing the diagnostics in the
     `diagnosticsText` format.
  4. Build the document with `pcbDocumentFromPlan(plan, {pageName:
     plan.title})`, then `serializeDocument`.
  5. With `--output`, write the file and print the summary to stderr,
     as `gerber import` does. Check `gerber-command.ts` for the stream
     and mirror it exactly. Without `--output`, print the document to
     stdout and the summary to stderr.
  6. Summary: `Board <w> x <h> mm: <f> footprints, <p> pads, <t> tracks, <v> vias, <z> zones, <n> nets.`
     - `w` and `h` (`toFixed(2)`) come from the Edge.Cuts extent:
       `exportPcbBoard(...).width` and `.height`, or `pcbOutlineBounds`
       over the Edge.Cuts `shapeBounds`. When there is no outline, print
       `Board with no outline: ...` with the same counts.
     - `n` = `board.nets.length`.
  7. Warnings are printed as `warning: <file>: <message>` lines (with
     `line:column` when present, as in `diagnosticsText`). `--strict` with
     warnings -> exit 3 and nothing written.
- `pcb gerber <doc.jsonl> --output <file.zip> [--page <page>] [--strict]`:
  - Mirror `breadboard gerber`.
  - Page selection: `pcb` pages; messages `The document contains no PCB pages.`
    and `The document has <n> PCB pages; choose one with --page:` plus the
    list.
  - `name` = output base name without `.zip`, using `lastIndexOf`.
  - An error string from `exportPcbBoard` -> exit 2.
  - Output: warnings, notes, then `Wrote Gerber and drill files to <path>.`
  - `--strict` with warnings -> exit 3 and nothing written.
- `pcb` without a valid subcommand ->
  `pcb expects the import or gerber subcommand.` and the help, exit 2.
- Help:
  - `OVERVIEW` line in "Convert and check", after the `gerber import`
    line: `  nodetto-cli pcb import|gerber   KiCad board to a PCB page, Gerber and drill export`.
    Align the column with the neighbouring lines.
  - `COMMAND_HELP.pcb`: usage for both subcommands, the options, exit
    codes 0/2/3 (reuse `EXIT_CODES`), and examples
    `nodetto-cli pcb import board.kicad_pcb --output board.jsonl` and
    `nodetto-cli pcb gerber board.jsonl --output board.zip`.

## Native parity case (`native-parity.test.ts`)

- Add one `nativeTest("native pcb import and gerber match the TypeScript CLI", ...)`.
  In separate temporary dirs, run
  `pcb import <abs>/test-fixtures/kicad/two-layer.kicad_pcb --output board.jsonl`,
  then `pcb gerber board.jsonl --output board.zip`.
- Compare exit codes (0), stdout and stderr, then the `board.jsonl` text
  and the `board.zip` bytes.
- Timeout 120000.

## Pitfalls

- Deterministic output: no timestamps. The document id and title come
  from `pcbDocumentFromPlan` defaults.
- Read the `.kicad_pcb` with `io.readText`. It is not a ZIP.
- Keep the `breadboard` and `gerber` commands unchanged.
- The `OVERVIEW` change alters `help` output. `ai-commands.test.ts`
  compares it with `OVERVIEW` itself, so no golden needs editing. If a
  test pins the exact text elsewhere, record it and stop.

## Tests (`pcb-commands.test.ts`, input -> expected)

- `pcb import fixture --output out.jsonl` -> exit 0; the written document
  parses and validates; stderr has the summary with `5 footprints` and
  `2 vias`.
- `pcb import fixture` without `--output` -> stdout equals
  `serializeDocument(pcbDocumentFromPlan(...))`.
- `pcb import` of a `.kicad_sch` text -> exit 2 with `kicad.unknownRoot`
  in stderr.
- Inline text that produces a warning (for example a `dimension`):
  with `--strict` -> exit 3 and no file; without it -> exit 0 and a
  `warning:` line.
- `pcb gerber doc --output board.zip` -> exit 0; the bytes equal
  `encodePcbBoardZip(exportPcbBoard(doc, page, {name: "board"}))`.
- `pcb gerber` without `--output` -> exit 2. A document with no pcb page
  -> exit 2 with the message. Two pcb pages without `--page` -> exit 2
  with the list; with `--page 2` -> exit 0.
- `pcb` and `pcb foo` -> exit 2 with the subcommand message.
- `help pcb` prints `COMMAND_HELP.pcb`.

## Verification

1. `bun test apps/cli/src/pcb-commands.test.ts apps/cli/src/ai-commands.test.ts apps/cli/src/breadboard-commands.test.ts apps/cli/src/gerber-commands.test.ts`
   exits 0.
2. `bun run typecheck` exits 0.
3. `bunx biome check apps/cli/src/pcb-command.ts apps/cli/src/pcb-commands.test.ts apps/cli/src/commands.ts apps/cli/src/help.ts apps/cli/src/native-parity.test.ts --diagnostic-level=warn`
   exits 0.
4. Run
   `mkdir -p tmp/kicad-pcb-s530/kicad-pcb-10-cli && CARGO_TERM_QUIET=true mise run test-cli > tmp/kicad-pcb-s530/kicad-pcb-10-cli/test-cli.log 2>&1; echo "exit=$?"`.
   - Do not pipe through `tee`: a pipeline reports tee's status, not
     test-cli's.
   - The printed `exit=` value must be 0, and it is the exit code of
     `mise run test-cli` itself. Record it and the log path.
   - Then
     `grep -n "native pcb import and gerber match the TypeScript CLI" tmp/kicad-pcb-s530/kicad-pcb-10-cli/test-cli.log`
     must show that test with bun's pass marker (`(pass)`). Record the
     matching line.
   - If the native binary build fails for reasons outside this plan,
     record it as blocked with the log path. Do not claim a pass.

## Done criteria

- `grep -c 'case "pcb"' apps/cli/src/commands.ts` is 1.
- `grep -c "pcb import|gerber" apps/cli/src/help.ts` is at least 1.
- All verification steps are recorded with exit code 0.

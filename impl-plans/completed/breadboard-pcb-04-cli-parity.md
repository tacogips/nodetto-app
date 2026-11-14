# breadboard-pcb-04-cli-parity

- planId: breadboard-pcb-04-cli-parity
- planPath: impl-plans/active/breadboard-pcb-04-cli-parity.md
- wave: 3; dependsOn: breadboard-pcb-03-core-export
- design: design-docs/specs/design-breadboard-pcb.md sections 7.2 (CLI
  validation), 7.4 (CLI ZIP equals the core encoder), 7.5 (native parity),
  9 (interfaces), and 8.1 R6
- progress log: impl-plans/progress/breadboard-pcb-04-cli-parity.md
- session: opus-luna-design-and-implement-review-loop-session-501; issue
  local-input:feat/breadboard-gerber@431bfdb
- Wave map: see impl-plans/active/breadboard-pcb-01-validator.md.

## Intent

Expose `--outline board|used` on `nodetto-cli breadboard gerber`, document
it in help, test the CLI against the core encoder, and add a native (Boa)
vs TypeScript CLI byte-parity case for the PCB archive.

## Repository context

- `apps/cli/src/breadboard-command.ts:gerberCommand`. Imitate how `--board`
  is parsed and passed: `...(board === undefined ? {} : { board })`. For
  the validation error style, imitate
  `breadboard-command.ts:exportCommand`'s
  `` `netlist requires --format kicad or spice.\n\n${helpFor("breadboard")}` ``.
- `apps/cli/src/help.ts` `breadboard` entry (around lines 363-390): the
  usage block and the option table with names padded to 10 columns.
- `apps/cli/src/breadboard-commands.test.ts`: the tests `breadboard gerber
  writes a ZIP of fabrication files` and `breadboard gerber usage errors`.
  Imitate their `memoryIo` and `writeBytes` capture.
- `apps/cli/src/native-parity.test.ts`: `nativeTest` (skipped unless
  `NODETTO_CLI_TEST_BINARY` is set). For per-case temp directories imitate
  `mkdtempSync(join(tmpdir(), ...))`, `rmSync` in `finally`, and
  `Bun.spawnSync([process.execPath, source, ...args], { cwd })`.
- The native binary bundles the TS sources at build time
  (`apps/cli/native/build.rs` runs `apps/cli/scripts/build-engine.ts`), so a
  release build picks up plan 03's core changes.
- Core contract from plan 03: `BreadboardPcbOptions.outline?: "board" |
  "used"`.

## Non-goals

- No `gerber --check` (design D6). No change to bom, netlist or import,
  existing messages, or exit codes.
- No changes to `apps/cli/native/**`, `commands.ts`, `mcp*.ts` or
  `mise.toml`.
- No desktop or `ui-solid` changes.

## writePaths

- apps/cli/src/breadboard-command.ts
- apps/cli/src/help.ts
- apps/cli/src/breadboard-commands.test.ts
- apps/cli/src/native-parity.test.ts
- impl-plans/progress/breadboard-pcb-04-cli-parity.md (new)

## sharedPaths

none

## File-level changes

### breadboard-command.ts (gerberCommand)

- Add `"--outline"` to the value options set.
- Validate it right after the positional-count check and before the
  `--output` check. A value other than `board` or `used` fails with
  `` fail(`--outline must be board or used.\n\n${helpFor("breadboard")}`) ``,
  which exits 2.
- Pass `...(outline === undefined ? {} : { outline })` into
  `exportBreadboardPcb`. Narrow the type with a type guard; do not cast.
- All other messages and their order stay byte-identical.

### help.ts (breadboard entry)

- Usage line 2 becomes
  `[--page <short-id|id|name>] [--board <id>] [--outline board|used] [--strict]`.
  If it exceeds the column width of the existing lines, wrap it onto a
  third aligned line instead.
- Add the option line
  `  --outline Board outline for gerber: board (default) or used, trimmed to the used area.`,
  placed after `--board`.
- Add the example
  `  nodetto-cli breadboard gerber prototype.jsonl --outline used --output prototype-pcb.zip`.

### breadboard-commands.test.ts

Add these cases (input -> expected):

- the example with `--output out/led-pcb.zip` -> the written bytes equal
  `encodeBreadboardPcbZip(exportBreadboardPcb(document, page.id, { name: "led-pcb" }))`.
  Parse with `parseDocument` from `@nodetto/io` and import from
  `@nodetto/core`. This is how the core validation covers CLI output
  (design 7.4).
- `--outline board` -> bytes identical to the default run
- `--outline used` -> exit 0; bytes equal the core encoder output with
  `outline: "used"`; bytes differ from the default; stderr notes contain
  `Board ` with a width smaller than `83.82`
- `--outline square` -> exit 2; stderr starts with
  `--outline must be board or used.`; nothing written
- `--outline` with no value -> exit 2, with `--outline requires a value.`
  (existing parseArgs behaviour)
- Keep the existing assertions (the e7 warning text, `All 2 wire(s) are
  top-layer traces.`, and the strict exit 3). If plan 03's R5 warning
  appears for the example, assert it explicitly. Do not loosen the
  existing `toContain` checks.

### native-parity.test.ts

Add one `nativeTest` case: "native CLI writes the same breadboard PCB
archive". For `extra` in `[[], ["--outline", "used"]]`:

- Make two temp directories, `ts` and `native`.
- Run `[process.execPath, source, "breadboard", "gerber", <absolute
  examples/breadboard/led-button.jsonl>, "--output", "led-button.zip",
  ...extra]` with `cwd: ts`. Run the same arguments with `binary!` and
  `cwd: native`.
- Compare exit code, stdout and stderr exactly. stderr contains the
  relative output path, so it is identical.
- Compare `readFileSync(join(ts, "led-button.zip"))` and the native ZIP
  with `toEqual`.
- Remove both directories in `finally`. Timeout 60000.

Resolve the example path with
`join(import.meta.dir, "../../../examples/breadboard/led-button.jsonl")`.

Pitfalls:

- Do not reuse `compare()` for this case. It runs both CLIs in the same
  cwd, and they would overwrite one ZIP.
- Do not edit or reorder the existing parity cases.
- If the bytes differ, do not paper over it in the test. Record the first
  differing file and offset in the progress log, and report it as a plan 03
  determinism finding.

## Invariants

- Existing CLI messages, exit codes and help text for other subcommands are
  unchanged. Every `apps/cli/src` test still passes.
- The new `--outline` behaviour exactly matches the core option.
- No file outside writePaths is changed.

## Verification (record exit codes and log paths in the progress log)

1. `BUN_OPTIONS=--jsx-runtime=classic bun test apps/cli/src` must exit 0.
   The parity case is skipped here because the environment variable is
   unset.
2. `CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli` must exit 0.
3. `NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" BUN_OPTIONS=--jsx-runtime=classic bun test apps/cli/src/native-parity.test.ts`
   must exit 0, with the new case reported as passed (not skipped).
4. `bunx biome check apps/cli/src/breadboard-command.ts apps/cli/src/help.ts apps/cli/src/breadboard-commands.test.ts apps/cli/src/native-parity.test.ts --diagnostic-level=warn`
   must exit 0.
5. `bun run typecheck` must exit 0. Record sibling-only failures as drift.
6. `bun apps/cli/src/main.ts help breadboard` output contains
   `--outline board|used`.

Run `mkdir -p tmp/breadboard-pcb-s501/breadboard-pcb-04-cli-parity` first.
Then write the stdout and stderr of steps 2 and 3 to
`tmp/breadboard-pcb-s501/breadboard-pcb-04-cli-parity/build-release.log` and
`tmp/breadboard-pcb-s501/breadboard-pcb-04-cli-parity/native-parity.log`.
Cite the log paths and exit codes.

## Per-worker protocol

Same as plan 01:

- read each file fresh before you edit it, and record its sha256 before and
  after
- write an intent snapshot first
- on drift, stop and record it
- run no state-changing git commands
- keep scratch only under `tmp/breadboard-pcb-s501/breadboard-pcb-04-cli-parity/`,
  and never put `*.test.ts` files under `tmp/`
- edit only your own progress log

## Done criteria (mechanical)

- `grep -c '"--outline"' apps/cli/src/breadboard-command.ts` is at least 1.
- `grep -c "outline board|used" apps/cli/src/help.ts` is at least 1.
- Verification steps 1-6 are recorded with exit 0, and step 3 shows the new
  case as passed.

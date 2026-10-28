# Progress: pcb-svg-04-cli-tests

## Scope and implementation

Implemented only the CLI and native parity tests assigned to plan
`pcb-svg-04-cli-tests`. No production source, package manifest, lockfile, or
native parity comparator was changed.

- `apps/cli/src/pcb-commands.test.ts`: added one test covering PCB SVG stdout,
  captured SVG input for PNG/PDF raster export, a real PNG signature, and a
  real one-page PDF.
- `apps/cli/src/native-parity.test.ts`: extended the existing native PCB
  import/Gerber parity test to export SVG through its existing byte-for-byte
  `both` helper and assert the TypeScript SVG contains `data-layer="pcb-board"`.
- Desktop exports use the shared `Editor.exportPageSvg` rendering path before
  PNG/PDF rasterization; this plan therefore verifies that path at the CLI
  boundary and does not add a desktop-specific test.

## Source identity

Pre-edit SHA-256 values, read before edits:

- `apps/cli/src/pcb-commands.test.ts`: `10a7b0c38281123e1678565b4897f2b15fada6a7ea7dff0eeffaea7a8eb7be8f`
- `apps/cli/src/native-parity.test.ts`: `1491b63ccd10c3d413e2ddd4368eb8520dc1e1e58a91ee3540aaac9d9827404c`

Final SHA-256 values:

- `apps/cli/src/pcb-commands.test.ts`: `3b52b9e898b020eb387ae152eba82ba740c5a1b875c62abc197486eb5fbcf826`
- `apps/cli/src/native-parity.test.ts`: `f4be863ddf9779efd7697c04e637f711299da84af7aaf86b3b5793dd01c29604`

The full native gate uses the release binary: `mise.toml` sets
`NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli"` for `bun test`.
The full test log reports 142 passing tests and zero failures.

## Assigned completion criteria

- CLI SVG/PNG/PDF export test: complete and passing.
- Existing native PCB import/Gerber test extended with SVG byte parity and a
  TypeScript board-layer assertion: complete and passing.
- Production and dependency files remain unchanged: complete.
- Required `mise run test-cli` gate: complete, exit 0; native binary is
  configured in the task, and an isolated run confirms the targeted test
  passes rather than being skipped.

## Verification

| Command | Exit | Result / complete log |
| --- | ---: | --- |
| `bun test apps/cli/src/pcb-commands.test.ts` | 0 | 9 pass, 0 fail; `tmp/pcb-svg-s538/pcb-svg-04-cli-tests/pcb-commands-final.log` |
| `bun test apps/cli/src/export-command.test.ts` | 0 | 8 pass, 0 fail; `tmp/pcb-svg-s538/pcb-svg-04-cli-tests/export-command-final.log` |
| `CARGO_TERM_QUIET=true mise run test-cli` | 0 | 142 pass, 0 fail across 17 files; `tmp/pcb-svg-s538/pcb-svg-04-cli-tests/test-cli.log` |
| `NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity.test.ts --test-name-pattern 'native pcb import and gerber match the TypeScript CLI'` | 0 | 1 pass, 0 fail; `tmp/pcb-svg-s538/pcb-svg-04-cli-tests/native-pcb-parity.log` |
| `bun run typecheck` | 0 | Passed; `tmp/pcb-svg-s538/pcb-svg-04-cli-tests/typecheck-final.log` |
| `bunx biome check apps/cli/src/pcb-commands.test.ts apps/cli/src/native-parity.test.ts` | 0 | Passed; `tmp/pcb-svg-s538/pcb-svg-04-cli-tests/biome-final.log` |
| `bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess` | 2 | Existing errors in unrelated test/fixture files; full output at `tmp/pcb-svg-s538/pcb-svg-04-cli-tests/tsc-unchecked.log`. Filter for `apps/cli/src/(pcb-commands|native-parity).test.ts` matched no errors (`tmp/pcb-svg-s538/pcb-svg-04-cli-tests/tsc-owned-errors.log`, empty). |
| `git diff --exit-code apps/cli/src/export-command.ts apps/cli/src/commands.ts apps/cli/src/help.ts apps/cli/package.json bun.lock` | 0 | Protected production/dependency paths unchanged; `tmp/pcb-svg-s538/pcb-svg-04-cli-tests/protected-paths.log` |
| `git diff --check -- apps/cli/src/pcb-commands.test.ts apps/cli/src/native-parity.test.ts impl-plans/progress/pcb-svg-04-cli-tests.md` | 0 | Passed; `tmp/pcb-svg-s538/pcb-svg-04-cli-tests/diff-check.log` |

The assigned tests and required aggregate gate pass. The unfiltered strict
compiler command remains nonzero due to the repository baseline; the changed
CLI test files have no reported errors under that option.

# Progress: breadboard-pcb-04-cli-parity

Completed outside the workflow after it stopped at the plan 03 evidence gate.

- `--outline board|used` on `breadboard gerber`; an invalid value exits 2 with
  `--outline must be board or used.` and the breadboard help; a missing value
  exits 2 with `--outline requires a value.`. Help lists the option and an
  example.
- `breadboard-commands.test.ts`: the default and `--outline board` archives
  are identical and equal the core encoder; `--outline used` equals the core
  encoder with `outline: "used"`, differs from the default and reports
  30.98 x 32.66 mm; invalid and missing values write nothing.
- `native-parity.test.ts`: the native CLI and the TypeScript CLI write
  byte-identical archives for the example, with and without
  `--outline used`, with equal exit code, stdout and stderr. It runs under
  `CARGO_TERM_QUIET=true mise run test-cli`.

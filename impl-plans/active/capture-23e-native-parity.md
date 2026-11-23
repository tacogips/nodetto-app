# M23e capture-23e-native-parity (session 885)

- Dispatch `capture-s885`, wave 5, dependsOn
  `capture-23d-census-render-digest` (wired picture, final crate report)
  and `capture-23f-host-cases` (its tests pin `capture-cad.ts`).
- Design wins: 4.1, 4.2, 6.6, 10.2 (1,000 elements budget), 12, 8.5,
  CAP-R4-03 (590.721 mm3), CAP-R6-02.
- Writes (3): this file, `apps/cli/src/native-parity/capture.test.ts`,
  `apps/cli/src/capture-cad.ts` (report text only, when native parity
  exposes a contradiction with 4.2 or 12). Artifact roots:
  `target/capture-m23e`, `tmp/capture/m23e`, `tmp/capture/m23`,
  `tmp/capture/m09` (the unchanged M9 test writes its timing there).

## Intent

Prove the native CLI end to end: interference text, hatch and exit codes
agree, the budgets hold, both fixtures are intact.

## Tests to add to `native-parity/capture.test.ts`

Imitate the existing block at `:424-509` (keep it unedited):
- Light and dark hatch: pixels `#335c67`/`#fffdf8` (light) and `#5fb4c7`/`#1f2427` (dark) present; two runs byte-equal.
- Plate/Trim/Boss -> `errors: 1` with `cad.result.empty (sampled)`, exit 0.
- Cube `cad.mesh` with a cut -> exit 0; a page with a `cad.pcb` board -> board listed in bodies.
- Block moved -> `interference: 0`; 1.5 mm pin -> one pair.
- 1,000 elements in 50 bodies -> under 10,000 ms; timings written to `tmp/capture/m23/timing.json`.
- Stacked 50 bodies -> 1,225 candidate pairs checked.
- Fixtures stay unedited: `apps/cli/native/src/engine_tests.rs:369-405` (run by `cargo test -p nodetto-cli` in gate 4) still compares the native default scene with `capture-plate-default.ncs1`; M23f pins both fixtures on the Bun side.

## Production edit

`capture-cad.ts` only for report text that contradicts design 4.2 or 12,
and gate 3 must stay green (it runs M23f's tests). Anything else: stop,
record the scope amendment.

## Pitfalls

Never run parity without the binary built in the same command. Do not
edit fixtures, `engine_tests.rs`, `capture-command.ts` or crate files.
Timing tests: up to 3 attempts, then alone, all logged.

## Acceptance criteria

- Gates 1, 3 and 4 exit 0; `native-parity.txt` shows a positive pass
  count and no skip; 590.721 within 1% for `top`, `front`, `iso`;
  `--fail-on-interference` exits 1; the M9 budget passes unchanged.

## Verification (each exit 0)

1. Gate 1: `env CARGO_TERM_QUIET=true CARGO_TARGET_DIR="$PWD/target/capture-m23e" sh -c 'cargo fmt -p nodetto-capture -- --check && cargo clippy -p nodetto-capture --all-targets -- -D warnings && cargo test -p nodetto-capture'`
2. Gate 3: `sh -c 'bun run typecheck && bunx biome check --diagnostic-level=warn apps/cli/src/capture-cad.ts apps/cli/src/native-parity/capture.test.ts && bun test packages/core/src/capture apps/cli/src/capture-cad.test.ts apps/cli/src/capture-command.test.ts apps/cli/src/ai-commands.test.ts apps/desktop/src/shell/export-handlers.test.ts'`
3. Gate 4: `sh -c 'mkdir -p tmp/capture/m23 && CARGO_TERM_QUIET=true CARGO_TARGET_DIR="$PWD/target/capture-m23e" cargo test -p nodetto-cli && CARGO_TERM_QUIET=true CARGO_TARGET_DIR="$PWD/target/capture-m23e" cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/capture-m23e/release/nodetto-cli" bun test apps/cli/src/native-parity/capture.test.ts > tmp/capture/m23/native-parity.txt 2>&1; s=$?; echo "exit=$s" >> tmp/capture/m23/native-parity.txt; test $s -eq 0 && grep -Eq "^ *[1-9][0-9]* pass$" tmp/capture/m23/native-parity.txt && ! grep -Eq "^ *[1-9][0-9]* skip$" tmp/capture/m23/native-parity.txt'`
   (anchored to bun's summary lines)

## Progress

Pending. Hashes before and after, logs under `tmp/capture/m23e/`, drift
stops the run.

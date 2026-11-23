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

## Amendment 2026-11-23 (blocked-wave-scope-or-contract, round 2)

Blocker: in the existing test "CAD interference is reported consistently
across views and capture options", the assertion at
`native-parity/capture.test.ts:495` expects `cell 1 mm` for
`--interference-cell 1`. The native engine prints `cell 0.938 mm`. See
`tmp/capture-s885/capture-23e-native-parity/gate4-final.log`, where the
received line is `interference: 1 (1 candidate pair checked, cell 0.938
mm)` and the box is `85,45,2 .. 100,60,5.008`.

Decision (CAP-R6-07, recorded in design 8.5 and section 18). The engine is
right and the expectation is wrong, so no engine edit is made.

- Design 6.6 step 2 uses `n = clamp(ceil(extent / c), 16, 1024)` rays per
  side. The printed guarantee is the largest level-0 cell side used,
  rounded up to 0.001 mm (6.6, "Guarantee").
- The Plate x Block candidate box spans 15 mm. With c = 1, n = max(15, 16)
  = 16, so the cell side is 15 / 16 = 0.9375 mm, printed as 0.938 mm.
- The default c = 0.25 gives n = 60 and exactly 0.25 mm, which agrees with
  the `cell 0.25 mm` assertion at `:459`.

Authorized change, exactly one, inside that existing block:

- The expected string at `:495` becomes `"cell 0.938 mm"`.

Everything else in `:438-520` stays byte-identical:

- the `--interference-cell 1` run and its arguments;
- the 0.25 mm and 590.721 assertions;
- the `--no-interference`, `Plate,Puck` and `--fail-on-interference`
  assertions.

No edits to `crates/capture`, including `interference.rs`, nor to
`capture-cad.ts` for this blocker, nor to fixtures or `engine_tests.rs`.
If any other assertion of that block then fails, stop and record it. This
is the last amendment round.

Resume: keep the already-added native cases and their logs, read the test
file fresh, and record `git hash-object` before and after this one-line
edit. Then rerun gates 1, 3 and 4. Gate 4 must show a positive pass count,
no skip and `exit=0` in `tmp/capture/m23/native-parity.txt`. The commit
message states the old expectation (`cell 1 mm`) and the new one
(`cell 0.938 mm`), citing CAP-R6-07.

## Progress

2026-11-23: Added native hatch, empty/refilled body, mesh, PCB, separated
and pin, 1,000-element and stacked candidate cases. The timing was
1,343.94 ms; the M9 test passed unchanged. Gate 1 passed (121 tests),
and gate 3 passed (204 tests). Gate 4 remains blocked: 29 CLI tests
passed, then parity ran 10 tests (9 passed, 1 failed). The existing,
explicitly protected interference test expects `cell 1 mm`, but the
engine reports `cell 0.938 mm` for that request. The test and engine
must be reconciled against design 6.6 through an authorized scope
amendment; neither was changed. Gate 4 must be rerun after resolution.
Complete logs, per-edit intentions, and hashes are under
`tmp/capture-s885/capture-23e-native-parity/`. Formal reviews and commits
remain downstream.

2026-11-23 CAP-R6-07 resume: Changed only the existing cell expectation
from `cell 1 mm` to `cell 0.938 mm`, as authorized. Gates 1, 3 and 4
passed on the resulting source: 121 capture tests, 204 Bun tests, 29 CLI
tests and 10 native parity tests, respectively; parity had no skips and
recorded `exit=0` in `tmp/capture/m23/native-parity.txt`. The 1,000-element
run measured 1,311.00 ms. Complete logs and edit hashes are in
`tmp/capture-s885/capture-23e-native-parity/`. Implementation acceptance
criteria are met; formal reviews and the local commit remain downstream.

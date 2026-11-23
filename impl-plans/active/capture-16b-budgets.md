# M16b capture-16b-budgets (session 889, repair in session 891)

- Stage: wave 1 of dispatch `capture-s889`, parallel with M16a. Session
  891: wave 1 of dispatch `capture-s891`, dependsOn none. The repair
  writes only this plan (Progress) and `target/capture-m16/`. It does not
  edit the design.
- Design: `design-docs/specs/design-ai-capture.md` revision 7, sections
  10.2 (budgets), 10.3 (method, CAP-R7-03), 8.5 ("M16 reduced scope").
- writePaths: `design-docs/specs/design-ai-capture.md` (section 10.3 table
  only), `impl-plans/active/capture-16b-budgets.md`, `target`.
- artifactRoots: `target` (all raw output under `target/capture-m16/`;
  Cargo builds with `CARGO_TARGET_DIR=target/capture-m16`).

## Intent

Measure the 10.2 budgets on the final code with the 10.3 method and record
value, method, machine and log path in the design, so M16c can copy the
values into `docs/capture.md`.

## Non-goals

No source, test, fixture, deadline or budget change. No native parity
test (`apps/cli/src/native-parity/`), no `mise run verify`, no browser
test, no `cargo test --workspace`. No write under the repository `tmp/`
(reading `tmp/capture/m09/timing.json` and `tmp/capture/m23/timing.json`
is allowed). No edit of the design outside the 10.3 table placeholder.

## Steps (all with CARGO_TERM_QUIET=true, foreground, complete logs)

1. `target/capture-m16/machine.txt`: `date`, `sysctl -n
   machdep.cpu.brand_string hw.ncpu`, `sw_vers`, `rustc --version`,
   `bun --version`, `git rev-parse HEAD`, `uptime` (again at the end).
2. Crate timings: verification command 1 -> `crate-release.log`.
3. Native: `cargo build --release -p nodetto-cli` (target
   `target/capture-m16`), then the step 3 command below, which runs for each
   case one warm-up plus three runs under `/usr/bin/time -p`, writing
   images with `--force` to `target/capture-m16/` and stdout plus times to
   `native-<case>.txt`. Cases: `plate-png`
   (`apps/cli/src/__fixtures__/capture-plate.jsonl`, default options,
   `--output target/capture-m16/plate.png`), `plate-jpg` (same,
   `--format jpg --output target/capture-m16/plate.jpg`), `led-2d`
   (`examples/breadboard/led-button.jsonl`, `--output
   target/capture-m16/led.png`).
4. Bun scene build: verification command 2 -> `bun-scene.log`.
5. Timing failures: up to three attempts, then the case alone; keep every
   attempt in the log (append, do not overwrite). A budget still missed is
   a blocker: record it, do not write it as met, stop.
6. Design 10.3: replace the line `<!-- M16 fills the measured table here. -->`
   with a machine/date line and a table with columns Budget | Budget value
   | Measured | Runs | Log. Rows, one per 10.2 row:
   - Native capture of the reference CAD page: median / max of
     `plate-png` real time; budget under 5,000 ms.
   - Render of the reference scene, one thread: value printed by
     `reference_render_stays_within_the_one_thread_budget`; under 2,000 ms.
   - Interference of one 200 mm pair: `release_pin_budget` line; 500 ms.
   - Interference in total: `release_many_holes_budget`,
     `release_many_boxes_budget` and the shared 20,000-point loop line.
   - Body sampling: "no timing printed; census tests passed" unless a
     printed value exists.
   - 1,000 elements in 50 bodies (native parity, deferred): "earlier
     evidence, M23e, 2026-11-23: 1,060 ms" from `tmp/capture/m23/timing.json`
     (read; round to ms).
   - Native 2D capture: median / max of `led-2d`; 10,000 ms class.
   - Scene build for 20,000 elements in Bun: printed value; 1,000 ms.
   - Extra rows: `plate-png` and `plate-jpg` bytes against 1,048,576; the
     M9 earlier evidence `tmp/capture/m09/timing.json` (742, 758, 700 ms).
   Also note whether the three runs of each case gave equal `bytes` and
   path (determinism observation, not a gate). Copy numbers only from the
   logs of this run or the named earlier files; never from 10.1.

## Pitfalls

- `--test-threads=1` and `--nocapture` are required, or printed timings
  are missing or contended.
- Release-only tests are ignored in debug; command 1 must use `--release`.
- `/usr/bin/time -p` writes to stderr; capture both streams.
- Do not run the native binary from `target/release`; use
  `target/capture-m16/release/nodetto-cli`.
- Do not tighten or loosen any deadline because of a measurement.

## Acceptance criteria

- The three verification commands and the step 3 command exit 0 with
  complete logs; `crate-release.log` shows
  `test result: ok` with a positive passed count and no failures;
  `bun-scene.log` shows one pass; the native files hold three timed runs
  per case.
- Design 10.3 holds the filled table with method, machine line and log
  paths; no other design line changed (`git diff` shows only 10.3).
- Nothing under `tmp/` is created or modified.
- Session 891: repaired verification 3 has a new complete log under
  `target/capture-m16/` that shows `1 pass`, `0 fail` and a last line
  `exit=0`. That path is recorded in Progress (CAP-R7-05).

## Verification (each must exit 0 and run at least one test)

The native measurement (step 3) runs no test, so it is a step, not a
verification command; command 3 checks its evidence after a test run.

Step 3 native measurement command (run once, then retries per step 5):
`sh -c 'set -e; CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/capture-m16 cargo build --release -p nodetto-cli; b=target/capture-m16/release/nodetto-cli; for c in "plate-png apps/cli/src/__fixtures__/capture-plate.jsonl --output target/capture-m16/plate.png" "plate-jpg apps/cli/src/__fixtures__/capture-plate.jsonl --format jpg --output target/capture-m16/plate.jpg" "led-2d examples/breadboard/led-button.jsonl --output target/capture-m16/led.png"; do set -- $c; n=$1; shift; f=target/capture-m16/native-$n.txt; : > $f; "$b" capture "$@" --force >> $f 2>&1; for i in 1 2 3; do echo "run $i" >> $f; /usr/bin/time -p "$b" capture "$@" --force >> $f 2>&1; done; test $(grep -c "^real" $f) -eq 3; done'`

1. `sh -c 'mkdir -p target/capture-m16 && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/capture-m16 cargo test -p nodetto-capture --release -- --nocapture --test-threads=1 > target/capture-m16/crate-release.log 2>&1; s=$?; echo "exit=$s" >> target/capture-m16/crate-release.log; test $s -eq 0 && grep -Eq "test result: ok\. [1-9][0-9]* passed" target/capture-m16/crate-release.log && ! grep -Eq "test result: FAILED" target/capture-m16/crate-release.log'`
2. `sh -c 'mkdir -p target/capture-m16 && bun test packages/core/src/capture/scene.test.ts -t "builds 20,000 CAD elements in under 1,000 ms" > target/capture-m16/bun-scene.log 2>&1; s=$?; echo "exit=$s" >> target/capture-m16/bun-scene.log; test $s -eq 0 && grep -Eq "^ *1 pass$" target/capture-m16/bun-scene.log && grep -q "CAD capture scene, 20,000 elements:" target/capture-m16/bun-scene.log'`
3. (Repaired in session 891, design CAP-R7-05 and review M16B-01. Each
   run writes a new log and prints its path.)
   `sh -c 'd=target/capture-m16; mkdir -p "$d" || exit 1; log=$(mktemp "$d/gate-3-review.XXXXXX") || exit 1; echo "log=$log"; (bun test packages/core/src/capture/scene.test.ts -t "builds 20,000 CAD elements in under 1,000 ms" || exit 1; grep -Eq "^ *1 pass$" "$log" && grep -Eq "^ *0 fail$" "$log" || exit 1; for n in plate-png plate-jpg led-2d; do test "$(grep -c "^real " "$d/native-$n.txt")" -eq 3 || exit 1; done; test -s "$d/machine.txt" && git diff --check -- design-docs/specs/design-ai-capture.md && ! grep -q "M16 fills the measured table here" design-docs/specs/design-ai-capture.md) > "$log" 2>&1; s=$?; echo "exit=$s" >> "$log" || exit 1; exit $s'`

Session 891 reruns command 3 only. Commands 1 and 2 and step 3 are the
measurement runs behind section 10.3. They are not rerun, so their logs
and `target/capture-m16/gate-3.log` (session 889, exit line only) stay
as history. Any later rerun of any command needs a new log path.

## Progress

2026-11-23: Implementation complete, pending independent review. Design
section 10.3 contains the measured table; the rest of the design is unchanged.
Design hash before: `4069e0f74444d9aa0b5dc4343627e013637b2c0d`; after:
`1c212d1d0755000fce1eebcfc0f53b5d7d31cfe7`. Plan hash before progress:
`58c5b358bd392b0af11416c58348fb70bcd044c0`. No drift observed.

- Verification 1: exit 0, 142 passed, 0 failed; first attempt;
  `target/capture-m16/crate-release.log`.
- Step 3 native build and timings: exit 0, first attempt; command log
  `target/capture-m16/native-command.log`, case logs `native-plate-png.txt`,
  `native-plate-jpg.txt`, `native-led-2d.txt` in `target/capture-m16/`.
- Verification 2: exit 0, 1 passed, 0 failed; first attempt;
  `target/capture-m16/bun-scene.log`.
- Verification 3: exit 0, 1 selected test; first attempt;
  `target/capture-m16/gate-3.log` (test output suppressed by the plan).
- Machine and load: `target/capture-m16/machine.txt`. Intent records:
  `target/capture-m16/design-edit-intent.txt` and `plan-edit-intent.txt`.
  No test, fixture, deadline, or budget was changed. Full repository
  verification remains deferred and NOT yet run, per CAP-R7-01.

2026-11-23, session 891 design review M16B-01 (mid): `gate-3.log` holds
only `exit=0`, because verification 3 sent its test output to
`/dev/null`. Verification 3 is now repaired as CAP-R7-05 requires. The
author could not run it in the design step, so it is pending. Next
action, as the M16b repair task: run repaired verification 3 once (timing
retries follow step 5, each with a new log), then append here the date,
the command, the exit status, the printed log path, the pass and fail
counts and the attempts. Keep every existing log and the 10.3 values. M16b
stays unaccepted until that entry shows `exit=0` with `1 pass` and
`0 fail` and the review approves.

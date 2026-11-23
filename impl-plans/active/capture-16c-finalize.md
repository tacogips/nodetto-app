# M16c capture-16c-finalize (session 889)

- Stage: wave 2 of dispatch `capture-s889`. dependsOn:
  capture-16a-help-docs, capture-16b-budgets (both accepted first).
- Design: `design-docs/specs/design-ai-capture.md` revision 7, header
  "Implementation status", 8.5 ("M16 reduced scope", the three operative
  gates), 10.3, CAP-R7-01, CAP-R7-04.
- writePaths: `docs/capture.md` (the `## Measured budgets` section only),
  `design-docs/specs/design-ai-capture.md` (the header "Implementation
  status" paragraph only), `impl-plans/active/capture-00-overview.md`
  (Progress section and the evidence-roots row only),
  `impl-plans/active/capture-16c-finalize.md`, `target`.
- artifactRoots: `target` (gate logs under `target/capture-m16/gates/`).

## Intent

Close M16: copy the measured values into the user docs, run the three
targeted design gates on the final tree, and only when all pass, mark
every milestone accepted in the design header and the overview progress
table while saying plainly that full repository verification is deferred
and NOT yet run.

## Non-goals

No source, test, help or fixture change (M16a owns help and docs test).
No re-measurement (M16b owns it). No `README.md`, `impl-plans/README.md`,
`mise.toml` or cad3d file edit; no plan archiving. No native parity, no
`mise run verify`, no browser test, no `cargo test --workspace`; no write
under the repository `tmp/`.

## Changes

1. `docs/capture.md`: replace the one placeholder sentence under
   `## Measured budgets` with a short table copied from design 10.3
   (Budget, Budget value, Measured, Log) plus the machine/date line and
   one sentence on the method (crate release tests with printed timings,
   three timed native runs after a warm-up, the Bun scene test). Values
   must equal design 10.3 exactly; earlier-evidence rows keep that label.
   Keep the heading `## Measured budgets` (M16a's test asserts it).
2. Run gates G1, G2, G3 below. If any fails after the retries allowed for
   timing tests, stop: leave M16 pending everywhere, record the failing
   command, exit status and log path in Progress, and report a blocker.
3. Only when G1 to G3 all exit 0:
   - Design header: replace the "Implementation status (revision 7)"
     paragraph with: status implemented (slice); every milestone M1 to
     M15, M17 to M20, M22, M23a to M23f and M16 (M16a, M16b, M16c)
     accepted by per-plan review and targeted gates; then keep verbatim the
     two sentences "Full repository verification ... is deferred and NOT
     yet run; ..." and "\"Accepted\" in this document ... never means that
     this full verification has passed."
   - Overview `## Progress` table: set every row (M1 to M14 and M15, M17
     to M20, M22, M23a to M23f, M16) to `accepted`; M10's text becomes
     `accepted`. Add directly under the table one paragraph: accepted means
     per-plan review plus targeted gates; full repository verification
     (`mise run verify`, browser tests, the whole native parity suite) is
     deferred and NOT yet run and runs after the workflow on the tree
     merged with `feat/cad3d-pages` (design CAP-R7-01).
   - Overview evidence-roots row (line 77): M16 `target` only (CAP-R7-01).
   - Do not change any other overview line.

## Gates (run each to its end, foreground; complete log plus `exit=` line)

- G1 typecheck, lint and help/docs tests.
- G2 crate tests (debug).
- G3 capture CLI unit tests with `UPDATE_CAPTURE_FIXTURES=0`.
Before marking (change 3), run verification 1 and 2 and the `bun test`
part of verification 3 (same command up to and including the fixture
`git diff`). After marking, rerun all three verification commands in full;
the tail of verification 3 checks the deferral wording and that no
progress row is still pending. Timing tests: up to three attempts, then
the case alone; log every attempt.

## Pitfalls

- Never mark M16 accepted before all three gates have a passing run.
- Do not reword the deferral into "verified" or "passed"; keep the words
  "deferred and NOT yet run" in the header and in the overview paragraph.
- Read `docs/capture.md`, the design and the overview fresh; M16a and M16b
  changed them. Edit only the named sections.
- Do not touch `apps/cli/src/__fixtures__/`; G3 must leave it unchanged.

## Acceptance criteria

- `docs/capture.md` `## Measured budgets` equals the design 10.3 values.
- G1, G2, G3 exit 0 with positive pass counts and logs under
  `target/capture-m16/gates/`.
- The design header and overview Progress table mark every milestone,
  M16 included, accepted, and both contain "deferred and NOT yet run";
  the overview evidence-roots row gives M16 `target` only.

## Verification (each must exit 0 and run at least one test)

1. `sh -c 'mkdir -p target/capture-m16/gates && (bun run typecheck && bunx biome check apps/cli/src/capture-help.ts apps/cli/src/capture-docs.test.ts && bun test apps/cli/src/capture-docs.test.ts apps/cli/src/capture-command.test.ts apps/cli/src/ai-commands.test.ts apps/cli/src/table-docs.test.ts) > target/capture-m16/gates/g1-help-docs.log 2>&1; s=$?; echo "exit=$s" >> target/capture-m16/gates/g1-help-docs.log; test $s -eq 0 && grep -Eq "^ *[1-9][0-9]* pass$" target/capture-m16/gates/g1-help-docs.log && grep -Eq "^ *0 fail$" target/capture-m16/gates/g1-help-docs.log'`
2. `sh -c 'mkdir -p target/capture-m16/gates && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/capture-m16 cargo test -p nodetto-capture > target/capture-m16/gates/g2-crate.log 2>&1; s=$?; echo "exit=$s" >> target/capture-m16/gates/g2-crate.log; test $s -eq 0 && grep -Eq "test result: ok\. [1-9][0-9]* passed" target/capture-m16/gates/g2-crate.log'`
3. `sh -c 'mkdir -p target/capture-m16/gates && UPDATE_CAPTURE_FIXTURES=0 bun test apps/cli/src/capture-command.test.ts apps/cli/src/capture-cad.test.ts apps/cli/src/capture-io.test.ts apps/cli/src/capture-interference-options.test.ts apps/cli/src/mcp-image.test.ts > target/capture-m16/gates/g3-cli-unit.log 2>&1; s=$?; echo "exit=$s" >> target/capture-m16/gates/g3-cli-unit.log; test $s -eq 0 && grep -Eq "^ *[1-9][0-9]* pass$" target/capture-m16/gates/g3-cli-unit.log && git diff --exit-code -- apps/cli/src/__fixtures__ && grep -q "deferred and NOT yet run" design-docs/specs/design-ai-capture.md && grep -q "deferred and NOT yet run" impl-plans/active/capture-00-overview.md && ! grep -Eq "^\| M[0-9]+[a-f]? \| (pending|implemented)" impl-plans/active/capture-00-overview.md'`

## Progress

Pending. Read each owned file fresh before editing and record
`git hash-object` before and after; a differing hash from the last
recorded value is drift: stop and record it. Append: date, command, exit
status, full log path, attempts, hashes. If a gate fails, record the
blocker here and leave M16 pending.

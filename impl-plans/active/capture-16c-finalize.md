# M16c capture-16c-finalize (session 889, revised session 891)

- Stage: after capture-16b-budgets. dependsOn: capture-16a-help-docs
  (accepted in session 889), capture-16b-budgets (accepted first,
  including its session 891 repair).
- Design: `design-docs/specs/design-ai-capture.md` revision 7, header
  "Implementation status", 8.5 ("M16 reduced scope", gates 1 to 3,
  "Gate evidence", "Publication"), 10.3, CAP-R7-01, CAP-R7-04 to CAP-R7-06.
- writePaths: `docs/capture.md` (the `## Measured budgets` section only),
  `design-docs/specs/design-ai-capture.md` (the header "Implementation
  status" paragraph only), `impl-plans/active/capture-00-overview.md`
  (the `## Progress` section and the `Evidence roots` row only),
  `impl-plans/active/capture-16c-finalize.md`, `target`.
- artifactRoots: `target` (everything under `target/capture-m16/gates/`).

## Intent

Close M16. Copy the measured values into the user docs and run the three
targeted gates. Publish the accepted status only after final gates and
the independent review have passed on the exact candidate. Say plainly
that full repository verification is deferred and NOT yet run.

## Non-goals

No source, test, help or fixture change. No re-measurement. No git state
change by the worker (no commit, stash or branch). No `README.md`,
`impl-plans/README.md`, `mise.toml` or cad3d edit, and no plan
archiving. No native parity, `mise run verify`, browser test or
`cargo test --workspace`. No write under the repository `tmp/`.

## Phases (CAP-R7-06)

1. Preliminary. Under `## Measured budgets` in `docs/capture.md`, replace
   the placeholder sentence with three things. First, the machine line
   of design 10.3. Second, the 10.3 table, every `| ` line copied
   byte-for-byte. Third, one sentence on the method: crate release tests
   with printed timings, three timed native runs after a warm-up, and the
   Bun scene test. Keep the heading. Copy the `status-check.sh` block
   below verbatim (without its fence lines) to
   `target/capture-m16/gates/status-check.sh`, and record its
   `git hash-object` in Progress. In this plan file, edit only the
   Progress section. Record the `git hash-object` of the
   design and the overview, then run G1, G2 and G3. If a preliminary gate
   still fails after its retries, record a blocker with its command, log
   path and exit status. Restore nothing: no status edit exists yet, and
   both live hashes must still equal the values recorded above. M16
   stays pending. Stop.
2. Candidate. For each candidate attempt n, create a new snapshot
   directory `snap=$(mktemp -d target/capture-m16/gates/candidate-n.XXXXXX)`.
   Copy the design and the overview into it, and record its path and the
   two `git hash-object` values in Progress. Then make the edits below:
   - Design header: replace the "Implementation status (revision 7)"
     paragraph with `Implementation status (revision 7): implemented
     (slice); every milestone accepted. Milestones M1 to M15, M17 to M20,
     M22, M23a to M23f and M16 (M16a, M16b, M16c) are accepted by their
     per-plan reviews and the targeted gates of section 8.5.` Then keep
     these two sentences verbatim: "Full repository verification ... is
     deferred and NOT yet run; ..." and "\"Accepted\" in this document
     ... never means that this full verification has passed."
   - Overview `## Progress`: set all 27 rows to exactly `accepted`;
     M10's text becomes `accepted`. Directly under the table, add one
     paragraph saying that accepted means per-plan review plus targeted
     gates, and that full repository verification (`mise run verify`,
     browser tests, the whole native parity suite) is deferred and NOT
     yet run; it runs after the workflow on the tree merged with
     `feat/cad3d-pages` (design CAP-R7-01).
   - Overview `Evidence roots` row: find it by its text, not by line
     number. It becomes exactly ``| Evidence roots | M23 `tmp/capture` and
     `target`; M16 `target` (CAP-R4-07, CAP-R7-01) |`` (one line; the M23
     allocation is unchanged). No other overview line changes. No HTML
     comment goes into the header paragraph or the Progress section.
   Record the hashes of `docs/capture.md`, the design and the overview
   as the candidate identity. Run G1, G2 and G3F on this exact candidate.
3. Review. The independent per-plan review checks the same three hashes,
   the logs and the edits. It also checks that
   `target/capture-m16/gates/status-check.sh` is byte-equal to the block
   below.
4. Publish. Only the workflow's integration step commits. It does so
   after the review approves and the three hashes still match. If a
   candidate gate (G1, G2 or G3F) fails after its retries, or the review
   rejects the candidate, the M16c worker (owner of these writePaths)
   copies the design and the overview back only from that attempt's
   `$snap`. It then checks that their hashes equal the values recorded
   for that attempt and records the failing command, log path and exit
   status, or the review decision, as a blocker. M16 stays pending. A
   later attempt starts again at phase 2 with a new `$snap`. If the
   integration step cannot commit a reviewed candidate as is, record the
   needed ownership amendment here before dispatch; M16 stays pending.

## status-check.sh (arguments: design path, overview path)

```sh
set -u
hdr=$(awk '/^Implementation status/{f=1} /^Implementation plan:/{f=0} f' "$1" | tr '\n' ' ')
case $hdr in *'<!--'*) echo "header comment"; exit 10;; esac
case $hdr in *"implemented (slice); every milestone accepted"*) ;; *) echo "header status"; exit 11;; esac
case $hdr in *"deferred and NOT yet run"*) ;; *) echo "header deferral"; exit 12;; esac
case $hdr in *pending*) echo "header pending"; exit 13;; esac
prog=$(awk '/^## Progress$/{f=1;next} /^## /{f=0} f' "$2")
case $prog in *'<!--'*) echo "progress comment"; exit 20;; esac
rows=$(printf '%s\n' "$prog" | grep -E '^\| M[0-9]+[a-f]? \|')
test "$(printf '%s\n' "$rows" | grep -c .)" -eq 27 || { echo "row count"; exit 14; }
for m in M1 M2 M3 M4 M5 M6 M7 M8 M9 M10 M11 M12 M13 M14 M15 M16 M17 M18 M19 M20 M22 M23a M23b M23c M23d M23e M23f; do
  test "$(printf '%s\n' "$rows" | grep -c "^| $m | accepted |\$")" -eq 1 || { echo "row $m"; exit 15; }
done
after=$(printf '%s\n' "$prog" | awk '/^\|/{t=1;next} t' | tr '\n' ' ')
case $after in *"deferred and NOT yet run"*) ;; *) echo "progress deferral"; exit 16;; esac
ev=$(grep -E '^\| Evidence roots \|' "$2")
test "$(printf '%s\n' "$ev" | grep -c .)" -eq 1 || { echo "evidence row count"; exit 17; }
test "$ev" = '| Evidence roots | M23 `tmp/capture` and `target`; M16 `target` (CAP-R4-07, CAP-R7-01) |' || { echo "evidence row"; exit 18; }
echo "status-check ok"
```

## Gates (CAP-R7-05)

Run each gate to its end in the foreground. Every attempt, retry,
isolated comparison and final run gets a new `mktemp` log, prints
`log=<path>`, and ends the log with the exit status of the whole gate
after all assertions. Nothing is overwritten. Timing tests get up to
three attempts, then the case alone.

## Acceptance criteria

- The `| ` lines of `## Measured budgets` in `docs/capture.md` equal
  those of design 10.3, and the heading is unchanged.
- Preliminary G1 to G3 and candidate G1, G2 and G3F exit 0. Each has its
  own log under `target/capture-m16/gates/` with a positive pass count,
  zero failures and the last line `exit=0`.
- `status-check.sh` passes on the candidate. Both records contain
  "deferred and NOT yet run" in visible text, and the Evidence roots row
  equals the exact phase 2 line. The review approves the recorded hashes
  before the integration commit. A preliminary failure leaves both live
  hashes unchanged. A candidate failure or a rejection restores both
  records from that attempt's own `$snap`, and their hashes match.

## Verification (each must exit 0 and run at least one test)

1. G1: `sh -c 'd=target/capture-m16/gates; mkdir -p "$d" || exit 1; log=$(mktemp "$d/g1-help-docs.XXXXXX") || exit 1; echo "log=$log"; (bun run typecheck && bunx biome check apps/cli/src/capture-help.ts apps/cli/src/capture-docs.test.ts && bun test apps/cli/src/capture-docs.test.ts apps/cli/src/capture-command.test.ts apps/cli/src/ai-commands.test.ts apps/cli/src/table-docs.test.ts || exit 1; grep -Eq "^ *[1-9][0-9]* pass$" "$log" && grep -Eq "^ *0 fail$" "$log" || exit 1; awk "/^### 10.3/{f=1;next} /^## /{f=0} f && /^\\| /" design-docs/specs/design-ai-capture.md > "$log.design" && awk "/^## Measured budgets\$/{f=1;next} /^## /{f=0} f && /^\\| /" docs/capture.md > "$log.docs" && test -s "$log.design" && cmp "$log.design" "$log.docs") > "$log" 2>&1; s=$?; echo "exit=$s" >> "$log" || exit 1; exit $s'`
2. G2: `sh -c 'd=target/capture-m16/gates; mkdir -p "$d" || exit 1; log=$(mktemp "$d/g2-crate.XXXXXX") || exit 1; echo "log=$log"; (CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/capture-m16 cargo test -p nodetto-capture || exit 1; grep -Eq "test result: ok\. [1-9][0-9]* passed" "$log" && ! grep -q "test result: FAILED" "$log") > "$log" 2>&1; s=$?; echo "exit=$s" >> "$log" || exit 1; exit $s'`
3. G3 (preliminary) and G3F (candidate, `F=1`): `sh -c 'd=target/capture-m16/gates; mkdir -p "$d" || exit 1; log=$(mktemp "$d/g3${F:+f}-cli-unit.XXXXXX") || exit 1; echo "log=$log"; (UPDATE_CAPTURE_FIXTURES=0 bun test apps/cli/src/capture-command.test.ts apps/cli/src/capture-cad.test.ts apps/cli/src/capture-io.test.ts apps/cli/src/capture-interference-options.test.ts apps/cli/src/mcp-image.test.ts || exit 1; grep -Eq "^ *[1-9][0-9]* pass$" "$log" && grep -Eq "^ *0 fail$" "$log" && git diff --exit-code -- apps/cli/src/__fixtures__ && git diff --check || exit 1; test -z "${F:-}" || sh target/capture-m16/gates/status-check.sh design-docs/specs/design-ai-capture.md impl-plans/active/capture-00-overview.md) > "$log" 2>&1; s=$?; echo "exit=$s" >> "$log" || exit 1; exit $s'`

## Progress

Pending. Read each owned file fresh before editing and record
`git hash-object` before and after; a differing hash from the last
recorded value is drift: stop and record it. For every gate attempt,
append the date, phase, command, printed log path, exit status, pass and
fail counts and the attempt number. Also record the pre-candidate and
candidate hashes and the review decision.

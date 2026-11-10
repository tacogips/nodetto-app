# ipd-28-finish

- planId: ipd-28-finish
- planPath: impl-plans/active/ipd-28-finish.md
- progressPath: impl-plans/progress/ipd-28-finish.md
- dependsOn: none pending (accepted dependencies: ipd-22-desktop-export-compare-check, ipd-27-reproduction; transitively, every other ipd plan)
- Design (binding): `design-docs/specs/design-iphone-app-design.md`, "Verification" and "Accepted output changes".
- Evidence: `tmp/ipd-s772/ipd-28-finish/final/`.
<!-- ownership:start -->
- writePaths:
  - `impl-plans/README.md`
  - `design-docs/specs/design-iphone-app-design.md`
  - `impl-plans/progress/ipd-28-finish.md`
  - `tmp/ipd-s772/ipd-28-finish`
  - `target`
  - `apps/desktop/src-tauri/binaries`
- sharedPaths:
  - none
- sharedPathNotes:
  - none
- artifactRoots:
  - `tmp/ipd-s772/ipd-28-finish`
  - `target`
  - `apps/desktop/src-tauri/binaries`
<!-- ownership:end -->

Build artifact roots: `target` (and `apps/desktop/src-tauri/binaries` where declared) are outputs of cargo, `mise run test-cli` and `mise run build-cli`. They are git-ignored and contain no authored source. Never edit files under them by hand. Cargo's lock serializes concurrent builds; `ipd-24` additionally depends on `ipd-23`, so the W9 parity builds do not overlap.

## Intent and context

Close the work:

- run the full gates on the combined tree and compare them with the `ipd-00` baseline;
- check privacy and licenses;
- update `impl-plans/README.md` and the design status line.

The workflow's `plan-archive` node moves the `ipd` plans after final verification; this plan moves nothing.

## Non-goals

- No new behavior.
- Do not move plan files or progress logs.
- No push, merge or release.

## Steps and verification (each command's full output goes to `final/<name>.log`)

1. `CARGO_TERM_QUIET=true mise run verify` -> exit 0, or only the failures listed in the `ipd-00` "Baseline failures" table (named exclusions).
2. `CARGO_TERM_QUIET=true mise run test-cli` -> exit 0, or only baseline failures. The native parity tests must not be skipped. Retry up to 3 times, only on deadline timeouts.
3. `CARGO_TERM_QUIET=true mise run build-cli` -> exit 0.
4. `sh -c 'mkdir -p tmp/ipd-s772/ipd-28-finish/final && bun run typecheck --pretty false > tmp/ipd-s772/ipd-28-finish/final/typecheck.log 2>&1'` -> exit 0. This stays workspace-wide: ipd-28 runs alone after every other plan, so any `error TS` line anywhere fails it.
5. Privacy:
   - `git ls-files tmp | wc -l` -> 0.
   - `git ls-files -o --exclude-standard | grep -c '^tmp/'` -> 0.
   - `git grep --untracked -l -i -F -f tmp/ipd-s772/ipd-27-reproduction/private-terms.txt -- . ':!tmp'` -> exit 1 (no match).
     - `--untracked` also scans new, not-yet-committed files: examples, tests, plans, progress logs, the dispatch manifest. The commit step runs after this plan.
     - It keeps the standard excludes, so ignored `tmp/` content stays out.
   - If any file matches, record a finding listing the file. Do not print the matched text; keep `-l`. Redact the match in files this plan owns. For other files, record a `pending_downstream` finding for the commit step.
6. Licenses:
   - `test -f THIRD_PARTY_NOTICES.md && test -f packages/core/src/icons/LICENSE-lucide.txt && test -f packages/core/src/text-metrics/LICENSE-liberation-sans.txt` -> exit 0.
7. No emojis in changed or new text files, tracked or untracked (scanner: ripgrep; amendment IPD-R5):
   - Build the list: `{ git diff --name-only f59bef4; git ls-files -o --exclude-standard; } | sort -u | grep -E '\.(md|ts|tsx|json|html)$' | while read -r f; do test -f "$f" && echo "$f"; done > tmp/ipd-s772/ipd-28-finish/final/emoji-files.txt`, then record `wc -l < tmp/ipd-s772/ipd-28-finish/final/emoji-files.txt` as the scanned-file count (must be greater than 0). Also `grep -c '[[:space:]]' tmp/ipd-s772/ipd-28-finish/final/emoji-files.txt` -> 0, because the scan passes the list as unquoted arguments; if any path has whitespace, record a gate failure.
   - Positive control first: `printf 'a\xe2\x9c\x85b\n' | rg -n '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]'` -> exit 0 with one match line. Record the command and exit code in the progress log. If it does not exit 0, the scanner is broken: stop and record a gate failure.
   - Scan without xargs: `rg -n --no-messages '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' $(cat tmp/ipd-s772/ipd-28-finish/final/emoji-files.txt) > tmp/ipd-s772/ipd-28-finish/final/emoji-scan.out 2> tmp/ipd-s772/ipd-28-finish/final/emoji-scan.err; echo "exit=$?"` (if the list is too long for one argument vector, run it in chunks with the same rule per chunk).
   - Clean only when rg exits 1 AND `tmp/ipd-s772/ipd-28-finish/final/emoji-scan.out` and `tmp/ipd-s772/ipd-28-finish/final/emoji-scan.err` are both empty. Exit 0 means emojis were found (record each listed file and line as a finding). Any other exit code, or any stderr text, is a gate failure to record, never a pass.
8. Lockfile unchanged: `git diff --exit-code f59bef4 -- bun.lock package.json` -> exit 0.

## File-level changes

`impl-plans/README.md`: add a "Completed" entry in the existing style. It records:

- what was finished;
- the design path and the user-QA path;
- "no GitHub issue";
- gate results with pass/skip/fail counts, quoted from logs only;
- native parity not skipped;
- the evidence root `tmp/ipd-s772/<planId>/`;
- that progress logs remain in `progress/`.

Mention that the private reproduction exists only under the git-ignored `tmp/`, without naming it.

`design-docs/specs/design-iphone-app-design.md`: change only the status line, to "IMPLEMENTED, <date>, gates passed (see impl-plans/README.md)", and only after steps 1-4 pass.

## Semantic conflict handling

- For a gate failure, find the owning plan's requested behavior.
- A test pinning old behavior may change only where the design lists an accepted output change. Record the reason.
- Otherwise, the fix belongs to the owning plan. Record a finding with the command, log path, file and symbol.

## Done criteria

All of steps 1-8 are satisfied, the README entry exists, and the design status is updated.

## Worker rules

- Record `git hash-object` of this plan first.
- Read each file fresh before editing it, with pre and post hashes.
- No state-changing git commands, no emojis.
- Evidence files must not match Bun test patterns. Before repeating a gate, move `final/` to `attempt-<n>/`.

## Amendment 2026-11-10 (step5 s781 IPD-R5)

- The previous step 7 piped the file list into `xargs grep -nP`. On darwin, xargs runs `/usr/bin/grep` (BSD), which has no `-P` (`grep: invalid option -- P`, exit 2), and BSD xargs turns that into exit 1, the same code the gate expected for "no match". The gate therefore passed without scanning any file.
- Replacement: ripgrep (`rg`, installed through mise; host version 15.2.0) invoked directly, without xargs, with `--no-messages`. It keeps the same tracked plus untracked file union and the same extension filter.
- A recorded positive control (`printf 'a\xe2\x9c\x85b\n' | rg -n '<range>'` -> exit 0) proves the scanner works on the host before the scan.
- Only exit 1 with empty stdout and empty stderr counts as clean. Any stderr text or unexpected exit code is a gate failure.
- Do not use `grep -P` anywhere in this plan. Unchanged: the privacy `git grep --untracked` gate in step 5, writePaths, artifactRoots, dependsOn and the dispatch manifest.
- First real run of the amended scan (step 4 rerun, 133 files): positive control exit 0, scan exit 0 with empty stderr, matches only in `packages/core/src/icons/lucide-data.generated.ts` (upstream Lucide tags U+1F389 and U+1F38A on `party-popper`). `ipd-07b-icon-data-ascii` owns that fix (ASCII-escaped generated source, runtime data unchanged) and precedes this plan through `ipd-23` -> `ipd-24`/`ipd-26` -> `ipd-27`. If the scan still matches that file here, record a finding against `ipd-07b-icon-data-ascii`; do not exclude the file from the scan.

## Amendment 2026-11-10 (step5 s794 IPD-R7)

- The dispatch manifest still carried the pre-IPD-R5 `xargs grep -nP` emoji entry for this plan, which exits 0 without scanning on darwin. It is replaced by the three entries below, which implement step 7 exactly (same file union, extension filter, whitespace precheck, positive control and clean rule). The markdown and the manifest carry identical command strings; run them in this order:
  1. Positive control: `sh -c 'printf "a\xe2\x9c\x85b\n" | rg -n "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]"'` -> exit 0.
  2. File list: `sh -c 'D=tmp/ipd-s772/ipd-28-finish/final; mkdir -p "$D" && { git diff --name-only f59bef4; git ls-files -o --exclude-standard; } | sort -u | grep -E "\.(md|ts|tsx|json|html)$" | while read -r f; do test -f "$f" && echo "$f"; done > "$D/emoji-files.txt"; test -s "$D/emoji-files.txt" && test "$(grep -c "[[:space:]]" "$D/emoji-files.txt")" -eq 0 && wc -l < "$D/emoji-files.txt"'` -> exit 0 and prints the scanned-file count (greater than 0).
  3. Scan: `sh -c 'D=tmp/ipd-s772/ipd-28-finish/final; L="$D/emoji-files.txt"; test -s "$L" && test "$(grep -c "[[:space:]]" "$L")" -eq 0 || exit 2; rg -n --no-messages "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]" $(cat "$L") > "$D/emoji-scan.out" 2> "$D/emoji-scan.err"; rc=$?; echo "exit=$rc"; test "$rc" -eq 1 && test ! -s "$D/emoji-scan.out" && test ! -s "$D/emoji-scan.err"'` -> exit 0 only when rg exits 1 and `emoji-scan.out` and `emoji-scan.err` are empty. It exits 2 on an empty or whitespace-containing list, because rg without path arguments would search the whole working directory.
- Any non-zero exit of these entries is a gate failure; on a scan failure, list each file and line from `emoji-scan.out` as a finding. Do not exclude `packages/core/src/icons/lucide-data.generated.ts`.
- Unchanged: steps 1-6 and 8, the privacy `git grep --untracked` gate, planId, dependsOn, writePaths, sharedPaths and artifactRoots.

## Amendment 2026-11-10 (operator round 16, binding; keep this section verbatim)

Determinism contract. Documents built through `nodetto-cli edit` operations contain values generated at random: element and component ids (including the ids kit insertion mints internally) and fractional ordering keys such as element `index` and page `order`. Repeated-run and Bun-versus-native determinism checks therefore use the round-15 generated-value comparison from `ipd-24-parity-flows`, never raw byte equality:

- ids are replaced by ordinal placeholders, never numbered by their position in the file;
- generated ordering keys are compared by relative order within their collection;
- every other field and every pre-existing value is compared exactly.

The committed example document is generated once and committed. Its regression test validates it, lints it with zero findings and renders it, but does not regenerate it byte for byte. Do not change engine id generation. Keep the work already in the working tree and continue from it.

## Amendment 2026-11-10 (operator round 19, binding; keep this section verbatim)

Reproduction lint gate (operator round 19, binding for ipd-27a, ipd-27b, ipd-27c, ipd-27-reproduction and ipd-28-finish; replaces the plain zero-findings wording for the reproduction document only): `app-off-grid`, `note-overflow`, `app-text-overflow`, touch-target, overlap and every error must be zero. `app-misaligned` ("nearly aligns") findings are allowed only for elements whose position matches the reference screenshot within 4 points, because the reference itself is not pixel-aligned; record their count per screen in the progress log. The generic example and kit tests keep the strict zero-findings gate.

Keep the work already in the working tree and continue from it.

## Amendment 2026-11-10 (step 4 s806 plan consistency, round 19)

The step 5 privacy gate in the dispatch manifest is now `sh -c 'test -s tmp/ipd-s772/ipd-27-reproduction/private-terms.txt && ! git grep --untracked -l -i -F -f tmp/ipd-s772/ipd-27-reproduction/private-terms.txt -- . ":!tmp"'` -> exit 0. It still runs `git grep --untracked` and still expects no match. It now also fails when `private-terms.txt` is missing or empty, which the bare negation used to treat as a pass. The round-19 reproduction lint rule (only `app-misaligned` allowed, each finding justified within 4 points) applies to the reproduction document only. The ipd-28 suite gates are unchanged.

Unchanged: planId, dependsOn, writePaths, sharedPaths, artifactRoots, steps 1-8 and the emoji gates.

## Amendment 2026-11-10 (operator round 22, binding; keep this section verbatim)

Scratch rule (operator round 22, binding for every remaining plan): temporary directories that test harnesses create under the operating system temp dir (mkdtemp under os.tmpdir(), for example nodetto-*-parity-*) are authorized scratch and are not write-scope violations. The reproduction plans do not run the native parity suites (they belong to accepted ipd-23 and ipd-24); their required gates are build-cli plus the reproduction gates.

## Amendment 2026-11-10 (operator round 23, binding; keep this section verbatim)

Near-alignment justification (operator round 23, binding for ipd-27b, ipd-27c, ipd-27-reproduction and ipd-28-finish): justify `app-misaligned` findings in bulk, not one by one. For each screen, export the frame and run nodetto-cli compare against its reference with the 4-point grid. If the comparison shows the flagged elements within 4 points of their reference positions, record a single line per screen in the progress log: screen number, count of app-misaligned findings, and 'within 4 points of reference'. A part is done when hard findings are zero, the per-screen lines are recorded, and the operator-style visual checklist (positions within 4 points, icons, colors, weight, nothing missing) is met for its screens. Do not spend continuations on cosmetic differences under 4 points.

`ipd-27a-reproduction-chrome` is accepted; its document and comparisons are in `tmp/ipd-s772/ipd-27-reproduction/work/`. Continue from them.

## Amendment 2026-11-11 (operator round 25, binding; keep this section verbatim)

Performance target and scratch (operator round 25, binding for ipd-27p and every remaining plan): the git-ignored apps/desktop/tmp/ directory created by existing test suites is authorized scratch, like OS temp directories. For ipd-27p, the synthetic native timing regression passes when every native batch finishes in under 5 s and the batch on the largest document takes under 4 times the first batch (this replaces the 3 s / 3x wording; the constraint-planning guard already cut batches from 8.1-21.3 s to 2.2-3.8 s). Keep looking for remaining per-operation whole-document work only while it is cheap; then complete the verification suite and record before/after timings.

## Amendment 2026-11-11 (operator round 26, binding; keep this section verbatim)

General scratch rule (operator round 26, binding for every remaining plan; supersedes the narrower round-22 and round-25 scratch wording): files that test harnesses or CLI commands write while running a plan's required verification are not write-scope violations when they land in git-ignored scratch: anywhere under the repository tmp/ (including other plans' tmp/ipd-s772/* artifact roots, for example tmp/ipd-s772/ipd-26-example-sample/ written by apps/cli/src/native-parity/iphone-kit-example.test.ts), apps/desktop/tmp/, target/, or the operating system temp directory. A plan's own source edits must still stay within its writePaths, and `git status --porcelain` must show no new tracked or untracked non-ignored files outside them.

## Amendment 2026-11-11 (operator round 29, binding; keep this section verbatim)

Formatting authority (operator round 29, binding for ipd-28-finish): ipd-28 may apply formatting-only fixes (`bunx biome check --write` or `bunx biome format --write` limited to files changed on this branch versus f59bef4, and `cargo fmt` for changed Rust files) to any such file, even outside its writePaths, provided `git diff` of those files after formatting shows only whitespace and formatting changes and every behavioral test still passes; record the formatted paths in the progress log. Then rerun every required gate.

## Amendment 2026-11-11 (operator round 30, binding; keep this section verbatim)

Test-discovery hygiene (operator round 30, binding for ipd-28-finish): the operator renamed the four test-named scratch copies under git-ignored tmp/ (two ipd-21 pre-format copies and two step-4 simulations) to *.test.ts.evidence, preserving their content, so the workspace `bun test` in `mise run verify` no longer collects them. Never write files named *.test.ts or *.test.tsx under tmp/; save copies with an .evidence suffix. Rerun every required gate; the formatting fix to packages/core/src/index.ts is already applied.

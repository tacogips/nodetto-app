# ipd-28-finish

- planId: ipd-28-finish
- planPath: impl-plans/active/ipd-28-finish.md
- progressPath: impl-plans/progress/ipd-28-finish.md
- dependsOn: ipd-22-desktop-export-compare-check, ipd-27-reproduction (transitively, every other ipd plan)
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
4. `bun run typecheck` -> exit 0.
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

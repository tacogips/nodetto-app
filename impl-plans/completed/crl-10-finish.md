# crl-10-finish

- planId: crl-10-finish
- planPath: impl-plans/active/crl-10-finish.md
- progressPath: impl-plans/progress/crl-10-finish.md
- wave: 2 (final); dependsOn: crl-09-parity-e2e
- Manifest (single source for writePaths, sharedPaths, artifactRoots): `impl-plans/active/crl-s759-dispatch.json`
- Design (binding): `design-docs/specs/design-connector-routing-arranging.md`, sections "Continuation plans" and "Owner performance decision".
- Evidence: `tmp/crl-s759/crl-10-finish/`, with gate logs in `final/`. Earlier logs under `tmp/crl-s754/` stay read-only.

## Intent and context

Finishes W5: help and docs are current, the earlier crl plans are archived, `impl-plans/README.md` is updated, and all gates pass on the merged tree. That tree also holds element conversion, participant shapes, ERD frame scope, sequence self-messages and file save stability. Fix any semantic conflict the gates expose.

The workflow's `plan-archive` node moves the plans dispatched in this run, after final verification. This plan moves the earlier files, which this run does not dispatch. Workers never move a plan that is in this run.

## Non-goals

- No new behavior. No new test beyond one needed to pin a conflict fix.
- Do not move `crl-09-parity-e2e.md`, `crl-10-finish.md` or `crl-s759-dispatch.json`.
- Do not move progress logs, including this plan's. They stay in `impl-plans/progress/`.
- Do not change deadlines, the fixture generator or test discovery configuration. No push or merge.
- No performance work. The owner decision in the design is final. Do not re-time unless a fix here changes non-test source on the arrange path.

## File-level changes

Docs and help, `apps/cli/src/help.ts` and `docs/cli.md`:

- Check each item in the `crl-07-wiring` help list (its "File-level changes"). Add only what is missing. `docs/cli.md:300-304` and `help.ts:305-308` already hold much of it.
- Add: arranging repairs remaining overlaps, including by moving port positions; a moved label takes the nearest free position to its connector or loop, and the candidate definition of "free position".
- Remove any text that offers a measured bound for the fixture.
- `docs/editing.md` and `README.md`: edit only where they list these features.

`apps/cli/src/commands.ts` and `packages/core/src/index.ts`: change only if a gate requires it. The test-only exports in `connector-label-placement.ts` stay out of `index.ts`.

Archive, using plain `mv` (no git commands):

- From `impl-plans/active/` to `impl-plans/completed/`: `crl-00-overview.md`, `crl-01-ir-resolver.md`, `crl-02-metric-fixture.md`, `crl-03-label-placement.md`, `crl-04-connect.md`, `crl-05-lanes-self-loops.md`, `crl-06-layered-order.md`, `crl-07-wiring.md`, `crl-08-repair-labels.md`, `crl-s749-dispatch.json`, `crl-s753-dispatch.json`, `crl-s754-dispatch.json`. crl-08 is accepted and committed, and the last two are replaced manifests, so none of them is in this run.
- Append a closing note to `impl-plans/completed/crl-07-wiring.md`: crl-08 to crl-10 and the design's "Continuation plans" and "Baseline binary and timing" sections replace its open items and its `target/crl-baseline` steps. Its plan body and amendments stay as they are.

`impl-plans/README.md`:

- Add a "Completed" entry in the existing style: what was finished, the design path, no GitHub issue, final gate results (pass, skip and fail counts, native parity not skipped), timing summary (the target of at most 6 user seconds per `arrange` command when uncontended, and the recorded means of layered 4.873 and route 3.890), evidence roots `tmp/crl-s749/<planId>/`, `tmp/crl-s753/<planId>/`, `tmp/crl-s754/<planId>/` and `tmp/crl-s759/<planId>/`, and progress logs in `progress/`. State only results recorded in logs.
- State that crl plans and crl manifests belong in `completed/`, unlike manifests other features keep in `active/`, because the request named them, and that `crl-09`, `crl-10` and `crl-s759-dispatch.json` are moved there by the `plan-archive` node after final verification. Name `crl-s753-dispatch.json` and `crl-s754-dispatch.json` as replaced manifests, already in `completed/`.

`design-docs/specs/design-connector-routing-arranging.md`: change only the status line, to record completion after the gates pass.

## Semantic conflict fixes

- For a gate failure, first find which feature's requested behavior the test pins. A test pinning old behavior may change only where the new behavior is the requested one (see the design's "Existing outputs that may change"), with the reason recorded. Otherwise fix the source.
- `apps/cli/src/__fixtures__/sequence-golden` and `obstacle-routing-batch` goldens: the second must not change; the first changes only with a recorded reason.
- A needed edit outside `writePaths` is a blocker: name the failing command, log path, file and symbol.
- If a fix changes non-test source on the arrange path, repeat only the two `arrange` timing rows of crl-09's "Timing" section, 3 runs each, with nothing else running, and record them. A result above 6 user seconds means that fix regressed the command: rework the fix instead of optimizing other code.

## What a careless implementation gets wrong

- A `bun test` path is a filter over a discovery tree. Keep no test-named files in `tmp/` or `target/`.
- `mise run test-cli` is the only gate that runs native parity with the binary set. A pass on `verify` alone does not satisfy W3.
- Retry only on native deadline timeouts, up to 3 attempts. An assertion failure is a failure on the first attempt.
- Archive after the gates pass, then rerun the checks below that read paths.
- The README must not claim anything about the desktop app or results that no log records.

## Invariants

No deadline is relaxed. The fixture generator is unchanged. Docs state the precedence verbatim: explicit field > page default > page convention > existing default.

## Worker rules

Before starting, record `git hash-object` of this plan. Read each file fresh before each edit and record pre and post `git hash-object` in the progress log. On drift, re-read, keep the other change, record it. Edit only your own progress log. No state-changing git commands. No broad formatting. Never run `cargo clean`. Neutral names only. No emojis. Before repeating a gate, move `final/` to `attempt-<n>/`. An incomplete log is not a passing check.

## Verification (each must exit 0, full output in `final/<name>.log`)

1. `BUN_OPTIONS=--jsx-runtime=classic CARGO_TERM_QUIET=true mise run verify` -> exit 0.
2. `CARGO_TERM_QUIET=true mise run test-cli` -> exit 0, native parity not skipped. Up to 3 attempts on a deadline timeout only.
3. `bun run typecheck` -> exit 0.
4. `bunx biome check apps/cli/src/help.ts` -> exit 0.
5. `grep -q 'explicit field > page default > page convention > existing default' docs/cli.md` -> exit 0.
6. `grep -q 'nearest free' docs/cli.md` -> exit 0.
7. `test -f impl-plans/completed/crl-07-wiring.md` -> exit 0, after the archive.
8. `test ! -e impl-plans/active/crl-s749-dispatch.json` -> exit 0, after the archive.
9. `grep -q 'crl-s753-dispatch.json' impl-plans/README.md` -> exit 0.
10. `git diff --exit-code -- apps/cli/src/__fixtures__/connector-arrange.ts` -> exit 0.
11. `test ! -e impl-plans/active/crl-s753-dispatch.json` -> exit 0, after the archive.
12. `grep -q 'crl-s754-dispatch.json' impl-plans/README.md` -> exit 0.
13. `grep -q 'crl-s759-dispatch.json' impl-plans/README.md` -> exit 0.
14. `test -f impl-plans/completed/crl-08-repair-labels.md` -> exit 0, after the archive.
15. `test ! -e impl-plans/active/crl-08-repair-labels.md` -> exit 0, after the archive.
16. `test ! -e impl-plans/active/crl-s754-dispatch.json` -> exit 0, after the archive.

## Done criteria

- Verification 1 to 16 exit 0 with complete logs and exit statuses in the progress log, with pass and skip counts for gates 1 and 2.
- Each changed existing test has its reason recorded.
- All twelve earlier files are in `impl-plans/completed/`, and none is in `impl-plans/active/`.
- `grep -l target/crl-baseline tmp/crl-s759/crl-10-finish/final/verify.log tmp/crl-s759/crl-10-finish/final/test-cli.log` lists no file.

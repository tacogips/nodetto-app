# car7-f1b-incomplete-exit

- planId: car7-f1b-incomplete-exit; wave 1; dependsOn: none
- progressPath: impl-plans/progress/car7-f1b-incomplete-exit.md
- Finding: function-capture-coarse-scan-reported-as-refinement (CLI exit predicate, help,
  docs) plus the low fixture typing error at `packages/core/src/capture/report.test.ts:55`.
- Design: `design-docs/specs/design-ai-capture.md` 25.1 R7-1 (exit rule, help text,
  docs wording, fixture typing, CLI tests). No cargo commands in this plan.
- Follow `impl-plans/active/car7-00-overview.md` worker rules.

## Intent and context

`interferenceExitCode` (`apps/cli/src/capture-interference-options.ts`, last function)
fails only on `report.pairs.length > 0` or `uncheckedCount > 0`, so an `incomplete` pair
exits 0 under `--fail-on-interference`. The parser (`packages/core/src/capture/report.ts:25`,
`:102-108`), the shared text (`describe.ts:78-126`) and the desktop note already handle
`analysis.incomplete`; tests use injected reports, so this plan does not wait for the
Rust producer (car7-f1a).

Non-goals: no edit to `describe.ts`, `report.ts`, `capture-cad.ts`, `capture-command.ts`,
`export-handlers.ts`, Rust or native-parity tests. Do not edit the existing ordinary-cap
case in `capture-cad.test.ts`.

## Changes

- `capture-interference-options.ts` `interferenceExitCode(report, failOnInterference)`:
  return 1 when `failOnInterference` and any of `report.pairs.length > 0`,
  `(report.analysis?.uncheckedCount ?? 0) > 0`,
  `(report.analysis?.incomplete?.length ?? 0) > 0`; else 0. Signature unchanged.
- `capture-help.ts` exit paragraph: `1 only with --fail-on-interference for an
  interfering pair, an unchecked candidate or an incomplete coarse check`; keep the
  existing wrap width (about 80 columns) and the `Exit codes:` ... `errors.` shape that
  `capture-docs.test.ts` extracts.
- `capture-help/interference.ts` flag line: `--fail-on-interference Exit 1 for
  interference, unchecked or incomplete pairs.` (same column alignment as its siblings).
- `docs/capture.md`:
  - line 33 table cell: `Exit 1 on interference, unchecked candidates or incomplete coarse
    checks; default off.`
  - output paragraph (lines 38-43) gains: an `incomplete:` line names a checked pair whose
    coarse check stopped before covering it; it ends with `interference not determined`,
    or with `the overlap listed above was found in the picture only` when a picture-only
    record names the same bodies; JSON lists such pairs as body ids in
    `interference.incomplete` (report key `analysis.incomplete`, body indices), present
    only when non-empty;
  - line 104: `... to signal interference, unchecked candidates or incomplete coarse
    checks.`;
  - exit line 109: `- 1: only with --fail-on-interference, when a pair interferes, a
    candidate was not checked, or a checked pair's coarse check is incomplete. A pair
    capped only during refinement does not change the exit status.`
- `packages/core/src/capture/report.test.ts:55`: `const incomplete = [[0, 1]] as const;`
  (nothing else in the file).

Pitfalls: do not treat `cappedWithoutHit` or `cappedCount` as failing; do not drop the
`?? 0` guards (legacy reports have no `incomplete`); keep docs terms the docs test checks
(`--fail-on-interference`, `## Exit codes`, `approximate`, etc.).

## Tests (write first; record failures)

`capture-interference-options.test.ts` (imitate the test at `:36`), each flagged and
unflagged:
- capped analysis pair, no `incomplete` -> flagged 1, unflagged 0;
- pairs [], `cappedWithoutHit [[0,1]]`, `incomplete [[0,1]]` -> flagged 1 (fails before),
  unflagged 0;
- pairs [], `cappedCount 1`, `cappedWithoutHit [[0,1]]`, no `incomplete` -> 0 and 0;
- legacy analysis object without the key -> unchanged results.

`capture-cad.test.ts` (imitate the `unchecked and capped analysis control exit codes`
case around `:401-457`, harness bodies): analysis `checked 1, cappedCount 1,
cappedWithoutHit [[0,1]], incomplete [[0,1]]`, pairs [] ->
- text contains `1 of 1 checked candidate pair incomplete` and the line
  `  incomplete: <a> x <b>; the coarse check stopped before covering this pair, interference not determined`
  with the harness body names; `--fail-on-interference` exit 1 (fails before);
- `--json`: `interference.incomplete` equals the two body ids; exit 1;
- the same report without the flag exits 0 in both modes;
- a refinement-only capped miss (no `incomplete`) with the flag exits 0 in text and JSON.

## Verification (each exits 0 and runs tests)

1. `bunx biome check --diagnostic-level=warn apps/cli/src/capture-interference-options.ts apps/cli/src/capture-interference-options.test.ts apps/cli/src/capture-cad.test.ts apps/cli/src/capture-help.ts apps/cli/src/capture-help/interference.ts packages/core/src/capture/report.test.ts`
2. `bun test apps/cli/src/capture-interference-options.test.ts apps/cli/src/capture-cad.test.ts apps/cli/src/capture-docs.test.ts packages/core/src/capture/report.test.ts`
   - evidence: new cases passed and recorded failing before the predicate change; docs
     test still passes; report test passes.
Workspace `bun run typecheck` (which proves the `as const` fix) runs at integration.

## Done criteria

- Predicate, help, docs and fixture updated; both commands exit 0; progress log `done`.

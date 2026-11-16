# dps-17-final

- planId: dps-17-final (session 864, wave 3, dependsOn: dps-17a-owner-tests,
  dps-17b-golden-identity, dps-17c-page-ui-tests,
  dps-17d-pdf-text-individual, dps-17e-desktop-export-tests,
  dps-17f-cli-parity, dps-17g-docs-examples)
- Design: `design-docs/specs/design-document-pages-snippets.md` sections
  10.2 (final gates) and 11.
- writePaths:
  - `impl-plans/progress/dps-17-wiring.md`
  - `impl-plans/progress/dps-17-final.md`
  - `tmp/dps-s864/dps-17-final`
  - `target` (artifact root; the default `target/release` is used by
    test-cli)
- sharedPaths: none. artifactRoots: `target`.

## Intent

Run the final gates on the joined tree and record dps-17-wiring
completion. This plan edits no source, test, doc or example. If a gate
fails, record which test failed and which plan owns it (section 10.2
table); that plan is repaired serially. Then rerun all gates.

## Gates (each must exit 0; logs in `tmp/dps-s864/dps-17-final/`)

1. `bun test packages/ir packages/io packages/core packages/ui-solid apps/cli/src > tmp/dps-s864/dps-17-final/aggregate.log 2>&1`
   -> 0 fail. The 5 failures of
   `tmp/dps-s863/dps-17-wiring/round2-aggregate.log` are gone.
2. `bun run typecheck`
3. `mise run lint`
4. `CARGO_TERM_QUIET=true mise run verify`. This includes `bun test` on
   the whole tree, desktop tests included. Do not set `CARGO_TARGET_DIR`.
5. test-cli, up to 3 attempts, retrying only on a deadline timeout.
   Deadlines are unchanged, and the default target dir is required because
   test-cli runs `$PWD/target/release/nodetto-cli`:

   ```
   sh -c 'mkdir -p tmp/dps-s864/dps-17-final; for i in 1 2 3; do CARGO_TERM_QUIET=true mise run test-cli > tmp/dps-s864/dps-17-final/test-cli-$i.log 2>&1 && exit 0; grep -qiE "timed out|deadline" tmp/dps-s864/dps-17-final/test-cli-$i.log || exit 1; done; exit 1'
   ```

## Done criteria (recorded in `impl-plans/progress/dps-17-wiring.md`)

- Status is set to complete only if all five gates exit 0.
- For each gate: the command, exit code, log path and attempt count.
- Each acceptance item in `impl-plans/active/dps-17-wiring.md` (Changes
  1-8, Tests, session 863 additions 1-5, done criteria) mapped to its
  passing test file or `rg` check.
- Whether `markdown-snippet/layout.ts` changed, copied from the dps-17b
  progress.
- The `rg` checks:
  - `rg -n "Unknown language" apps/cli/src/document-wiring.test.ts`
  - `rg -n -- "--format markdown --document" apps/cli/src/help.ts docs/cli.md`

## Non-goals

No source edits, no git state changes, no push, no version bump.

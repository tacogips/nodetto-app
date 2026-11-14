# slk-00-strict-index-gate

- planId: slk-00-strict-index-gate
- planPath: impl-plans/active/slk-00-strict-index-gate.md
- progressPath: impl-plans/progress/slk-00-strict-index-gate.md
- wave: 1; dependsOn: none
- Design: `design-docs/specs/design-slide-link-animation.md` section 9.1.
- writePaths: `.agents/scripts/strict-index-gate.ts` (new),
  `.agents/scripts/strict-index-gate.test.ts` (new),
  `impl-plans/progress/slk-00-strict-index-gate.md`,
  `tmp/slk-s855/slk-00-strict-index-gate`, `target`
- sharedPaths: none. artifactRoots: `target`.

## Intent and context

The private sync Worker compiles nodetto-app with `noUncheckedIndexedAccess`.
The repo `typecheck` (`tsc --noEmit`) does not enable that flag. Step 3
review found that `bun run typecheck --noUncheckedIndexedAccess` already
exits 2 at `ccac2d3`, with diagnostics in unrelated files (tests, fixtures,
`packages/ui-solid/src/compare-dialog.ts`, `CompareDialog.tsx`). This plan
adds a gate that fails only on strict diagnostics introduced in
feature-owned files. Step 4 could not capture the baseline itself (the
sandbox denied the command), so the gate captures it from a pristine export
of `ccac2d3`. Concurrent wave-1 edits therefore cannot contaminate it.

## Non-goals

- Do not fix any baseline diagnostic. Do not touch `tsconfig*.json`,
  `package.json`, `mise.toml` or `.agents/scripts/lint-ts.sh`.
- The gate is not added to `mise run verify`.

## CLI (pinned; other plans call it exactly like this)

```text
bun .agents/scripts/strict-index-gate.ts capture-baseline --ref ccac2d3 --out target/strict-index/baseline.log
bun .agents/scripts/strict-index-gate.ts check --baseline target/strict-index/baseline.log --log target/strict-index/<planId>.log -- <file> [<file> ...]
```

`capture-baseline`:

1. If `<out>` and `<out>.ref` exist and `.ref` equals the resolved full SHA
   of `--ref`, reuse them, print `baseline reused`, and exit 0 (idempotent).
2. Otherwise:
   - create a per-invocation extraction directory
     `target/strict-index/base-tree-<pid>-<timestamp>` (never a fixed name,
     so concurrent captures cannot remove or overwrite each other's tree);
   - export the ref with `git archive <ref> | tar -x -C <that dir>`;
   - for each existing `packages/*/node_modules` and `apps/*/node_modules`
     in the working tree, create a symlink at the same relative path inside
     `<that dir>` (the root `node_modules` resolves by walking up);
   - run `<repo>/node_modules/.bin/tsc --noEmit --pretty false -p <that dir>/tsconfig.json --noUncheckedIndexedAccess`
     and capture its complete output in memory or in a temp file outside
     the extraction dir;
   - remove `<that dir>` recursively in a `finally` block, after tsc exits
     and whether it succeeds, fails or the launch throws. This must happen
     before the `.exit`/`.ref` files are written and before returning.
     Removing the symlinks must not follow them (use `rm` semantics on the
     directory tree, not on the link targets).
3. Write the complete stdout+stderr to a temp file and rename it to `<out>`
   (atomic, so concurrent captures are safe). Write the tsc exit code to
   `<out>.exit` and the SHA to `<out>.ref`. Normalize paths by stripping
   the `<that dir>/` prefix (repo-relative form
   `target/strict-index/base-tree-<pid>-<timestamp>/`), so diagnostic paths
   are repo-relative and independent of the per-invocation name.
4. Exit 0 only when the tsc exit is 0, or 2 with at least one parsable
   diagnostic. Otherwise exit 1 (compiler failure).

`check`:

1. Run `node_modules/.bin/tsc --noEmit --pretty false -p tsconfig.json --noUncheckedIndexedAccess`
   in the working tree. Write the complete output to `--log` and the exit
   code to `<log>.exit`.
2. Fail (exit 1) when:
   - the baseline or its `.exit` is missing or unreadable;
   - tsc failed to launch;
   - the tsc exit is not 0 or 2;
   - the tsc exit is 2 and no diagnostic parses.
3. Parse each diagnostic line `^(.+)\((\d+),(\d+)\): error (TS\d+): (.*)$`.
   Continuation lines (indented) are ignored. The key is
   `(path, code, message)`, without line or column.
4. A listed file is "new" when `git cat-file -e ccac2d3:<file>` fails.
   - A new file must have zero diagnostics.
   - An existing file passes when its diagnostic multiset is a subset of
     that file's baseline multiset.
   - Unlisted files are ignored for pass/fail. Their counts appear in the
     summary.
   - A listed path that does not exist fails.
5. Print a summary: listed files, new diagnostics with full lines, and
   ignored count. Exit 0 only if every listed file passes.

Imitate: argument parsing and `Bun.spawnSync` style in existing
`apps/cli/scripts/*.ts` (read one first). Keep the parser and rule logic in
exported pure functions (`parseDiagnostics`, `evaluateGate`) so the test
needs no compiler.

## Pitfalls

- Never treat exit 2 as success without applying the rules, and never treat
  an empty log as success.
- `--pretty false` is required; pretty output breaks the regex.
- Use `node_modules/.bin/tsc`, not a global tsc.
- Do not write outside `target/strict-index/` and the evidence root.
- Never leave an extracted tree under the repo. `bun test <filter>` matches
  paths by substring, and the unfiltered `bun test` in `mise run test` /
  `mise run verify` has no path-ignore setting (`bunfig.toml` has only
  `preload`). Stale `ccac2d3` copies of `*.test.ts` would run alongside the
  real suites, roughly doubling runtime against deadline tests and causing
  mixed-tree failures. Do not fix this by editing `bunfig.toml` (non-goal);
  always remove the tree in `finally`.
- Removing the tree must not delete the real `node_modules` through the
  symlinks.

## Tests (`strict-index-gate.test.ts`, pure functions only)

- sample with 2 diagnostics plus a continuation line -> 2 parsed entries
  with path, code and message
- new file with 1 diagnostic -> fail
- existing file whose diagnostics equal the baseline (different lines) -> pass
- existing file with one extra `(code, message)` -> fail
- unlisted file diagnostics -> pass, counted as ignored
- tsc exit 1 -> fail; exit 2 with no parsable line -> fail; baseline missing -> fail
- a capture-log line prefixed with `target/strict-index/base-tree-123-456/packages/a.ts(...)`
  -> normalized to `packages/a.ts`

## Verification (each must exit 0)

1. `bun test ./.agents/scripts/strict-index-gate.test.ts`: all tests pass.
2. `bunx biome check --diagnostic-level=warn .agents/scripts/strict-index-gate.ts .agents/scripts/strict-index-gate.test.ts`:
   no diagnostics. If biome excludes `.agents`, record its output in the log;
   it still exits 0.
3. `bun .agents/scripts/strict-index-gate.ts capture-baseline --ref ccac2d3 --out target/strict-index/baseline.log`:
   exit 0. Record `baseline.exit` (expected 2) and the diagnostic count in
   the progress log.
4. `test -z "$(find target/strict-index -name '*.test.ts' -print -quit)"`:
   exit 0, meaning no extracted test file remains after the capture.
5. `test -z "$(find target/strict-index -maxdepth 1 -name 'base-tree-*' -print -quit)"`:
   exit 0, meaning no extraction directory remains.
6. `test -d node_modules/.bin && test -d packages/core/node_modules`: exit 0,
   meaning the real node_modules survived the cleanup.

Evidence: save each command's complete output to
`tmp/slk-s855/slk-00-strict-index-gate/<n>.log` with its exit code.

## Acceptance criteria

- Both subcommands behave as specified. The tests cover every fail rule.
- `target/strict-index/baseline.log`, `.exit` and `.ref` exist and `.ref`
  is the full SHA of `ccac2d3`.
- After the capture, no `*.test.ts` file and no `base-tree-*` directory
  exists under `target/strict-index` (verification steps 4-5 exit 0), and
  the real `node_modules` is intact (step 6).
- No file outside writePaths changed.

## Amendment 2026-11-12 (Step 5 SLK-PLAN-001)

capture-baseline extracts into a per-invocation directory and removes it in
`finally`. A pitfall and verification steps 4-6 were added. The gate rules
(design 9.1), the pinned CLI and the
`baseline.log`/`.exit`/`.ref` locations are unchanged.

## Progress log

Record each step with the command, exit code, log path and file hashes.

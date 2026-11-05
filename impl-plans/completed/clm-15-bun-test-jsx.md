# clm-15-bun-test-jsx

- planId: clm-15-bun-test-jsx
- planPath: impl-plans/active/clm-15-bun-test-jsx.md
- progressPath: impl-plans/progress/clm-15-bun-test-jsx.md
- wave: 1; dependsOn: none
- Workflow mode: `issue-resolution` (manifest `workflowMode`). Manifest:
  `impl-plans/active/clm-s732-dispatch.json`.
- Findings: IR-S732-JSXDEV-UNOWNED-FINAL-GATE and S5-CLM15-FULL-BUILD-GATE (checkpoint
  amendment round 1).
- writePaths: see "File-level changes". sharedPaths: none. artifactRoots: `target`.

## Intent and context

The accepted run must end with `mise run verify` passing, and that task runs plain
`bun test`. Six test files fail to load there, so clm-09's final gate cannot pass. CI
does not show this, because its `bun test` step covers only `apps/cli/src`.

The failure reproduces at checkpoint HEAD, so no plan in this run caused it:

- Command: `bun test packages/ui-solid/src/Toolbar.test.ts` (Bun 1.4.4, pinned in
  `mise.toml`).
- Result: 0 pass, 1 fail, 1 error, `Export named 'jsxDEV' not found` in solid-js
  `dist/solid.js`.
- Evidence: `tmp/clm-s732/serial-reconcile/baseline-ui-solid-at-head.log`,
  `bun-test-full.log` and `bun-test-full-failures.txt` in that directory.

Confirmed root cause:

- `tsconfig.base.json` sets `jsxImportSource` to `solid-js`, so Bun compiles `.tsx` to
  `solid-js/jsx-dev-runtime`.
- solid-js 1.9.15 maps that export to `dist/solid.js`, which has no `jsxDEV`.
- `solid-js/h/jsx-dev-runtime` does export `jsxDEV`
  (`node_modules/.bun/solid-js@1.9.15/node_modules/solid-js/h/jsx-runtime/dist/jsx.js`).
- Production is not affected: Vite compiles `.tsx` with `vite-plugin-solid`, and every
  `.tsx` file lives under `packages/ui-solid` or `apps/desktop`.

The six affected files:

- `apps/desktop/src/history-shortcuts.test.ts` (through `@nodetto/ui-solid`)
- `packages/ui-solid/src/bpmn-palette.test.ts`
- `packages/ui-solid/src/text-note-view.test.ts`
- `packages/ui-solid/src/canvas-rulers.test.ts`
- `packages/ui-solid/src/Toolbar.test.ts`
- `packages/ui-solid/src/SelectionToolbar.test.ts`

They use pure helpers exported from modules that happen to contain JSX; none of them
calls `render`, so they do not need Solid's compiled DOM output.

## Non-goals

- No production JSX output change and no dependency or lockfile change.
- Do not edit `tsconfig.base.json`, `tsconfig.json`, `apps/desktop/vite.config.ts`,
  `mise.toml`, any `package.json` or `bun.lock`.
- Do not delete or skip the six files, and do not remove them from `bun test` discovery.
- No babel-based test transform and no test-environment DOM.

## File-level changes

1. `bunfig.toml` (new, repository root): only a `[test]` table with
   `preload = ["./packages/ui-solid/src/bun-test-jsx-preload.ts"]`. Only `bun test`
   reads this key, so `bun run`, Vite and `Bun.build` are unaffected.
2. `packages/ui-solid/src/bun-test-jsx-preload.ts` (new, test-only): register one
   `Bun.plugin` whose `onLoad` matches `/\.tsx$/` and makes that file use the
   `solid-js/h` JSX runtime.
   - First try: return the source with `/** @jsxImportSource solid-js/h */` prepended,
     with `loader: "tsx"`.
   - If the pragma does not override `tsconfig.base.json`, use `new Bun.Transpiler` in
     the same `onLoad`, with `jsxImportSource` set to `solid-js/h`, and return JavaScript.
     Record which form worked and why in the progress log.
   - If a `.css` import in these modules then fails to load, add a `.css` `onLoad`
     returning empty JavaScript to the same file, and record it.
   - Do not export this file from `packages/ui-solid/src/index.ts` or import it from
     production code. The root `tsc` include covers `packages/*/src`, so it is typechecked.
3. The six test files above may change only as described in Pitfalls. Do not change them
   to accommodate the load fix.
4. `impl-plans/progress/clm-15-bun-test-jsx.md` (new): per-edit hashes, decisions and logs.

Pattern to imitate: follow the module and comment style of neighboring `packages/ui-solid/src/*.ts`
files. No repository file uses `Bun.plugin` yet.

## Invariants

- `bunfig.toml` holds only a `[test]` table, production code does not import the preload,
  and the forbidden configuration and lockfile paths listed in Non-goals are unchanged.
- `mise run test-cli` (`bun test apps/cli/src`) behaves as before: the CLI has no `.tsx`.
- `bun run typecheck` still resolves JSX through `solid-js`.

## Pitfalls

- The preload path resolves from the repository root. `bun test` must be run from there,
  as `mise run test` and every verification command here do.
- A root-level preload outside `packages/*/src` would not be typechecked, and root
  `node_modules` has no `solid-js` entry. Keep the file where this plan puts it.
- Do not use `mock.module` on `solid-js/jsx-dev-runtime`. It resolves to the same
  `dist/solid.js` file as `solid-js`, so a mock could replace the whole library.
- These six files have not been executing. Once they load, an assertion may fail:
  - If `git log` shows that production intentionally changed after the test was written,
    update that expectation only, and record the commit and reason in the progress log.
  - Otherwise treat it as a production defect: do not edit production code, leave the
    test as is, and report a blocker with the file, assertion and output.
  - Module-load failures that the preload cannot resolve (for example, top-level DOM use)
    are also blockers. Do not stub globals.
- clm-02 and clm-12 edit `packages/core` in this wave. A full `bun test` failure outside
  these six files is drift from them, not this plan's failure, so the full-run gate checks
  only for the `jsxDEV` error. clm-09's `mise run verify` is the final exit-status gate.
- Do not run a Vite build as a gate and do not move `bunfig.toml`. A build here could fail
  on a sibling's in-progress edit. clm-09 owns the single production-build gate in wave 3.

## Working rules

Fresh read before each edit, with pre/post `git hash-object` in the progress log. Edit only
writePaths. No state-changing git commands, no worktrees, no broad formatters. Evidence goes
under `tmp/clm-s732/clm-15-bun-test-jsx/`; gate runs go under `final/`.

## Tests (situation -> expected)

The existing tests in the six files are the regression. Add no new test files.

- `bun test` on the six files -> 6 files load, more than 0 tests run, 0 fail, no `jsxDEV` text.
- Full `bun test` from the root -> no `jsxDEV` text, more than 0 tests pass.
- `bun test apps/cli/src/edit/selectors.test.ts` with the preload active -> unchanged pass.
- `bunfig.toml` after this plan -> exactly one line starts with `[`, and it is `[test]`.
- `packages/ui-solid/src/index.ts` and `apps/desktop/src` -> no `bun-test-jsx-preload` text.

## Verification (each must exit 0)

Commands are listed in full in the manifest entry `clm-15-bun-test-jsx`. They establish:

1. to 4. The six files load and run: at least one test passes, 0 fail, the summary reports
   6 files, and the log has no `jsxDEV` text.
5. Full `bun test` has no `jsxDEV` text and a positive pass count. Its exit status is not
   the gate here, per Pitfalls.
6. `bun test apps/cli/src/edit/selectors.test.ts` still passes with the preload active.
7. `bun run typecheck`.
8. `bunx biome check` on the preload file.
9. `sh -c 'test "$(grep -c "^\[" bunfig.toml)" = 1 && grep -q "^\[test\]" bunfig.toml'`:
   `bunfig.toml` holds only a `[test]` table, which only `bun test` reads.
10. `sh -c '! grep -rn bun-test-jsx-preload packages/ui-solid/src/index.ts apps/desktop/src'`:
    production code does not import the preload.
11. `git diff --quiet HEAD` over the forbidden configuration and lockfile paths.
12. `grep -n` shows the preload key in `bunfig.toml`.

## Done criteria

- All manifest verification commands exit 0, with logs under
  `tmp/clm-s732/clm-15-bun-test-jsx/final/`.
- The progress log records which `onLoad` form worked, every touched test file with its
  reason (or "none"), and the pre/post hashes.
- `git status --short` shows this plan changed only its writePaths.

# cpf-00-overview

- Design: `design-docs/specs/design-convert-participant-frame-scope.md` (accepted), with the
  pointer in `design-docs/specs/design-cli-ai-drawing.md`.
- Issue: none. The source is the workflow input items E1, E2 and E3.
- Evidence root: `tmp/cpf-s748/<planId>/` (git-ignored; only `.log`, `.txt`, `.json` and
  `.jsonl` data, never `.ts` files or binaries).
- Base: branch `main`, commit `1e8f43d224d7b43e200eb2229e7be17b39ca033c`. No rebase, merge or
  push.

## Goal

- E1: `edit` gains `{"op":"convert",...}`, and `delete` gains `reconnectTo`. A dirty desktop
  session asks instead of merging a conversion that conflicts.
- E2: `sequence.participant` kinds `actor` and `db` draw as a stick figure and a cylinder in
  export and on the canvas. `service` stays the existing box.
- E3: `ddl --frame` uses a table scope rule that names ambiguous exclusions, and `lint` reports
  tables that straddle a frame edge.

All three run in the Bun CLI and in the native CLI, which hosts the same TypeScript bundle in
Boa. No Rust source change is expected.

## Non-goals

- No change to `frameParents`, `expandContainers`, `frame-membership.ts`, `mergeDocuments`, CLI
  `merge`, `validateDocument`, shape sizing defaults, or sequence layout.
- No app UI for conversion, no connector retyping, no conversion of edges, frames or groups.
- No DDL scope change for views or other database objects, and none for page-wide DDL.
- No schema change, migration, version bump, release or push. No server, auth or deployment code.

## Waves

| Wave | Plan | Scope | dependsOn |
| --- | --- | --- | --- |
| 1 | `cpf-01-convert-command` | `convertElement` command and two editor facade methods | none |
| 1 | `cpf-02-participant-export` | Participant notation, SVG export, `types` | none |
| 1 | `cpf-03-ddl-frame-scope` | DDL scope resolver, `frame-straddle` rule module | none |
| 2 | `cpf-04-edit-convert-op` | `convert` op, `delete` `reconnectTo`, report | 01 |
| 2 | `cpf-05-desktop-reconcile` | `planOutsideChange` conversion checks | 01 |
| 3 | `cpf-06-wiring` | Core index exports, lint hook, help, docs, README | 02, 03, 04, 05 |
| 4 | `cpf-07-canvas-view` | Canvas participant view | 02, 06 |
| 4 | `cpf-08-native-parity` | Native parity tests, CPU timing | 04, 06 |

`cpf-06` is the only plan that edits `packages/core/src/index.ts`, `apps/cli/src/commands.ts`,
`apps/cli/src/help.ts`, `docs/cli.md` and `README.md`. Wave 4 needs the new index exports or the
final help text, so it follows wiring and adds no registration.

`writePaths` are disjoint across all plans, apart from the `target` artifact root.

## Rules for every worker

1. Read your plan and the design sections it cites first.
2. Before each edit of an existing file, read it fresh and record `git hash-object <file>` in
   your own progress log; record it again after the edit. If the hash differs from your last
   record, re-read and re-apply only your own hunk.
3. Edit only your `writePaths`. If another file must change, stop and report it in your progress
   log. Do not fix it.
4. No git state changes, worktrees, branches, `cargo clean`, lockfile changes or broad formatters.
   Run `bunx biome` only on your own files.
5. Progress log: `impl-plans/progress/<planId>.md`. Record each step, the commands run with exit
   codes, the evidence paths, and any existing test that failed.
6. Save command output to `tmp/cpf-s748/<planId>/<name>.log`, and record the exit status next to
   it. A truncated log is not a pass.
7. An existing test that fails must not be weakened. Report it unless your plan names it.
8. Code rules: strict TypeScript, no emojis, no unchecked index lookups in `packages/core`
   (a downstream consumer compiles it with `noUncheckedIndexedAccess`), no
   `String.prototype.split` with a regex on whole documents, no per-point destructuring in hot
   loops.
9. Fixtures and all text use only self-authored neutral names (widgets, orders, gadgets, Idle,
   Running, catalog, zone). Never reference external issues, reporters, organizations, products
   or their files. Add no image files.
10. Cargo commands use `CARGO_TERM_QUIET=true`. Retry native deadline timeouts up to 3 attempts
    before treating them as failures, and never relax a deadline.
11. `bun run typecheck` covers the whole repository. If it fails only in files outside your
    `writePaths` while siblings are working, log that and run it again at the end of your plan.
    If those errors remain, report them for reconciliation and do not edit those files.
12. If a Bun run fails on classic JSX resolution, repeat it with
    `BUN_OPTIONS=--jsx-runtime=classic`, as earlier runs recorded.

## Final verification (serial, on the combined tree, after all plans)

1. `CARGO_TERM_QUIET=true mise run verify` exits 0.
2. `CARGO_TERM_QUIET=true mise run test-cli` exits 0, up to 3 attempts for deadline timeouts
   only. Native parity tests must run, not skip.
3. The `cpf-08` timing comparison is recorded.
4. `apps/desktop/src-tauri/gen/schemas/*.json` rewritten by verify are not staged.
5. `impl-plans/README.md` gains the completion entry during reconciliation, not in any plan.

## Completion

- Every plan's acceptance criteria and verification hold on the combined tree.
- The E1, E2 and E3 acceptance signals in the workflow input are met.
- Each worker's progress log lists its evidence.

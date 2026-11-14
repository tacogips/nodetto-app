# zorder-00-overview

- Design: `design-docs/specs/design-z-order.md` (accepted), with the pointer in
  `design-docs/specs/design-bpmn.md` section 6.4.
- Issue: none. The source is the workflow input items H1 and H2.
- Evidence root: `tmp/zorder-s734/<planId>/` (git-ignored; only `.log`, `.txt`,
  `.json` and `.jsonl` data, never `.ts` files or binaries).
- Base: branch `z-order`, commit `29f8691135fb6098a9496495f4a417e93ce0625e`. No
  rebase, merge or push.

## Goal

- H1: `nodetto-cli edit` gains `{"op":"order",...}`.
- H2: frames and BPMN surfaces paint beneath what they own in SVG, PNG and PDF
  export and on the canvas. Pages with no inversion keep the same bytes.

## Non-goals

- `add` keeps its index behavior, and `frameParents` ownership does not change.
- No schema change, migration, flag or document rewrite.
- No HTML or prototype export change, no Layers panel change, no PCB
  `canvasHitTest` change, and no new app UI.
- Connector-page surface-over-shape hit order and the hit positions of grouped
  members stay as they are today (design section 2.4).
- No changes to `README.md`, `apps/cli/src/commands.ts`, MCP schemas or Rust.

## Waves

| Wave | Plan | Scope | dependsOn |
| --- | --- | --- | --- |
| 1 | `zorder-01-paint-order` | `paint-order.ts`, core index export | none |
| 1 | `zorder-02-core-placement` | `relativeOrder`, planner, `Editor.orderElements` | none |
| 1 | `zorder-03-help-docs` | `help.ts`, `docs/cli.md`, `docs/design.md` | none |
| 2 | `zorder-04-paint-consumers` | SVG export and `hitTestPoint` | 01 |
| 2 | `zorder-05-canvas` | `Canvas.tsx` and `targetUnder` | 01 |
| 2 | `zorder-06-cli-order-op` | `operations/order.ts`, batch and field rows | 02 |
| 3 | `zorder-07-export-tests` | CLI export bytes, canvas and SVG parity | 04, 05 |
| 3 | `zorder-08-native-parity` | Native parity and CPU timing | 04, 06 |

`writePaths` are disjoint across all plans. Only `zorder-01` edits
`packages/core/src/index.ts`, and only `zorder-06` edits
`apps/cli/src/edit/batch.ts`.

## Rules for every worker

- Read the plan and the design sections it cites first.
- Before each edit of an existing file, read it fresh and record
  `git hash-object <file>` in your own progress log; record it again after the
  edit. If the hash differs from your last record, re-read and re-apply only your
  own hunk.
- Edit only your `writePaths`. If another file must change, stop and report it in
  your progress log. Do not fix it.
- No git state changes, worktrees, branches, `cargo clean`, lockfile changes or
  broad formatters. Run `bunx biome` only on your own files.
- Progress log: `impl-plans/progress/<planId>.md`. Record each step, the commands
  run with exit codes, the evidence paths, and any existing test that failed.
- An existing test that fails after your change must not be weakened. If it
  encodes the old inversion and is in your `writePaths`, update it and explain why
  in the log. Otherwise report it.
- Code rules: strict TypeScript, no unchecked index lookups in `packages/core`, no
  `String.prototype.split` with a regex on whole documents, no per-point
  destructuring in hot loops, no emojis.
- Fixtures use only self-authored neutral names (widgets, orders, Idle, Running).
  Never reference external issues, reporters, organizations or products, and add
  no image files.
- Cargo commands use `CARGO_TERM_QUIET=true`. Retry native deadline timeouts up to
  3 attempts before treating them as failures, and never relax a deadline.

## Final verification (serial, on the combined tree, after all plans)

1. `CARGO_TERM_QUIET=true mise run verify` exits 0.
2. `CARGO_TERM_QUIET=true mise run test-cli` exits 0, up to 3 attempts for deadline
   timeouts only. Native parity tests must run, not skip. If a run fails on classic
   JSX resolution, repeat it with `BUN_OPTIONS=--jsx-runtime=classic`, as earlier
   runs recorded.
3. The `zorder-08` timing comparison is recorded.
4. `apps/desktop/src-tauri/gen/schemas/*.json` rewritten by verify are not staged.

## Completion

- Every plan's acceptance criteria and verification hold on the combined tree.
- The H1 and H2 acceptance signals in the workflow input are met.

# clm-01-merge

- planId: clm-01-merge
- planPath: impl-plans/active/clm-01-merge.md
- progressPath: impl-plans/progress/clm-01-merge.md
- wave: 1
- dependsOn: none
- Design: `design-docs/specs/design-cli-layout-merge-lint.md`, sections B1,
  B2, B3, "Help and documentation", and the B rows of "Verification".
  Owner question Q3: arrays are atomic.
- writePaths:
  - `packages/core/src/document-merge.ts`
  - `packages/core/src/document-merge-versions.test.ts` (new)
  - `packages/core/src/index.ts`
  - `apps/cli/src/merge-command.ts` (new)
  - `apps/cli/src/merge-command.test.ts` (new)
  - `apps/cli/src/merge-git.test.ts` (new)
  - `apps/cli/src/export-determinism.test.ts` (new)
  - `apps/cli/src/native-parity/merge.test.ts` (new)
  - `apps/cli/src/commands.ts`
  - `apps/cli/src/help.ts`
  - `apps/cli/src/ai-commands.test.ts` (only to add help assertions)
  - `docs/cli.md`
  - `README.md`
  - `design-docs/specs/export.md`
  - `impl-plans/progress/clm-01-merge.md`
  - `tmp/clm-s725/clm-01-merge`
  - `target`
- artifactRoots: `target`

## Intent and context

Add `nodetto-cli merge <base> <ours> <theirs> [--output <file>]` so it can
be used as a git merge driver, and guarantee that text export is
deterministic.

- The app's live merge `mergeDocuments`
  (`packages/core/src/document-merge.ts`) must keep returning exactly what
  it returns today.
- The CLI runs the same TypeScript in Bun and in native Boa. The native
  engine dispatches through `runCli` (`apps/cli/src/native-engine.ts`), so no
  Rust change is needed.

## Non-goals

- Do not change `mergeDocuments` results or the app or session merge code
  in `packages/ui-solid` or `apps/desktop`.
- Do not merge lists item by item, and do not add a `--format` flag or an
  SVG merge driver.
- Do not touch Rust (`apps/cli/native`, `crates`).

## File-level changes

1. `packages/core/src/document-merge.ts`
   - Extract the recursive merge into a variant that records conflict
     paths. Keep `mergeValue` and `mergeById` behavior for `mergeDocuments`
     byte-identical. The existing `document-merge.test.ts` must pass
     unchanged.
   - Add the following. Use this shape:
     ```ts
     export interface FieldConflict {
       readonly kind: "document" | "page" | "element";
       readonly id: string;
       readonly type?: string;
       readonly path?: string;
       readonly reason: "both-changed" | "both-added" | "deleted-in-ours" | "deleted-in-theirs";
       readonly base?: unknown;
       readonly ours?: unknown;
       readonly theirs?: unknown;
     }
     export function mergeDocumentVersions(base: Document, ours: Document, theirs: Document): { document: Document; conflicts: readonly FieldConflict[] };
     ```
   - Semantics, exactly as in design B1:
     - A change on one side wins.
     - The same change on both sides is taken.
     - Plain objects merge key by key, recursively. Arrays and scalars are
       atomic. On conflict, keep ours and record the dotted path
       (`visual.x`, `semantic.columns`, `title`).
     - Both sides adding the same id merges against `{}` (`both-added`).
     - Delete against modify: ours' deletion stays deleted
       (`deleted-in-ours`). Theirs' deletion is undone when ours changed the
       record (`deleted-in-theirs`).
     - Unknown records: a three-way set merge of their canonical JSON
       strings.
     - Header fields: `title` and `extensions` use the same value merge.
       `id` and `schemaVersion` come from ours.
   - Integrity fixpoint, at most as many passes as there are records:
     - Missing page: restore it from ours, or drop the element.
     - Missing referenced id: read references with
       `getElementTypeDefinition(type).references(semantic)` from
       `@nodetto/ir`. Restore the referenced element from ours, or drop the
       referencing element.
     - Record the conflicts as the design says.
   - Sort conflicts by kind order (document, page, element), then id, then
     path, using code-unit compare.
   - Pattern to imitate: `document-merge.ts:mergeById`, using `Map` lookups
     only. Do not use iteration order for output; the canonical serializer
     sorts it.
2. `packages/core/src/index.ts`: export `mergeDocumentVersions` and the
   `FieldConflict` type next to the existing `document-merge.ts` export
   (around line 667).
3. `apps/cli/src/merge-command.ts`, new:
   - Export `mergeCommand(io: CommandIo, args: readonly string[]): CommandResult`.
   - Parse with `parseArgs(args, new Set(["--output"]), new Set())` from
     `commands.ts`. Expect exactly 3 positionals, otherwise exit 2 with the
     merge help.
   - Read and parse all three files with `parseDocumentResult` before any
     write. On a read or parse error, exit 2 and name the file.
   - If the three document ids differ, exit 2 with "<files> are not versions
     of the same document".
   - Call `mergeDocumentVersions`, then `validateDocument`. On an error,
     exit 2, list the errors and write nothing.
   - Serialize with `serializeDocument`. With `--output`, write with
     `writeOutput` from `commands.ts` (atomic `io.writeText`); otherwise print
     to stdout.
   - stderr gets one line per conflict, in the formats from design B1.
     Values are compact `JSON.stringify` output, truncated to 80 characters
     plus `...`. Then the summary line
     `merged with <n> conflict(s); conflicting fields keep ours.`
   - Exit 0 when clean, 1 when there are conflicts (the result is still
     written).
4. `apps/cli/src/commands.ts`: add `case "merge": return mergeCommand(io, rest);`
   in `runCli`. Do not change other commands.
5. `apps/cli/src/help.ts`:
   - Add a `merge` entry to `COMMAND_HELP`. This automatically creates the
     MCP tool `nodetto_merge`. The entry covers usage, policy (ours kept,
     arrays atomic, delete rules), exit codes 0/1/2 and the git driver
     setup lines from design B2.
   - Add `nodetto-cli merge <base> <ours> <theirs>` to OVERVIEW under
     "Convert and check".
   - Add the determinism sentence to the `export` help: text exports (svg,
     mermaid, d2, drawio) are a pure function of document content and the
     referenced attachment bytes.
6. `docs/cli.md`: add a "Merging documents" section with the command, the
   policy, the git driver setup, and the SVG regeneration recipe (an
   `export` command plus a post-merge hook example). Add the determinism
   statement.
7. `README.md`: add one example line, `nodetto-cli merge base.jsonl ours.jsonl theirs.jsonl --output ours.jsonl`.
8. `design-docs/specs/export.md`: one Goals bullet and one Rollout bullet
   with the text-export determinism guarantee.

## Pitfalls

- `--output` is usually the ours path (`%A`). Read all three inputs before
  writing anything.
- Never write a partial or invalid file. Validation failure writes nothing.
- Do not let `Object.keys` order leak into output. The serializer sorts
  records, but conflict lines must be sorted explicitly.
- `undefined` against a missing key: keep the existing `mergeValue` rule
  (a merged `undefined` deletes the key).
- `same()` compares with `JSON.stringify`, so key-order differences count as
  changes. Keep that behavior; documents come from the canonical parser.
- The git driver command in tests must quote paths. For Bun use
  `"<process.execPath>" "<abs main.ts>" merge %O %A %B --output %A`.
- If the B3 audit finds nondeterminism in the SVG exporter, stop. Record it
  in the progress log as a Step-5 finding and fix it only if the fix lies
  in an owned file. Otherwise report it as a blocker.

## Tests (input -> expected)

`packages/core/src/document-merge-versions.test.ts`:
- Ours moves `visual.x`, theirs renames `semantic.tableName` -> both applied,
  no conflicts.
- Both set `visual.x` to different values -> ours kept, one `both-changed`
  at `visual.x` with the base, ours and theirs values.
- Both change `semantic.columns` arrays differently -> ours kept, conflict
  path `semantic.columns`.
- The same element is added on both sides with different labels ->
  `both-added`.
- Ours deletes an element that theirs modified -> it stays deleted,
  `deleted-in-ours`. Theirs deletes an element that ours modified -> ours
  kept, `deleted-in-theirs`.
- Theirs deletes a page, and ours added an element on it -> the page is
  restored from ours, with a conflict.
- Theirs deletes a node, and ours added an edge to it -> the node is
  restored.
- Ours deletes a node, and theirs added an edge to it -> the edge is
  dropped, with a conflict.
- The existing `mergeDocuments` tests pass unchanged.

`apps/cli/src/merge-command.test.ts`, using an in-memory `CommandIo` (see
the pattern in `apps/cli/src/commands.test.ts`):
- A clean merge gives exit 0 and canonical stdout.
- With `--output` equal to the ours path, the ours file is rewritten.
- A conflict gives exit 1. The file is written with ours' value, and stderr
  has the conflict line and the summary.
- Different document ids give exit 2 and no write. An unparsable input
  gives exit 2 and names the file. A wrong argument count gives exit 2.

`apps/cli/src/merge-git.test.ts`, with a real `git` in a temp dir:
- Setup: init, local user config, `.gitattributes` with
  `*.jsonl merge=nodetto`, and `merge.nodetto.driver`.
- Disjoint branch edits -> `git merge` exits 0 and the file contains both
  edits.
- A conflicting edit -> `git merge` exits non-zero, the file keeps ours'
  value canonically, and the output mentions `conflict:`.
- Missing `git` fails the test; do not skip it.

`apps/cli/src/export-determinism.test.ts`:
- An SVG export of a fixture with a raster attachment (a tiny PNG written
  by the test), run with `TZ=UTC LANG=C` and `TZ=Asia/Tokyo LANG=ja_JP.UTF-8`,
  from two copied directories with different cwd -> byte-identical.
- `export(doc)` equals `export(format(doc))`.

`apps/cli/src/native-parity/merge.test.ts`:
- Uses `compare(...)` from `harness.ts` for clean, conflict and error merges.
- Runs the git driver scenario with the native binary.
- Compares native and Bun SVG export of the determinism fixture byte for
  byte.

`apps/cli/src/ai-commands.test.ts`: the `merge` help shows usage and the
driver line, and OVERVIEW lists `merge`.

## Verification (each must exit 0)

1. `bun test packages/core/src/document-merge.test.ts packages/core/src/document-merge-versions.test.ts`:
   all pass, and the existing test count is unchanged.
2. `bun test apps/cli/src/merge-command.test.ts apps/cli/src/merge-git.test.ts apps/cli/src/export-determinism.test.ts apps/cli/src/ai-commands.test.ts apps/cli/src/mcp.test.ts`:
   all pass.
3. `bun run typecheck`.
4. `CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity/merge.test.ts`:
   more than 0 tests run, and all pass.
5. `bunx biome check <owned TS files>`.

Save each output to `tmp/clm-s725/clm-01-merge/<n>.log` with its exit code.

## Done criteria

- `grep -n '"merge"' apps/cli/src/commands.ts apps/cli/src/help.ts` finds
  both the dispatch and the help entry.
- Verification commands 1 to 5 exit 0, and their logs are recorded in the
  progress log.
- `git diff --stat` shows only writePaths.

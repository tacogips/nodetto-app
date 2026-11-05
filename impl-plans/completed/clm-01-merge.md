# clm-01-merge

- planId: clm-01-merge
- planPath: impl-plans/active/clm-01-merge.md
- progressPath: impl-plans/progress/clm-01-merge.md
- wave: 1
- dependsOn: none
- Design: `design-docs/specs/design-cli-layout-merge-lint.md`, sections B1,
  B3 and the B1/B3 rows of "Verification". Owner question Q3: arrays are
  atomic. B2 (git end-to-end), help, docs and registration belong to
  clm-09.
- writePaths:
  - `packages/core/src/document-merge.ts`
  - `packages/core/src/document-merge-versions.test.ts` (new)
  - `apps/cli/src/merge-command.ts` (new)
  - `apps/cli/src/merge-command.test.ts` (new)
  - `apps/cli/src/export-determinism.test.ts` (new)
  - `impl-plans/progress/clm-01-merge.md`
  - `tmp/clm-s725/clm-01-merge`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

Users need `nodetto-cli merge <base> <ours> <theirs> [--output <file>]` so
it can act as a git merge driver, and a guarantee that text export is
deterministic. This plan builds the merge engine and the command module.
clm-09 registers the command in `runCli`, adds help and docs, and writes the
git end-to-end and native parity tests.

- `packages/core/src/document-merge.ts:mergeDocuments` is the app's live
  merge. Its results must not change. The existing
  `packages/core/src/document-merge.test.ts` must pass unchanged.
- The native CLI runs this TypeScript in Boa through `runCli`, so no Rust
  changes are needed.

## Non-goals

- Do not edit `commands.ts`, `help.ts`, `packages/core/src/index.ts`, docs or
  any native-parity file.
- No item-by-item list merge, no `--format` flag, no SVG merge driver.
- No changes in `packages/ui-solid`, `apps/desktop` or Rust.

## File-level changes

1. `packages/core/src/document-merge.ts`
   - Extract the recursive value merge into a variant that records conflict
     paths. `mergeValue`/`mergeById` behavior for `mergeDocuments` stays
     byte-identical.
   - Add (contract):
     ```ts
     export interface VersionConflict {
       readonly kind: "document" | "page" | "element"; readonly id: string;
       readonly type?: string; readonly path?: string;
       readonly reason: "field" | "both-added" | "deleted-in-ours" | "deleted-in-theirs";
       readonly base?: unknown; readonly ours?: unknown; readonly theirs?: unknown;
     }
     export function mergeDocumentVersions(base: Document, ours: Document, theirs: Document):
       { document: Document; conflicts: VersionConflict[] };
     ```
   - Semantics (design B1):
     - Records are keyed by kind and id: the header, pages by id, elements
       by id.
     - A change on one side is taken. The same change on both sides is
       taken.
     - Plain objects merge key by key, recursively. Arrays and scalars are
       atomic.
     - Differing changes on both sides: ours is kept, and a `field`
       conflict records the dotted path (`visual.x`, `semantic.columns`,
       `title`) with base, ours and theirs values.
     - The same id added on both sides with different content merges
       against `{}`, and the differing fields are `both-added` conflicts.
     - Ours deleted and theirs changed: stays deleted (`deleted-in-ours`).
       Theirs deleted and ours changed: ours kept (`deleted-in-theirs`). A
       one-sided deletion of an unchanged record is taken without a
       conflict.
     - Unknown records: a three-way set merge of their canonical lines.
     - Header: `title` and `extensions` use the value merge. `id` and
       `schemaVersion` come from ours.
   - Integrity fixpoint, at most as many passes as there are records:
     - An element whose page is missing: restore ours' page with a
       `deleted-in-theirs` conflict, or drop the element (with a
       `deleted-in-ours` conflict when theirs added or changed it).
     - A missing referenced id, found with
       `getElementTypeDefinition(type).references(semantic)` from
       `@nodetto/ir`: restore it from ours (`deleted-in-theirs`), or drop
       the referencing element (`deleted-in-ours`).
   - Sort conflicts by kind (document, page, element), then id, then path,
     using code-unit compare.
   - Imitate `document-merge.ts:mergeById` (Map lookups). Never let input
     iteration order reach the output.
2. `apps/cli/src/merge-command.ts`, new. Imitate
   `apps/cli/src/diff-command.ts`, which imports from `commands.ts`.
   - `export function mergeCommand(io: CommandIo, args: readonly string[]): CommandResult`.
   - Export `MERGE_USAGE` (a short usage string). clm-09 uses it in help.
   - Parse with `parseArgs(args, new Set(["--output"]), new Set())`. Anything
     other than exactly 3 positionals exits 2 with the usage.
   - Read and parse all three files with `parseDocumentResult` before any
     write. A read or parse error exits 2 and names the file. Different
     document ids exit 2 with `<base>, <ours> and <theirs> are not versions of the same document.`
   - Call `mergeDocumentVersions` through a relative import, then
     `validateDocument`. On an error, exit 2, list the errors and write
     nothing.
   - Serialize with `serializeDocument`. With `--output`, write with
     `writeOutput` (atomic). Otherwise print to stdout.
   - stderr: one line per conflict, in the formats from design B1:
     - `conflict: element <id> (<type>) <path>: base <v> | ours <v> | theirs <v> (kept ours)`
     - `conflict: element <id> (<type>): deleted in theirs, changed in ours (kept ours)`
     - the matching `deleted in ours, changed in theirs (kept deletion)` line
       and the page/document variants.
     - Values are compact `JSON.stringify` output, truncated to 80 characters
       plus `...`. A missing value prints `(absent)`.
     - Then `merged with <n> conflict(s); conflicting fields keep ours.`
   - Exit 0 when clean. Exit 1 on conflicts (the result is still written).
     Exit 2 for usage, read, parse, identity or validation errors.
3. `apps/cli/src/export-determinism.test.ts`, new (B3). It drives the
   existing `export` command by spawning `process.execPath` with
   `apps/cli/src/main.ts`.

## Pitfalls

- `--output` is usually the ours path (`%A`). Read all three inputs before
  writing anything.
- A validation failure writes nothing, not even to stdout.
- Conflict lines must be sorted explicitly. Do not rely on `Object.keys`
  order.
- Keep the existing `mergeValue` rule that a merged `undefined` deletes the
  key, and keep `same()` comparing with `JSON.stringify`.
- If the B3 audit finds nondeterminism, fix it only if the fix lies in a
  core exporter file. Add that file to this plan's progress log as an
  amendment request, and never edit `export-command.ts` (clm-04 owns it). If
  the fix needs a non-owned file, record a Step-5 blocker.

## Tests (input -> expected)

`packages/core/src/document-merge-versions.test.ts`:
- Ours moves `visual.x`, theirs renames `semantic.tableName` -> both
  applied, no conflicts.
- Both set `visual.x` differently -> ours kept, one `field` conflict at
  `visual.x` with all three values.
- Both change `semantic.columns` differently -> ours kept, path
  `semantic.columns`.
- The same id added on both sides with different labels -> `both-added`.
- Ours deletes what theirs modified -> deleted, `deleted-in-ours`. Theirs
  deletes what ours modified -> ours kept, `deleted-in-theirs`.
- Theirs deletes a page where ours added an element -> page restored, with
  a conflict.
- Theirs deletes a node that ours connected an edge to -> node restored.
  Ours deletes a node that theirs connected an edge to -> edge dropped, with
  a conflict.
- Inputs built in shuffled order -> identical result and conflict order.

`apps/cli/src/merge-command.test.ts`, with an in-memory `CommandIo` (pattern
in `apps/cli/src/commands.test.ts`), calling `mergeCommand` directly:
- Clean merge -> exit 0, canonical stdout.
- `--output` equal to the ours path -> the ours file is rewritten.
- Conflict -> exit 1, the file has ours' value, stderr has the conflict line
  and the summary.
- Different ids -> exit 2, no write. Unparsable input -> exit 2 naming the
  file. Wrong argument count -> exit 2.
- A result that fails validation -> exit 2, nothing written.

`apps/cli/src/export-determinism.test.ts`:
- SVG export of a fixture with a tiny raster attachment written by the
  test, run with `TZ=UTC LANG=C` and `TZ=Asia/Tokyo LANG=ja_JP.UTF-8`, from
  two copied directories with different cwd -> byte-identical.
- `export(doc)` equals `export(format(doc))`.

## Verification (each must exit 0)

1. `bun test packages/core/src/document-merge.test.ts packages/core/src/document-merge-versions.test.ts`:
   all pass, and the existing test count is unchanged.
2. `bun test apps/cli/src/merge-command.test.ts apps/cli/src/export-determinism.test.ts`:
   more than 0 tests run, and all pass.
3. `bun run typecheck`.
4. `bunx biome check packages/core/src/document-merge.ts packages/core/src/document-merge-versions.test.ts apps/cli/src/merge-command.ts apps/cli/src/merge-command.test.ts apps/cli/src/export-determinism.test.ts`.

Save each output to `tmp/clm-s725/clm-01-merge/<n>.log` with its exit code.

## Done criteria

- `grep -n "export function mergeDocumentVersions" packages/core/src/document-merge.ts`
  and `grep -n "export function mergeCommand" apps/cli/src/merge-command.ts`
  both match.
- Verification 1 to 4 exit 0, and their logs are recorded in the progress
  log.
- `git status --short` shows only writePaths changed.

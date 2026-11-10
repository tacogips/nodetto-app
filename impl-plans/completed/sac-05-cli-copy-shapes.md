# sac-05-cli-copy-shapes

- planId: sac-05-cli-copy-shapes
- planPath: impl-plans/active/sac-05-cli-copy-shapes.md
- progressPath: impl-plans/progress/sac-05-cli-copy-shapes.md
- wave: 2
- dependsOn: sac-02-copy-shapes-core
- Design: `design-docs/specs/design-slide-area-copy-shapes.md` sections 6.2, 6.4 and 9; user-qa Q4.
- writePaths:
  - `apps/cli/src/pages-command.ts`
  - `apps/cli/src/pages-copy-shapes.ts` (new)
  - `apps/cli/src/pages-command.test.ts`
  - `impl-plans/progress/sac-05-cli-copy-shapes.md`
  - `tmp/sac-s826/sac-05-cli-copy-shapes`
  - `target`
  - `apps/desktop/dist`
- sharedPaths: none
- artifactRoots: `target`, `apps/desktop/dist`

## Intent and context

Agents need the same "copy shapes from page" operation from the CLI:

```text
nodetto-cli pages copy-shapes <doc.jsonl> --from <page|prev|next> --to <page> [--dry-run] [--format text|json]
```

- `--to` and a named `--from` resolve through `resolvePageQuery`
  (`packages/ir/src/page-id.ts:28`), which takes a full id, short id or
  name.
- `prev` and `next` are relative to `--to`, through
  `editor.adjacentPageId`. The keyword wins over a page with that name.

## Non-goals

- Do not edit `apps/cli/src/commands.ts`: dispatch already goes to
  `pagesCommand`.
- Do not edit `apps/cli/src/help.ts` (sac-08 adds the usage).
- No MCP tool. No native or Rust parity work.

## File-level changes

1. `pages-command.ts`: at the top of `pagesCommand`, if
   `args[0] === "copy-shapes"`, return
   `pagesCopyShapesCommand(io, args.slice(1))`. The existing listing path is
   unchanged.
2. `pages-copy-shapes.ts`: `export function pagesCopyShapesCommand(io: CommandIo, args: readonly string[]): CommandResult`.
   - Parse with `parseArgs(args, new Set(["--from", "--to", "--format"]), new Set(["--dry-run"]))`,
     imitating `pages-command.ts:702` and `edit-command.ts:27`.
   - Require exactly one positional and both `--from` and `--to`.
     `--format` is `text` (default) or `json`.
   - `loadDocument(io, path)`, then `new Editor({ document: loaded.document })`
     (as in `commands.ts:811`).
   - Resolve `--to` with `resolvePageQuery([...pages])`.
   - For `--from`:
     - `prev` / `next` -> `editor.adjacentPageId(to.id, ...)`. `null` gives
       ``Page "${to.name}" has no previous page.`` (or `next`).
     - Anything else goes through `resolvePageQuery`.
   - `from === to` -> `--from and --to are the same page.`
   - Every failure is `fail(`${message}\nNothing was written.`)`.
   - Then `const ids = editor.copyPageElements(from, to)`. `null` is
     treated as a failure.
   - Write `serializeDocument(editor.getSnapshot())` with
     `io.writeText(path, text)` only when `ids.length > 0` and not
     `--dry-run`.
   - Text output:
     ``Copied ${n} element${n === 1 ? "" : "s"} from "${from.name}" to "${to.name}".``
     plus ` (dry run, nothing written)` when applicable.
   - JSON output:
     `{ from: { id, name }, to: { id, name }, copied: ids, written: boolean }`,
     pretty-printed with 2 spaces and a trailing newline.
   - Pass `loaded.warnings` through `ok(...)`.

## Pitfalls

- `prev` / `next` use tab order, where hidden pages count. Do not use the
  slide list.
- Never write on any error path, or for an empty source.
- `resolvePageQuery` needs the `Page[]` from `loaded.document.pages`, and
  ambiguity errors must surface verbatim.
- `parsed.positional[0]` must be checked for undefined, not cast blindly
  (`noUncheckedIndexedAccess`).

## Tests (append to `apps/cli/src/pages-command.test.ts`; reuse its `fixture()` io pattern with `writes` counting)

- Three freeform pages `A` (2 rects plus a connector), `B` (1 rect) and
  `C`. Run `pages copy-shapes doc.jsonl --from prev --to B` -> exit 0, and
  writes increments by 1. The parsed `saved` has page B with 4 elements,
  all new ids, at A's coordinates, and the connector endpoints point at the
  new ids.
- `--from prev --to A` -> non-zero, stderr contains "has no previous page"
  and "Nothing was written.", and writes is unchanged.
- `--from next --to C` -> non-zero with "has no next page".
- `--from B --to B` -> non-zero with "same page".
- `--dry-run --format json` -> `written:false`, `copied.length === 3`, and
  writes is unchanged.
- From the empty page C to A -> exit 0, "Copied 0 elements", and no write.
- The existing `pages` listing tests still pass unchanged.

## Verification (each exits 0 with at least 1 pass and 0 fail; logs in `tmp/sac-s826/sac-05-cli-copy-shapes/final/`)

1. `bun test ./apps/cli/src/pages-command.test.ts` -> `cli.log`
2. `bun run typecheck` -> `typecheck.log`

Static: `bunx biome check` on the owned files.

## Done criteria

- Verifications 1-2 exited 0.
- `git diff --stat -- apps/cli/src/commands.ts apps/cli/src/help.ts` is
  empty.
- The progress log has the intent hash, per-edit hashes and the exit
  statuses.

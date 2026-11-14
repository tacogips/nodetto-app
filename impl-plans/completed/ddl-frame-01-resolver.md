# ddl-frame-01-resolver

- planId: ddl-frame-01-resolver
- planPath: impl-plans/active/ddl-frame-01-resolver.md
- wave: 1; dependsOn: none. Runs in parallel with ddl-frame-02-help-docs
  (disjoint files).
- design: design-docs/specs/design-cli-ai-drawing.md, sections "Ids and names",
  "ddl --frame resolution (designed 2026-10-25)" and the `ddl --frame` bullet in
  "Verification".
- progress log: impl-plans/progress/ddl-frame-01-resolver.md (this worker only)
- evidence: tmp/ddl-frame/ddl-frame-01-resolver/ (tmp/ is git-ignored)
- repository: nodetto-app (public submodule), branch main, same working
  directory as the sibling plan. No worktrees, no private branches, and no git
  write operations (no add, commit, stash, checkout or reset).

## Intent

`nodetto-cli ddl --frame` accepts only an exact full frame id today
(`apps/cli/src/commands.ts:ddlCommand` calls `editor.store.get(frameId)`).
Make it accept, among frames on the selected `--page` only, in this order:

1. the exact full id,
2. the exact frame name (`semantic.name`),
3. an id prefix of at least `MIN_PREFIX` (6) characters.

When resolution fails, exit non-zero with empty stdout and list the candidate
frames in the same style as the `--page` listing.

## Files and symbols

| File | Change |
| --- | --- |
| `apps/cli/src/commands.ts` | Add a private `resolveFrameQuery`. In `ddlCommand`, replace the `store.get` check with a call to it. |
| `apps/cli/src/commands.test.ts` | Add one new `test(...)` block with fixtures, plus the regression cases below. |
| `impl-plans/progress/ddl-frame-01-resolver.md` | Create it. This is your progress log. |

Pinned signature. It is private, so do not export it:

```ts
function resolveFrameQuery(document: Document, page: Page, query: string): Resolution
```

- `Resolution` is the type exported from `apps/cli/src/ids.ts`
  (`{ ok: true; id } | { ok: false; message }`).
- Import `MIN_PREFIX`, `shortIds` and `type Resolution` from `./ids.ts`.
- `Document` and `Page` are already imported from `@nodetto/ir` in commands.ts.
- Place the function directly above `ddlCommand`.

Patterns to imitate:
- `packages/ir/src/page-id.ts:resolvePageQuery`: full ids take precedence, and it
  never picks silently between colliding names.
- `apps/cli/src/commands.ts:selectPage`: the candidate line format
  `` `  ${short}\t${name} (full id: ${id})` ``, joined with `\n`.
- `apps/cli/src/inspect-command.ts`: computes
  `shortIds(document.elements.map((element) => element.id))`. Use exactly this,
  over ALL document element ids, so the short ids match `inspect` output.

## Required behavior

Candidate pool: `document.elements` filtered to `type === "frame" && page === page.id`,
kept in document element order. Read the name as `(element.semantic as FrameSemantic).name`
(import `type FrameSemantic` from `@nodetto/ir`). Also guard with
`typeof name === "string"`, because documents can be hand-edited. Missing or empty
names display as `(unnamed)`.

Every step below searches only the pool:

1. Exact id: if a pool frame's `id === query`, return it.
2. Name: collect pool frames whose name `=== query`. The comparison is exact and
   case-sensitive, with no trimming. One match resolves. Two or more matches fail
   as ambiguous. Do NOT fall through to step 3.
3. Prefix: only if `query.length >= MIN_PREFIX`, collect pool frames whose
   `id.startsWith(query)`. One match resolves. Two or more fail as ambiguous.
4. Otherwise fail with "no match".

Every failure message is passed to `fail(...)`, which adds the trailing newline.
The first line must be exactly:
`--frame must identify a frame on the selected --page.`
The existing test asserts the substring "frame on the selected --page". The line
that follows depends on the case:

- No match, and the page has frames:
  `No frame on page "<page.name>" has the id, name or id prefix "<query>". Frames on this page:`
  then one candidate line for every pool frame.
- No match, and the page has no frames: `Page "<page.name>" has no frames.`
- Ambiguous name or prefix:
  `"<query>" matches <n> frames on page "<page.name>"; pass a full id or short id:`
  then candidate lines for the matching frames only.

`ddlCommand` wiring: if `--frame` is present, call
`resolveFrameQuery(loaded.document, page, query)`. On failure, `return fail(message)`.
On success, pass the resolved full id as `frameId` to `generateDatabaseDdl`.
`selectPage` and the `--page` resolution order do not change.

## Invariants and pitfalls

- An exact full id must produce byte-identical stdout, stderr, `--output`,
  `--check` and `--strict` results compared with HEAD f705c09. Do not change
  `generateDatabaseDdl` or its options.
- Do not reuse `resolveId` for prefix matching. It accepts any prefix length and
  searches all ids. Do not change `resolveId` or `shortIds`.
- A frame on another page must never match, by id, name or prefix.
- Non-frame elements (for example `t-users`) are never candidates, even by
  exact id.
- On failure, nothing goes to stdout and the `--output` file is not written.
  Resolution already happens before any output, so keep it there.
- Strict typing: no `any`, no non-null assertions on lookups.
- Do not touch `apps/cli/src/help.ts`, `README.md`,
  `apps/cli/src/ai-commands.test.ts`, the native Rust sources,
  `apps/cli/native/engine/diagram.js`, design docs or other plans.
- Fixtures use only the neutral names given below. Do not mention external
  issues, projects, products or people anywhere.

## Tests to add (apps/cli/src/commands.test.ts)

Build a fixture document inline, in the style of the existing `ERD` constant and
the "DDL frame scopes ..." test:

- page `{"kind":"page","id":"p-shop","name":"Shop schema","pageKind":"erd"}`
- two `erd.table` elements, for example `t-orders` and `t-billing`
- frame `fr-orders-0001` named "orders store" with member `t-orders`
- frame `fr-billing-0001` named "billing store" with member `t-billing`
- for the ambiguity case, two more frames with ids `fr-dup-aaaa1` and
  `fr-dup-bbbb2`, both named "shared store"
- a second ERD page `p-other` "Other schema" with its own table and a frame
  named "orders store" (id `fr-other-0001`)

Choose ids so that the prefix cases are unambiguous within each page. The
fixture has two ERD pages, so `selectPage` fails before frame resolution when
`--page` is omitted. Every case below that does not name a page passes
`--page "Shop schema"`. Cases:

- `--page "Shop schema" --frame "orders store"` -> exit 0, and stdout equals the
  stdout of `--frame fr-orders-0001` (`toBe`, byte equality).
- `--frame fr-orders-0001` -> exit 0, and stdout contains the orders table but
  not the billing table.
- A unique prefix of 6 or more characters (for example `fr-ord`) -> exit 0, with
  the same stdout as the full id.
- A 5-character prefix (`fr-or`) -> `EXIT_ERROR`. Shorter queries never match by
  prefix.
- `--frame "no such store"` -> `EXIT_ERROR`, stdout `""`, and stderr contains
  "frame on the selected --page", "orders store", "billing store" and
  `(full id: fr-orders-0001)`.
- `--frame "shared store"` -> `EXIT_ERROR`, stdout `""`, and stderr contains
  `matches 2 frames`, `(full id: fr-dup-aaaa1)` and `(full id: fr-dup-bbbb2)`,
  but not `fr-orders-0001`.
- `--page "Shop schema" --frame fr-other-0001` (a full id on the other page) ->
  `EXIT_ERROR`.
- `--page "Other schema" --frame "billing store"` -> `EXIT_ERROR`. The name
  exists only on the other page.
- `--page "Other schema" --frame "orders store"` -> exit 0, and stdout contains
  only the other page's table, never the Shop page's.
- Name before prefix: use a SEPARATE fixture document (its own `memoryIo`), so
  the `fr-ord` prefix case above stays valid. In it, frame `fr-name-0001`, with a
  table member different from the orders table, is named `fr-ord`. Querying
  `--frame fr-ord` resolves to `fr-name-0001`: its stdout equals the stdout of
  `--frame fr-name-0001` and differs from that of `--frame fr-orders-0001`.
- Unnamed frame: a frame with `semantic: { name: "" }` appears in the no-match
  listing as `(unnamed)`.
- `--output out.sql --frame "no such store"` -> `EXIT_ERROR`, and `out.sql` is
  not in `io.files`.

The existing test "DDL frame scopes validate page ownership ..." must keep
passing unchanged. Do not edit its assertions.

Regression proof: before editing commands.ts, add the tests first and run them.
They must fail on f705c09; save the output as `tmp/ddl-frame/ddl-frame-01-resolver/red.log`.
Then implement, and save the passing run as `green.log`.

## Verification (run from the nodetto-app root, in the foreground)

1. `bun test apps/cli/src/commands.test.ts 2>&1 | tee tmp/ddl-frame/ddl-frame-01-resolver/green.log`
   -> exit 0, 0 fail, with the new test listed.
2. `bun run typecheck` -> exit 0.
3. `bunx biome check apps/cli/src/commands.ts apps/cli/src/commands.test.ts`
   -> exit 0.
4. `git diff --stat` -> beyond the sibling plan's files, only
   `apps/cli/src/commands.ts`, `apps/cli/src/commands.test.ts` and this
   progress log are changed by this plan.

Workspace-wide `bun run lint`, `bun test apps/cli/src` and
`CARGO_TERM_QUIET=true mise run test-cli` belong to reconcile and integration
review, not to this plan.

## Concurrency protocol

Before every edit, re-read the file fresh and record its sha256 (`shasum -a 256`)
in the progress log. Record it again after the edit. If the pre-edit hash differs
from the last hash you recorded, stop: log the drift and re-read before
continuing. Never rewrite whole files that you do not own.

## Done criteria (mechanically checkable)

- [ ] `grep -n "function resolveFrameQuery" apps/cli/src/commands.ts` finds
  exactly one match, and it is not exported.
- [ ] `grep -n "editor.store.get(frameId)" apps/cli/src/commands.ts` finds no
  match.
- [ ] red.log shows the new test failing, and green.log shows 0 fail.
- [ ] Verification commands 2 and 3 exit 0.
- [ ] The progress log records the pre/post hashes, the commands run, their exit
  codes and the log paths.

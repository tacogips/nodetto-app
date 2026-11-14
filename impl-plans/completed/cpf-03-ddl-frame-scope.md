# cpf-03-ddl-frame-scope

- planId: cpf-03-ddl-frame-scope
- planPath: impl-plans/active/cpf-03-ddl-frame-scope.md
- progressPath: impl-plans/progress/cpf-03-ddl-frame-scope.md
- wave: 1
- dependsOn: none
- Design: `design-docs/specs/design-convert-participant-frame-scope.md`, "E3: frame membership for DDL".
- Worker rules: `impl-plans/active/cpf-00-overview.md`.
- writePaths:
  - `packages/core/src/erd-frame-scope.ts`
  - `packages/core/src/erd-frame-scope.test.ts`
  - `packages/core/src/diagram-lint/frame-straddle.ts`
  - `packages/core/src/diagram-lint/frame-straddle.test.ts`
  - `packages/core/src/database-ddl.ts`
  - `apps/cli/src/ddl-frame-scope.test.ts`
  - `impl-plans/progress/cpf-03-ddl-frame-scope.md`
  - `tmp/cpf-s748/cpf-03-ddl-frame-scope`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

`generateDatabaseDdl` scopes a frame with `expandContainers`, which follows `frameParents`. Canvas
ownership skips a frame above an element, and gives a table only one owner. So a table straddling a
nested positional frame vanishes from the outer frame's DDL, and a positional frame above a table
owns nothing. This plan adds a DDL-only resolver and a lint rule module. Canvas, carry and selection
behavior must not change.

## Non-goals

- Do not edit `frame-tree.ts`, `frame-membership.ts`, `packages/core/src/index.ts`,
  `apps/cli/src/lint-diagram.ts` or `apps/cli/src/commands.ts`. The lint hook and export are in
  `cpf-06`, and help text too.
- No scope change for views or other database objects, or for DDL without `frameId`.
- No change to `--frame` name resolution.

## Contract for `cpf-06`

`packages/core/src/diagram-lint/frame-straddle.ts` exports:

```ts
export interface FrameStraddleFinding {
  readonly elementId: string;
  readonly message: string;
}
export function lintFrameStraddles(document: Document, pageId: PageId): FrameStraddleFinding[];
```

## File-level changes

`packages/core/src/erd-frame-scope.ts` (new):

```ts
export interface ErdFrameScope {
  readonly included: ReadonlySet<ElementId>;
  readonly warnings: readonly string[];
}
export function erdFrameScope(store: Store, page: PageId, frameId: ElementId, context: ShapeContext): ErdFrameScope;
```

Also export two box predicates for the lint rule: `boxFullyInside(inner, outer)`, inclusive and
identical to the test in `frameParents` (`packages/core/src/frame-tree.ts:88`), and
`boxesOverlap(a, b)`, with positive area.

Rule, as in the design:

- `base` = `expandContainers(store, [frameId], context)`. Everything in `base` stays included.
- Containers = `frameId` and every frame in `base`. Open: no `memberIds`, or `memberIds` non-empty
  and all listed ids are frames. Otherwise closed.
- For each `erd.table` on the page outside `base`, sorted by table name then id, take the first
  matching case:
  1. Claimed elsewhere: a frame outside `base` lists it. Excluded, no warning.
  2. Competing frame: `frameParents(store, page, context).get(T)` = Q, Q outside `base`, T fully
     inside an open container C, Q not fully inside C, and Q does not enclose C. Excluded with a warning.
  3. Adopted: T fully inside an open container. Included.
  4. Closed: T fully inside a closed container that does not list it. Excluded with a warning.
  5. Straddling: T overlaps a container with positive area and is not fully inside it. Excluded
     with a warning.
  6. Otherwise out of scope, with no warning.
- Warning text: `<tableName>: table excluded from frame <frame name>: <reason>.` One per table.
  Reasons name the other frame: `also inside frame <Q>`, `not listed in memberIds of frame <C>`,
  `straddles the edge of frame <C>`. A missing frame name falls back to its id.

`packages/core/src/database-ddl.ts`, in the `options.frameId` branch only:

- Replace the `expandContainers` call with `erdFrameScope(...)`, and use its `included` set where
  `included` is used today, so relations follow.
- Put the scope warnings first in `warnings`, before later pushes.
- Remove the `expandContainers` import only if nothing else uses it.

`packages/core/src/diagram-lint/frame-straddle.ts` (new), imitating `lintNodeOverlaps`
(`packages/core/src/diagram-lint/node-overlap.ts:47`):

- Return `[]` unless the page kind is `erd`, and return at once when the page has no frames.
- Skip hidden elements, and mask sources, as `lintNodeOverlaps` does, for both tables and frames.
- One finding per table and frame pair where `boxesOverlap` is true and `boxFullyInside` is false.
  Message: `Table <tableName> straddles the edge of frame <frame name>.` `elementId` is the table.
- Sort by table name, table id, then frame id.
- Include explicit members too.

## What a careless implementation gets wrong

- The existing test `packages/core/src/database-ddl.test.ts:487` has frames `db-a` `[nested]`,
  `nested` `[orders, local-view]` and `db-b` `[users]`. It must stay exactly as is and pass: tables
  claimed by another frame are excluded silently, so `b.warnings` stays `[]`.
- A frame without `memberIds` has an owner found by `frameParents`, which applies the z-order rule.
  So do not treat `parents.get(T) === undefined` as "not inside".
- Q that encloses C, or lies fully inside C, is nesting and not competition. Only partial overlap
  is a competing frame.
- A frame with zero width or height never contains anything, as in `frameParents`.
- Do not add a warning for a table in `base`, even if it straddles: it is listed or owned.
- Keep the warning order deterministic: use the same `compare` style as `database-ddl.ts`, not
  `localeCompare`.
- Boa: no regex split, and no per-point destructuring. This runs only with `--frame`.

## Tests

`packages/core/src/erd-frame-scope.test.ts` (new):

- Repro: `zone` positional, drawn before widgets and gadgets, inside it; `catalog` memberIds `[zone]`
  encloses all. Both tables in `catalog` scope, no warnings.
- gadgets moved to straddle `zone`'s bottom edge, still inside `catalog` -> `catalog` includes
  both, with no warning; `zone` excludes gadgets with a warning naming `gadgets` and `zone`.
- Positional frame after (above) a table fully inside it -> included, no warning.
- Positional inner frame below an outer frame, table inside inner -> the outer frame includes it.
- Table claimed by another frame and geometrically inside F -> excluded, no warning.
- Two partially overlapping positional frames, table in the intersection, owned by the smaller ->
  the larger frame excludes it with a warning naming the smaller.
- Closed frame `memberIds: [widgets]`, unlisted gadgets inside -> excluded with a warning.
- `memberIds: []`, unlisted table inside -> excluded with a warning.
- Table overlapping nothing -> no warning.
- `frameParents` output -> unchanged by calling `erdFrameScope`.

`packages/core/src/diagram-lint/frame-straddle.test.ts` (new):

- Table straddling a positional frame -> one finding naming both.
- Table straddling two frames -> two findings, in stable order.
- Table fully inside, or touching an edge without area overlap -> none.
- Hidden table -> none. Non-ERD page -> none. Explicit member that straddles -> one finding.

`apps/cli/src/ddl-frame-scope.test.ts` (new), imitating `apps/cli/src/export-paint-order.test.ts`
with `Bun.spawnSync` on `main.ts`:

- Repro with straddling gadgets: `ddl --page ... --frame catalog --strict` -> exit 0, SQL has both tables.
- `--frame zone --strict` -> exit 3, stderr names `gadgets`. Without `--strict` -> exit 0, the
  warning line is present and the SQL lacks gadgets.
- Positional frame above a table: `--frame <name> --strict` -> exit 0, SQL has the table.
- An unambiguous document, with and without `--frame` -> the SQL equals the SQL generated with
  `expandContainers`-only membership, asserted against a literal expected string.

## Verification

1. `bun test packages/core/src/erd-frame-scope.test.ts packages/core/src/diagram-lint/frame-straddle.test.ts apps/cli/src/ddl-frame-scope.test.ts` exits 0.
2. `bun test packages/core/src/database-ddl.test.ts packages/core/src/database-ddl-tables.test.ts packages/core/src/database-objects.test.ts packages/core/src/database-ddl-expressions.test.ts packages/core/src/erd-definition-edit.test.ts apps/desktop/src/design-workflow.test.ts` exits 0, with no change to those tests.
3. `bun run typecheck` exits 0 (overview rule 11).
4. `bunx biome check` on the files you edited exits 0.

## Done criteria

- `git diff --quiet 1e8f43d -- packages/core/src/frame-tree.ts packages/core/src/frame-membership.ts packages/core/src/database-ddl.test.ts` exits 0.
- The progress log lists evidence for each verification command.

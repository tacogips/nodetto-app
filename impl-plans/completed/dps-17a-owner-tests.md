# dps-17a-owner-tests

- planId: dps-17a-owner-tests (session 864, wave 1, dependsOn: none)
- Design: `design-docs/specs/design-document-pages-snippets.md` section 10.2,
  "Owner decisions".
- Parent: `impl-plans/active/dps-17-wiring.md` (remaining work split).
- writePaths:
  - `packages/ui-solid/src/bpmn-palette.test.ts`
  - `packages/ui-solid/src/interaction-creation.test.ts`
  - `packages/ui-solid/src/shape-search.test.ts`
  - `impl-plans/progress/dps-17a-owner-tests.md`
  - `tmp/dps-s864/dps-17a-owner-tests`
  - `target` (artifact root only; this plan builds nothing)
- sharedPaths: none. artifactRoots: `target`.

## Intent and context

Three tests fail on HEAD e557845 because the committed wiring added a
Page palette action and three toolbar actions
(`tmp/dps-s863/dps-17-wiring/round2-aggregate.log`). The owner decided
how each test must change. Apply exactly those decisions, edit only the
tests, and change no product code.

The Page entry is declared in `packages/ui-solid/src/shape-palette.ts:138-143`
as `{ tool: "action:add-page-frame", label: "Page", icon: "frame", action: "add-page-frame" }`
inside the common shape list. The `action` field type is
`"icon-picker" | "ios-kit" | "add-page-frame"` (`shape-palette.ts:89`).

## Non-goals

- Do not edit `shape-palette.ts`, `ShapePalette.tsx`, `tools.ts`,
  `shortcuts.ts`, `Toolbar.tsx` or any product file.
- Do not delete, skip or loosen any assertion beyond the three decisions
  below. Do not drop the Page entry from the palette.

## Changes

1. `bpmn-palette.test.ts`, the `ACTION_MENUS` expectation (around :226-231):
   - insert `"addPageFrame"`, `"nextPageFrame"` and `"previousPageFrame"`
     into the expected action-id list of the menu that now contains them;
   - use the order the received value shows: right after the entry that
     precedes `"frameSelection"`, the same order as `Toolbar.tsx:184-186`.
   - Nothing else changes.
2. `interaction-creation.test.ts`, the "left shape palette creation"
   describe (:20-) and any other loop over palette arrays in the file that
   calls `interactionFor(editor, item.tool)` or `creationFor(item.tool)`:
   - skip entries with `item.action !== undefined` next to the existing
     connector/port `continue`;
   - add one separate test, "palette action entries are actions, not
     creation tools". It asserts that `COMMON_SHAPES` contains exactly one
     entry with `action === "add-page-frame"`, whose `tool` is
     `"action:add-page-frame"` and whose label is `"Page"`.
   - Do not call `creationFor` on that entry; it throws by design.
3. `shape-search.test.ts`, the "every palette shape has a shape ID" test
   (:16-34):
   - only entries without `action` must satisfy `findShape(...) !== undefined`;
   - action entries are collected separately, and their action ids must
     equal exactly `["add-page-frame"]` (sort before comparing if more than
     one array is concatenated);
   - keep the `pointByPoint` exclusion unchanged.

## Pitfalls

- Using `item.tool.startsWith("action:")` instead of `item.action` is
  wrong: `icon-picker` and `ios-kit` entries have real tool ids. Filter on
  `item.action`.
- Check whether the `icon-picker` or `ios-kit` entries are in the arrays
  the test iterates. If they are, the exact action-id expectation in
  change 3 must list every action id actually present. That is still an
  extension, not a loosening. Record the actual list in the progress log.

## Test cases (input -> expected)

- `bpmn-palette.test.ts` on the current toolbar -> passes with the 3 ids
  added.
- Creation loop over `COMMON_SHAPES`, `DIAGRAM_SHAPES` and
  `ARTBOARD_SHAPES` -> no test named `action:add-page-frame places...`;
  every other tool still runs both existing tests.
- New action test -> exactly one Page action entry.
- Shape-search catalogue test -> every non-action entry is found; the
  action ids equal the exact list.

## Verification (each must exit 0; logs in `tmp/dps-s864/dps-17a-owner-tests/`)

1. `bun test packages/ui-solid/src/bpmn-palette.test.ts packages/ui-solid/src/interaction-creation.test.ts packages/ui-solid/src/shape-search.test.ts`
   -> 0 fail.
2. `bun run typecheck` -> exit 0.
3. `bunx biome check --diagnostic-level=warn packages/ui-solid/src/bpmn-palette.test.ts packages/ui-solid/src/interaction-creation.test.ts packages/ui-solid/src/shape-search.test.ts`
   -> exit 0.

## Acceptance criteria

- The three files pass. `git diff` shows only added expectations, the
  `item.action` skip and the separated action assertions; no `test.skip`,
  `.todo` or removed `expect`.
- `rg -n "add-page-frame" packages/ui-solid/src/interaction-creation.test.ts packages/ui-solid/src/shape-search.test.ts`
  matches in both files.

## Coordination and progress

Read each file fresh before editing and record its sha256 before and
after in `impl-plans/progress/dps-17a-owner-tests.md`, with each command,
its exit code and its log path. Do not change git state.

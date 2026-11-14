# zorder-03-help-docs

- planId: zorder-03-help-docs
- planPath: impl-plans/active/zorder-03-help-docs.md
- progressPath: impl-plans/progress/zorder-03-help-docs.md
- wave: 1
- dependsOn: none (documents behavior pinned by the design)
- Design: `design-docs/specs/design-z-order.md` sections 2.3, 3 and 4.
- writePaths:
  - `apps/cli/src/help.ts`
  - `docs/cli.md`
  - `docs/design.md`
  - `impl-plans/progress/zorder-03-help-docs.md`
  - `tmp/zorder-s734/zorder-03-help-docs`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

Follow the worker rules in `impl-plans/active/zorder-00-overview.md`.

## Intent and context

Users learn `order` and the container paint rule from help and docs. Sibling branches
edit the same files, so hunks stay small and localized.

Existing text to imitate: the operation examples and rule bullets in
`apps/cli/src/help.ts` (around the `group`, `ungroup` and `replace-text` lines, 205-247)
and the operations paragraph in `docs/cli.md` (lines 103-106).

## Changes

`apps/cli/src/help.ts`, edit help section only:

- Examples after the `ungroup` example:
  `{"op":"order","id":"@panel","to":"back"}` and
  `{"op":"order","id":"@panel","before":"@widget"}`.
- One rule bullet stating:
  - `to` is `back`, `front`, `backward` or `forward`; `before` puts it directly
    beneath the anchor and `after` directly above; exactly one of the three is
    required.
  - `id` or `where`/`expect` selects targets; several targets move as one block.
  - Group members reorder within their group. Ungrouped elements reorder on the page,
    together with frame contents and group members.
  - Frames and BPMN pools, lanes, groups and expanded sub-processes always paint
    beneath what they enclose, so `to: front` does not lift them above their contents,
    and `to: back` does not put enclosed content behind them. Sending content behind
    its frame also ends implicit ownership, so it no longer moves with the frame.

`docs/cli.md`: extend the operations paragraph with `order` and one short paragraph
carrying the same rules, including how to give a frame ownership: order the frame
`to: back` or `before` the node, because painting beneath does not grant ownership.

`docs/design.md`, right after line 32 ("Content belongs to the smallest enclosing
artboard below it in z-order; moving content outside releases it."): add that an
artboard always paints beneath content it encloses, whatever the stored order, and
that ownership still requires the artboard to be below the content. To keep a covering
panel, use a rectangle shape, or group the frame with the content.

## Pitfalls

- Do not edit `README.md` or `apps/cli/src/commands.ts`; neither lists edit operations.
- Do not state that `add` inserts containers below content. It does not.
- Do not mention hit testing, implementation names or file paths in user docs.
- Use only neutral example names.
- Keep existing help wording unchanged; tests compare parts of it.

## Tests

No new test file. Existing help tests must still pass.

## Acceptance criteria

- `help.ts` and `docs/cli.md` contain `"op":"order"`, and both describe `before`,
  `after` and the paint-rule interaction.
- `docs/design.md` describes the paint rule next to the ownership sentence.

## Verification (each must exit 0)

1. `bun test apps/cli/src/commands.test.ts`: all pass.
2. `bun run typecheck`: no errors.
3. `bunx biome check apps/cli/src/help.ts`
4. `grep -q '"op":"order"' apps/cli/src/help.ts`
5. `grep -q '"op":"order"' docs/cli.md`
6. `grep -q 'paints beneath' docs/design.md`

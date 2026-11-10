# ipd-08-cli-layout-ops

- planId: ipd-08-cli-layout-ops
- planPath: impl-plans/active/ipd-08-cli-layout-ops.md
- progressPath: impl-plans/progress/ipd-08-cli-layout-ops.md
- wave: 3. dependsOn: ipd-04-cli-edit-contracts
- Design (binding): `design-docs/specs/design-iphone-app-design.md`, Decision 7 (7.1-7.5) and D8.
- Evidence: `tmp/ipd-s772/ipd-08-cli-layout-ops/`.
<!-- ownership:start -->
- writePaths:
  - `apps/cli/src/edit/operations/layout.ts`
  - `apps/cli/src/edit/sizing-fields.ts`
  - `apps/cli/src/layout-ops.test.ts`
  - `impl-plans/progress/ipd-08-cli-layout-ops.md`
  - `tmp/ipd-s772/ipd-08-cli-layout-ops`
- sharedPaths:
  - none
- sharedPathNotes:
  - none
- artifactRoots:
  - `tmp/ipd-s772/ipd-08-cli-layout-ops`
<!-- ownership:end -->

## Intent and context

D8: frames already support auto layout. `semantic.layout`, `layoutGrow` and `layoutPosition: "absolute"` exist, and `packages/core/src/auto-layout.ts` runs inside every transaction. Layout only runs on frames with `memberIds`, and the CLI has no convenient operation for it, so agents hand-computed coordinates.

This plan implements the CLI operations `layout`, `align`, `distribute` and `snap`, and the `sizing`/`absolute` fields on `add`/`update`. They are wired by `ipd-04`.

## Non-goals

- No new IR fields.
- No per-child cross-axis alignment field (design intentional divergence).
- No desktop changes. The desktop snap-grid size is handled in `ipd-29`.
- No help text (`ipd-25`).

## File-level changes

`apps/cli/src/edit/operations/layout.ts` replaces the stubs. Keep the exported names.

`layoutOperation`:

- Resolve `id` to a `frame` (reference rules as in `update`). A non-frame is an error.
- Build `semantic.layout`, keeping the existing value for any field not given. Defaults when absent:
  - direction `vertical`, gap 0, padding 0;
  - sizing `fixed`, align `start`, justify `start`.
- Padding:
  - a number sets `padding`;
  - `[t, r, b, l]` (4 finite >= 0 numbers) sets `padding: 0` plus `paddingTop`, `paddingRight`, `paddingBottom` and `paddingLeft`;
  - any other shape is an error.
- `width`/`height` (`fixed`|`hug`) set `widthSizing`/`heightSizing`. `wrap` and `crossGap` are passed through.
- If the frame has no `memberIds`, set `memberIds` to its current geometric children from `frameParents(store, page, ctx)`, sorted by position: (y, x) for vertical, (x, y) for horizontal. Ties break by element id.
- `remove: true` deletes `layout` and keeps `memberIds`. It cannot be combined with other layout fields.
- Apply through `batch.editor.apply([{type: "updateSemantic", ...}])`, as `elements.ts:updateOne` does, so layout runs in the same transaction.

`alignOperation`:

- Targets from `ids` or `where`/`expect`, using the same selector helpers as `operations/order.ts`.
- `edge` is one of `left|hcenter|right|top|vcenter|bottom`.
- `to`:
  - `"selection"` (default): requires 2 or more targets and uses `planAlign` (`packages/core/src/align.ts:92`).
  - `"parent"`: aligns each target to its parent frame's box from `frameParents`. No parent is an error.
  - `"safe-area"`: aligns to `safeAreaContentBox(parentBox, safeArea)`. A parent without a safe area falls back to its box, with a warning.
  - any other string: an element reference, aligned to that element's bounds.
- Targets in an auto-layout flow (parent has `layout` and the child is not `layoutPosition: "absolute"`) are skipped with a warning `skipped <id>: positioned by auto layout`.

`distributeOperation`:

- `axis` is `horizontal|vertical`.
- Without `gap`: requires 3 or more targets and uses `planDistribute` (`align.ts:137`).
- With `gap` (finite >= 0): requires 2 or more targets. Sort by position on the axis (ties by id). Keep the first element; place each next one at `previous end + gap`.
- Flow children are skipped as in `align`.

`snapOperation`:

- Targets from `ids`, `where`, or `page` (all elements on that page).
- `grid` must be one of 1, 2, 4, 8.
- For each target with a box (not edges, not flow children): round x and y relative to the parent frame origin (or the page origin) to the grid, and round width and height to the grid with a minimum of one grid unit.
- Text elements with `textResize` auto keep their auto dimension and are not resized.
- Moves go through `batch.moveBoxTo`, or the same command path `move` uses, so frame members follow.

`apps/cli/src/edit/sizing-fields.ts` replaces the stub, keeping its signature:

- `sizing: {width?, height?}`, with values `fixed|hug|fill`.
- Main axis = the parent layout direction; there must be a parent frame with layout for `fill`.
- Main-axis `fill` -> `visual.layoutGrow: 1`.
- Cross-axis `fill` -> allowed only when the parent `align === "stretch"`. Otherwise `OperationError(index, 'cross-axis "fill" needs the parent frame layout align "stretch"; set it with {"op":"layout","id":<parent>,"align":"stretch"}')`.
- `hug` on `text.note` -> `textResize: "auto-width"` (width) or `"auto-height"` (height).
- `hug` on a frame with layout -> `widthSizing`/`heightSizing: "hug"`. Any other type is an error.
- `fixed` -> remove `layoutGrow` for the main axis, set `textResize: "fixed"` for text, and set frame sizing `fixed`.
- `absolute: true` sets `visual.layoutPosition: "absolute"`; `false` removes it.

## Patterns to imitate

- `apps/cli/src/edit/operations/order.ts` for target selection and errors.
- `apps/cli/src/edit/operations/elements.ts:updateOne` for applying commands.
- `packages/ui-solid/src/inspector/FrameAutoLayoutFields.tsx:27-35` for how enabling layout attaches members (copy the semantics, not UI code).

## Pitfalls

- Layout runs inside `editor.apply`. Do not compute child positions yourself.
- `memberIds` order is the flow order. Do not re-sort an existing `memberIds`.
- The `carryMembers` rules do not apply here.
- Rounding: `Math.round(v / grid) * grid` relative to the parent origin, then add the origin back. Keep the result deterministic, avoiding negative zero (`fmt` already maps -0 to 0 in export).
- Error messages name the operation index, through `OperationError`.

## Tests: new `apps/cli/src/layout-ops.test.ts`

- **Vertical list.** Frame 390×300 with 3 rects at y 50, 10, 100 (no members) + `layout {direction: vertical, gap: 8, padding: 16, align: stretch}` -> `memberIds` ordered by y, rects stacked at y 16, 16+h1+8, and so on; width 358.
- **Toolbar.** Horizontal toolbar, `justify: space-between` -> first child x = padding, last child right = width - padding.
- **Padding forms.** `[8,16,8,16]` -> `paddingTop` 8, `paddingLeft` 16. `padding: [1,2]` -> error.
- **Remove.** `remove: true` -> `layout` absent, `memberIds` kept.
- **Fill.** `sizing {width: "fill"}` on a row in a horizontal layout -> `layoutGrow` 1. Cross-axis fill under `align: start` -> an error mentioning `stretch`.
- **Hug.** `sizing {width: "hug"}` on `text.note` -> `textResize` auto-width.
- **Absolute.** `absolute: true` -> `layoutPosition` absolute, and the child keeps its position while the others reflow.
- **Align.**
  - `to: "parent"`, `edge: "right"` -> child right = frame right.
  - `to: "safe-area"`, `edge: "top"` on an iPhone frame -> child y = frame y + 47.
- **Distribute.** `gap: 12` vertical on 3 boxes -> exact 12 gaps. Without gap on 3 boxes -> equal gaps.
- **Snap.** `grid: 4` on x 13.3 within a frame at x 100 -> x 112, relative 12.
- **Flow children.** A flow child in `align` -> a skipped warning, and it is unmoved.

## Verification (evidence in `final/`)

1. `bun test apps/cli/src/layout-ops.test.ts apps/cli/src/edit apps/cli/src/edit-frame-carry.test.ts packages/core/src/auto-layout.test.ts packages/core/src/align.test.ts` -> exit 0, 0 fail.
2. `bun run typecheck` -> no `error TS` line in the owned files.
3. `bunx biome check apps/cli/src/edit/operations/layout.ts apps/cli/src/edit/sizing-fields.ts apps/cli/src/layout-ops.test.ts` -> exit 0.
4. Visual evidence:
   - Build a 390×844 frame with a vertical list of 6 rows, a toolbar and a tab-bar-like horizontal layout using only these operations.
   - Export `final/layout.png` at `--scale 2` and inspect the alignment.

## Done criteria

Verification passes, and the progress log records the test counts and visual notes.

## Worker rules

- Record `git hash-object` of this plan first.
- Read each file fresh before editing it, with pre and post hashes. On drift, re-read, keep the other change and record it.
- Edit only writePaths.
- No state-changing git commands, no emojis. Evidence files must not match Bun test patterns.

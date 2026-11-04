# sef-06-edit-box-align-writes

- planId: sef-06-edit-box-align-writes
- planPath: impl-plans/active/sef-06-edit-box-align-writes.md
- progressPath: impl-plans/progress/sef-06-edit-box-align-writes.md
- wave: 2
- dependsOn: sef-01-edit-visual-merge, sef-02-edit-style-keys, sef-05-box-label-layout
- Design: `design-docs/specs/design-style-export-fixes.md`, section "Compatibility contract", the write table and behavior matrix.
- Worker rules and pinned contracts: `impl-plans/active/sef-00-overview.md`.
- writePaths:
  - `apps/cli/src/edit/visual-patch.ts`
  - `apps/cli/src/edit/box-label-align.test.ts` (new)
  - `apps/cli/src/edit/operations/add.ts`
  - `apps/cli/src/native-parity/box-label.test.ts` (new)
  - `impl-plans/progress/sef-06-edit-box-align-writes.md`
  - `tmp/sef-s733/sef-06-edit-box-align-writes`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

Renderers honor `verticalAlign` on a box node only with `visual.style.boxLabelAlign: true` (sef-05). Users write only `verticalAlign`, so `edit add`
and `update` must add the marker. On a text-style-bound box, `planTextStyles` would overwrite the requested value, so the link is removed, as the app does
for typography edits (`packages/core/src/editor/style-text.ts:162-187`).

## Non-goals

- No rendering or IR changes. No `text.note` changes.
- `operations/elements.ts` is not edited: `updateOne` already calls `visualPatchCommand` (sef-01).
- `connect` is not changed.
- No marker from draw.io import or document load (user-qa Q1).

## File-level changes

`apps/cli/src/edit/visual-patch.ts`: add
`export function withBoxLabelAlign(type: string, patch: JsonObject, current: Visual | undefined): JsonObject`, returning the patch unchanged unless `type` is
`node.generic` or `shape.geo` and `patch.style` is a plain object. Then:

| `style.verticalAlign` in patch | Other patch state | Result patch |
| --- | --- | --- |
| A value | Patch has no `style.boxLabelAlign` key | Adds `style.boxLabelAlign: true` |
| A value | Bound (`current.textStyle` set) and patch has no `textStyle` key | Also adds `textStyle: null` |
| A value | Patch has its own `textStyle` key | Link untouched. The style's value wins when `planTextStyles` runs |
| null | Patch has no `style.boxLabelAlign` key | Adds `style.boxLabelAlign: null` |
| Absent | Any | Unchanged. `boxLabelAlign: true` or null passes through |

`visualPatchCommand` applies `withBoxLabelAlign(element.type, patch, element.visual)` first, before the `[]` step.

`apps/cli/src/edit/operations/add.ts`, `addElement` (line 37 area): when `visual` is a plain object, apply `withBoxLabelAlign(type, visual, undefined)` and strip `verticalAlign` and
`boxLabelAlign` when their value is null, since `add` has no merge step. `addShape` reaches `addElement` with the resolved type, so it needs no hunk. Keep this small.

## What a careless implementation gets wrong

- A lock-only patch has no `style`, so it is not affected. Keep the order so the lock path still sees the same keys.
- An explicit `boxLabelAlign: false` in the patch stays as given.
- `textStyle: null` works because `deepMerge` deletes it. Other typography stays materialized.
- A `text.note` bound to a style must keep its link and get no marker.
- Multi-element `where` updates apply per element with each element's own type and binding.

## Tests

`apps/cli/src/edit/box-label-align.test.ts`, imitating `apps/cli/src/edit/selectors.test.ts`, then reload through `parseDocument` where it matters:

- `add` node.generic with `style.verticalAlign: "top"` -> marker stored; SVG first line above center.
- `add` with `shape` resolving to `shape.geo` and `bottom` -> marker stored; SVG at bottom.
- `update` unbound with `bottom` -> marker; `layout.top` matches `alignedLabelTop`.
- `update` on a legacy node storing `top` with no marker, `style: {stroke: "#112233"}` -> no marker, SVG unchanged.
- `update` bound box with `bottom` -> `textStyle` gone, other typography kept, label at bottom, and a later unrelated `update` does not reset it.
- `update` bound box with `boxLabelAlign: true`, style value `bottom` -> link kept, label at bottom. `update` of that text style to `top` (`updateTextStyle` from `@nodetto/core`) -> label at top.
- `update` with `textStyle: "<id>"` and `verticalAlign: "bottom"`, style value `top` -> link kept, value `top`, marker present.
- `update` with `verticalAlign: null` -> both keys gone, label back at middle, `style` gone if empty.
- `update` with `boxLabelAlign: null` -> marker gone, stored value kept, label at middle.
- `text.note` with `verticalAlign: "bottom"` -> no marker. Bound note -> link kept.
- `style.boxLabelAlign: true` accepted by the unknown-key check; `style.valign` still rejected.
- Written document reloads with the marker in `style`, not `extensions`.

`apps/cli/src/native-parity/box-label.test.ts`, using `nativeTest` and one copy per runtime as in `style-edit.test.ts`:

- `add` and `update` batches for both box types -> same exit codes, stderr and written bytes.
- `compare(["export", doc, "--format", "svg"], cwd)` on the results -> equal.
- PNG and PDF export with top and bottom -> exit 0 in both, valid signature, and different bytes from a no-marker copy.
- `style.valign` batch -> same error in both.

## Verification (each must exit 0)

1. `bun test apps/cli/src/edit` -> 0 fail.
2. `bun test apps/cli/src/box-label-compat.test.ts apps/cli/src/edit-frame-carry.test.ts` -> 0 fail.
3. `bun run typecheck`.
4. `bunx biome check apps/cli/src/edit/visual-patch.ts apps/cli/src/edit/box-label-align.test.ts apps/cli/src/edit/operations/add.ts apps/cli/src/native-parity/box-label.test.ts`.
5. `sh -c 'CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity/box-label.test.ts'` -> 0 fail, 0 skip.

## Done criteria

- Verification 1-5 exit 0 with logs recorded.
- `grep -n "withBoxLabelAlign" apps/cli/src/edit/operations/add.ts` matches.
- Progress log complete.

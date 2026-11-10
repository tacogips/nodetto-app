# ipd-04-cli-edit-contracts

- planId: ipd-04-cli-edit-contracts
- planPath: impl-plans/active/ipd-04-cli-edit-contracts.md
- progressPath: impl-plans/progress/ipd-04-cli-edit-contracts.md
- wave: 2. dependsOn: ipd-00-baseline
- Design (binding): `design-docs/specs/design-iphone-app-design.md`, Decisions 1.3/1.5 (text alignment aliases, typography detach), 2.4 (`icon:<name>`), 5.2/5.3 (`ios:<name>`, `props`), 6.2/6.3 (`parent`, `memberIndex`, parent-relative coordinates), 7.1-7.5 (`layout`, `sizing`, `absolute`, `align`, `distribute`, `snap`).
- Evidence: `tmp/ipd-s772/ipd-04-cli-edit-contracts/`.
<!-- ownership:start -->
- writePaths:
  - `apps/cli/src/edit/operation-fields.ts`
  - `apps/cli/src/edit/batch.ts`
  - `apps/cli/src/edit/operations/add.ts`
  - `apps/cli/src/edit/operations/elements.ts`
  - `apps/cli/src/edit/operations/layout.ts`
  - `apps/cli/src/edit/parent-fields.ts`
  - `apps/cli/src/edit/sizing-fields.ts`
  - `apps/cli/src/edit/kit-shapes.ts`
  - `apps/cli/src/edit/icon-shapes.ts`
  - `apps/cli/src/edit/typography-link.ts`
  - `apps/cli/src/edit/ipd-contracts.test.ts`
  - `impl-plans/progress/ipd-04-cli-edit-contracts.md`
  - `tmp/ipd-s772/ipd-04-cli-edit-contracts`
- sharedPaths:
  - `apps/cli/src/edit/operation-fields.test.ts`
- sharedPathNotes:
  - path: `apps/cli/src/edit/operation-fields.test.ts`; intendedEdit: update only expectations that snapshot the full valid-field lists, after the new fields are appended
- artifactRoots:
  - `tmp/ipd-s772/ipd-04-cli-edit-contracts`
<!-- ownership:end -->

## Intent and context

Several later plans add fields and operations to `nodetto-cli edit`. The shared files are `apps/cli/src/edit/operation-fields.ts`, `batch.ts`, `operations/add.ts` and `operations/elements.ts`. If parallel plans edited these files, they would collide.

This plan wires all new fields and operations into those files once. Each feature has one hook, in its own new file. The hooks start as stubs with defined error behavior, and the feature plans later replace only their own hook file:

| Hook file | Owner |
| --- | --- |
| `edit/typography-link.ts` | `ipd-09` |
| `edit/icon-shapes.ts` | `ipd-07` |
| `edit/sizing-fields.ts` | `ipd-08` |
| `edit/operations/layout.ts` | `ipd-08` |
| `edit/parent-fields.ts` | `ipd-11` |
| `edit/kit-shapes.ts` | `ipd-14` |

Because the CLI bundle also runs in the native CLI, nothing here may import Node APIs.

## Non-goals

- Implement no feature behavior beyond the plumbing below.
- Do not touch help text. `ipd-25` owns `apps/cli/src/help.ts`.
- No change to existing operations' behavior when no new field is present. Byte-identical output for every existing test.

## File-level changes

`apps/cli/src/edit/operation-fields.ts`, `OPERATION_FIELDS`:

- `add` gains `parent`, `memberIndex`, `props`, `sizing`, `absolute`.
- `update` gains the same five.
- New operations:
  - `layout`: `op`, `id`, `direction`, `gap`, `padding`, `align`, `justify`, `width`, `height`, `wrap`, `crossGap`, `remove`;
  - `align`: `op`, `ids`, `where`, `expect`, `edge`, `to`;
  - `distribute`: `op`, `ids`, `where`, `expect`, `axis`, `gap`;
  - `snap`: `op`, `ids`, `where`, `expect`, `page`, `grid`.

Keep the existing unknown-field check and its "Did you mean" suggestions.

`apps/cli/src/edit/batch.ts`, operation dispatch (`:318-381`): add `case "layout"`, `"align"`, `"distribute"` and `"snap"`. They call `layoutOperation`, `alignOperation`, `distributeOperation` and `snapOperation` from the new `apps/cli/src/edit/operations/layout.ts`. Each stub throws `new OperationError(index, '"<op>" is not available in this build')`.

New hook files. These are the exact exported signatures (the contract); stub bodies as stated:

- `apps/cli/src/edit/parent-fields.ts`
  - `export interface ParentPlacement { readonly parentId: ElementId; readonly origin: { readonly x: number; readonly y: number }; readonly memberIndex?: number }`
  - `export function resolveParentPlacement(batch: Batch, operation: JsonObject, index: number, pageId: PageId): ParentPlacement | undefined`
    - Stub: throws `OperationError(index, '"parent" is not available in this build')` when `operation.parent` or `operation.memberIndex` is defined; otherwise returns undefined.
  - `export function attachToParent(batch: Batch, id: ElementId, placement: ParentPlacement | undefined, positioned: boolean, index: number): void`
    - Stub: no-op.
  - `export function reparentFromUpdate(batch: Batch, element: Element, operation: JsonObject, index: number): ParentPlacement | undefined`
    - Stub: throws like `resolveParentPlacement` when `parent` or `memberIndex` is present; otherwise returns undefined.
- `apps/cli/src/edit/sizing-fields.ts`
  - `export function applySizingFields(batch: Batch, id: ElementId, operation: JsonObject, index: number): void`
    - Stub: throws "not available" when `sizing` or `absolute` is present; otherwise no-op.
- `apps/cli/src/edit/kit-shapes.ts`
  - `export function isKitShapeId(id: string): boolean`, returning `id.startsWith("ios:")`.
  - `export function addKitShape(batch: Batch, operation: JsonObject, index: number): ElementId`
    - Stub: throws `OperationError(index, 'kit shape "<id>" is not available in this build')`.
  - `export function applyKitProps(batch: Batch, id: ElementId, props: unknown, index: number): void`
    - Stub: throws `OperationError(index, '"props" is only accepted on iOS kit instances')` when `props !== undefined`.
- `apps/cli/src/edit/icon-shapes.ts`
  - `export function isIconShapeId(id: string): boolean`, returning `id.startsWith("icon:")`.
  - `export function iconShapeCreation(id: string, index: number): { readonly type: "ui.icon"; readonly semantic: JsonObject; readonly visual: JsonObject }`
    - Stub: throws "not available".
- `apps/cli/src/edit/typography-link.ts`
  - `export function normalizeTypography(type: string, visual: Json | undefined, existing: Visual | undefined, index: number): { readonly visual: Json | undefined; readonly detachedStyle?: ElementId }`
    - Stub: returns `{visual}` unchanged.

`apps/cli/src/edit/operations/add.ts`:

- `addElement`:
  1. Pass `visual` through `normalizeTypography(type, visual, undefined, index)` before `withBoxLabelAlign`.
  2. Call `resolveParentPlacement(batch, operation, index, page.id)` after the page is resolved.
  3. If a placement is returned and the visual has numeric `x` and/or `y`, add `placement.origin` to those present.
  4. `autoPlace` must be false whenever a placement exists.
  5. After the element is created, labelled and placed: `attachToParent(batch, id, placement, positioned, index)` (always called), then `applySizingFields(batch, id, operation, index)`.
  6. If `operation.props !== undefined` on a non-kit add, throw `OperationError(index, '"props" is only accepted on iOS kit shapes')`.
  7. Record `detachedStyle` warnings through the same warning channel that `apply-batch.ts` uses for `semantic.unknownField`. Read `apps/cli/src/warnings.ts` and copy that call pattern; the text is pinned by `ipd-09`.
- `addShape`:
  - Before `batch.shape(...)`, a shape id starting with `icon:` (`isIconShapeId`) builds the add from `iconShapeCreation`: type, semantic and visual are merged with the operation's own semantic and visual in the same order as other shapes. It then follows the same path as a typed add, so parent, sizing and label still apply.
  - A shape id starting with `ios:` (`isKitShapeId`) returns `addKitShape(batch, operation, index)`.

`apps/cli/src/edit/operations/elements.ts`, `updateElement` / `updateOne`:

- `update` may now carry only `parent`, `memberIndex`, `props`, `sizing` or `absolute`. Extend the "update needs semantic, visual or label" check to list these too, with the message updated accordingly.
- In `updateOne`:
  1. Pass `visual` through `normalizeTypography(element.type, visual, element.visual, index)`.
  2. `const placement = reparentFromUpdate(batch, element, operation, index)`. If set and the visual has `x`/`y`, add `placement.origin`.
  3. After `batch.editor.apply`, call `applySizingFields`, then `applyKitProps(batch, element.id, operation.props, index)` if `props` is defined.

## Patterns to imitate

- `apps/cli/src/edit/carry-members.ts`: the precedent for a small helper module called from `elements.ts`.
- `apps/cli/src/edit/operations/order.ts` for `where`/`expect` handling (later plans).

## Pitfalls

- Field order in `OPERATION_FIELDS` is shown in error messages ("Valid fields: ..."). Append new fields at the end of each list so existing snapshot tests stay stable. If a test snapshots the full list, update that test (sharedPaths) and record it.
- Do not change `placeRelative`, auto placement or `PLACE_GAP` behavior for operations without the new fields.
- Coordinate offsets apply only when a placement exists. Never offset `width`/`height`.
- Stubs must throw `OperationError` with the operation index, so the batch stays all-or-nothing.
- Keep imports acyclic: hook files import `Batch` as a type only (`import type`).

## Tests: new `apps/cli/src/edit/ipd-contracts.test.ts`

These assertions must stay true after the feature plans land:

- For each new field on `add` and `update`, and each new op (`layout`, `align`, `distribute`, `snap`): running the op does not produce an "unknown field" error, nor an "Unknown operation"-style error. Assert the message does not match `/unknown field|Unknown op/i`.
- `{"op":"add","type":"shape.geo","semantic":{"geo":"rect"},"props":{}}` -> an error whose message contains `props`.
- `{"op":"add","type":"shape.geo","visual":{"x":10,"y":20}}` -> the element is at 10,20, unchanged from before.
- `{"op":"update","id":...,"bogus":1}` -> still an "unknown field" error with a suggestion.

Existing suites must pass unchanged: `apps/cli/src/edit/*.test.ts`, `apps/cli/src/commands.test.ts`, `apps/cli/src/warnings.test.ts`.

## Verification (evidence in `final/`)

1. `bun test apps/cli/src/edit apps/cli/src/commands.test.ts apps/cli/src/warnings.test.ts apps/cli/src/ai-commands.test.ts` -> exit 0, 0 fail.
2. `bun run typecheck` -> no `error TS` line under `apps/cli/src/edit`.
3. `bunx biome check apps/cli/src/edit` -> exit 0.

## Done criteria

- Verification passes.
- `rg -n '"layout"|"align"|"distribute"|"snap"' apps/cli/src/edit/operation-fields.ts` -> at least 4 matches.
- All six hook files exist with exactly the exported names above: `rg -n '^export (function|interface)'` on each file.
- The progress log has hash records.

## Worker rules

- Record `git hash-object` of this plan first.
- Read each file fresh before editing it, with pre and post hashes. On drift, re-read, keep the other change and record it.
- Edit only writePaths.
- No state-changing git commands, no lockfile or formatting sweeps, no emojis.
- Evidence files must not match Bun test patterns.

# ipd-14-kit-core

- planId: ipd-14-kit-core
- planPath: impl-plans/active/ipd-14-kit-core.md
- progressPath: impl-plans/progress/ipd-14-kit-core.md
- dependsOn: ipd-04-cli-edit-contracts, ipd-05-core-catalogue, ipd-07-icon-core-cli, ipd-09-text-layer, ipd-11-frames, ipd-12-controls, ipd-13-prototype-core-cli (amendment round 8: runs after ipd-13 on a settled tree), ipd-19-desktop-presentation (amendment round 9: runs after ipd-19 on a settled tree)
- Design (binding): `design-docs/specs/design-iphone-app-design.md`, Decision 5 (5.1-5.4), and the components `ios:status-bar`, `ios:home-indicator`, `ios:nav-bar`, `ios:tab-bar`, `ios:top-tabs`, `ios:segmented` from 5.5.
- Evidence: `tmp/ipd-s772/ipd-14-kit-core/`.
<!-- ownership:start -->
- writePaths:
  - `packages/core/src/kits/ios/types.ts`
  - `packages/core/src/kits/ios/style.ts`
  - `packages/core/src/kits/ios/insert.ts`
  - `packages/core/src/kits/ios/props.ts`
  - `packages/core/src/kits/ios/bars.ts`
  - `packages/core/src/kits/ios/content.ts`
  - `packages/core/src/kits/ios/index.ts`
  - `packages/core/src/kits/ios/kit-core.test.ts`
  - `apps/cli/src/edit/kit-shapes.ts`
  - `apps/cli/src/shapes-command.ts`
  - `apps/cli/src/shapes-command.test.ts`
  - `apps/cli/src/kit-cli.test.ts`
  - `impl-plans/progress/ipd-14-kit-core.md`
  - `tmp/ipd-s772/ipd-14-kit-core`
- sharedPaths:
  - `packages/core/src/index.ts`
- sharedPathNotes:
  - path: `packages/core/src/index.ts`; intendedEdit: append export lines only; re-read immediately before writing; never reorder or remove lines; verify sibling plans' new lines survive after writing
- artifactRoots:
  - `tmp/ipd-s772/ipd-14-kit-core`
<!-- ownership:end -->

## Intent and context

The iOS kit is a set of component definitions (`frame` with `component: true` and the new `semantic.kit`), generated in code. They are inserted as instances through the existing component system (`packages/core/src/editor/components.ts:planComponentInstance`), with typed properties that write overrides onto the instance's bound children.

This plan builds:

- the mechanism (types, insertion, definitions page, properties, slots and `items`, CLI);
- the six bar and tab components.

`ipd-15` adds the other ten components into the stub file created here.

## Non-goals

- The ten content components (`ipd-15`).
- Desktop palette (`ipd-17`).
- Lint (`ipd-20`).
- No change to override inference or component refresh semantics.

## File-level changes

New `packages/core/src/kits/ios/types.ts`:

```
export type KitPropType = "text" | "icon" | "color" | "boolean" | "enum" | "integer"
export interface KitPropTarget { readonly key: string; readonly field: "text" | "label" | "icon" | "fill" | "stroke" | "color" | "hidden" | "value" | "checked" }
export interface KitProp { readonly name: string; readonly type: KitPropType; readonly default: string | number | boolean; readonly values?: readonly string[]; readonly targets: readonly KitPropTarget[] }
export interface KitComponent { readonly id: `ios:${string}`; readonly version: 1; readonly label: string; readonly width: number; readonly height: number; readonly fullWidth: boolean; readonly slots?: { readonly prefix: string; readonly count: number }; readonly props: readonly KitProp[]; build(editor: Editor, at: Vec): { readonly frame: Element; readonly children: readonly Element[] } }
```

`build` returns the definition frame and children, not yet applied:

- each child has `visual.componentKey`;
- `memberIds`, layout, `showTitle: false`, `component: true` and `kit: "<id>@1"` are set.

Field meaning for targets:

- `text` -> `semantic.text`;
- `label` -> `semantic.label`;
- `icon` -> `semantic.icon` on `ui.icon`, or `leadingIcon` on controls when the key names a control;
- `fill`/`stroke`/`color` -> style;
- `hidden` -> `visual.hidden`, where boolean `true` means shown, so the stored value is inverted;
- `value`/`checked` -> control semantic.

New `packages/core/src/kits/ios/style.ts`: exports the shared constants.

- HIG colors:
  - `IOS_LABEL "#000000"`;
  - `IOS_SECONDARY_LABEL "#3c3c4399"`, or `#3c3c43` with opacity 0.6. Validate which color syntax IR accepts; if 8-digit hex is rejected, use opacity;
  - `IOS_SEPARATOR` (`#3c3c43` at 0.29);
  - `IOS_TINT "#007aff"`;
  - `IOS_GROUPED_BG "#f2f2f7"`;
  - `IOS_BG "#ffffff"`.
- Type sizes: body 17, subhead 15, caption 12, tab label 10.
- A `textLayer(...)` helper building `text.note` children with `APP_FONT_STACK`, `textMeasure: "proportional"` and `textPadding: 0`.

New `packages/core/src/kits/ios/insert.ts`:

```
export function insertKitComponent(editor: Editor, kitId: string, options: { readonly page: PageId; readonly x?: number; readonly y?: number; readonly width?: number; readonly parentId?: ElementId; readonly props?: Readonly<Record<string, unknown>> }): ElementId
```

Steps:

1. Find a frame with `semantic.kit === "<id>@1"` and `component: true` in the whole document.
2. If missing:
   - find or create a page named `iOS kit` (kind `freeform`, mode `app`), appended last;
   - place the definition in a column at x = 0, y = the bottom of the existing definitions on that page + 40 (0 if none);
   - apply the frame and children in one `editor.apply`, imitating `packages/core/src/ui-blocks.ts:insertUiBlock`.
3. `planComponentInstance(editor, idSource, defId, {x, y})` on the target page, then apply.
4. If `fullWidth`, `parentId` is given and `width` is not: set the width to the parent width and x to the parent x. Children reflow by layout.
5. Attach to the parent with `planAttachToFrame` (from `ipd-11`).
6. `applyKitProps(editor, instanceId, props)`.

Unknown kit id -> throw `Error('unknown kit component "<id>"')`.

New `packages/core/src/kits/ios/props.ts`:

- `export function kitComponentOf(store: Store, instanceId: ElementId): KitComponent | undefined`, resolved through `instanceOf` -> definition `semantic.kit` -> registry.
- `export function applyKitProps(editor: Editor, instanceId: ElementId, props: Readonly<Record<string, unknown>> | undefined): void`
  - Validate each prop's type. An unknown prop name -> `Error('unknown property "<p>" for <id>; properties: a, b')`.
  - Resolve each target child by `componentKey` among the instance's members, recursively.
  - Write one batch of `updateSemantic`/`replaceVisual` commands in a single `editor.apply`.
- Slots sugar:
  - `props.items: [{label, icon?, badge?}]` (1 to `slots.count` entries) -> `<prefix><n>Label`, `<prefix><n>Icon`, `<prefix><n>Badge` and `count`.
  - `count` hides slot children with index > count through `visual.hidden`, and auto layout skips them.
  - `active` (0-based) sets the active slot's icon and label color to `activeColor` and the others to `inactiveColor`.
- `export function kitProps(kitId: string): readonly KitProp[]`

New `packages/core/src/kits/ios/bars.ts`: the six components.

| Component | Size | Contents |
| --- | --- | --- |
| `status-bar` | 390×47 | time text layer left ("9:41", 17 semibold) at x 33 baseline; right group with three generic glyphs drawn with icons `signal`, `wifi`, `battery-full`. Props `time`, `style` (dark/light -> colors). |
| `home-indicator` | 390×34 | a 134×5 pill, radius 2.5, centred, 8 from the bottom. Prop `style`. |
| `nav-bar` | 390×44 | horizontal layout. Back group (chevron-left icon + `backLabel` text, tint), centred title (17 semibold), trailing icon button 44×44. Props `title`, `back`, `backLabel`, `trailingIcon`, `large` (`large` adds a 34 bold title row; height 96). |
| `tab-bar` | 390×83 | top separator (390×0.5 rect); 5 slot items, each a vertical frame of icon (24) + label (10), `layoutGrow` 1, height 49; and a 34 bottom inset. Props `items`, `active`, `activeColor` (default tint), `inactiveColor` (`#999999`), and per-slot badge (`ui.control` badge on a small frame, or a kit badge built inline). |
| `top-tabs` | 390×44 | 5 slots with labels, and a 2-unit underline under the active slot (a rect child per slot, hidden unless active). Props `items`, `active`, `activeColor`. |
| `segmented` | 358×32 visual | a grouped background rounded 9, 5 slots, an active slot with a white rounded rect pill. Props `items`, `active`. The definition's outer frame is 358×44, with the 32-high control centred, so the touch target passes `app-touch-target` (44). |

Touch-target rule for every kit component smaller than 44 points in a touch dimension: the outer component frame is 44 high (or wide) and transparent, and the documented size is the visual part inside it. Record this in `style.ts` as `IOS_MIN_TOUCH = 44`. `ipd-15` applies the same rule.

New `packages/core/src/kits/ios/content.ts`: a stub, `export const IOS_CONTENT_COMPONENTS: readonly KitComponent[] = []`. `ipd-15` fills it.

New `packages/core/src/kits/ios/index.ts`:

- `export const IOS_KIT: readonly KitComponent[] = [...IOS_BAR_COMPONENTS, ...IOS_CONTENT_COMPONENTS]`
- `findKitComponent(id)`, `insertKitComponent`, `applyKitProps`, `kitProps`.

`apps/cli/src/edit/kit-shapes.ts` replaces the `ipd-04` stubs, keeping their signatures.

- `addKitShape` resolves:
  - the page;
  - the parent via `resolveParentPlacement` (`ipd-11`), with relative x/y;
  - `width` from `visual.width`;
  - `props`.

  It calls `insertKitComponent`, records the operation (`batch.record`) and applies sizing via `applySizingFields`.
- `applyKitProps` on a non-instance -> the existing error text. Otherwise it delegates to core. Core errors are mapped to `OperationError(index, message)`.
- `isKitShapeId` stays a prefix check; an unknown `ios:` id becomes an error inside `addKitShape`.

`apps/cli/src/shapes-command.ts`:

- The plain listing appends kit rows (`ios:<name>`, label, category "ios-kit", type `frame`) after the icon row.
- `shapes ios:<name>` prints the type, size and properties (`name type default [values]`), plus example `draw` and `add` operations.
- Update `apps/cli/src/shapes-command.test.ts` expectations.

`packages/core/src/index.ts` (sharedPaths, append-only): export `IOS_KIT`, `findKitComponent`, `insertKitComponent`, `applyKitProps`, `kitProps`, `kitComponentOf` and the types.

## Patterns to imitate

- `packages/core/src/ui-blocks.ts:insertUiBlock` for building component frames.
- `packages/core/src/editor/components.ts:planComponentInstance` for instances.
- `packages/core/src/component-overrides.ts` to confirm that props become overrides.

## Pitfalls

- A second insertion must reuse the definition. Never create a duplicate definition or a second `iOS kit` page.
- Definition creation must not change the current page. Restore `editor.setCurrentPage` if needed.
- Property writes go to instance children, never to the definition.
- Generic content only: placeholder titles like "Title", "Label 1" and so on.
- The status bar uses drawn icons, not Unicode glyphs.
- Sizes and positions are integers or .5 values.
- Every child that could be a hotspot (icon button, tab item) is at least 44×44 (the tab item is 78×49).

## Tests

New `packages/core/src/kits/ios/kit-core.test.ts`:

- Inserting `ios:nav-bar` twice -> one definition and two instances. The definition is on page `iOS kit` and has `kit: "ios:nav-bar@1"`.
- Props `{title: "Inbox", back: true, backLabel: "Back"}` -> the instance child texts change and the definition is unchanged. After component refresh, the overrides persist (use the existing refresh API).
- `ios:tab-bar` with `items` of 4 entries and `active: 1` -> slot 5 hidden. Item 2's icon `stroke` equals `activeColor`.
- `fullWidth` with a parent 402 wide -> instance width 402.
- An unknown prop -> an error listing the properties.
- An SVG export of each bar component contains icon markup and no placeholder.

New `apps/cli/src/kit-cli.test.ts`:

- `add` `{"shape":"ios:status-bar","parent":"@s"}` inside a `frame:iphone` -> at the frame top, width 390.
- `update` with `props` on an instance changes its title.
- `props` on a rect -> an error.
- `shapes ios:tab-bar` lists `items`, `active` and `activeColor`.
- `shapes` lists `ios:nav-bar`.

## Verification (evidence in `final/`)

1. `bun test packages/core/src/kits apps/cli/src/kit-cli.test.ts apps/cli/src/shapes-command.test.ts packages/core/src/components.test.ts packages/core/src/component-refresh.test.ts` -> exit 0, 0 fail.
2. `sh -c 'L=tmp/ipd-s772/ipd-14-kit-core/final/typecheck.log; mkdir -p tmp/ipd-s772/ipd-14-kit-core/final && bun run typecheck --pretty false > "$L" 2>&1 && exit 0; grep -q "error TS" "$L" || exit 2; ! grep -E "^(packages/core/src/kits/ios/types\.ts|packages/core/src/kits/ios/style\.ts|packages/core/src/kits/ios/insert\.ts|packages/core/src/kits/ios/props\.ts|packages/core/src/kits/ios/bars\.ts|packages/core/src/kits/ios/content\.ts|packages/core/src/kits/ios/index\.ts|packages/core/src/kits/ios/kit-core\.test\.ts|apps/cli/src/edit/kit-shapes\.ts|apps/cli/src/shapes-command\.ts|apps/cli/src/shapes-command\.test\.ts|apps/cli/src/kit-cli\.test\.ts)\([0-9]+,[0-9]+\): error TS" "$L"'` -> exit 0. Exit 0 also when the workspace typecheck fails only in files this plan does not own (record those as `owned_elsewhere`). Exit 1 prints the `error TS` lines in owned files: fix them. Exit 2 means tsc failed without diagnostics: a gate failure. The full log is the evidence.
3. `bunx biome check packages/core/src/kits/ios/types.ts packages/core/src/kits/ios/style.ts packages/core/src/kits/ios/insert.ts packages/core/src/kits/ios/props.ts packages/core/src/kits/ios/bars.ts packages/core/src/kits/ios/content.ts packages/core/src/kits/ios/index.ts packages/core/src/kits/ios/kit-core.test.ts apps/cli/src/edit/kit-shapes.ts apps/cli/src/shapes-command.ts apps/cli/src/shapes-command.test.ts apps/cli/src/kit-cli.test.ts` -> exit 0 (owned TS/TSX/CSS files only; every listed file must exist at completion).
4. Visual evidence:
   - With the CLI, insert each of the six components into a `frame:iphone`.
   - Export `final/kit-bars.png` at `--scale 2`, inspect alignment, icons and type against the generic iOS look, and record the notes.

## Done criteria

- Verification passes.
- `rg -n 'IOS_CONTENT_COMPONENTS' packages/core/src/kits/ios/content.ts` -> 1 match.

## Worker rules

- Record `git hash-object` of this plan first.
- Read each file fresh before editing it, with pre and post hashes. On drift, re-read, keep the other change and record it.
- `packages/core/src/index.ts` is shared: append export lines only.
- No state-changing git commands, no emojis, generic content only. Evidence files must not match Bun test patterns.
- Gate scope (S5-s786-R2): the typecheck and biome gates cover only this plan's owned files. `error TS` lines or biome diagnostics in files this plan does not own never block completion and are never fixed here: record each as an `owned_elsewhere` finding in the progress log (file path and the first error line, no fix) and finish. Errors in owned files always block. Do not wait for, or ask for, another amendment because a sibling's in-progress file fails the workspace typecheck.

## Amendment 2026-11-10 (operator round 8)

This plan now depends on `ipd-13-prototype-core-cli` and runs after it, because its workspace typecheck gate failed on ipd-13's in-progress prototype files in the shared tree. Keep the ipd-14 work already in the working tree and continue from it.

## Amendment 2026-11-10 (operator round 9)

This plan now runs after `ipd-19-desktop-presentation`: its workspace typecheck failed only on ipd-19's in-progress `PrototypePreview.tsx` in the shared tree. Keep the ipd-14 work already in the working tree and continue from it.

## Amendment 2026-11-10 (step5 s786 S5-s786-R2)

The manifest and Verification typecheck and biome gates are now scoped to this plan's owned files, with the expected result stated (typecheck: exit 0, or exit 0 when only non-owned files fail; exit 1 lists owned-file `error TS` lines; exit 2 is a tsc failure without diagnostics). The markdown and the manifest carry the identical command strings. Ownership, plan ID and dependsOn are unchanged. Errors in non-owned files are `owned_elsewhere` findings and never block (see Worker rules).

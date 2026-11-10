# ipd-17-desktop-palette

- planId: ipd-17-desktop-palette
- planPath: impl-plans/active/ipd-17-desktop-palette.md
- progressPath: impl-plans/progress/ipd-17-desktop-palette.md
- dependsOn: ipd-05-core-catalogue, ipd-10-icon-desktop, ipd-14-kit-core
- Design (binding): `design-docs/specs/design-iphone-app-design.md`, Decisions 1.1, 2.4, 5.2 and 6.5: the desktop palette entries.
- Evidence: `tmp/ipd-s772/ipd-17-desktop-palette/`.
<!-- ownership:start -->
- writePaths:
  - `packages/ui-solid/src/shape-palette.ts`
  - `packages/ui-solid/src/ShapePalette.tsx`
  - `packages/ui-solid/src/shape-search.ts`
  - `packages/ui-solid/src/palette-drag.ts`
  - `packages/ui-solid/src/app-palette.test.ts`
  - `impl-plans/progress/ipd-17-desktop-palette.md`
  - `tmp/ipd-s772/ipd-17-desktop-palette`
- sharedPaths:
  - `packages/ui-solid/src/index.ts`
- sharedPathNotes:
  - path: `packages/ui-solid/src/index.ts`; intendedEdit: append export lines only, and only if needed; re-read before writing; verify sibling lines survive
- artifactRoots:
  - `tmp/ipd-s772/ipd-17-desktop-palette`
<!-- ownership:end -->

## Intent and context

The acceptance criteria require that the text layer, icons, iOS kit and device presets are insertable from the desktop palette, not only the CLI. The palette is defined in:

- `packages/ui-solid/src/shape-palette.ts` (`UI_CONTROL_SHAPES`, `ARTBOARD_SHAPES`, `PRIMARY_TOOLS` per workspace, `shapePaletteGroups`);
- `ShapePalette.tsx`;
- `shape-search.ts`.

## Non-goals

- Do not edit `Toolbar.tsx`; `ipd-18` owns it.
- No inspector changes.
- No core changes.

## File-level changes

`packages/ui-solid/src/shape-palette.ts`:

- Add a "Text layer" item for `Tool.TextLayer` in the app and web workspaces' primary tools. Reuse the existing text icon in `PALETTE_ICONS`, or add a small inline-SVG icon in the same style.
- `ARTBOARD_SHAPES` gains the five iPhone presets (`ipd-05` Tool ids), labelled by size, after "iPhone".
- New group "iOS kit", shown in the app workspace only. Its items are generated from `IOS_KIT` (id, label), so `ipd-15` additions appear automatically.
- New "Icon" item that opens the picker. Represent it with a dedicated palette action kind; follow how existing non-tool actions are modelled, if any. Otherwise add an `action: "icon-picker"` field to `ShapePaletteItem`.

`packages/ui-solid/src/ShapePalette.tsx`:

- **Kit items.** A click inserts at the viewport centre: `insertKitComponent(editor, id, {page, x, y, parentId})`.
  - The parent is the frame under the viewport centre (`findInsertionParent`); when there is a parent, x/y come from its safe-area top-left.
  - The insert is one undo step.
  - Then select the new instance.
- **Icon item.** Opens `IconPicker` (`packages/ui-solid/src/IconPicker.tsx`) in a popover. Picking creates a `ui.icon` (24×24, stroke `#000000`) at the viewport centre, with the same parent rule, then selects it.

`packages/ui-solid/src/shape-search.ts`: include the presets, "Text layer", kit components (searchable by label and id) and "Icon".

`packages/ui-solid/src/palette-drag.ts`: if palette items support drag-to-place, kit and icon items support it with the same insertion functions at the drop point. If drag is tool-based only, skip this and record that.

## Patterns to imitate

- The existing `UI_CONTROL_SHAPES` group and how `ShapePalette.tsx` dispatches a tool click.
- `packages/core/src/ui-blocks.ts:insertUiBlock` callers in ui-solid, if any, for click-to-insert components.

## Pitfalls

- Kit insertion creates the `iOS kit` page on first use. The current page must stay the user's page.
- The palette must stay fast. Do not render kit previews; text items only.
- Keyboard and panel navigation tests (`panel-keyboard.test.ts`, `palette-drag.test.ts`) must stay green. Add new items without breaking roving focus.

## Tests: new `packages/ui-solid/src/app-palette.test.ts`

- The app workspace groups include "iOS kit", with 16 items once `ipd-15` lands (assert at least 6 here; `ipd-24` re-checks 16). They also include "Text layer" and the presets.
- Clicking `ios:nav-bar` with an iPhone frame at the viewport centre -> one instance inside the frame, and one undo reverts everything, including the definitions page.
- Picking `bell` in the icon picker -> a selected `ui.icon` with `icon: "bell"`.
- Searching "segmented" finds `ios:segmented`.

## Verification (evidence in `final/`)

1. `bun test packages/ui-solid/src/app-palette.test.ts packages/ui-solid/src/shape-search.test.ts packages/ui-solid/src/bpmn-palette.test.ts packages/ui-solid/src/breadboard-palette.test.ts packages/ui-solid/src/palette-drag.test.ts packages/ui-solid/src/panel-keyboard.test.ts packages/ui-solid/src/workspaces.test.ts` -> exit 0, 0 fail.
2. `bun run typecheck` -> no `error TS` line in the owned files.
3. `bunx biome check` on the owned files -> exit 0.

## Done criteria

Verification passes.

## Worker rules

- Record `git hash-object` of this plan first.
- Read each file fresh before editing it, with pre and post hashes. On drift, re-read, keep the other change and record it.
- `packages/ui-solid/src/index.ts` is shared: append export lines only, if needed.
- No state-changing git commands, no emojis. Evidence files must not match Bun test patterns.

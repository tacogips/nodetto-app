# stb-02-toolbar-icon

- planId: stb-02-toolbar-icon; wave 1; dependsOn: none
- Design: section 3.2 of `design-docs/specs/design-selection-toolbar-icons.md`.
- writePaths: `packages/ui-solid/src/ToolbarIcon.tsx` (new),
  `packages/ui-solid/src/ToolbarIcon.test.ts` (new),
  `impl-plans/progress/stb-02-toolbar-icon.md`, `tmp/stb-s857/stb-02-toolbar-icon`,
  `target`. artifactRoots: `target`.

## Intent and context

The selection toolbar becomes icon-only. This plan adds the single source
of icon names the toolbar may use, plus a small glyph component that
renders a vendored Lucide icon. The unit test fails if any name is missing
from the registry. stb-03 uses only `ToolbarIconKey`, so the test covers
every toolbar icon.

## Non-goals

- No button wrapper, title, aria or click logic (stb-03 owns that).
- No edits to `SelectionToolbar.tsx`, `IconPicker.tsx`, `index.ts` or core.
- No new icon dependency and no hand-written SVG paths.

## Contract (stb-03 depends on these exact names)

```ts
export const TOOLBAR_ICONS = { /* key: lucide name */ } as const;
export type ToolbarIconKey = keyof typeof TOOLBAR_ICONS;
export function ToolbarIcon(props: { readonly name: ToolbarIconKey }): JSX.Element;
```

The `TOOLBAR_ICONS` entries are exactly these 36 keys and values, the
design 3.2 table:
duplicate copy; delete trash-2; comment message-square-plus;
straightenConnector minus; colors palette; text type; arrange layers;
properties sliders-horizontal; bringToFront bring-to-front; sendToBack
send-to-back; frameSelection frame; group group; ungroup ungroup;
booleanUnion squares-unite; booleanSubtract squares-subtract;
booleanIntersect squares-intersect; booleanExclude squares-exclude;
flattenBoolean layers-2; alignLeft align-start-vertical; alignHCenter
align-center-vertical; alignRight align-end-vertical; alignTop
align-start-horizontal; alignVCenter align-center-horizontal; alignBottom
align-end-horizontal; fontSmaller a-arrow-down; fontLarger a-arrow-up;
bold bold; italic italic; underline underline; strikethrough
strikethrough; textAlignStart text-align-start; textAlignMiddle
text-align-center; textAlignEnd text-align-end; verticalTop
align-vertical-justify-start; verticalMiddle align-vertical-justify-center;
verticalBottom align-vertical-justify-end.

All 36 names were confirmed present in
`packages/core/src/icons/lucide-data.generated.ts` (Step 2 grep and the
Step 3 reviewer check).

## Rendering (imitate `packages/ui-solid/src/IconPicker.tsx:IconPicker`, the `<svg innerHTML=...>` block)

- Render `<svg aria-hidden="true" focusable="false" class="nodetto-toolbar-icon"
  width="16" height="16" viewBox="0 0 24 24">`. Its `innerHTML` is
  `renderIconMarkup(findIcon(TOOLBAR_ICONS[props.name]) ?? { path: "" },
  { x: 0, y: 0, width: 24, height: 24 }, { stroke: "currentColor",
  strokeWidth: 2, fill: "none", viewBox: 24 })`.
- Why: `renderIconMarkup` (`packages/core/src/icons/icon-markup.ts`) emits a
  `<g transform="translate(..) scale(box/viewBox)">` in the svg's user units.
  A 24 box with paint.viewBox 24 gives scale 1, and the svg viewBox
  `0 0 24 24` scales it to 16 px with the standard Lucide stroke. Do not mix
  a 16 box with a 24 viewBox.
- `currentColor` is required so the icon follows the button ink, the
  disabled ink and the dark theme.

## Pitfalls

- Keep `as const` so the key type is a literal union and values stay literal.
- `TOOLBAR_ICONS[props.name]` is a typed record lookup, which is safe under
  noUncheckedIndexedAccess. Do not widen it to `Record<string, string>`.
- The test is a `.ts` file that imports only `TOOLBAR_ICONS` (it does not
  render). This is the same pattern as `SelectionToolbar.test.ts`, which
  imports `placeAbove` from a `.tsx` module.
- No `any`, no emojis, no non-null assertions.

## Tests (`ToolbarIcon.test.ts`, `bun:test`)

- Every value of `TOOLBAR_ICONS` resolves with `findIcon` from
  `@nodetto/core`. The failure message names the missing icon.
- Exactly 36 keys, and the set of keys equals the list above. This guards
  against silent removals.
- The 36 values contain no duplicates (`new Set(values).size === 36`).

## Verification (each must exit 0; logs under tmp/stb-s857/stb-02-toolbar-icon/)

1. `bun test packages/ui-solid/src/ToolbarIcon.test.ts` shows all passing
   with 0 failures.
2. `bun run typecheck`. If it fails only in stb-01's files during the wave,
   record the diagnostic and re-run after stb-01 lands.
3. `bunx biome check --diagnostic-level=warn packages/ui-solid/src/ToolbarIcon.tsx packages/ui-solid/src/ToolbarIcon.test.ts`
4. `sh -c 'mkdir -p tmp/stb-s857/stb-02-toolbar-icon && bunx tsc --noEmit --pretty false -p tsconfig.json --noUncheckedIndexedAccess > tmp/stb-s857/stb-02-toolbar-icon/strict-index.log 2>&1; ! grep -E "^packages/ui-solid/src/ToolbarIcon(\.test)?\.tsx?\(" tmp/stb-s857/stb-02-toolbar-icon/strict-index.log'`

## Done criteria

- Both files exist with the exact contract.
- All four commands exit 0.
- The progress log `impl-plans/progress/stb-02-toolbar-icon.md` records the
  changes, commands, exit codes, log paths.

## Coordination

Same rules as stb-01: edit only your writePaths, record pre and post
`git hash-object` per edit, record drift instead of reverting, and make no
git state changes.

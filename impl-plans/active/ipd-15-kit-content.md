# ipd-15-kit-content

- planId: ipd-15-kit-content
- planPath: impl-plans/active/ipd-15-kit-content.md
- progressPath: impl-plans/progress/ipd-15-kit-content.md
- dependsOn: ipd-14-kit-core
- Design (binding): `design-docs/specs/design-iphone-app-design.md`, Decision 5.5. The remaining components are `ios:search-field`, `ios:list-row`, `ios:section-header`, `ios:chip`, `ios:fab`, `ios:icon-button`, `ios:text-field`, `ios:composer`, `ios:card`, `ios:badge`.
- Evidence: `tmp/ipd-s772/ipd-15-kit-content/`.
<!-- ownership:start -->
- writePaths:
  - `packages/core/src/kits/ios/content.ts`
  - `packages/core/src/kits/ios/kit-content.test.ts`
  - `impl-plans/progress/ipd-15-kit-content.md`
  - `tmp/ipd-s772/ipd-15-kit-content`
- sharedPaths:
  - none
- sharedPathNotes:
  - none
- artifactRoots:
  - `tmp/ipd-s772/ipd-15-kit-content`
<!-- ownership:end -->

## Intent and context

`ipd-14` built the kit mechanism, the six bar components, and a stub `IOS_CONTENT_COMPONENTS` array in `packages/core/src/kits/ios/content.ts`. This plan fills that array with the ten content components, using only:

- the `KitComponent` contract from `packages/core/src/kits/ios/types.ts`;
- the helpers in `style.ts`.

## Non-goals

- Do not change `types.ts`, `insert.ts`, `props.ts`, `bars.ts` or `index.ts`. If the contract is insufficient, record a finding for `ipd-14`'s owner instead of editing it.
- No palette and no lint.

## File-level changes

`packages/core/src/kits/ios/content.ts`: the ten `KitComponent` objects, in this order. Sizes are in points.

| Component | Size | Contents and properties |
| --- | --- | --- |
| `search-field` | 358×36 | Rounded 10 fill `#7676801f` (or opacity per the IR color rule); `search` icon 17 at x 8; placeholder text layer (17, secondary). Props `placeholder`, `value` (when non-empty, it shows the value in label color instead). |
| `list-row` | 390×44 | Horizontal layout, padding [0,16,0,16], gap 12, align center. Children: leading icon (24, tint), text column (title 17, subtitle 15 secondary, hidden by default; when visible, height 60), spacer (`layoutGrow` 1), value text (17 secondary, hidden by default), trailing accessory slot (`chevron-right` icon 17 secondary / a `ui.control` switch / nothing), and a bottom divider rect 0.5 high, inset left 56, `layoutPosition` absolute. Props `title`, `subtitle`, `leadingIcon`, `accessory` (chevron/value/switch/none), `value`, `divider` (boolean). |
| `section-header` | 390×38 | Text layer (13, secondary, uppercase content as authored) at x 16, bottom-aligned 6. Prop `title`. |
| `chip` | hug×32 | Horizontal layout, padding [0,12,0,12], gap 6, rounded 16, stroke `IOS_SEPARATOR` 1. Optional leading icon 16, label 15. Props `label`, `selected` (fill tint and white label when true), `leadingIcon`. |
| `fab` | 56×56 | Circle (rounded 28) in tint, with a shadow from the existing `effects` style; centred icon 24 white. Props `icon`, `color`. |
| `icon-button` | 44×44 | Transparent frame with a centred icon 24 in label color. Prop `icon`. |
| `text-field` | 358×44 | `ui.control` input, rounded 10, padding 12, placeholder. Props `placeholder`, `value`. |
| `composer` | 390×52 | Horizontal layout, padding [8,16,8,16], gap 8. Rounded 18 textarea-like input (`layoutGrow` 1, height 36) and a send icon button 36 (`arrow-up` in a tint circle). Props `placeholder`, `sendIcon`. |
| `card` | 358×hug | Vertical layout, padding 16, gap 6, rounded 12, fill white, stroke separator. Title (17 semibold) and body (15 secondary, wraps by auto-height). `strokeSides` left accent (`accentSide` left -> `strokeSides: {left: 4}`, `strokeAlign` inside, stroke = `accentColor`; none -> uniform separator stroke). Props `title`, `body`, `accentSide`, `accentColor`. |
| `badge` | hug×20 | Capsule (rounded 10, min width 20, padding [0,6,0,6]) in `#ff3b30`, white 13 bold count. Prop `count`. |

All text is generic placeholder text: "Title", "Subtitle", "Value", "Label", "Search", "Message".

## Pitfalls

- Use `planAttachToFrame` semantics only through `insert.ts`. Do not create definitions any other way.
- `hug` sizes: use frame layout `widthSizing: "hug"` so instances size to content.
- Every interactive component (row, chip, icon button, fab, search field, text field) has an outer frame at least `IOS_MIN_TOUCH` (44) in both touch dimensions, so `app-touch-target` (`ipd-20`) passes.
  - `chip` (32-high capsule) and `search-field` (36-high field) use a transparent 44-high outer frame, with the visual centred inside, as `ipd-14` does for `segmented`.
  - The documented sizes are the visual parts.
  - Record this in the progress log.
- Respect the IR color rule decided in `ipd-14` (`style.ts`). Reuse its constants.

## Tests: new `packages/core/src/kits/ios/kit-content.test.ts`

- Each of the ten components inserts into a `frame:iphone` and renders an SVG without the icon placeholder.
  - Its visual part has the documented default size within 0.5. Hug components are larger than 0.
  - Its outer frame is at least 44 in each touch dimension.
- `list-row` with `subtitle` set -> the subtitle is visible and the height is 60. `accessory: "switch"` -> a `ui.control` switch is visible and the chevron is hidden. `divider: false` -> the divider is hidden.
- `card` with `accentSide: "left"` -> the card style has `strokeSides.left` 4.
- `chip` `selected` -> the fill equals the tint.
- `IOS_KIT` has 16 entries with unique ids.

## Verification (evidence in `final/`)

1. `bun test packages/core/src/kits` -> exit 0, 0 fail.
2. `bun run typecheck` -> no `error TS` line in `packages/core/src/kits/ios/content.ts` or the test.
3. `bunx biome check packages/core/src/kits/ios/content.ts packages/core/src/kits/ios/kit-content.test.ts` -> exit 0.
4. Visual evidence:
   - With the CLI, insert all ten components into a `frame:iphone`, stacked with a `layout` operation.
   - Export `final/kit-content.png` at `--scale 2`, inspect it, and record the notes.

## Done criteria

- Verification passes.
- `rg -c 'id: "ios:' packages/core/src/kits/ios/content.ts` -> 10.

## Worker rules

- Record `git hash-object` of this plan first.
- Read each file fresh before editing it, with pre and post hashes. On drift, re-read, keep the other change and record it.
- No state-changing git commands, no emojis, generic content only. Evidence files must not match Bun test patterns.

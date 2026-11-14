# ipd-15-kit-content

- planId: ipd-15-kit-content
- planPath: impl-plans/active/ipd-15-kit-content.md
- progressPath: impl-plans/progress/ipd-15-kit-content.md
- dependsOn: none. `ipd-14-kit-core` is an accepted dependency (round 10); its kit mechanism is already in the tree.
- Design (binding): `design-docs/specs/design-iphone-app-design.md`, Decision 5.5. The remaining components are `ios:search-field`, `ios:list-row`, `ios:section-header`, `ios:chip`, `ios:fab`, `ios:icon-button`, `ios:text-field`, `ios:composer`, `ios:card`, `ios:badge`.
- Evidence: `tmp/ipd-s772/ipd-15-kit-content/`.
<!-- ownership:start -->
- writePaths:
  - `packages/core/src/kits/ios/content.ts`
  - `packages/core/src/kits/ios/kit-content.test.ts`
  - `impl-plans/progress/ipd-15-kit-content.md`
  - `tmp/ipd-s772/ipd-15-kit-content`
  - `packages/core/src/kits/ios/props.ts`
  - `packages/core/src/kits/ios/types.ts`
  - `packages/core/src/kits/ios/style.ts`
  - `packages/core/src/kits/ios/kit-core.test.ts`
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

- Do not change `insert.ts`, `bars.ts` or `index.ts`. Round 10: `types.ts`, `props.ts` and `style.ts` may change only for the additive property-effect contract in the round-10 amendment below; `kit-core.test.ts` may only gain new cases. If anything beyond that is needed, record a finding instead of editing.
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

1. `bun test packages/core/src/kits apps/cli/src/kit-cli.test.ts apps/cli/src/shapes-command.test.ts packages/core/src/components.test.ts packages/core/src/component-refresh.test.ts` -> exit 0, 0 fail. The non-owned files are regression guards for the round-10 contract change: they must pass unchanged.
2. `sh -c 'L=tmp/ipd-s772/ipd-15-kit-content/final/typecheck.log; mkdir -p tmp/ipd-s772/ipd-15-kit-content/final && bun run typecheck --pretty false > "$L" 2>&1 && exit 0; grep -q "error TS" "$L" || exit 2; ! grep -E "^(packages/core/src/kits/ios/content\.ts|packages/core/src/kits/ios/kit-content\.test\.ts|packages/core/src/kits/ios/props\.ts|packages/core/src/kits/ios/types\.ts|packages/core/src/kits/ios/style\.ts|packages/core/src/kits/ios/kit-core\.test\.ts)\([0-9]+,[0-9]+\): error TS" "$L"'` -> exit 0. Exit 0 also when the workspace typecheck fails only in files this plan does not own (record those as `owned_elsewhere`). Exit 1 prints the `error TS` lines in owned files: fix them. Exit 2 means tsc failed without diagnostics: a gate failure. The full log is the evidence.
3. `bunx biome check packages/core/src/kits/ios/content.ts packages/core/src/kits/ios/kit-content.test.ts packages/core/src/kits/ios/props.ts packages/core/src/kits/ios/types.ts packages/core/src/kits/ios/style.ts packages/core/src/kits/ios/kit-core.test.ts` -> exit 0 (owned TS/TSX/CSS files only; every listed file must exist at completion).
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
- Gate scope (S5-s786-R2): the typecheck and biome gates cover only this plan's owned files. `error TS` lines or biome diagnostics in files this plan does not own never block completion and are never fixed here: record each as an `owned_elsewhere` finding in the progress log (file path and the first error line, no fix) and finish. Errors in owned files always block. Do not wait for, or ask for, another amendment because a sibling's in-progress file fails the workspace typecheck.

## Amendment 2026-11-10 (step5 s786 S5-s786-R2)

The manifest and Verification typecheck and biome gates are now scoped to this plan's owned files, with the expected result stated (typecheck: exit 0, or exit 0 when only non-owned files fail; exit 1 lists owned-file `error TS` lines; exit 2 is a tsc failure without diagnostics). The markdown and the manifest carry the identical command strings. Ownership, plan ID and dependsOn are unchanged. Errors in non-owned files are `owned_elsewhere` findings and never block (see Worker rules).

## Amendment 2026-11-10 (operator round 10)

This plan owns `packages/core/src/kits/ios/props.ts`, `types.ts`, `style.ts` and `kit-core.test.ts`. Extend the kit property contract additively so a property can declare derived effects beyond raw field assignment: (a) conditional geometry (a list row grows to its subtitle height when `subtitle` is non-empty); (b) enum properties selecting one of a fixed set of child configurations (`accessory`: none, chevron, value, switch, checkmark); (c) value-to-style mappings (chip `selected` -> fill, stroke and text colors from kit tokens); (d) per-side stroke settings (card accent stroke on chosen sides, using the Decision 3 per-side borders). Keep every existing raw-assignment property, every existing `kit-core.test.ts` expectation and the existing inserted-instance output unchanged; add new test cases for each new effect kind. Keep the ipd-15 work already in the working tree and continue from it.

## Amendment 2026-11-10 (step4 s790, round-10 contract detail)

This section makes the operator round-10 amendment executable. Ownership is the ownership block above (plain path bullets only); the manifest entry carries the same paths and the same gate strings as Verification steps 1-3.

Contract extension (additive only, in `types.ts` and `props.ts`):

- Add one optional field to `KitProp`, for example `effects?: readonly KitPropEffect[]`. `KitPropEffect` is a discriminated union with exactly four kinds: `geometry` (target `key`, a condition on the property value such as non-empty or equals, and the width/height to set), `variant` (enum value -> which `componentKey` children are visible or hidden, for `accessory`: none, chevron, value, switch, checkmark), `style` (value -> `fill`/`stroke`/`color` taken from `style.ts` kit tokens) and `strokeSides` (value -> per-side stroke widths, `strokeAlign` and stroke color, using the Decision 3 per-side border fields already in the IR).
- `applyKitProps` keeps its exported signature and keeps the existing raw `targets` assignment first; it then applies the effects of the same property in declaration order, inside the same single command it already emits (one undo step per call).
- Properties without `effects` behave byte-for-byte as before. `kitProps`, `kitComponentOf`, `findKitComponent`, `insertKitComponent` and the CLI wrappers in `apps/cli/src/edit/kit-shapes.ts` and `apps/cli/src/edit/operations/elements.ts` keep working without edits; do not edit those CLI files or `insert.ts`.
- `style.ts` may gain token constants (for example a selected-chip fill and label color); do not rename or change existing constants.

Pitfalls:

- Do not encode the effects as ad hoc per-component code in `props.ts` keyed by kit id; content components declare them in `content.ts` data.
- A `geometry` effect resizes the target element only; it must not move siblings by hand. Let the existing frame auto layout reflow them.
- The native CLI uses the bundled TypeScript engine, so parity follows from the core change; do not touch `apps/cli/native`.

New tests (in `kit-core.test.ts`, added cases only; existing cases unchanged):

- A synthetic property with a `geometry` effect and a non-empty value -> target height changes; with an empty value -> the default height is restored.
- An enum property with a `variant` effect -> exactly the configured child is visible for each enum value.
- A boolean property with a `style` effect -> fill, stroke and text color equal the token values when true and the defaults when false.
- A `strokeSides` effect -> the style carries the configured per-side widths and stroke alignment.
- A property without `effects` -> the resulting store state equals the pre-round-10 result (existing assertions still pass).
- One `applyKitProps` call with effects -> one undo restores every changed field.

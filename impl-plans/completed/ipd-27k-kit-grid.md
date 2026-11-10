# ipd-27k-kit-grid (amendment rounds 20-21)

- planId: ipd-27k-kit-grid
- planPath: impl-plans/active/ipd-27k-kit-grid.md
- progressPath: impl-plans/progress/ipd-27k-kit-grid.md
- Status: Ready
- dependsOn: none among pending plans (accepted dependencies ipd-14-kit-core, ipd-15-kit-content, ipd-20-app-lint and ipd-26-example-sample)
- Design: `design-docs/specs/design-iphone-app-design.md`, Decision 5 (iOS kit) and Decision 9 (app-design lint)
- Evidence: `tmp/ipd-s772/ipd-27k-kit-grid/` (git-ignored)
<!-- ownership:start -->
- writePaths:
  - `packages/core/src/kits/ios/bars.ts`
  - `packages/core/src/kits/ios/content.ts`
  - `packages/core/src/kits/ios/style.ts`
  - `packages/core/src/kits/ios/insert.ts`
  - `packages/core/src/kits/ios/props.ts`
  - `packages/core/src/kits/ios/types.ts`
  - `packages/core/src/kits/ios/kit-core.test.ts`
  - `packages/core/src/kits/ios/kit-content.test.ts`
  - `impl-plans/progress/ipd-27k-kit-grid.md`
  - `tmp/ipd-s772/ipd-27k-kit-grid`
- sharedPaths:
  - none
- sharedPathNotes:
  - none
- artifactRoots:
  - `tmp/ipd-s772/ipd-27k-kit-grid`
<!-- ownership:end -->

`tmp/ipd-s772/ipd-27k-kit-grid` holds command logs only (git-ignored, no authored source). The progress log `impl-plans/progress/ipd-27k-kit-grid.md` stays a tracked source path.

## Operator amendment round 20 (binding; keep this section verbatim)

Finish the round-19 kit fix that ipd-27a started. The tab bar must distribute its item widths in whole points for any item count, so the widths sum to the bar width (for example 98, 97, 98, 97 for four items on 390). Every centered child (icon, label, badge) must have its position and size rounded to a whole point. The kit-core regression for 2 to 5 items, with and without a badge, already exists and currently fails on a child at x 85.5. Keep the centered floating action button shadow that already landed.

Non-goals: no lint rule changes; no changes to unrelated kit output; no reproduction work (`ipd-27a` onward).

Keep the work already in the working tree and continue from it.

## Intent and context

The iOS kit (Decision 5) builds a bottom tab bar from 5 hidden-or-visible slots (`item1`..`item5`, each with `Icon`, `Label`, `Badge`, `BadgeBackground` and `Indicator` children). The app lint (Decision 9) flags children that are off the whole-point grid (`app-off-grid`) and siblings whose left edges, right edges, horizontal centers or top edges differ by more than 0.01 and at most 2 points (`app-misaligned`, `packages/core/src/app-design-lint/rules.ts`, near lines 270-283). Inside a kit instance, `app-misaligned` is checked only for children whose geometry differs from the definition baseline (`geometryOverridden`, `packages/core/src/app-design-lint/scope.ts`, near line 68), and hidden children are not checked. The reproduction parts (`ipd-27a` onward) insert tab bars with 2 to 5 items, so every misaligned or half-point child makes a screen fail the lint gate.

Current state, measured by Step 4 (session 810): `bun test packages/core/src/kits/ios` -> 17 pass, 1 fail. The failing test is `tab bars distribute whole-point slots and lint cleanly with badges` in `packages/core/src/kits/ios/kit-content.test.ts`. Its whole-point assertions now pass. Its lint assertion fails with 3 `app-misaligned` findings on the first iteration (2 items, no badge, 390 bar): slot 1 `Indicator` and `Label` against slot 1 `Icon`, and slot 2 `Label` against slot 2 `Icon`.

Why whole-point rounding alone is not enough: the working-tree `applyKitProps` (`packages/core/src/kits/ios/props.ts`, count branch near lines 228-250) places the icon at the slot x plus the rounded half of (slot width minus icon width), and the badges at the slot x plus the rounded half slot width plus 8 (the rejected round-20 offsets), and it leaves `Label` and `Indicator` on their `stretch` constraint at the full slot width. For an odd slot width the icon center and the label center then differ by half a point. Example: 4 items on a 390 bar give slot 2 at x 98, width 97. Math.round puts the icon at x 135 (center 147), while the full-slot label centers at 146.5. The round-21 amendment fixes this with one center line: c = 98 + floor(97 / 2) = 146, icon x 134, label and indicator box x 98 width 96 (center 146), badge anchored at 146 + 8 = 154.

Step 4 simulation (read-only, through the public editor API, no source edits; logs `tmp/ipd-s772/plan-check/step4-s810/sim.log` and `sim-badge-y.log`, simulation file `tmp/ipd-s772/plan-check/step4-s810/sim.test.ts`). For bar widths 390 and 402 and 2 to 5 items with and without a badge on item 1:

- The center line for Icon, Label, Indicator, Badge and BadgeBackground, applied with all five ids in `keepMembers`, gives 0 findings for every case without a badge.
- With a badge, the badge children still get 2 `app-misaligned` findings. The badge top (bar y + 2) is 1 point from the icon top (bar y + 3) and 2 points from the indicator top (bar y + 0). Once the kit rewrites the badge x, the badge counts as overridden and is linted. Setting the Badge and BadgeBackground y to the kit icon top (slot y + 3) gives 0 findings in all 16 counted cases. This plan therefore also moves the badge top from bar y + 2 to slot y + 3. That is a tab-bar slot geometry change, needed by the round-21 zero-findings regression. It changes no lint rule.
- A default insertion with no `items` and no `count` into a 402-wide parent gives fractional slots (80.4). This is because `insert.ts` resizes the instance and the `scale` constraint divides 402 by 5. The result is 16 `app-off-grid` findings. Inserting the same bar with `count: 5` gives whole-point slots 80, 81, 80, 81, 80 and 0 findings once the center line is applied.

The derived constraint pipeline still matters. `applyKitProps` resizes each visible slot through `replaceVisual`, and `planDerivedCommands` (`packages/core/src/editor/transaction.ts`, near lines 95, 138 and 183) then runs `planFrameTranslations` and `planConstraints` (`packages/core/src/constraints.ts`, near lines 26-205). Any child written in the same batch is overwritten again by its derived constraint patch unless its id is in `ApplyOptions.keepMembers` (`packages/core/src/editor/types.ts`, near lines 30-39; `planConstraints` returns early for kept ids near `constraints.ts:80`). The working tree already collects `keepMembers` and passes it to the single final `editor.apply` (`props.ts`, near line 337).

## Non-goals

- Do not change any lint rule or file under `packages/core/src/app-design-lint`.
- Do not change kit output that is unrelated to tab-bar slot geometry and the floating action button shadow. No color, typography, height or default-prop changes. The `ios:top-tabs` and `ios:segmented` builds and their count path stay as they are.
- Do not edit `examples/design`, the CLI, the renderer or the native sidecar. The native engine bundles this TypeScript kit, so native parity follows from the bundle and is re-checked by `ipd-27a`.
- No reproduction work and no files under `tmp/ipd-s772/ipd-27-reproduction`.
- Do not loosen or delete the existing failing assertion to make it pass.
- Do not edit `packages/core/src/constraints.ts`, `packages/core/src/editor/*` or the `horizontalConstraint` table in `bars.ts` (near lines 131-145).

## Center-line contract (shared by props.ts and bars.ts)

For one visible tab-bar slot with whole-point `slotX`, `slotY` and `slotWidth`, all in the same absolute coordinates as the child visuals:

- `c = slotX + Math.floor(slotWidth / 2)`.
- Icon: `x = c - iconWidth / 2`. Kit icons are 24 wide, so this is an integer. Keep the icon width, y and height.
- Label: `labelWidth = slotWidth - (slotWidth % 2)` and `x = c - labelWidth / 2`. This always equals `slotX`. Keep the label y and height.
- Indicator: the same `x` and `width` as the Label. Keep the indicator y and height. This is required because a full-width indicator differs from the even label by 1 point at the right edge, which `app-misaligned` flags.
- Badge and BadgeBackground: `x = c + 8` and `y = slotY + 3` (the kit icon top). Keep width 20 and height 16. Both get the same values.

## File-level changes

- `packages/core/src/kits/ios/props.ts` (`applyKitProps`, the `count` branch, `kit.id === "ios:tab-bar"` only):
  - Replace the two Math.round offset formulas (the inner `offset` helper near lines 238-241) with the center-line contract above. For each visible slot (`i <= count`), compute `c` from the new slot geometry (`left + start`, `end - start`, and the slot's current y).
  - Extend the rewritten suffixes from `Icon`, `Badge`, `BadgeBackground` to `Icon`, `Label`, `Indicator`, `Badge`, `BadgeBackground`. Write each through `visuals.set(child.id, { ...(visuals.get(child.id) ?? child.visual), ...patch })`, and add every written child id to the existing `keepMembers` set.
  - Keep the single final `editor.apply(commands, keepMembers.size ? { keepMembers } : {})`. Do not add a second `apply`.
  - User-moved check, per child and before writing: compute the center-line box for the slot's current (pre-change) geometry, using `oldX`, `oldWidth` and the slot's current y. Compare it with the child's current visual: x for Icon; x and width for Label and Indicator; x and y for Badge and BadgeBackground. If any compared field differs by more than 1 point, the child is user-moved. Skip it, and do not add it to `keepMembers`. A difference of exactly 1 still counts as kit-placed. That lets documents written by the old Math.round formula, the old full-width label or the old badge top (bar y + 2) be corrected.
- `packages/core/src/kits/ios/bars.ts` (the `slots(kind)` builder, near lines 359-451, `kind === "tab"` only): apply the same center line to the default build. Icon x is `x + Math.floor(slotWidth / 2) - 12`. The tab Label and the tab Indicator get width `slotWidth - (slotWidth % 2)` at x `x`. Badge and BadgeBackground get x `x + Math.floor(slotWidth / 2) + 8` and y `at.y + 3`. Keep `top` and `segmented` output unchanged, and keep the `horizontalConstraint` table unchanged. At the 390 kit width the slots are 78 wide (even), so the only visible change in the default definition is the badge top (+2 to +3).
- `packages/core/src/kits/ios/insert.ts` (`insertKitComponent`): for `ios:tab-bar` only, when the instance width was changed (`width !== undefined`) and `options.props` has neither `items` nor `count`, call `applyKitProps` once with `{ ...options.props, count: n }`. `n` is the number of `itemN` slot frames in the new instance whose visual is not hidden (5 for a kit-built definition). This replaces the existing single `applyKitProps(editor, id, options.props)` call on that path, so insertion still makes exactly one `applyKitProps` call. Do not add new exported API.
- `packages/core/src/kits/ios/content.ts`, `style.ts`, `types.ts`: no change is expected. Touch them only if a shared private helper for the center line is needed. Do not export it from the package index.
- `packages/core/src/kits/ios/kit-core.test.ts`, `kit-content.test.ts`: keep the existing regression and add the cases below. Update existing assertions that encode the old Math.round offset. For example, the moved-icon check in `tab bar honors moved children and 402-point widths` must compute the kit offset from `c` (`c - slot.x - moved.width / 2`) instead of the rounded half-difference. Do not weaken them.
- `impl-plans/progress/ipd-27k-kit-grid.md`: progress log.

Patterns to imitate: the existing count branch in `packages/core/src/kits/ios/props.ts` (`visuals.set(slot.id, {...})`, `keepMembers.add(child.id)`), the tab builder in `packages/core/src/kits/ios/bars.ts`, `packages/core/src/keep-members.test.ts` (passing `{ keepMembers: new Set([...]) }` to `editor.apply`), the test helper `child(editor, id, key)` in `packages/core/src/kits/ios/kit-content.test.ts`, and the read-only simulation `tmp/ipd-s772/plan-check/step4-s810/sim-badge-y.test.ts`, which shows the expected geometry and lint result.

## Pitfalls

- Do not keep the round-20 rounded half-difference offsets (rounded half of slot width minus child width for the icon, rounded half slot width plus 8 for the badges) for tab-bar children. On odd slot widths it is off the center line by half a point after the label is made even, and it is exactly what fails today.
- Every child whose geometry is written must be in `keepMembers`. Any child left out is moved again by its derived constraint patch (center children by `delta/2`, stretch children by the slot margins), which undoes the write. Rewriting the Label without adding it to `keepMembers` changes nothing.
- Writing only the Label but not the Indicator leaves a 1-point right-edge difference between them, which `app-misaligned` flags. Rewrite both to the same box.
- Leaving the badge top at bar y + 2 still gives 2 `app-misaligned` findings per visible badge after its x is rewritten. Move it to slot y + 3 in both `props.ts` and `bars.ts`.
- Do not round the center and the width separately, and do not change icon or badge widths. Compute `c` once per slot and derive every child from it.
- Do not get the result by editing `packages/core/src/constraints.ts`, `packages/core/src/editor/*`, the `bars.ts` constraint table or the lint. Those are out of scope, and constraint-table changes would alter resize behavior for every kit user.
- Children must be written through `visuals` (`{ ...(visuals.get(id) ?? child.visual), ...patch }`). That keeps a previous write in the same call (for example `hidden` from the badge branch), and one undo restores everything (see the test `declarative property effects compose in one undo and restore defaults`). Do not call `editor.apply` a second time inside `applyKitProps`.
- Hidden slots (`i > count`) keep their previous geometry. Change only visible slots, and do not add hidden-slot children to `keepMembers`. A hidden badge inside a visible slot is still rewritten, so it is already placed when it is shown.
- User-moved children: use the 1-point tolerance against the center-line box for the slot's current geometry, as described above. Do not use `componentOverrides` from the definition to decide this: after any count change the kit itself writes child geometry, so every slot child differs from the 5-slot definition. Keep the test `kit reuses a definition, applies props to instances and preserves overrides on refresh` passing.
- The insertion path with `items` reaches the same count branch through `insert.ts`. The default insertion into a non-390 parent does not, which is why `insert.ts` must pass `count` on a width change. Do not hard-code 390 or 402 anywhere.
- `bars.ts` is shared by `tab`, `top` and `segmented`. Guard every change with `kind === "tab"`.

## Invariants

- For any count 1..5 and bar width W, the visible slot widths are integers that sum to W.
- For every visible tab-bar slot that is not user-moved, `icon.x + icon.width / 2 === c`, `label.x + label.width / 2 === c`, the indicator box equals the label box, `badge.x === badgeBackground.x === c + 8`, and `badge.y === badgeBackground.y === slot.y + 3`. Every value is an integer.
- The floating action button keeps the centered (non-offset) shadow already in the working tree.
- Every existing kit test keeps passing, except assertions that encode the old Math.round offset, which are updated to the center line.
- `applyKitProps` still issues exactly one `editor.apply` per call, so one undo reverts a property change and its derived commands. `insertKitComponent` still calls `applyKitProps` exactly once.
- `packages/core/src/constraints.ts`, `packages/core/src/editor/*`, `packages/core/src/app-design-lint/*`, `examples/design` and the `bars.ts` constraint table are unchanged.

## Test cases

Compute expected values from the slot visual and `c`, never from hard-coded constants (except where stated).

- Tab bar on a 390-wide parent and on a 402-wide parent, with 2, 3, 4 and 5 items, with and without a badge on item 1 -> slot widths sum to the bar width, every child field is an integer, and `lintAppDesignPage` returns 0 findings. This extends the existing test `tab bars distribute whole-point slots and lint cleanly with badges` with the 402 width. It must now pass.
- Odd-width center equality: 4 items on a 390-wide parent, with a badge on item 2. Slot 2 is x 98, width 97, so c = 146. Expected: `item2Icon.x + item2Icon.width / 2 === 146`, `item2Label.x === 98` with width 96 (center 146), `item2Indicator` has the same x and width as the label, and `item2Badge.x === item2BadgeBackground.x === 154` with `y === slot.y + 3`. Assert the literal 146 and 154 here, and also assert that they equal the c-based formula.
- 402-bar default insert: insert `ios:tab-bar` with no props into a 402-wide parent -> slot widths 80, 81, 80, 81, 80 (sum 402), all integers, every visible slot satisfies the center-line invariant, and 0 lint findings.
- `count` changed from 5 to 3 and back to 5 on an inserted tab bar -> every visible child satisfies the center-line invariant, and one undo restores the previous geometry.
- Insert 4 items on a 390-wide parent with a badge on item 2, then `applyKitProps(editor, id, { count: 3 })`. Slot 2 becomes x 130, width 130, an odd width delta of 33. Expected: icon, label, indicator and badge follow the center line for the new slot (c = 195), every value is an integer, and the icon x is not the constraint-only value (old x plus dx plus 33/2, which ends in .5). Then one `editor.undo()` restores the exact previous icon, label, indicator, badge and slot geometry.
- User-moved icon: shift `item1Icon` x by 10 points with `editor.apply` before changing `count` -> after the change, the icon is not snapped back. Its offset from the slot differs from the c-based offset by more than 1, and its constraint still moves it. The other visible children satisfy the center-line invariant.
- Legacy geometry correction: a tab bar whose slot 2 icon sits at the old Math.round position (1 point right of the center line) and whose label is full slot width -> after `applyKitProps(editor, id, { count })`, both are on the center line (tolerance of exactly 1 is kit-placed).
- Default floating action button -> its shadow has offset 0 (centered) and 0 lint findings (keep or add).

## Steps

1. Record `git hash-object` of this plan and the sha256 of the 8 kit files into the progress log before the first edit, and write the out-of-scope snapshot `scope.before.sha` described in Done criteria. Re-read each file immediately before editing it, and compare it with the recorded hash. If a file changed since your last read, re-read it and merge; never overwrite another writer's change.
2. Run `bun test packages/core/src/kits/ios` and log the failing assertion (expected: 17 pass, 1 fail, 3 `app-misaligned`).
3. Apply the center-line contract in `props.ts` (all five tab-slot children in `keepMembers`, one `apply`), in the `bars.ts` tab build, and the `count` pass-through in `insert.ts`. Update the old-formula assertions and add the tests above.
4. Run the verification commands below, keeping complete logs under `tmp/ipd-s772/ipd-27k-kit-grid/`.

## Verification (evidence in `tmp/ipd-s772/ipd-27k-kit-grid/`)

1. `bun test packages/core/src/kits apps/cli/src/kit-cli.test.ts apps/cli/src/shapes-command.test.ts packages/core/src/app-design-lint apps/cli/src/iphone-kit-example.test.ts` -> exit 0, 0 fail. The committed example test must pass unchanged. If it fails, record a finding for `ipd-26-example-sample` and do not edit `examples/design`.
2. `sh -c 'L=tmp/ipd-s772/ipd-27k-kit-grid/typecheck.log; mkdir -p tmp/ipd-s772/ipd-27k-kit-grid && bun run typecheck --pretty false > "$L" 2>&1 && exit 0; grep -q "error TS" "$L" || exit 2; ! grep -E "^packages/core/src/kits/ios/[^(]*\([0-9]+,[0-9]+\): error TS" "$L"'` -> exit 0. Exit 0 is also accepted when tsc fails only in files this plan does not own; record those as `owned_elsewhere`. Exit 1 lists errors in owned kit files, which you must fix. Exit 2 means tsc failed without diagnostics, which is a gate failure.
3. `bunx biome check packages/core/src/kits/ios/bars.ts packages/core/src/kits/ios/content.ts packages/core/src/kits/ios/style.ts packages/core/src/kits/ios/insert.ts packages/core/src/kits/ios/props.ts packages/core/src/kits/ios/types.ts packages/core/src/kits/ios/kit-core.test.ts packages/core/src/kits/ios/kit-content.test.ts` -> exit 0.

## Done criteria

- Verification 1-3 exit 0; the test log shows 0 fail and includes `tab bars distribute whole-point slots and lint cleanly with badges` as pass.
- Out-of-scope files are unchanged by this plan: `find packages/core/src/app-design-lint examples/design packages/core/src/constraints.ts packages/core/src/editor -type f -exec shasum -a 256 {} + | sort` is written to `tmp/ipd-s772/ipd-27k-kit-grid/scope.before.sha` in step 1 and to `scope.after.sha` at the end, and `cmp` of the two files exits 0.
- `grep -c 'keepMembers' packages/core/src/kits/ios/props.ts` -> at least 1, and `grep -n 'Math.floor' packages/core/src/kits/ios/props.ts packages/core/src/kits/ios/bars.ts` -> at least 1 match in each file.
- `grep -nE 'Math[.]round[(][(]?slotWidth' packages/core/src/kits/ios/props.ts packages/core/src/kits/ios/bars.ts` -> no match (exit 1). The slot distribution `Math.round(((n - 1) * width) / 5)` and the count-branch `start`/`end` rounding stay.
- The progress log records the before/after hashes, every command with exit code and log path, the pass/fail counts, and any finding for another plan.

## Worker rules

- Edit only writePaths. A problem elsewhere is a finding naming its owning plan, not a blocker.
- No state-changing git commands. No emojis. Run commands in the foreground with complete logs.

## Amendment 2026-11-10 (operator round 21, binding; keep this section verbatim)

Shared center line (operator round 21, binding for ipd-27k): within each tab-bar slot, the icon, the label box and the badge anchor share one whole-point center line. Compute the slot's integer center c = slot.x + floor(slot.width / 2) (relative to the bar), place the icon at c - icon.width/2 (icon widths are even), and give the label box an even width (slot.width, minus 1 when slot.width is odd) with x = c - labelWidth/2, so the icon and label centers coincide exactly and every value is a whole point. Rewriting label and indicator geometry for this purpose is authorized even though their integer assertions pass. Lint rules stay unchanged; the zero-findings regression for 2 to 5 items with and without a badge (and the 402-point bar) must pass.

Keep the work already in the working tree and continue from it.

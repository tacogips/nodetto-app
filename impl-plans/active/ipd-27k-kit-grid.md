# ipd-27k-kit-grid (amendment round 20)

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

The iOS kit (Decision 5) builds a bottom tab bar from 5 hidden-or-visible slots (`item1`..`item5`, each with `Icon`, `Label`, `Badge`, `BadgeBackground` and `Indicator` children). The app lint (Decision 9, `app-off-grid`) flags any child whose position or size is not on the whole-point grid. The reproduction parts (`ipd-27a` onward) insert tab bars with 2 to 5 items, so a half-point child makes every screen fail the lint gate.

Current state, measured by Step 4 (session 808): `bun test packages/core/src/kits/ios` -> 15 pass, 1 fail. The failing test is `tab bars distribute whole-point slots and lint cleanly with badges` in `packages/core/src/kits/ios/kit-content.test.ts`, which reports `Expected: 86, Received: 85.5` on a slot child. The slot widths are already whole points (`packages/core/src/kits/ios/props.ts`, the `count` branch rounds `start`/`end` with `Math.round(((i - 1) * width) / count)`). The half point comes from the editor's derived constraint pipeline, not from missing child writes:

- `packages/core/src/kits/ios/bars.ts` (tab-bar `build`, the `horizontalConstraint` table near line 133) gives `itemNIcon`, `itemNBadge` and `itemNBadgeBackground` the constraint `center`, `itemNLabel` and `itemNIndicator` the constraint `stretch`, and the slot frame `itemN` the constraint `scale`.
- `applyKitProps` in `props.ts` resizes each visible slot through `replaceVisual` (count branch, near lines 228-234) and then calls `editor.apply(commands)` without `ApplyOptions` (near line 315).
- `planDerivedCommands` in `packages/core/src/editor/transaction.ts` (near lines 138 and 183) then runs `planFrameTranslations` and `planConstraints` (`packages/core/src/constraints.ts`, near lines 26-205). A `center` child keeps its offset from the parent center, so it moves by `dx + delta/2` where `delta` is the change in slot width. For count 2 on 390, slot 2 goes from x 78 width 78 to x 195 width 195, and the icon goes to 85.5 in the slot (27 + 117/2). An odd width delta always gives a half point.
- `stretch` children keep their left and right margins, so they stay whole points whenever the slot x and width are whole points. Only the `center` children (Icon, Badge, BadgeBackground) produce half points.
- Writing a child `x` in the same batch is not enough by itself, because the derived constraint patch is computed from the old child box and overwrites it. `ApplyOptions.keepMembers` (`packages/core/src/editor/types.ts`, near lines 30-39) is the existing way to skip it: `planConstraints` returns early for kept ids (`constraints.ts`, near line 80), and `planFrameTranslations` skips them through `held` (`transaction.ts`, near line 95). See `packages/core/src/keep-members.test.ts` for how it is used.

## Non-goals

- Do not change any lint rule or file under `packages/core/src/app-design-lint`.
- Do not change kit output that is unrelated to tab-bar slot geometry and the floating action button shadow (no color, typography, height or default-prop changes).
- Do not edit `examples/design`, the CLI, the renderer or the native sidecar. The native engine bundles this TypeScript kit, so native parity follows from the bundle and is re-checked by `ipd-27a`.
- No reproduction work and no files under `tmp/ipd-s772/ipd-27-reproduction`.
- Do not loosen or delete the existing failing assertion to make it pass.

## File-level changes

- `packages/core/src/kits/ios/props.ts` (`applyKitProps`):
  - In the tab-slot `count` branch (the loop that sets `x`/`width` per visible slot), for each visible slot also write the absolute whole-point `x` of its `center`-constrained children into `visuals` in the same batch: `itemNIcon` gets `slotX + Math.round((slotWidth - iconWidth) / 2)`, and `itemNBadge` and `itemNBadgeBackground` get `slotX + Math.round(slotWidth / 2) + 8`, the same formula as `bars.ts`. Keep each child's width, y and height.
  - `itemNLabel` and `itemNIndicator` stay under their `stretch` constraint, which keeps them whole points. Do not rewrite them and do not add them to `keepMembers`. The test asserts they are integers. If that assertion fails, rewrite them the same way and add them to `keepMembers`, and record that in the progress log.
  - Collect the ids of exactly the children written in that loop in a `Set<ElementId>`. Pass it as `keepMembers` to the one final `editor.apply` at the end of `applyKitProps`: `editor.apply(commands, keepMembers.size ? { keepMembers } : {})`. Keep a single `apply` call, so that one undo restores everything.
- `packages/core/src/kits/ios/bars.ts`: the tab-bar builder already rounds with `Math.round(((n - 1) * width) / 5)` and `x + Math.round((slotWidth - 24) / 2)`, and places badges at `x + Math.round(slotWidth / 2) + 8`. Insertion with `props.items` reaches the same `count` branch in `applyKitProps` through `insert.ts`, so no `bars.ts` change is expected. Change `bars.ts` only if the default 5-slot build itself gives a fractional child for a non-390 width, and never change its constraint table.
- `packages/core/src/kits/ios/insert.ts`, `content.ts`, `style.ts`, `types.ts`: touch only if the rounding fix needs a shared helper or the insertion path (`props.items` length) bypasses the `count` branch. Do not add new exported API.
- `packages/core/src/kits/ios/kit-core.test.ts`, `kit-content.test.ts`: keep the existing regression and add the cases below.
- `impl-plans/progress/ipd-27k-kit-grid.md`: progress log.

Patterns to imitate: `packages/core/src/kits/ios/props.ts` (count branch, `visuals.set(slot.id, {...})`), `packages/core/src/kits/ios/bars.ts` (tab-bar builder rounding), `packages/core/src/keep-members.test.ts` (passing `{ keepMembers: new Set([...]) }` to `editor.apply`), and the test helper `child(editor, id, key)` in `packages/core/src/kits/ios/kit-content.test.ts`.

## Pitfalls

- Rounding the child center and the child width separately can make the child extend 1 point past the slot. Round the offset, keep the child width fixed (icons are 24 wide), and clamp to the slot.
- Writing the child `x` without `keepMembers` changes nothing. The derived `planConstraints` patch runs after the batch and moves the child again by `delta/2`, so the test keeps failing. Any child whose geometry you write must be in `keepMembers`, and any child left out of `keepMembers` is still moved by its constraint.
- Do not get the rounding by editing `packages/core/src/constraints.ts`, `packages/core/src/editor/*`, the `bars.ts` constraint table or the lint. Those are out of scope, and constraint-table changes would alter resize behavior for every kit user.
- The `count` branch writes a copy of the slot visual. Children must be written the same way through `visuals` (`{ ...(visuals.get(id) ?? child.visual), x }`), so that a previous write in the same call (for example `hidden` from the badge branch) is kept and one undo restores everything (see the test `declarative property effects compose in one undo and restore defaults`). Do not call `editor.apply` a second time.
- Hidden slots (`i > count`) must keep their previous geometry. Change only visible slots, and do not add hidden-slot children to `keepMembers`.
- User-moved children. A centered child counts as user-moved when its current offset from its slot's current x differs by more than 1 point from the kit offset for the slot's current width (the same formulas as above). Such a child is neither rewritten nor added to `keepMembers`, so its constraint moves it exactly as it does today. The 1-point tolerance lets documents that already hold a half-point child (for example 85.5) be corrected. Do not use `componentOverrides` from the definition to decide this: after any count change the kit itself writes child geometry, so every slot child differs from the 5-slot definition. Keep the test `kit reuses a definition, applies props to instances and preserves overrides on refresh` passing.
- The insertion path (`insert.ts` -> `applyKitProps` with `items`) uses the same `count` branch, so a separate insertion fix is not needed.
- Badge and badge background must move together. Compute them from the same rounded slot center.
- Bar widths other than 390 (for example 402) must also give whole points. Do not hard-code 390.

## Invariants

- For any count 1..5 and bar width W, the visible slot widths are integers that sum to W.
- Every visible slot child has integer `x`, `y`, `width` and `height`.
- The floating action button keeps the centered (non-offset) shadow already in the working tree.
- Every existing kit test keeps passing.
- `applyKitProps` still issues exactly one `editor.apply` per call, so one undo reverts a property change and its derived commands. `packages/core/src/constraints.ts`, `packages/core/src/editor/*` and the `bars.ts` constraint table are unchanged.

## Test cases

- Tab bar on a 390-wide parent with 2, 3, 4 and 5 items, without a badge -> slot widths sum to 390, every child field is an integer, `lintAppDesignPage` returns 0 findings (existing test, must now pass).
- Same with a badge on item 1 -> same result, and the badge and badge background are integer and inside slot 1.
- Tab bar with 4 items on a 402-wide parent -> slot widths sum to 402 and every child is an integer.
- `count` property changed from 5 to 3 and back to 5 on an inserted tab bar -> every visible child is an integer and centered within 1 point of the slot center; one undo restores the previous geometry.
- Tab bar inserted with 4 items on a 390-wide parent (slot 2 at x 98, width 97), with a badge on item 2, then `applyKitProps(editor, id, { count: 3 })` (slot 2 becomes x 130, width 130, an odd width delta of 33). Expected: `item2Icon.x === slot.x + Math.round((slot.width - icon.width) / 2)` and `item2Badge.x === item2BadgeBackground.x === slot.x + Math.round(slot.width / 2) + 8`, all integers and not equal to the constraint-only value (the previous x plus dx plus 33/2, which ends in .5). Then one `editor.undo()` gives back the exact previous icon, badge and slot geometry. Compute expected values from the slot visual, not from hard-coded constants.
- A user-moved icon (shift `item1Icon` x by 10 points with `editor.apply` before changing `count`) -> after `count` changes, the icon is not snapped back to the kit offset (its constraint still moves it), and the other visible children are whole points.
- Default floating action button -> its shadow has offset 0 (centered) and 0 lint findings (keep or add).

## Steps

1. Record `git hash-object` of this plan and the sha256 of the 8 kit files into the progress log before the first edit, and write the out-of-scope snapshot `scope.before.sha` described in Done criteria. Re-read each file immediately before editing it, and compare it with the recorded hash. If a file changed since your last read, re-read it and merge; never overwrite another writer's change.
2. Run `bun test packages/core/src/kits/ios` and log the failing assertion.
3. Fix the rounding in `props.ts`: write the whole-point `center` children and pass their ids as `keepMembers` to the single final `editor.apply`. Change `bars.ts` only if the default build needs it. Add the tests above.
4. Run the verification commands below, keeping complete logs under `tmp/ipd-s772/ipd-27k-kit-grid/`.

## Verification (evidence in `tmp/ipd-s772/ipd-27k-kit-grid/`)

1. `bun test packages/core/src/kits apps/cli/src/kit-cli.test.ts apps/cli/src/shapes-command.test.ts packages/core/src/app-design-lint apps/cli/src/iphone-kit-example.test.ts` -> exit 0, 0 fail. The committed example test must pass unchanged. If it fails, record a finding for `ipd-26-example-sample` and do not edit `examples/design`.
2. `sh -c 'L=tmp/ipd-s772/ipd-27k-kit-grid/typecheck.log; mkdir -p tmp/ipd-s772/ipd-27k-kit-grid && bun run typecheck --pretty false > "$L" 2>&1 && exit 0; grep -q "error TS" "$L" || exit 2; ! grep -E "^packages/core/src/kits/ios/[^(]*\([0-9]+,[0-9]+\): error TS" "$L"'` -> exit 0. Exit 0 is also accepted when tsc fails only in files this plan does not own; record those as `owned_elsewhere`. Exit 1 lists errors in owned kit files, which you must fix. Exit 2 means tsc failed without diagnostics, which is a gate failure.
3. `bunx biome check packages/core/src/kits/ios/bars.ts packages/core/src/kits/ios/content.ts packages/core/src/kits/ios/style.ts packages/core/src/kits/ios/insert.ts packages/core/src/kits/ios/props.ts packages/core/src/kits/ios/types.ts packages/core/src/kits/ios/kit-core.test.ts packages/core/src/kits/ios/kit-content.test.ts` -> exit 0.

## Done criteria

- Verification 1-3 exit 0; the test log shows 0 fail and includes `tab bars distribute whole-point slots and lint cleanly with badges` as pass.
- Out-of-scope files are unchanged by this plan: `find packages/core/src/app-design-lint examples/design packages/core/src/constraints.ts packages/core/src/editor -type f -exec shasum -a 256 {} + | sort` is written to `tmp/ipd-s772/ipd-27k-kit-grid/scope.before.sha` in step 1 and to `scope.after.sha` at the end, and `cmp` of the two files exits 0.
- `grep -c 'keepMembers' packages/core/src/kits/ios/props.ts` -> at least 1.
- The progress log records the before/after hashes, every command with exit code and log path, the pass/fail counts, and any finding for another plan.

## Worker rules

- Edit only writePaths. A problem elsewhere is a finding naming its owning plan, not a blocker.
- No state-changing git commands. No emojis. Run commands in the foreground with complete logs.

# ipd-20-app-lint

- planId: ipd-20-app-lint
- planPath: impl-plans/active/ipd-20-app-lint.md
- progressPath: impl-plans/progress/ipd-20-app-lint.md
- dependsOn: ipd-07-icon-core-cli and ipd-16-frames-export-compare (`commands.ts` ownership order), ipd-09-text-layer, ipd-12-controls, ipd-13-prototype-core-cli, ipd-14-kit-core, ipd-15-kit-content
- Design (binding): `design-docs/specs/design-iphone-app-design.md`, Decision 9 (9.1 including the instance-content table and context/deduplication rules, 9.2 rules). The desktop panel (9.3) is `ipd-22`.
- Evidence: `tmp/ipd-s772/ipd-20-app-lint/`.
<!-- ownership:start -->
- writePaths:
  - `packages/core/src/app-design-lint`
  - `apps/cli/src/commands.ts`
  - `apps/cli/src/lint-diagram.ts`
  - `apps/cli/src/app-lint-cli.test.ts`
  - `impl-plans/progress/ipd-20-app-lint.md`
  - `tmp/ipd-s772/ipd-20-app-lint`
- sharedPaths:
  - `packages/core/src/index.ts`
- sharedPathNotes:
  - path: `packages/core/src/index.ts`; intendedEdit: append export lines only; re-read immediately before writing; never reorder or remove lines; verify sibling plans' new lines survive after writing
- artifactRoots:
  - `tmp/ipd-s772/ipd-20-app-lint`
<!-- ownership:end -->

## Intent and context

Item (9) asks for an app-design lint that reports:

- off-frame elements;
- text overflow and truncation;
- overlapping controls;
- items off the grid;
- near-miss misalignment;
- touch targets under 44 points.

It runs from `nodetto-cli lint`, alongside the existing rules. The output format is described below.

Design review DR-02 made instance content in scope per rule: overrides live on the copied children, so their current values are the rendered values.

## Non-goals

- No desktop panel (`ipd-22`).
- No auto-fix.
- No severity configuration.
- No change to existing lint rules or their output on non-app pages.

## File-level changes

New `packages/core/src/app-design-lint/scope.ts`:

- `export function isAppLintPage(store: Store, page: Page): boolean`
  - True when `page.mode` is `app` or `web`.
  - Also true when any frame on the page has `platform` in `ios|android|web`, or a `screenKind`.
- `export interface LintNode { readonly element: Element; readonly box: Box; readonly screenId?: ElementId; readonly parentId?: ElementId; readonly instanceId?: ElementId; readonly inInstance: boolean; readonly geometryOverridden: boolean }`
- `export function collectLintNodes(store, page, context): readonly LintNode[]`
  - Visits each element once.
  - Excludes component definitions (`component: true` frames) and their descendants.
  - Excludes hidden elements, and elements under hidden ancestors.
  - Computes, for each node:
    - the screen: the nearest top-level ancestor frame with `platform` or `screenKind`;
    - the parent frame (`frameParents`);
    - the nearest instance ancestor (frame with `instanceOf`);
    - `geometryOverridden`, from the existing override inference in `packages/core/src/component-overrides.ts`. Use its exported comparison for geometry fields only; if it has none, compare x, y, width and height against the binding baseline JSON.
- `export function isInteractive(node: LintNode, store: Store): boolean`
  - `ui.control` except `progress`;
  - any element that is the `from` of a prototype link;
  - kit instances whose `kit` is one of `ios:list-row`, `ios:chip`, `ios:fab`, `ios:icon-button`, `ios:search-field`, `ios:text-field`, `ios:segmented`;
  - the tab item slot frames inside `ios:tab-bar` / `ios:top-tabs`, identified by componentKey prefix from `kits/ios/bars.ts`.
- `export function touchMinimum(screen): number | undefined`: `ios` -> 44, `android` -> 48, otherwise undefined (skip).

New `packages/core/src/app-design-lint/rules.ts`. Each rule returns findings `{ruleId, elementId, severity: "warning", message, context?: {screenId, instanceId?}}`.

- **`app-off-frame`**
  - On app/web-mode pages: a non-edge, non-guide node with no screen.
  - Any node whose box extends beyond its parent frame by more than 0.5, when that parent has neither `clipContent` nor `prototypeOverflow` other than `none`. This includes instance descendants.
- **`app-text-overflow`**, for every text-bearing node including instance descendants:
  - `text.note`: `textNoteLines` (from `ipd-09`) total height > box height + 0.5; or, in legacy mode, any line wider than the content box using its measure.
  - `ui.control` labels: per-line measured width > content width, unless truncation is set.
  - `shape.geo` labels: the wrapped block taller than the box.
- **`app-text-truncated`**: `textTruncate` set and the text actually shortened (`truncated: true`).
- **`app-control-overlap`**: interactive siblings (same parent) whose boxes intersect with area > 0.25 square points, where neither contains the other. Checked within instances too, among siblings.
- **`app-off-grid`**: non-flow nodes (skip auto-layout flow children). The grid is the parent frame's square layout grid size, else 1.
  - Check parent-relative x and y, and width and height unless auto-derived (text auto sizes, hug frames).
  - Tolerance 0.01.
  - Instance descendants only when `geometryOverridden`.
- **`app-misaligned`**: siblings in a non-layout parent; compare left, right, horizontal-centre and top edges between each pair.
  - A difference with `0.01 < d <= 2` -> a finding on the later element in document order, naming the other.
  - Instance descendants only when `geometryOverridden`.
  - Report each element at most once per rule (the first offending pair in document order).
- **`app-touch-target`**: interactive nodes whose screen has a minimum, and whose width or height is below it.
  - Instance descendants are checked.
  - Exception: a descendant with no prototype link of its own is skipped when its nearest interactive ancestor up to the screen meets the minimum. A descendant that is itself a link `from` is always checked.

Deduplication: at most one finding per (ruleId, elementId).

Messages are one line, for example: `text overflows its box by 12.5 (in instance "Row" ios:list-row@1, screen "Home")`. The parenthetical context is present only for instance descendants. The format is `(in instance "<layerName or name>" <kit>, screen "<name>")`, where the kit part is omitted when there is no kit.

New `packages/core/src/app-design-lint/index.ts`:

- `export function lintAppDesignPage(store, page, context): readonly AppLintFinding[]`
- `export const APP_LINT_RULE_IDS`

Findings are sorted by element document order, then rule id.

`apps/cli/src/commands.ts:lintCommand`:

- For pages where `isAppLintPage`, run `lintAppDesignPage` and append its findings to that page's findings, in the same row format: `elementId severity message ruleId`.
- JSON adds the optional `context` object only on findings that have it.
- App pages count as lintable, so the `LINT_NO_PAGES` logic and `--page` acceptance include them.
- The exit code is unchanged: warnings only.

`packages/core/src/index.ts` (sharedPaths, append-only): export `lintAppDesignPage`, `APP_LINT_RULE_IDS`, `isAppLintPage` and the finding type.

## Patterns to imitate

- `packages/core/src/text-layout-lint/` (engine, rules, index) for structure and determinism.
- `apps/cli/src/lint-diagram.ts` for CLI aggregation.

## Pitfalls

- Never recurse into instance internals for off-grid or misaligned unless geometry is overridden. That avoids noise multiplied by every instance.
- Hidden: `visual.hidden` on any ancestor, including kit slots hidden by `count`.
- Prototype edges are never nodes for geometric rules.
- The existing text-layout lint also runs on freeform app pages. Do not change it; do not duplicate its rule ids.
- Determinism: iterate in document order, and use stable sorts.

## Tests: new `packages/core/src/app-design-lint/app-design-lint.test.ts`

- **DR-02 reproduction.**
  - An iOS screen contains an instance of a small definition with a fixed 80×44 `ui.control` button whose label is overridden to 100 `W` characters, and a 24×24 icon child that is the `from` of a prototype link.
  - Expected: exactly one `app-text-overflow` on the button and one `app-touch-target` on the icon, both with `context.instanceId` and `screenId`.
- **Clean instances.** Every `IOS_KIT` component inserted with defaults into a `frame:iphone` gives zero findings of any app rule.
- **Exclusions.** A hidden child with overflowing text -> no finding. The `iOS kit` definitions page -> zero findings.
- **Nested instances.** An instance inside an instance with one overflowing label -> exactly one finding.
- **Off-frame.** A rect half outside a non-clipping screen -> `app-off-frame`. With `clipContent` -> none. A note on an app-mode page outside every screen -> `app-off-frame`.
- **Overlap.** Two overlapping buttons in the same frame -> one `app-control-overlap`.
- **Off-grid.** x 10.5 in a frame with no grid -> `app-off-grid`. x 12 with an 8-grid frame -> finding; x 16 -> none.
- **Misaligned.** Siblings with left 16 and 17 -> one `app-misaligned`. 16 and 16 -> none. 16 and 24 -> none.
- **Touch target.** A 30×30 hotspot on iOS -> finding. On web -> none.
- **Truncated.** A `textTruncate` label that is cut -> `app-text-truncated`.

New `apps/cli/src/app-lint-cli.test.ts`:

- `lint` on an app page prints rows with the rule ids.
- `--format json` includes `context` for instance findings.
- A doc with only freeform non-app pages has unchanged output.

## Verification (evidence in `final/`)

1. `bun test packages/core/src/app-design-lint apps/cli/src/app-lint-cli.test.ts apps/cli/src/lint-diagram.test.ts apps/cli/src/text-layout-lint.test.ts apps/cli/src/lint-metrics.test.ts packages/core/src/text-layout-lint` -> exit 0, 0 fail.
2. `bun run typecheck` -> no `error TS` line in the owned files.
3. `bunx biome check packages/core/src/app-design-lint apps/cli/src/app-lint-cli.test.ts` -> exit 0.

## Done criteria

- Verification passes.
- `rg -c '"app-' packages/core/src/app-design-lint/index.ts` -> 7 or more.

## Worker rules

- Record `git hash-object` of this plan first.
- Read each file fresh before editing it, with pre and post hashes. On drift, re-read, keep the other change and record it.
- `packages/core/src/index.ts` is shared: append export lines only.
- No state-changing git commands, no emojis. Evidence files must not match Bun test patterns.

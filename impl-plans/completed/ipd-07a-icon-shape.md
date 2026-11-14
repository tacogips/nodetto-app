# ipd-07a-icon-shape

- planId: ipd-07a-icon-shape
- planPath: impl-plans/active/ipd-07a-icon-shape.md
- progressPath: impl-plans/progress/ipd-07a-icon-shape.md
- wave: 1. dependsOn: none pending; accepted dependencies ipd-01-ir-schema (IR type `ui.icon`), ipd-03-icon-data (icon data).
- Design (binding): `design-docs/specs/design-iphone-app-design.md`, Decision 2 (icon element, D6).
- Evidence: `tmp/ipd-s772/ipd-07a-icon-shape/`.
<!-- ownership:start -->
- writePaths:
  - `packages/core/src/shapes/ui-icon.ts`
  - `packages/core/src/shapes/index.ts`
  - `impl-plans/progress/ipd-07a-icon-shape.md`
  - `tmp/ipd-s772/ipd-07a-icon-shape`
- sharedPaths:
  - none
- sharedPathNotes:
  - none
- artifactRoots:
  - `tmp/ipd-s772/ipd-07a-icon-shape`
<!-- ownership:end -->

## Intent and context

`ipd-01` (accepted) registered the IR element type `ui.icon` in `ELEMENT_TYPES`
(`packages/ir/src/registry/icons.ts`: a `ui.icon` semantic needs exactly one of
`icon` or `path`). No core shape util exists for it yet.

`apps/cli/src/edit/label-field.test.ts` ("all registered types accept their
mapped label or report no label") creates every `ELEMENT_TYPES` entry from
`editor.registry.getOrFallback(type).defaultSemantic()`. For `ui.icon` the
fallback (unknown util) default has neither `icon` nor `path`, so
`createElement` throws `invalid element`. Every plan whose gate runs
`bun test packages apps/cli/src` or `apps/cli/src/edit` fails on it until the
util exists.

This plan moves only the minimal shape util and its registration out of
`ipd-07-icon-core-cli` into a root plan, so the registry is valid from wave 1.

Evidence that the contract is sufficient: a throwaway simulation that registers
a util with exactly the defaults below and replays the label-field steps passes
(`tmp/ipd-s772/plan-check/amend-s777/sim-ui-icon.log`: 1 pass, 0 fail;
`labelField` reports `ui.icon has no text label`, which is the expected branch).

## Non-goals

- No SVG export case for `ui.icon` (stays in `ipd-07`).
- No shape warnings, palette or catalogue rows, CLI `shapes icon` listing or
  validate warnings (all `ipd-07`).
- No export from `packages/core/src/index.ts` (`ipd-07` appends it).
- No edit of `apps/cli/src/edit/label-field.test.ts`, `packages/ir/**`, or
  any other test.

## File-level changes

New `packages/core/src/shapes/ui-icon.ts`, exporting
`uiIconShapeUtil: ShapeUtil` with exactly:

- `type: "ui.icon"`;
- `canResize: true`;
- `getBounds`: from the visual, defaults `x 0`, `y 0`, `width 24`, `height 24`;
- `hitTest`: box containment via `boxContains` (as in `uiControl.ts`);
- `resize: (_element, box) => ({ visual: { ...box } })`;
- `defaultSemantic: () => ({ icon: "square" })`;
- `defaultVisual: () => ({ x: 0, y: 0, width: 24, height: 24, style: { stroke: "#000000", strokeWidth: 2 } })`.

`packages/core/src/shapes/index.ts`: import `uiIconShapeUtil` and add
`.register(uiIconShapeUtil)` in `createDefaultRegistry`, directly after
`.register(uiControlShapeUtil)`. Change nothing else in the file.

## Patterns to imitate

- `packages/core/src/shapes/uiControl.ts:uiControlShapeUtil` (19 lines): copy
  its structure, imports (`boxContains` from `../geometry.ts`, `ShapeUtil`
  type from `../shape-util.ts`) and style.
- `packages/core/src/shapes/index.ts:createDefaultRegistry` registration chain.

## Pitfalls

- Do not import the icon data (`findIcon`, generated Lucide JSON) here; the util
  must not parse the about 1 MB icon data at module load. Rendering belongs to
  `ipd-07`.
- The default semantic must be `{icon: "square"}` exactly: `ipd-07`, its tests
  and the CLI `icon:<name>` creation rely on it.
- Do not reorder the existing registrations; registration order can affect
  lookups and later plans diff this file.
- `packages/core/src/index.ts` is append-only and shared; this plan does not
  touch it.

## Tests

No new test file. The existing tests are the regression:

- `apps/cli/src/edit/label-field.test.ts` "all registered types ..." -> passes
  (today 3 pass, 1 fail; `tmp/ipd-s772/plan-check/amend-s777/label-field.log`).
- `packages/core` suite -> no new failures versus the `ipd-00-baseline`
  Baseline failures table in `impl-plans/progress/ipd-00-baseline.md`.

## Verification (evidence in `tmp/ipd-s772/ipd-07a-icon-shape/final/`)

1. `bun test apps/cli/src/edit/label-field.test.ts` -> exit 0, 4 pass, 0 fail.
2. `bun test packages/core` -> no failures other than those listed in the
   ipd-00 baseline table; record pass/fail counts.
3. `bun run typecheck` -> exit 0, no `error TS` lines.
4. `bunx biome check packages/core/src/shapes/ui-icon.ts packages/core/src/shapes/index.ts` -> exit 0.

Save each command's full output as a `.log` in `final/` and record exit code
and counts in the progress log.

## Done criteria

- `rg -n '"ui.icon"' packages/core/src/shapes/ui-icon.ts` -> 1 match.
- `rg -n 'uiIconShapeUtil' packages/core/src/shapes/index.ts` -> 2 matches
  (import and register).
- `rg -n 'icon: "square"' packages/core/src/shapes/ui-icon.ts` -> 1 match.
- The four verification commands pass and
  `impl-plans/progress/ipd-07a-icon-shape.md` records them.

## Progress log

`impl-plans/progress/ipd-07a-icon-shape.md`: plan hash, pre/post
`git hash-object` of both source files, commands with exit codes and counts,
log paths, and any finding with a status from the fixed vocabulary.

## Worker rules

- Record `git hash-object` of this plan first.
- Read each file fresh immediately before editing it; record pre and post
  hashes. On drift (hash differs from your last read), re-read, keep the other
  change and record it.
- Edit only the writePaths above. Problems found elsewhere are findings, never
  blockers.
- No state-changing git commands, no emojis. Evidence files must not match Bun
  test patterns (no `.test.ts` names under `tmp/`).

## Amendment 2026-11-10 (blocked-wave-scope-or-contract, operator round 3, ipd-07a split)

Created by the operator after session-775 wave 2: `ipd-01-ir-schema` is
accepted (IR and golden suites pass), and the `ui.icon` core default could not
be fixed inside its IR scope. `ipd-05`, `ipd-06`, `ipd-07`, `ipd-09` and
`ipd-12` depend on this plan; `ipd-07` keeps SVG export, warnings, catalogue
and CLI work and treats `ui-icon.ts` as a shared path. Step 4 (session-777)
normalized this plan to the ownership-block and contract format, with no scope
change.

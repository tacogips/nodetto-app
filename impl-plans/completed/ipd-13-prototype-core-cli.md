# ipd-13-prototype-core-cli

- planId: ipd-13-prototype-core-cli
- planPath: impl-plans/active/ipd-13-prototype-core-cli.md
- progressPath: impl-plans/progress/ipd-13-prototype-core-cli.md
- dependsOn: ipd-01-ir-schema, ipd-05-core-catalogue, ipd-11-frames (both edit `svg-export/document.ts` and `inspect-command.ts`; all three are accepted dependencies, so this plan has no pending dependency)
- Design (binding): `design-docs/specs/design-iphone-app-design.md`, Decision 8 (8.1-8.5 and 8.7 core rule), D9.
- Evidence: `tmp/ipd-s772/ipd-13-prototype-core-cli/`.
<!-- ownership:start -->
- writePaths:
  - `packages/core/src/prototype-links.ts`
  - `packages/core/src/prototype-links.test.ts`
  - `packages/core/src/shapes/connector/decoration.ts`
  - `packages/core/src/svg-export/theme.ts`
  - `packages/core/src/svg-export/document.ts`
  - `packages/core/src/editor/facade/page-editing.ts`
  - `apps/cli/src/export-command.ts`
  - `apps/cli/src/inspect-command.ts`
  - `apps/cli/src/edit/operations/connect.ts`
  - `apps/cli/src/prototype-cli.test.ts`
  - `impl-plans/progress/ipd-13-prototype-core-cli.md`
  - `tmp/ipd-s772/ipd-13-prototype-core-cli`
  - `packages/core/src/screen-transition.test.ts`
- sharedPaths:
  - `packages/core/src/index.ts`
  - `packages/core/src/svg-export.test.ts`
  - `packages/core/src/templates/design-templates.test.ts`
- sharedPathNotes:
  - path: `packages/core/src/index.ts`; intendedEdit: append export lines only; re-read immediately before writing; never reorder or remove lines; verify sibling plans' new lines survive after writing
  - path: `packages/core/src/svg-export.test.ts`; intendedEdit: update only expectations that pinned prototype links in default page export (accepted output change, design 8.4)
  - path: `packages/core/src/templates/design-templates.test.ts`; intendedEdit: update only expectations that pinned prototype links in default page export (accepted output change, design 8.4)
- artifactRoots:
  - `tmp/ipd-s772/ipd-13-prototype-core-cli`
<!-- ownership:end -->

## Intent and context

D9: prototype links (`edge.generic` with `prototype: true`) are drawn like ordinary orthogonal connectors. Their label is verbose (`packages/core/src/shapes/connector/decoration.ts:141-157`), and page export draws them across all artboards.

This plan provides the core model and the CLI surface:

- compact labels;
- prototype-view geometry (curves ending at the destination frame edge, back tags, flow flags);
- flows with breadth-first screen order;
- persistent-layer matching;
- page export omitting links by default, with `--prototype` drawing the prototype view;
- `inspect --flows`;
- `connect` support for `tap` and `prototype:back`.

Desktop views are `ipd-18`/`ipd-19`. HTML presentation is `ipd-21`.

## Non-goals

- No desktop UI.
- No HTML prototype.
- No new IR. `back`, `swap-overlay` and `prototypeFlowName` come from `ipd-01`.
- Do not change routing for non-prototype connectors.

## File-level changes

New `packages/core/src/prototype-links.ts`:

- `export function compactPrototypeLabel(semantic: GenericEdgeSemantic): string`
  - An explicit `label` returns that label.
  - Otherwise join only the non-defaults with `" · "`, in this order:
    - action: `back` -> "back"; `open-overlay` -> "overlay"; `swap-overlay` -> "swap"; `close-overlay` -> "close"; `change-to` -> "variant"; `navigate` -> nothing;
    - trigger: `hover`, `press`; `after-delay` -> `after <s>s`, with seconds = delay/1000 and trailing zeros trimmed; `click` -> nothing;
    - animation: `fade`; `slide-left` -> "slide ←", likewise for the other slides; `smart`; `instant` -> nothing.
  - A default link returns `""`.
- `export interface PrototypeLinkGeometry`, with fields:
  - `readonly kind: "curve" | "back-tag"`
  - `readonly d?: string`
  - `readonly start: Vec`
  - `readonly end?: Vec`
  - `readonly labelPoint: Vec`
  - `readonly label: string`
- `export function prototypeLinkGeometry(store: Store, context: ShapeContext, link: Element): PrototypeLinkGeometry | undefined`
  - **Back links** -> `back-tag` at the hotspot's top-right.
  - **Other links.** Find the hotspot box (`from`) and the destination frame box (`to`).
    - Start: the midpoint of the hotspot edge facing the destination. Use the right edge if the destination centre x >= the hotspot centre x, else the left edge.
    - End: the destination frame's nearest vertical edge, at y = clamp(start.y, frame.y + 12, frame.y + frame.height - 12).
    - `d` is a cubic: `M start C (start.x ± k) start.y, (end.x ∓ k) end.y, end.x end.y`, with `k = max(40, |end.x - start.x| / 2)`.
    - The label point is the curve midpoint (t = 0.5).
  - Missing ends -> undefined.
- `export interface PrototypeFlow`, with fields:
  - `readonly name: string`
  - `readonly startId: ElementId`
  - `readonly screens: readonly ElementId[]`
  - `readonly links: readonly { id: ElementId; from: ElementId; screen: ElementId; to: ElementId; trigger: string; action: string }[]`
- `export function prototypeFlows(store: Store, context: ShapeContext): { readonly flows: readonly PrototypeFlow[]; readonly unreachable: readonly ElementId[]; readonly dangling: readonly ElementId[] }`
  - Starts are frames with `prototypeStart`. The name is `prototypeFlowName ?? frame name`.
  - Flows are ordered by name, then id.
  - Breadth-first order follows outgoing links from each screen, in document order of links. Back links add no edge. Screens on other pages are included.
  - Unreachable screens: screen frames (`platform` or `screenKind`) on pages that contain a start but are not reached by any flow.
  - Dangling: a link whose hotspot or destination is missing or hidden.
- `export function persistentLayerPairs(store: Store, context: ShapeContext, fromScreen: ElementId, toScreen: ElementId): readonly { from: ElementId; to: ElementId }[]`
  - Top-level children of both screens with `visual.prototypeFixed`.
  - A pair matches by `layerName` (or, when both are kit instances, by equal `semantic.kit`) and by box relative to the screen within 0.5.
  - Ordered by the destination id.

`packages/core/src/shapes/connector/decoration.ts`: the prototype branch uses `compactPrototypeLabel`. Arrowheads are unchanged (dot to arrow).

`packages/core/src/svg-export/theme.ts`: `SvgExportOptions` gains `readonly prototypeView?: boolean`.

`packages/core/src/svg-export/document.ts`:

- Page export skips elements that are `edge.generic` with `prototype === true` unless `prototypeView` is true.
- With `prototypeView`:
  - after normal content, draw each link from `prototypeLinkGeometry`: path stroke `#7c3aed`, width 2, fill none, a dot at the start, an arrow at the end;
  - the label on a white rounded backdrop at the label point, 11-unit text;
  - back tags as a small rounded rect with "back";
  - one flag per flow above each start frame: a triangle path plus the flow name, placed left-aligned above the frame title band (`frameTitleBox` from `ipd-05`; when the title is outside, stack the flag above the title).
- Bounds include link geometry, flags and back tags.
- Artboard and selection export never draw links.

`packages/core/src/editor/facade/page-editing.ts`: pass `prototypeView` through `exportPageSvg` options. No signature break.

`apps/cli/src/export-command.ts`:

- New flag `--prototype`. Allowed only for page `svg|png|pdf` without `--element`. Otherwise exit 1 with `--prototype draws a whole page; remove --element`.
- It sets `prototypeView: true`.
- Add it to `EXPORT_OPTIONS`/flags.

`apps/cli/src/inspect-command.ts`:

- `--flows` prints, per flow:
  - `flow "<name>" start <shortId> "<frame name>"`;
  - then per screen in breadth-first order: `  <shortId> "<name>"`;
  - then per outgoing link: `    -> <shortId> "<dest>" (<trigger> <action> from <hotspotShortId>)`.

  Then `unreachable:` and `dangling:` lines when they are non-empty.
- `--flow <name>` filters to one flow; an unknown name is exit 1 listing the names.
- `--format json` emits `{flows, unreachable, dangling}` with full ids.
- Use the existing short-id helper (`apps/cli/src/ids.ts`).

`apps/cli/src/edit/operations/connect.ts`:

- `semantic.prototypeTrigger: "tap"` is normalized to `"click"` before validation.
- `{"op":"connect","shape":"prototype:back","from":X}` without `to` is allowed and calls `connectShape(editor, Tool.PrototypeBack, from, from)`. If `to` is given, it is ignored with a warning. A missing screen is an error naming `from`.

`packages/core/src/index.ts` (sharedPaths, append-only): export the new prototype-links API.

## Patterns to imitate

- `packages/core/src/prototype.ts:prototypeScreen` for screen resolution.
- `packages/core/src/svg-export/connectors.ts` for arrow markers and backdrops.
- `apps/cli/src/inspect-command.ts` existing `--text` option handling.

## Pitfalls

- Omitting links in page export is an accepted output change. Update only the tests that pin prototype edges in page export, listing each one. Do not touch connector tests that have no prototype links.
- Links to frames on other pages: in page prototype view, draw only links whose both ends are on the exported page; count the rest in a `<desc>` comment-free way, which means do not draw them. `inspect --flows` still lists them.
- Breadth-first search must terminate on cycles. Use a visited set.
- Do not reuse the orthogonal router for prototype curves.
- Keep `fmt` number formatting for path data.

## Tests

New `packages/core/src/prototype-links.test.ts`:

- **Labels.** Default -> `""`. `{prototypeTrigger:"after-delay",prototypeDelay:2000}` -> `"after 2s"`. Overlay with fade -> `"overlay · fade"`. An explicit label wins.
- **Geometry.** Hotspot left of the destination -> start on the hotspot's right edge, end x = destination left edge. Destination to the left -> mirrored.
- **Back link** -> `back-tag`.
- **Flows.** Two starts with names -> two flows sorted. A cycle A->B->A terminates. An unreachable screen is listed. A hidden hotspot is dangling.
- **Persistent pairs.** Tab bars with the same `layerName` and box on two screens -> 1 pair. Moved 3 units -> 0 pairs.
- **Page export.** Default page SVG of a doc with links -> no `#7c3aed` path. `prototypeView` -> curve paths, and flags with the flow names.

New `apps/cli/src/prototype-cli.test.ts`:

- `export --prototype --format svg` contains the curves.
- `export --prototype --element X` -> exit 1.
- `inspect --flows` text lists screens in breadth-first order. JSON has `flows[0].screens`.
- `connect` with `prototypeTrigger: "tap"` stores `click`.
- `connect prototype:back` with only `from` -> `to` = screen, action back.

## Verification (evidence in `final/`)

1. `bun test packages/core/src/prototype-links.test.ts apps/cli/src/prototype-cli.test.ts packages/core/src/prototype.test.ts packages/core/src/screen-transition.test.ts packages/core/src/svg-export.test.ts packages/core/src/connector-outlines.test.ts apps/cli/src/export-command.test.ts apps/cli/src/commands.test.ts packages/core/src/templates/design-templates.test.ts` -> exit 0, 0 fail.
2. `bun run typecheck` -> no `error TS` line in the owned files.
3. `bunx biome check` on the owned files -> exit 0.
4. Visual evidence:
   - Build four linked iPhone screens with the CLI: tabs, back and an overlay.
   - Export `final/storyboard.png` with `--prototype --scale 1` and `final/design.png` without it.
   - Inspect both: no links in the design export; curves end at frame edges with compact labels in the storyboard.

## Done criteria

Verification passes.

## Worker rules

- Record `git hash-object` of this plan first.
- Read each file fresh before editing it, with pre and post hashes. On drift, re-read, keep the other change and record it.
- `packages/core/src/index.ts` is shared: append export lines only.
- No state-changing git commands, no emojis. Evidence files must not match Bun test patterns.

## Amendment 2026-11-10 (operator round 8)

This plan owns `packages/core/src/screen-transition.test.ts`. Update only the stale verbose prototype label expectation (around line 55) to the compact label required by Decision 8.3; keep every semantic and round-trip assertion. Then rerun the aggregate and visual verification. Keep the ipd-13 work already in the working tree and continue from it.

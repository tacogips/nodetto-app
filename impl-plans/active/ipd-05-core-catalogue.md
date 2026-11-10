# ipd-05-core-catalogue

- planId: ipd-05-core-catalogue
- planPath: impl-plans/active/ipd-05-core-catalogue.md
- progressPath: impl-plans/progress/ipd-05-core-catalogue.md
- wave: 3. dependsOn: ipd-01-ir-schema, ipd-02-text-measure
- Design (binding): `design-docs/specs/design-iphone-app-design.md`, Decisions 1.1 (`text:layer`), 6.5 (presets), 6.6 (title placement), 8.1 (`prototype:back`).
- Evidence: `tmp/ipd-s772/ipd-05-core-catalogue/`.
<!-- ownership:start -->
- writePaths:
  - `packages/core/src/tools.ts`
  - `packages/core/src/shape-catalogue.ts`
  - `packages/core/src/shape-catalogue.test.ts`
  - `packages/core/src/shapes/frame.ts`
  - `packages/core/src/screen-transition.ts`
  - `packages/core/src/ipd-catalogue.test.ts`
  - `impl-plans/progress/ipd-05-core-catalogue.md`
  - `tmp/ipd-s772/ipd-05-core-catalogue`
- sharedPaths:
  - `packages/core/src/index.ts`
- sharedPathNotes:
  - path: `packages/core/src/index.ts`; intendedEdit: append export lines only; re-read immediately before writing; never reorder or remove lines; verify sibling plans' new lines survive after writing
- artifactRoots:
  - `tmp/ipd-s772/ipd-05-core-catalogue`
<!-- ownership:end -->

## Intent and context

Shape IDs are defined once and read by three consumers: the desktop palette, `nodetto-cli shapes` and `draw`/`add`. The registry is `packages/core/src/tools.ts` (`Tool`, `creationFor`) plus `packages/core/src/shape-catalogue.ts` (listings, `connectShape`).

This plan adds the fixed new shape IDs:

- `text:layer`;
- five iPhone presets;
- `prototype:back`.

It also adds the frame title-placement helpers that the renderers (`ipd-11`) use. Dynamic IDs (`icon:<name>`, `ios:<name>`) are not catalogue entries; `ipd-07` and `ipd-14` handle them.

## Non-goals

- No renderer, canvas or CLI command change.
- No palette UI change; `ipd-17` adds palette rows.
- Do not change `FRAME_TITLE_BAND` or `arrange-layered.ts`.

## File-level changes

`packages/core/src/tools.ts`:

- Add `Tool` entries:
  - `TextLayer: "text:layer"`;
  - `IPhone393Frame: "frame:iphone-393x852"`;
  - `IPhone402Frame: "frame:iphone-402x874"`;
  - `IPhone430Frame: "frame:iphone-430x932"`;
  - `IPhone440Frame: "frame:iphone-440x956"`;
  - `IPhone375Frame: "frame:iphone-375x667"`;
  - `PrototypeBack: "prototype:back"`.
- `creationFor(Tool.TextLayer)` returns `text.note` with:
  - semantic `{text: "Text"}`;
  - visual: `textPadding: 0`, `textResize: "auto-width"`, `textMeasure: "proportional"`, width 40, height 22;
  - style: `fontFamily: APP_FONT_STACK` (from `packages/core/src/text-measure.ts`), `fontSize: 17`, `fontWeight: 400`, `lineHeight: 1.29`, `color: "#000000"`, `textAlign: "start"`, `verticalAlign: "top"`.

  Width and height are recomputed by auto-width on the first transaction.
- `FRAME_KINDS` maps the five preset tools to the new `FRAME_PRESETS` keys.

`packages/core/src/shapes/frame.ts`:

- `FRAME_PRESETS` gains, all with `platform: "ios"`:

  | Key | name | Size | safeArea (top, right, bottom, left) |
  | --- | --- | --- | --- |
  | `"iphone-393x852"` | "iPhone 393×852" | 393×852 | 59, 0, 34, 0 |
  | `"iphone-402x874"` | | 402×874 | 62, 0, 34, 0 |
  | `"iphone-430x932"` | | 430×932 | 59, 0, 34, 0 |
  | `"iphone-440x956"` | | 440×956 | 62, 0, 34, 0 |
  | `"iphone-375x667"` | | 375×667 | 20, 0, 0, 0 |

  The existing `iphone` (390×844) is unchanged. Name the others in the same "iPhone W×H" style.
- New exports:
  - `export const FRAME_OUTSIDE_TITLE_GAP = 6`
  - `export const FRAME_OUTSIDE_TITLE_HEIGHT = 16`
  - `export function resolveTitlePlacement(semantic: FrameSemantic): "inside" | "outside"`
    - An explicit `titlePlacement` wins.
    - Otherwise `"outside"` when `platform !== undefined || screenKind !== undefined`.
    - Otherwise `"inside"`.
  - `export function frameTitleBox(bounds: Box, semantic: FrameSemantic): Box | undefined`
    - undefined when `showTitle === false`.
    - Inside: `{x, y, width, height: FRAME_TITLE_BAND}`.
    - Outside: `{x, y: y - FRAME_OUTSIDE_TITLE_GAP - FRAME_OUTSIDE_TITLE_HEIGHT, width, height: FRAME_OUTSIDE_TITLE_HEIGHT}`.
- `frameShapeUtil.hitTest`: when placement is `"outside"`, the top edge band is 8 units, not `FRAME_TITLE_BAND`. The interior near the top is then not a frame grab area.

`packages/core/src/screen-transition.ts`:

- `export function connectPrototypeBack(editor: Editor, from: ElementId): ElementId | null`
  - Resolves `screenFrame(editor, from)`; null if there is none.
  - Creates an `edge.generic` with semantic `{from, to: screen, prototype: true, prototypeAction: "back", prototypeTransition: "instant"}`. Use the same creation call that `connectScreenTransition` uses.

`packages/core/src/shape-catalogue.ts`:

- Listings:
  - `general` gains `[Tool.TextLayer, "Text layer"]`.
  - `artboard` gains the five presets after `IPhoneFrame`, labelled "iPhone 393×852" and so on.
  - `screen` gains `[Tool.PrototypeBack, "Back link"]`.
- `connectorTypeFor`: `PrototypeBack` -> `edge.generic`.
- `connectShape`: `PrototypeBack` -> `connectPrototypeBack(editor, from)`. The `to` argument is ignored.

`packages/core/src/index.ts` (sharedPaths, append-only): export `resolveTitlePlacement`, `frameTitleBox`, `FRAME_OUTSIDE_TITLE_GAP`, `FRAME_OUTSIDE_TITLE_HEIGHT` and `connectPrototypeBack`.

## Patterns to imitate

- The existing `Tool.IPhoneFrame` entry and the `FRAME_KINDS`/`creationFor` frame branch (`tools.ts:465`, `:666-680`).
- `connectScreenTransition` (`screen-transition.ts:45`) for edge creation.

## Pitfalls

- `Tool` values are persisted nowhere, but they are shape IDs used by the CLI. Keep the exact strings.
- Do not change the existing iPhone preset or its safe area.
- `resolveTitlePlacement` must not consult `showTitle`, so placement and visibility stay independent.
- `prototype:back` must not throw when `to` is given and differs; it simply uses the screen. Document this in the function comment.
- The `shape-catalogue.test.ts` snapshot or counts will change. Update those expectations deliberately and list each change in the progress log.

## Tests

`packages/core/src/shape-catalogue.test.ts` (extend):

- `findShape("text:layer")` has type `text.note`.
- Each preset id has type `frame`.
- `findShape("prototype:back").connector === true`.

New `packages/core/src/ipd-catalogue.test.ts`:

- `shapeCreation(Tool.TextLayer)` has `textMeasure: "proportional"` and `textPadding: 0`.
- Creating `frame:iphone-402x874` through the editor gives 402×874 with safe-area top 62.
- `resolveTitlePlacement`:
  - `{name, platform: "ios"}` -> outside;
  - `{name}` -> inside;
  - `{name, platform: "ios", titlePlacement: "inside"}` -> inside;
  - `{name, screenKind: "popup"}` -> outside.
- `frameTitleBox` for an outside frame at y=100 -> y = 100 - 6 - 16.
- `hitTest` at (x+50, y+15) on an outside-title iPhone frame -> false. The same point on a diagram frame -> true (unchanged).
- `connectPrototypeBack` from a child of a screen -> an edge with `to` equal to that screen and action `back`. From an element on no screen -> null.

## Verification (evidence in `final/`)

1. `bun test packages/core/src/shape-catalogue.test.ts packages/core/src/ipd-catalogue.test.ts packages/core/src/frame.test.ts packages/core/src/screen-transition.test.ts packages/core/src/arrange-layered.test.ts` -> exit 0, 0 fail.
2. `bun test apps/cli/src/shapes-command.test.ts` -> record the result. `ipd-07` owns that test file and updates any expectation that lists catalogue rows. A failure here caused only by the new rows is a `pending_downstream` finding owned by `ipd-07`. Any other failure blocks this plan.
3. `bun run typecheck` -> no `error TS` line under the owned files.
4. `bunx biome check packages/core/src/tools.ts packages/core/src/shape-catalogue.ts packages/core/src/shapes/frame.ts packages/core/src/screen-transition.ts packages/core/src/ipd-catalogue.test.ts` -> exit 0.

## Done criteria

- Verification passes.
- `rg -n '"text:layer"|"prototype:back"|"frame:iphone-402x874"' packages/core/src/tools.ts` -> 3 matches.

## Worker rules

- Record `git hash-object` of this plan first.
- Read each file fresh before editing it, with pre and post hashes. On drift, re-read, keep the other change and record it.
- `packages/core/src/index.ts` is shared by parallel plans: append export lines only.
- No state-changing git commands, no emojis. Evidence files must not match Bun test patterns.

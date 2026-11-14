# iPhone app design: precise layers, iOS kit, CLI layout, prototype flows

Status: IMPLEMENTED, 2026-11-11, gates passed (see impl-plans/README.md), base f59bef4 ("Release Nodetto 0.8.9"), branch
`feat/iphone-app-design`. No GitHub issue; the source is an operator request
(2026-11-10). Owner questions are in
`design-docs/user-qa/iphone-app-design.md`. Q1, Q3 and Q4 are open; this design
implements their defaults. Q2 was resolved in design review DR-01: the desktop
app gets comparison.

Revised 2026-11-10 after design review:

- DR-01: desktop comparison added (10.2, 10.3).
- DR-02: app lint checks the visible content of component instances, per rule
  (9.1).

## Overview

An iPhone app design drawn with `nodetto-cli` 0.8.9 came out misaligned, with
the wrong typography and missing icons. Ten defects (D1-D10) were recorded.
This design fixes them and adds what an app designer, human or AI agent, needs
to draw a phone app precisely from the desktop palette and from the CLI. It
also covers clickable, Figma-style prototype flows. Only concepts are taken
from Figma; no assets or internal names.

Decisions 1-10 below map one-to-one to the operator's items (1)-(10). Item (11)
is a reproduction of a private reference app. It is built only with the CLI,
and its inputs and outputs stay under the git-ignored `tmp/` directory. The
"Reproduction" section defines how this design supports it. No name, text,
color or image from the private reference may appear in a tracked file.

Read first: `design-web-app-roundtrip.md` (HTML export, controls),
`design-text-layout-lint.md` (text measurement, lint shape),
`design-cli-layout-merge-lint.md` (edit operations, unknown fields, carry
members, lint additions), `design-appearance.md`, `design-z-order.md` (frame
paint order and ownership).

## Baseline facts (f59bef4)

The design extends existing machinery. Most of what a phone design needs
already exists; the defects are rendering gaps and missing CLI entry points.

| Fact | Where |
| --- | --- |
| One SVG serializer serves desktop export, the CLI and the native CLI. Per-type switch | `packages/core/src/svg-export/shapes.ts:47-291`, `document.ts:548-611` |
| The ui-solid canvas has its own Solid views; it shares geometry/layout helpers only | `packages/ui-solid/src/shapes/*View.tsx` |
| The native CLI runs the same TS bundle in Boa (`apps/cli/scripts/build-engine.ts`, IIFE, no Node APIs) and rasterizes with resvg 0.48; bun uses `@resvg/resvg-js` with the same font profile | `apps/cli/native/README.md`, `render.rs`, `raster-backend.ts`, `render-profile.ts` |
| Native parity harness: `compare()` / `compareFile()` assert equal exit code, stdout, stderr and bytes | `apps/cli/src/native-parity/harness.ts:15-49` |
| `ui.control` kinds button, input, textarea, select, checkbox, switch, radio, tabs, progress; tabs select by `value` equal to an option | `packages/ir/src/ui-controls.ts:11-42` |
| D1: button label always `x+width/2`, `text-anchor: middle`; canvas uses browser button centring | `svg-export/ui-control.ts:135-140`, `UiControlView.tsx:12-20` |
| D2: tabs/progress never call `styled()`; colors hard-coded `#f1f5f9`, `#d6ecef`, `#137e7e` in SVG, canvas CSS and HTML; no accent style key exists, so `style.accent` is rejected by CLI style-key checks | `ui-control.ts:15-81`, `UiControlView.css:39-111`, `interface-code.ts:485-487`, `apps/cli/src/edit/operation-fields.ts:126-166` |
| D3: ui.control emits one `<text>` with the raw label; usvg turns `\n` into a space; font is the theme stack `Inter, ui-sans-serif, system-ui, sans-serif` (Inter absent). The monospace fallback is not confirmed in code (likely usvg run fallback) | `ui-control.ts:132-150`, `theme.ts:25` |
| D4: `rectOutline` insets every geo rect by 1 unit per side, so height <= 2 gives a zero-size rect | `packages/core/src/shapes/geo-outline.ts:274-283` |
| D5: geo labels wrap at `width - 16` and ignore `visual.textPadding`; width is estimated at 0.55 em per grapheme; a CLI `update` of typography on an element linked to a text style is silently reverted by `planTextStyles` | `label-layout.ts:73-85`, `text-layout.ts:14,50-104`, `text-styles.ts:263-268`, `transaction.ts:128-132` |
| `text.note` has no background; `visual.textResize` (fixed / auto-width / auto-height) and `visual.textPadding` exist; `style.textAlign` is start / middle / end | `packages/ir/src/types.ts:211,359-362` |
| D7: membership is `memberIds` when present, else geometric (smallest enclosing lower frame). Every auto-layout frame has `memberIds`; CLI `add` writes no membership; there is no `parent` field | `packages/core/src/frame-tree.ts:26-117`, `apps/cli/src/edit/operations/add.ts` |
| Frames already have `platform`, `screenKind`, `safeArea`, `clipContent`, `showTitle`, `prototypeStart`, `prototypeOverflow`, `layout` (direction, gap, wrap, padding*, sizing, align, justify), `layoutGrids`; children have `layoutGrow`, `layoutPosition: "absolute"`, min/max sizes, `prototypeFixed` | `packages/ir/src/semantics/design.ts:19-125`, `types.ts:282-379` |
| D8: auto layout runs inside every transaction (CLI included) but needs `memberIds`; the CLI has no layout, align, distribute or snap operation | `auto-layout.ts:47,138`, `apps/cli/src/edit/batch.ts:318-381` |
| Align/distribute planners exist (`planAlign`, `planDistribute`); desktop snap grid is a fixed 24 units unless a frame has layout grids | `packages/core/src/align.ts:92,137`, `ui-solid/src/interaction/snapping.ts:21,150-163` |
| D9: prototype links are `edge.generic` with `prototype: true`, drawn like ordinary connectors, labelled `trigger → action · animation`; page SVG/PNG export draws them; actions are navigate, change-to, open-overlay, close-overlay | `shapes/connector/decoration.ts:141-157`, `semantics/connectors.ts:29-60` |
| A desktop prototype preview exists (start frame, history, back, overlays, smart animate) | `packages/ui-solid/src/PrototypePreview.tsx`, `prototype-*.ts` |
| D10: the frame title is drawn inside the frame at `(x+8, y+16)` and children paint over it; artboard export hides it; `FRAME_TITLE_BAND = 24` is also used by layered arranging | `svg-export/shapes.ts:240-253`, `FrameView.tsx:125-138`, `shapes/frame.ts:9`, `arrange-layered.ts:219` |
| Export: `--element`, `--page`, `--scale`, no per-frame output; HTML export is a static ZIP without prototype navigation | `apps/cli/src/export-command.ts:51-65`, `packages/core/src/html-bundle.ts` |
| Lint rules are direct calls per page kind; output rows are `elementId severity message ruleId` | `apps/cli/src/commands.ts:276-541`, `lint-diagram.ts` |
| Components: a definition is a `frame` with `component: true`; an instance is a `frame` with `instanceOf` and `instanceBindings`; overrides are inferred from baselines | `packages/core/src/editor/components.ts:65-119`, `component-overrides.ts` |
| `SCHEMA_VERSION = 1`, `MIGRATIONS = []`; unknown fields are warnings and preserved | `packages/ir/src/migrations.ts`, `validate.ts:102-159` |
| No icon set, no third-party license file besides the root MIT `LICENSE` | repository root |

## Global rules

- **Schema.** All additions are optional fields, one new element type
  (`ui.icon`) and two new prototype action values. `schemaVersion` stays 1 and
  no migration is written. A document without the new fields renders and
  exports byte-identically to f59bef4. The one exception is the deliberate
  default changes listed in "Accepted output changes".
- **Extend, do not duplicate.** The text layer is `text.note`. Per-side
  borders and stroke alignment are style fields on existing rect-like types.
  Control styling extends `ui.control`. The kit is built on component frames.
  Prototype links stay `edge.generic`. Flow starts stay on the frame. The only
  new element type is `ui.icon`, because no existing type can hold a named
  vector reference (see Decision 2).
- **One implementation, two hosts.** Every operation, shape ID, element type,
  lint rule and export option is implemented in TypeScript in
  `packages/core` or `apps/cli/src`, and so runs unchanged in the Boa-hosted
  native CLI. Native Rust code changes only if a new host primitive is needed;
  none is planned. Shared code must not import Node/Bun APIs. Parity is proven
  by `apps/cli/src/native-parity/` topic tests, run by `mise run test-cli`.
- **Determinism.** New exports, lint findings, kit insertion and generated IDs
  are deterministic for the same input and CLI arguments. No timestamps or
  random values go into output files.
- **Privacy.** Tests, fixtures, examples, docs and commit messages use generic
  content only.

## Decision 1: precise text layer (D5)

1.1 **Type.** The text layer is a `text.note`. Palette and CLI shape ID
`text:layer` ("Text layer") creates `text.note` with these defaults:

- `visual.textPadding: 0`, `visual.textResize: "auto-width"`,
  `visual.textMeasure: "proportional"`;
- style `fontFamily` = `APP_FONT_STACK`, `fontSize: 17`, `fontWeight: 400`,
  `lineHeight: 1.29`, `color: "#000000"`, `textAlign: "start"`,
  `verticalAlign: "top"`.

Inside controls, the same layout functions draw control labels (Decision 4).

1.2 **New visual fields.**

- `visual.textMeasure?: "proportional"`. Omitted keeps the legacy 0.55 em
  estimate, so existing notes do not reflow. `proportional` measures with a
  committed advance-width table for U+0020-U+00FF in two weight buckets:
  regular (`fontWeight` < 600) and bold (>= 600). The values come from Liberation
  Sans 2.x (SIL OFL 1.1), which is metric-compatible with Arial/Helvetica.
  Attribution goes in `THIRD_PARTY_NOTICES.md`. East Asian Wide/Fullwidth
  graphemes measure 1.0 em (`wide-text-width.ts`); everything else 0.55 em.
  `letterSpacing` is added per grapheme. One measure function serves auto-width
  sizing, wrapping, truncation, the SVG line breaks and the app lint.
- `visual.textTruncate?: "ellipsis"`. Text renders on one line. Explicit
  newlines are joined with a space. If the measured width exceeds the content
  width, graphemes are removed from the end and `…` (U+2026) is appended.
  `auto-width` never truncates. With `textTruncate`, `auto-height` behaves as
  fixed height one line.

1.3 **Sizing.** `fixed`, `auto-width` and `auto-height` keep their meaning. With
`textMeasure: "proportional"`, auto sizes use the proportional measure.
Horizontal alignment uses `textAlign` start/middle/end; the CLI also accepts
`left`/`center`/`right` and normalizes them. Vertical alignment uses
`verticalAlign`. The other style fields — `fontSize`, `fontWeight`,
`lineHeight`, `letterSpacing`, `color`, `fontStyle` and `textDecoration` —
already exist and are honored by the SVG and canvas renderers.

1.4 **`APP_FONT_STACK`.** The value is
`-apple-system, "SF Pro Text", "SF Pro", system-ui, "Helvetica Neue", Helvetica, Arial, sans-serif`.
The canvas (WebKit on macOS) resolves it to the system UI font. resvg resolves
the first family loaded by the render profile. The plan must record which
family each host resolves on macOS and Linux (font-coverage evidence). The
stack is used only by `text:layer`, the iOS kit and controls whose
`fontFamily` is unset when they are created from the kit. The theme default
stack does not change.

1.5 **Fix D5, update honored.** A CLI `update` or `add` that sets any
typography field (`TYPOGRAPHY_FIELDS` in `text-styles.ts`) on an element with
`visual.textStyle` removes that link in the same operation. It prints the
warning `detached text style <id> from <element>` (suppressed by `--quiet`).
This mirrors the existing `withBoxLabelAlign` unlink and the desktop behavior
of editing a linked field. Regression tests cover:

- update of `fontSize`/`fontWeight` on a plain note;
- the same update on a linked note;
- the rendered SVG `font-size` / `font-weight` attributes.

1.6 **Fix D5, geo label inset.** `shape.geo` labels honor `visual.textPadding`
(horizontal and vertical inset). When it is omitted, the legacy 8-unit inset
stays. `boxLabelLayout`, `centredLabel` and the canvas label style read the same
value.

## Decision 2: icon element (D6)

2.1 **Icon set.** Lucide (ISC license), pinned to one release.

- A dev-time script `scripts/vendor-lucide.ts` reads the pinned `lucide-static`
  devDependency. It writes `packages/core/src/icons/lucide-data.generated.ts`:
  one exported JSON string of `{name, tags, nodes}` records, where nodes are
  compact SVG element tuples. The generated file is committed.
- The license is committed as `packages/core/src/icons/LICENSE-lucide.txt` and
  listed in a new root `THIRD_PARTY_NOTICES.md`.
- The string is `JSON.parse`d lazily on the first icon lookup, so commands that
  draw no icon pay only the string-literal parse.
- The plan records the size of `diagram.js` and of the desktop bundle before and
  after. `mise run test-cli` parity/MCP deadlines must still pass. If they
  fail, apply the user-QA Q3 fallback (curated subset).

2.2 **Element type `ui.icon`** (category `node`). Semantic:

- `icon?: string`: a Lucide name, optionally prefixed `lucide:`.
- `path?: string`: custom SVG path data, at most 8 KiB.
- `viewBox?: number`: a positive number, default 24.

Exactly one of `icon` / `path` is required. Rendering:

- The icon is scaled from a `viewBox` square into the element box.
- `style.stroke` is the color (default `#000000`).
- `style.strokeWidth` is in viewBox units (default 2, as in Lucide).
- `style.fill` defaults to `none`; custom paths may set it.
- Line caps and joins are round.

Default size 24×24. An unknown name gives the validation warning
`icon.unknown` and renders a dashed placeholder square, never a font glyph.

2.3 **Why a new type.**

- `draw.path` stores page-space contours and has no name lookup.
- `image.raster` is a raster attachment.
- `ui.control` is an interactive control with a required label.

A named, recolorable vector symbol is none of these.

2.4 **Lookup.**

- `nodetto-cli shapes icon <query>` lists matching names. It matches name
  prefix first, then name substring, then tag; ties sort alphabetically; at most
  50 results unless `--all`.
- `nodetto-cli shapes icon:<name>` shows the add operation.
- Shape ID `icon:<name>` creates a `ui.icon`, both in `draw`/`add` and from the
  desktop palette.
- A plain `shapes` listing shows one `icon:<name>` entry that points to
  `shapes icon <query>`, instead of every icon.

The desktop palette gets an **Icon** tool in the app and web workspaces. It
opens a searchable icon grid that uses the same lookup function. The inspector
edits name, size, color and stroke width. Icons are also used by controls
(Decision 4) and the kit (Decision 5).

## Decision 3: thin dividers, per-side borders, stroke alignment (D4)

3.1 **Fix D4.** The legacy 1-unit inset in `rectOutline` applies only when both
width and height are >= 3. Below that, the rect is drawn at its exact box,
so any height or width > 0 renders. The rule is shared by the SVG and canvas
renderers through `geoOutline`. Kit dividers and `shape.geo` rects created by
`divider` sugar use `cornerRadius: 0`. Regression tests cover:

- SVG rect geometry for heights 0.5, 1, 2 and 2.9;
- the PNG pixel row of a 1-unit divider at scale 2;
- the canvas outline.

3.2 **`style.strokeAlign?: "inside" | "center" | "outside"`** for
`shape.geo` `rect`, `frame` and `ui.control`. Omitted keeps the current
behavior. With a value, fill covers the exact box and the stroke is offset
inward, centered or outward by `strokeWidth / 2`, as in Figma.

3.3 **`style.strokeSides?: {top?, right?, bottom?, left?}`** (numbers >= 0) on
the same types.

- Each listed side draws a border of that width in `style.stroke`.
- Unlisted sides use 0 when `strokeSides` is present.
- Borders are filled strips aligned by `strokeAlign` (default inside), clipped
  to the shape's rounded outline. A thick left accent border on a rounded card
  therefore follows the corner.
- When `strokeSides` is present, the uniform stroke is not drawn.

## Decision 4: styleable controls, tabs and badges (D1, D2, D3)

4.1 **Fix D1.** Every `ui.control` kind with a label or value honors
`style.textAlign` and `visual.textPadding`. Defaults:

- button: middle, padding 12;
- input/select/textarea: start, padding 10;
- checkbox/radio/switch: the label beside the glyph, unchanged.

SVG, canvas (`text-align` and `justify-content` on the control element) and the
HTML handoff use the same computed anchor.

4.2 **Style honored by all kinds:**

- `fill`, `stroke`, `strokeWidth`, `cornerRadius` / `cornerRadii`;
- `color`, `fontFamily`, `fontSize`, `fontWeight`, `letterSpacing`;
- `strokeAlign` and `strokeSides` (Decision 3).

Two style fields are new:

- `style.accentColor?`: selected tab indicator, progress bar, checked
  checkbox/radio/switch fill. The default is the legacy `#137e7e`.
- `style.selectedColor?`: selected tab label color. The default is
  `accentColor` for the underline indicator and `color` for cell and pill.

The legacy hard-coded tab background `#f1f5f9` and selected cell `#d6ecef` stay
the defaults only when `fill` / `accentColor` are unset. This fixes D2 in the
SVG, canvas and HTML.

4.3 **Tabs indicator.** `semantic.indicator?: "cell" | "underline" | "pill"`.
The default is `cell`, the legacy look.

- `underline`: a 2-unit bar in `accentColor` under the selected option. Labels
  are in `color` / `selectedColor`. No cell fill.
- `pill`: a rounded rect in `accentColor` behind the selected option.

4.4 **Fix D3.** Labels are split on `\n` and drawn as one `<text>` per line. The
lines are vertically centered as a block and use the control's font family.
When `fontFamily` is unset, that is the theme stack — no monospace path.
`visual.textTruncate: "ellipsis"` truncates single-line labels (Decision 1).
The plan first reproduces the monospace symptom with a 0.8.9 document. The
regression test asserts:

- the line count;
- no `monospace` / `Menlo` family in the SVG;
- PNG font coverage reporting no fallback.

4.5 **Icons and badges on controls.**

- `semantic.leadingIcon?` and `semantic.trailingIcon?` take Lucide names.
- `semantic.iconSize?` defaults to 20.
- `semantic.badge?: string`. An empty string draws a dot. Otherwise it draws a
  count capsule at the top-right in `accentColor` with white text.

The icons sit inside the padding, and the label area shrinks accordingly.

4.6 **Per-option editing.** `ui.control` tabs keep `options: string[]` and are
styled as a whole. Individually movable or overridable options are provided by
the kit's top tab strip and segmented control (Decision 5): auto-layout frames
with one child per option.

## Decision 5: iOS component kit

5.1 **Definitions.** Kit components are generated in code
(`packages/core/src/kits/ios/`) as `frame` component definitions:

- `component: true`, with a new optional `semantic.kit: "ios:<name>@1"`;
- children carry `visual.componentKey`;
- auto layout is set where the component stacks content.

Colors are generic Apple HIG system colors (label `#000000`, secondary label
`#3c3c43` at 60%, separator `#3c3c43` at 29%, tint `#007aff`, grouped
background `#f2f2f7`). They are overridable. Text uses `APP_FONT_STACK`.

5.2 **Insertion.** Shape ID `ios:<name>` in the palette (**iOS kit** group in
the app workspace), `draw` and `add`:

1. Look for a definition with the same `kit` in the document.
2. If there is none, create it on a page named `iOS kit` (kind `freeform`, mode
   `app`, created once). Definitions are stacked in a column at x = 0 with
   40-unit gaps, in kit order.
3. Create an instance through the existing `planComponentInstance` at the
   target position.
4. Apply properties.

Full-width components get the parent's width when inserted with a parent and
no width: status bar, home indicator, nav bar, tab bar, top tabs, search field,
list row, section header and composer.

5.3 **Properties.** Each kit component declares typed properties (`text`,
`icon`, `color`, `boolean`, `enum`, `integer`). Each property maps to a
`(componentKey, field)` target: text, icon name, style color or `visual.hidden`.

- Setting a property writes that field on the instance's bound child, so the
  existing override inference records it as an override that survives
  component refresh.
- `nodetto-cli shapes ios:<name>` prints the properties with types and
  defaults.
- CLI `add` / `update` accept `props: {...}`. On `update`, `props` works only on
  kit instances; elsewhere it is an operation error.
- The desktop edits overrides by selecting the child layers, as for any
  component instance.

5.4 **Variable item counts.** Item counts use slots. The tab bar, top tab strip
and segmented control have 5 slots. `count` (2-5) hides the surplus slots, and
auto layout skips hidden children. The CLI sugar
`props.items: [{label, icon?, badge?}]` fills the slots and sets `count`.
`props.active` is the selected index.

5.5 **Components** (shape IDs, sizes in points):

| Shape ID | Size | Properties |
| --- | --- | --- |
| `ios:status-bar` | 390×47 | `time`, `style` (dark/light) |
| `ios:home-indicator` | 390×34 | `style` |
| `ios:nav-bar` | 390×44 | `title`, `back` (boolean), `backLabel`, `trailingIcon`, `large` (boolean, 96 high) |
| `ios:tab-bar` | 390×83 (49 + 34) | `items`, `active`, `activeColor`, `inactiveColor` |
| `ios:top-tabs` | 390×44 | `items`, `active`, `activeColor` (underline) |
| `ios:segmented` | 358×32 | `items`, `active` (pill) |
| `ios:search-field` | 358×36 | `placeholder`, `value` |
| `ios:list-row` | 390×44 (60 with subtitle) | `title`, `subtitle`, `leadingIcon`, `accessory` (chevron/value/switch/none), `value`, `divider` |
| `ios:section-header` | 390×38 | `title` |
| `ios:chip` | hug×32 | `label`, `selected`, `leadingIcon` |
| `ios:fab` | 56×56 | `icon`, `color` |
| `ios:icon-button` | 44×44 | `icon` |
| `ios:text-field` | 358×44 | `placeholder`, `value` |
| `ios:composer` | 390×52 | `placeholder`, `sendIcon` |
| `ios:card` | 358×hug | `title`, `body`, `accentSide` (none/left), `accentColor` |
| `ios:badge` | hug×20 | `count` |

All kit components are generic. Hotspot-sized parts (icon buttons, rows, tab
items) are at least 44 points in both dimensions.

## Decision 6: frames, auto-parenting, safe area, presets, titles (D7, D10)

6.1 **Membership stays `memberIds`; no parent field.** This keeps every
existing document valid and reuses `frame-tree.ts`, carry-on-move,
`carryMembers` and paste.

6.2 **Auto-parenting.** A shared core function picks the parent of an inserted
element (`planInsertionParent`):

- an explicit parent, if one is given;
- otherwise the smallest top-level-or-nested frame that fully contains the new
  element's box, on the same page, excluding component definitions on other
  pages.

If that frame has `memberIds`, the element id is appended, or inserted at
`memberIndex`. If it uses geometric membership, nothing is written: the element
is added above the frame and is already its child.

The function is used by:

- CLI `add`, `draw` and kit insertion;
- desktop creation tools;
- desktop drag-end when the drop target frame has explicit `memberIds`.

The plan checks desktop behavior first and fills only the gap.

6.3 **CLI `parent`.**

- `add` accepts `parent` (id, prefix, `@ref` or `name:`) and `memberIndex`.
- `update` accepts `parent` to reparent through the existing `planReparent`.
- When an operation names `parent`, its `visual.x` / `visual.y` are relative to
  that parent's top-left corner. This is the only coordinate rule change, and
  it is stated in help.
- Without x/y, a child of a non-layout frame is placed at the frame's safe-area
  top-left. A child of a layout frame is placed by the layout.
- `inspect` shows parent-relative coordinates for frame children, as
  `rel x,y`, alongside page coordinates.

6.4 **Clip and safe area.** These already exist (`clipContent`, `safeArea`,
snapping to safe area). iPhone presets and kit screens default to
`clipContent: true`. The CLI `snap` operation (Decision 7) can snap to the safe
area.

6.5 **Device presets.** `FRAME_PRESETS` and frame shape IDs:

| Shape ID | Size | Safe area (top, bottom) |
| --- | --- | --- |
| `frame:iphone` (unchanged) | 390×844 | 47, 34 |
| `frame:iphone-393x852` | 393×852 | 59, 34 |
| `frame:iphone-402x874` | 402×874 | 62, 34 |
| `frame:iphone-430x932` | 430×932 | 59, 34 |
| `frame:iphone-440x956` | 440×956 | 62, 34 |
| `frame:iphone-375x667` | 375×667 | 20, 0 |

They are named by size, not model, so names do not go stale. The desktop iPhone
tool offers them in a size menu.

6.6 **Fix D10, title placement.** New `semantic.titlePlacement?: "inside" |
"outside"`.

- When omitted, frames with `platform` or `screenKind` (device and screen
  artboards) resolve to `outside`. All other frames keep `inside`, so
  diagram containers and `arrange-layered` are unchanged.
- An `outside` title is drawn 6 units above the frame's top edge, 12-unit text,
  in the canvas and in page SVG/PNG/PDF export. The page bounds include it.
- An outside title is never drawn inside the artboard, and is omitted from
  `--element`, `--frames` and HTML/prototype exports.
- Canvas selection by title uses the band above the frame.

## Decision 7: CLI auto layout, align, distribute, snap (D8)

7.1 **`layout` operation.**

`{"op":"layout","id":<frame>,"direction":"vertical"|"horizontal","gap":n,"padding":n|[t,r,b,l],"align":"start"|"center"|"end"|"stretch","justify":"start"|"center"|"end"|"space-between","width":"fixed"|"hug","height":"fixed"|"hug","wrap":bool,"crossGap":n}`

- The operation writes `semantic.layout`.
- If the frame has no `memberIds`, it attaches the current geometric children,
  ordered by position: y then x for vertical, x then y for horizontal.
- `"layout": null`, written as `{"op":"layout","id":...,"remove":true}`,
  removes the layout and keeps membership.
- Layout then runs in the same transaction, as it already does.

7.2 **Child sizing sugar on `add` / `update`.**
`sizing: {width?: "fixed"|"hug"|"fill", height?: ...}` maps as follows:

- main-axis `fill` → `layoutGrow: 1`;
- cross-axis `fill` → allowed only when the parent's `align` is `stretch`,
  otherwise an operation error naming the fix;
- `hug` on `text.note` → `textResize` auto-width / auto-height;
- `hug` on a frame → layout `widthSizing` / `heightSizing: "hug"`;
- `fixed` → clears grow and hug.

`absolute: true` maps to `layoutPosition: "absolute"`.

7.3 **`align` operation.**

`{"op":"align","ids":[...]|"where":{...},"edge":"left"|"hcenter"|"right"|"top"|"vcenter"|"bottom","to":"selection"|"parent"|"safe-area"|<ref>}`

It uses `planAlign`. With `to` other than `selection`, each target is aligned
to the box of that reference. Children in an auto-layout flow are skipped, with
a warning.

7.4 **`distribute` operation.**

`{"op":"distribute","ids":[...]|"where":{...},"axis":"horizontal"|"vertical","gap"?:n}`

- Without `gap`, it spaces the elements equally between the outermost ones
  (`planDistribute`).
- With `gap`, it stacks them from the first element in position order with
  that fixed gap.

7.5 **`snap` operation.**

`{"op":"snap","ids"|"where"|"page":...,"grid":1|2|4|8}`

It rounds x, y, width and height relative to the parent frame origin, or the
page origin. Flow children are skipped.

7.6 **Desktop snap grid.** Snap settings offer a grid size of 4, 8 or 24. The
default is 8 in the app and web workspaces and 24 elsewhere. Frame layout grids
still take precedence.

All four operations are listed in `OPERATION_FIELDS` with unknown-field
checks, `help edit`, `docs/cli.md` and parity tests.

## Decision 8: prototyping, view toggle, flows, storyboard, presentation (D9)

8.1 **Model.**

- Prototype links stay `edge.generic` with `prototype: true`.
- `from` is any element (the hotspot) or a whole screen frame.
- `to` is the destination frame.
- `PROTOTYPE_ACTIONS` gains `back` (return to the previous screen in history)
  and `swap-overlay` (replace the top overlay).
- Triggers stay click, hover, press and after-delay. CLI `connect` accepts
  `tap` as an alias of `click` and stores `click`.

A back link's `to` is the hotspot's own screen frame. This keeps the existing
endpoint rule, so no free endpoint is needed. CLI shape `prototype:back` needs
only `from` and fills `to`.

8.2 **Flow starts.** `prototypeStart: true` plus a new optional
`semantic.prototypeFlowName?: string`. When the name is omitted, the flow is
named after the frame. Several frames may start flows. Flow names must be
unique per document; a duplicate is a validation warning.

8.3 **Design view and prototype view.**

- Prototype links are hidden on the canvas in design view. A toolbar toggle
  **Design | Prototype** in the app and web workspaces switches views. Its key
  is Shift+E; if that key is already bound, the plan picks a free one and
  documents it. The view is UI state stored in desktop preferences, not in the
  document.
- In prototype view, each link is a cubic curve. It starts at the hotspot edge
  facing the destination and ends with an arrow at the destination frame's
  nearest vertical edge. The end y is clamped into the frame.
- Back links draw as a small `back` tag at the hotspot instead of a line.
- Flow starts draw a flag (a drawn triangle shape plus the flow name) above the
  frame.
- Labels are compact. An explicit `semantic.label` is shown alone. Otherwise
  only non-default facets are shown, joined by ` · `: action (`back`,
  `overlay`, `swap`, `close`, `variant`), trigger (`hover`, `press`,
  `after 2s`), animation (`fade`, `slide ←`, `smart`). A default tap / navigate
  / instant link has no label.

The geometry and labels are one core function (`prototypeLinkGeometry`), used
by the canvas and by export.

8.4 **Export default changes.**

- Page SVG/PNG/PDF export omits prototype links by default (design view).
- `export --prototype` draws the prototype view, including flow flags. This is
  the storyboard image.
- `--element` and `--frames` never draw links.

8.5 **Storyboard.**

- `nodetto-cli inspect <doc> --flows [--flow <name>] [--format json]` lists
  each flow, then its screens in breadth-first order from the start, each
  outgoing link (hotspot, trigger, action, destination), unreachable screens,
  and links whose hotspot or destination is hidden or missing.
- The desktop prototype view shows a **Flows** list. It selects and zooms to a
  flow's screens and starts presentation from a chosen flow.

8.6 **Desktop presentation.** Extends the existing `PrototypePreview`, in the
same window as a full-window overlay (user-QA Q4 default). It adds:

- a flow selector and restart;
- an optional generic device frame: a rounded bezel and home indicator drawn
  with CSS, no vendor artwork;
- hotspot hints: a click that hits no hotspot briefly outlines all hotspots,
  and a toggle keeps them visible;
- the existing back button and history, plus the keys Backspace / Left
  (`back`) and Escape (close the overlay, then exit).

8.7 **Persistent elements.** During a navigate transition from A to B, take
each top-level child of B that has `visual.prototypeFixed` and also matches a
fixed child of A, by `layerName` (or the kit instance's `kit`) and by bounds
within 0.5 units. It is drawn once in a static layer above the animating
screens, so a bottom tab bar does not slide. The same rule applies in the
desktop and in the HTML prototype.

8.8 **HTML prototype export.**

`nodetto-cli export <doc> --format prototype --output app.html [--page P] [--flow name] [--device none|frame]`

The output is one self-contained HTML file:

- each reachable screen and overlay, including screens on other pages that the
  links reach, as inline SVG from the same renderer as PNG export (title
  omitted);
- transparent hotspot buttons at link source boxes;
- persistent layers rendered separately (8.7);
- a small inline script for navigate, back, overlays, swap, after-delay, the
  transitions, hints, history and keys.

Images are data URIs. The output is deterministic, with byte-identical
TS/native parity. The desktop Export dialog gets **Prototype (HTML)**. The
existing `--format html` static export is unchanged.

## Decision 9: app-design lint

9.1 **Eligible pages.** Pages whose `mode` is `app` or `web`, and any page
containing a frame with `platform` `ios`/`android`/`web` or a `screenKind`
("screens"). The rules run from `nodetto-cli lint` with the other rules, with
the same text/JSON output and `--page`.

These are excluded from every rule:

- component definition frames (`component: true`) and everything inside them,
  so the generated `iOS kit` page is clean;
- hidden elements: an element with `visual.hidden`, or one under a hidden
  ancestor.

**Instance content.** A component instance holds real copied child elements.
Overrides are written onto those copies (Decision 5.3), so the current values
of the copies are the rendered, override-resolved values. The rules read those
current values; there is no separate resolution step.

Instance descendants are checked per rule:

| Rule | Instance descendants |
| --- | --- |
| `app-text-overflow`, `app-text-truncated` | Checked: every visible text-bearing descendant, including `ui.control` labels, at any nesting depth. |
| `app-touch-target` | Checked: every visible interactive descendant (see 9.2). Exception: a descendant with no prototype link of its own is skipped when its nearest interactive ancestor, up to the screen, meets the minimum. Its taps go to that ancestor. A descendant that is itself a link source (`from`) is always checked. |
| `app-control-overlap` | Checked among interactive siblings inside the same instance, as on a screen. |
| `app-off-frame` | Checked: a visible descendant extending beyond its instance frame when that frame neither clips nor scrolls (for example, overridden auto-width text). |
| `app-off-grid`, `app-misaligned` | Checked only for descendants whose geometry differs from the instance baseline (existing override inference, `component-overrides.ts`). Other descendants take their geometry from the definition and its layout, and are skipped. |

**Context and deduplication.**

- Each finding names the element that fails. It is never reported again on its
  instance or screen.
- There is at most one finding per (rule, element) pair. An element reached
  through nested instances is visited once.
- A finding on an instance descendant names its nearest enclosing instance (by
  layer name and `kit`, if set) and its screen frame:
  - text: `... (in instance "Row" ios:list-row@1, screen "Home")`;
  - JSON: an optional `context: {screenId, instanceId?}` on the finding. The
    other JSON fields are unchanged.

`app-off-grid` also ignores dimensions derived by auto sizing: `textResize`
auto dimensions and hug frame dimensions.

9.2 **Rules.** All are severity `warning`.

| Rule | Reports |
| --- | --- |
| `app-off-frame` | on app/web-mode pages, an element (not a prototype link) outside every screen; or any element extending beyond its parent frame when that frame neither clips nor scrolls (`prototypeOverflow` none) |
| `app-text-overflow` | text (`text.note`, control labels, geo labels) whose wrapped lines exceed the box height, or whose single line exceeds the width, by the element's measure |
| `app-text-truncated` | text actually shortened by `textTruncate: "ellipsis"` |
| `app-control-overlap` | two interactive elements with the same parent that overlap with positive area, neither containing the other. Interactive means `ui.control` (not progress), prototype hotspots, and kit instances of rows, buttons, chips, tab items and fields |
| `app-off-grid` | a non-flow element whose parent-relative x, y, width or height is not a multiple of the parent frame's square layout-grid size, or of 1 point when there is none (catches fractional drift) |
| `app-misaligned` | siblings in a non-layout parent whose left, right, horizontal-center or top edges differ by more than 0 and at most 2 points (near-miss alignment) |
| `app-touch-target` | an interactive element smaller than 44×44 points on `ios`, or 48×48 on `android` (web skipped) |

9.3 **Desktop.** A **Design check** problems panel in the app and web
workspaces lists the same findings and selects the element on click. It
follows the existing BPMN/breadboard problems panel pattern.

## Decision 10: per-frame export and comparison (D10)

10.1 **Per-frame export.**

`nodetto-cli export <doc> --page P --frames --format png|svg --output-dir DIR [--scale s]`

- Writes one file per top-level frame on the page, named
  `NN-<slug>.<ext>`.
- NN is the 1-based two-digit index in reading order. Frames are sorted by y;
  a new row starts when a frame's y is at least the row's first y plus half its
  height; within a row, frames are sorted by x.
- The slug is the frame name lowercased, with runs of characters outside
  `[a-z0-9]` replaced by `-`, at most 48 characters, or `frame` when empty.
- Each file equals `--element <frame>` output.
- `--frames` conflicts with `--element` and `--output`.
- The desktop Export dialog gets **All artboards → PNG/SVG**, saved as one ZIP
  (no new filesystem capability).

10.2 **Comparison helper, CLI and desktop.** Both hosts use one shared core
module, `packages/core/src/compare-images.ts`. It provides:

- `pngInfo(bytes)`: checks the PNG signature and reads width and height from
  the IHDR chunk;
- `pairByLeadingNumber(names)`: pairs files by their leading number;
- `parseBand`;
- `composeComparisonSvg({reference, actual, scale, bands, grid, labels})`.
  `reference` and `actual` are PNG bytes. The function returns an SVG with
  three labelled panels.

The rules below apply to both hosts unless a bullet names one.

`nodetto-cli compare <actual> <reference> --output <png|dir> [--scale 2] [--band y0:y1:dy]... [--grid n]`

- **Inputs.** Arguments are two PNG files or two directories. Directories pair
  files by their leading number; an unmatched or duplicate number is an error.
- **Output.** For each pair the tool writes one PNG with three labelled panels:
  reference, nodetto, and difference (the actual drawn over the reference with
  `mix-blend-mode: difference`).
- **Composition.** Panels are composed as SVG with the two PNGs embedded as data
  URIs, then rasterized by the existing PNG path. Image sizes come from the PNG
  IHDR bytes, so no pixel decoding is needed in JS and no Rust change is
  needed.
- **Bands.** `--band y0:y1:dy`, in reference points and repeatable, compares
  reference rows y0..y1 with the actual shifted by dy. This handles system bars
  added above and below the content. Default: one band, full height, dy 0.
- **Grid.** `--grid n` draws an n-point grid over the difference panel to read
  drift.
- **Size mismatch.** Panels use the reference pixel size. If the actual image's
  size differs, it is scaled uniformly to the reference width, and stdout
  prints a `warning:` with both sizes.
- stdout lists each pair and output path.

10.3 **Desktop comparison.**

- **Entry point.** **Compare with reference...** opens from the Export dialog
  and the artboard context menu, in the app and web workspaces.
- **Inputs.**
  - Actual: the selected artboard, or **All artboards** on the page. Each is
    rendered with `exportArtboardSvg` and rasterized at the chosen scale
    (default 2) by the existing `rasterizeSvg`. The bytes are the same as the
    desktop's per-frame PNG export.
  - Reference: one PNG chosen with a file input (`accept="image/png"`), or
    several when comparing all artboards. The bytes are held in memory only.
    They are not added to the document, not saved as attachments, and not put
    on the undo stack. Each file is limited to 16 MiB.
  - Options: scale, an optional grid size, and band rows (y0, y1, dy), as in
    the CLI.
- **Pairing.** All artboards are paired with the references by number. An
  artboard's number is its two-digit reading-order index from 10.1; a
  reference's number is the leading number of its file name.
- **Data flow.** The PNG bytes go to `composeComparisonSvg`. The resulting SVG
  is shown in the dialog, scaled to fit, one pair at a time with
  previous/next. **Save PNG** rasterizes that SVG with `rasterizeSvg` and saves
  it through the existing raster export save path. With several pairs, it
  saves one ZIP of `NN-compare.png` files.
- **Errors.** The dialog shows the error inline, and nothing is saved or
  changed, when:
  - a file is not a PNG, or its signature or IHDR is invalid;
  - a file exceeds 16 MiB, or the raster dimension limits (`rasterDimensions`);
  - an artboard or reference number is unmatched or duplicated;
  - a band is invalid;
  - no artboard is selected.

  A size mismatch shows the same warning text as the CLI and still composes.
- **Panels.** For the same PNG inputs and options, the desktop SVG equals the
  CLI's composed SVG. Only the rasterizer differs (browser canvas versus
  resvg).

## Help, docs and examples

- `apps/cli/src/help.ts` documents everything above:
  - `add` `parent` / `memberIndex` / `props` / `sizing` / `absolute`;
  - the `layout`, `align`, `distribute` and `snap` operations;
  - the `text:layer`, `icon:<name>`, `ios:<name>`, `prototype:back` and frame
    preset shape IDs;
  - `shapes icon`;
  - `inspect --flows`;
  - `export --frames`, `--prototype` and `--format prototype`;
  - `compare`;
  - the app lint rules.

  MCP descriptions reuse it.
- `docs/cli.md` gets "Designing phone apps with the CLI", a step-by-step
  recipe for agents: frame preset, kit, parent-relative layout, icons,
  prototype links, lint, per-frame export, compare. `docs/design.md` gets
  "iPhone app design" covering the palette, kit, prototype view, flows,
  presentation, Design check, per-artboard export and **Compare with
  reference...**.
- `design-docs/specs/design-cli-ai-drawing.md` and
  `design-web-app-roundtrip.md` get one cross-reference line each.
- New generic sample `examples/design/iphone-kit/`:
  - Content: a fictional garden-journal app with four screens (list with
    search, detail with segmented control and chips, settings with switches,
    and an add-entry bottom sheet), tab bar navigation, row → detail, back, an
    overlay and one flow start.
  - Files: `build.ops.json` (CLI operations only), `design.jsonl`, `screens/`
    from `export --frames`, `storyboard.png` from `export --prototype`,
    `prototype.html`, and `README.md`.
  - A test applies `build.ops.json` to an empty document. The result must equal
    `design.jsonl` byte for byte, pass `validate`, and give zero app-lint
    findings. A native parity test repeats this.
  - `examples/design/README.md` lists the sample.

## Reproduction (item 11) support

The reproduction is operator verification work, not shipped behavior. Its
document and images live only under the git-ignored `tmp/` directories named in
the request.

- It is built only with `nodetto-cli edit` / `draw` operation files: one app
  page; one 390×844 `frame:iphone` per screen; kit status bar and home
  indicator; icons; text layers; prototype links for tabs, list → detail,
  detail tabs, back, search → results, more → settings; and one named flow
  start.
- It must pass `validate` and the app lint with zero findings.
- It is exported with `--frames --scale 2` and compared with `compare --scale 2`
  and the default bands from user-QA Q1.
- The integration review inspects every comparison image. Each remaining
  visible difference becomes a finding to fix: drift over 4 points, wrong icon,
  wrong color, wrong weight, or a missing element.
- Generic regression fixtures for every defect are written from scratch, never
  derived from the private material.

## Accepted output changes

| Change | Affects |
| --- | --- |
| Device/screen frame titles move above the artboard (6.6) | page exports and canvas of documents with platform/screen frames, including `examples/design/*` previews (regenerated) |
| Page SVG/PNG/PDF export omits prototype links unless `--prototype` (8.4) | documents with prototype links |
| Geo rects under 3 units render at their exact box (3.1) | only previously invisible or sub-unit rects |
| Prototype link labels become compact (8.3) | canvas only, prototype view |

Everything else is gated on new optional fields. Existing golden fixtures must
stay byte-identical, except the regenerated `examples/design` previews and any
golden fixture whose change is one of the rows above, each listed in the plan.

## Verification

- **Baseline unit first.** Run `CARGO_TERM_QUIET=true mise run verify`,
  `CARGO_TERM_QUIET=true mise run test-cli` and
  `CARGO_TERM_QUIET=true mise run build-cli` at f59bef4 with full logs. Record
  the exit codes, pass/skip/fail counts and failing test names. Later gates
  require "no new failures" with the excludes listed explicitly.
- **Per-decision regression tests**, in bun and in native parity topic files
  split by area: text, shapes, controls, icons, frames, layout operations, kit,
  prototype, lint, export/compare.
  - D1: anchor and x per `textAlign`.
  - D2: tab colors from style and `accentColor`; the indicator variants.
  - D3: multi-line label with no monospace.
  - D4: thin rect geometry and PNG row.
  - D5: update honored, with and without a linked style; geo `textPadding`.
  - D6: icon render, unknown-icon placeholder, `shapes icon` search.
  - D7: `add` inside a `memberIds` frame joins it; `parent`-relative
    coordinates; desktop drop.
  - D8: `layout` / `sizing` / `align` / `distribute` / `snap` results.
  - D9: links hidden in the default export; prototype-view geometry and compact
    labels; `inspect --flows`; HTML prototype contents.
  - D10: outside title position and exclusion from element export; `--frames`
    naming and order; `compare` output size and panels.
  - Comparison core (`compare-images.ts`): `pngInfo` with valid, invalid and
    truncated input; pairing with matched, unmatched and duplicate numbers;
    band parsing; a fixed `composeComparisonSvg` output for given inputs.
  - Desktop comparison (ui-solid tests):
    - the dialog builds the same SVG as the CLI for the same inputs;
    - the error cases in 10.3 show inline errors and save nothing;
    - All-artboards pairing follows the reading-order numbers;
    - the document and undo stack are unchanged after a comparison.
  - App lint on instances:
    - An iOS screen holds an instance with a fixed 80×44 `ui.control` child
      whose overridden label is 100 `W` characters, and a 24×24 child that is a
      prototype link source. Expected: exactly one `app-text-overflow` on the
      control and one `app-touch-target` on the 24×24 child, each with
      instance and screen context.
    - Every `ios:<name>` kit component, inserted with default properties into a
      screen, gives zero findings.
    - A hidden instance child, and the `iOS kit` definitions page, give zero
      findings.
    - A nested instance is reported once.
    - Native parity covers these cases.
- **Commands:** `bun run typecheck`, focused `bun test` for `packages/ir`,
  `packages/core`, `packages/ui-solid`, `apps/cli`;
  `CARGO_TERM_QUIET=true mise run test-cli`;
  `CARGO_TERM_QUIET=true mise run build-cli`;
  `CARGO_TERM_QUIET=true mise run verify`. Rust is touched only if a plan
  proves it necessary; then run `cargo fmt` and clippy.
- **Visual evidence (mandatory).**
  - Export at `--scale 2` with the built native CLI and with bun, and inspect:
    - every kit component;
    - the D1-D4 fixtures;
    - an icon sheet;
    - the sample's screens, storyboard and prototype HTML (opened in a
      browser).
  - Desktop comparison: for one sample artboard and its exported PNG used as
    the reference, save the comparison PNG from the desktop dialog and from
    `nodetto-cli compare`. Inspect both. The difference panel should be
    near-black, and the panel layout should match.
  - Then do the reproduction comparison above.

## Implementation partition guidance

The source-file and changed-line split limits apply to each unit. Suggested
units:

- baseline;
- IR schema additions (all new fields and the type, validation, key order);
- text layer and metrics plus the D5 update fix;
- geo thin rects, `strokeAlign` and `strokeSides`;
- `ui.control` rendering (D1-D3, icons, badges) in SVG, canvas and HTML;
- icon vendoring and the `ui.icon` element plus `shapes icon` and the palette
  picker;
- frames: auto-parenting, `parent`, presets, title placement;
- CLI layout, sizing, align, distribute, snap, and the desktop grid size;
- kit mechanism (definitions page, properties, insertion);
- kit components;
- prototype model and view (core, CLI, `inspect --flows`, export
  `--prototype`);
- desktop prototype view, flows and presentation;
- HTML prototype export;
- app lint (core, CLI, desktop panel);
- `--frames`, the shared `compare-images.ts` and CLI `compare`;
- desktop per-artboard ZIP export and the comparison dialog (after the shared
  comparison module);
- docs, help and the sample;
- native parity per area;
- the reproduction (tmp only);
- finish and archive.

The IR unit lands first because every other unit reads its fields.

# Slide links and animated slide transitions (Phase 1)

Status: design for implementation. It extends
`design-docs/specs/design-presentation.md` and
`design-docs/specs/design-slide-area-copy-shapes.md`, which stay the
baseline for the slideshow, the slide rect and Copy shapes from page.
Everything there still holds unless this document changes it. Scope: the
public `nodetto-app` repository only (`packages/ir`, `packages/io`,
`packages/collab`, `packages/core`, `packages/ui-solid`, `docs/`,
`README.md`). No server, auth or deployment code. No Rust change.

Owner decisions with a default already applied are in
`design-docs/user-qa/slide-link-animation.md`.

Phase 2 (per-slide transition settings and per-shape animation settings)
is specified in `design-docs/specs/design-slide-transition-settings.md`.
All Phase 2 settings, including the per-slide ones
(`visual.animation.slide` on one artwork-free `presentation.slide`
resource element per page), live in `Element.visual.animation`. They are
written with `createElement`, `updateVisual` / `replaceVisual` and
`deleteElements`. The Worker rejects new `updatePage` keys (user-qa Q7).
The Phase 2 change to `packages/core/src/commands.ts` is limited to
validation wiring (Phase 2 section 3.3), so the section 9 "empty diff"
check below applies to Phase 1 only. There is no `Page` field and no
`Command` change. Where Phase 2 differs from this document, Phase 2 wins.

## 1. Goals and non-goals

Goals:

1. An optional `linkId` string on elements. Copies of one shape on several
   pages are separate elements (each with its own id) that share a `linkId`.
2. Duplicate page and Copy shapes from page give every copy a `linkId`, in
   the same undo step.
3. In presentation mode, moving to the next or previous slide animates the
   difference: linked shapes move/resize/rotate/restyle in place, new shapes
   draw on, new connectors grow, new text and images fade in, removed shapes
   fade out.
4. Inspector: "Linked on N pages", Unlink, and "Apply to linked shapes".

Non-goals (later phases): morphing between different element types,
glyph-outline text writing, per-shape animation settings, in-slide build
steps, video export, LaTeX/math, a document-level duration setting, a CLI
command, animated jumps (goto/first/last).

Hard constraint: no new `Command` kind and no change to the `Command` union
(`packages/core/src/commands.ts`). The private sync Worker switches
exhaustively over it. Everything below uses `createElement`, `updateVisual`
and `replaceVisual`.

## 2. Data model: `Visual.linkId`

### 2.1 Placement (decision)

`linkId` lives in `Element.visual`, directly after `componentKey`:

```text
/** Shared by copies of one shape on several pages; drives slide transitions. */
readonly linkId?: string;
```

Why `visual` and not the top level of `Element`:

- It is presentation metadata of the same nature as `componentKey` (which
  already drives prototype smart animate) and `layerName`.
- `updateVisual` / `replaceVisual` already edit and invert it exactly, so no
  command changes are needed. A top-level field would need a new command or
  a change to `Command`, which is forbidden.
- JSONL and the Yjs binding already carry `visual` generically: the JSONL
  canonical form orders visual keys by `packages/ir/src/keyOrder.ts`, and
  `packages/collab/src/ydoc.ts` writes and reads `visual` as one map
  (`toY({...element.visual, ...})` / `elementFromY`). Neither needs code
  changes.

The name is always `linkId`. It is never called "group id": groups are a
different feature (`packages/core/src/group.ts`).

### 2.2 IR, validation and key order

- `packages/ir/src/types.ts`: add the field above to `Visual`.
- `packages/ir/src/validate.ts`: next to the `componentKey` check,
  `checkString(out, raw["linkId"], `${path}.linkId`, { optional: true })`.
  A non-string is `type.string`, an empty string is `value.empty`. There is
  no other format rule.
- `packages/ir/src/keyOrder.ts`: insert `"linkId"` right after
  `"componentKey"` in the visual key list.
- No schema-version bump and no migration.

### 2.3 Round trip

- A document without `linkId` produces exactly the same bytes as before:
  no reader, serializer or binding ever adds, empties or normalizes the key.
- A document with `linkId` round-trips through JSONL (parse, serialize) and
  through the Yjs binding (`elementToY`-style write, `elementFromY` read)
  with the value unchanged.
- Older builds see `visual.linkId` as an unknown visual field
  (`field.unknown` warning) and preserve it, the existing forward-compat
  path.

## 3. Assigning links: cross-page copies only

### 3.1 Paste never carries a link (`packages/core/src/clipboard.ts`)

- `planPaste` drops `linkId` from every created element's `visual` by
  default. This one rule covers every path built on it: same-page paste,
  paste on another page through the clipboard, duplicate (Cmd+D), component
  instances (`packages/core/src/editor/components.ts`) and cross-document
  paste.
- `PasteOptions` gains `readonly linkIds?: ReadonlyMap<ElementId, string>`,
  keyed by payload (source) element id. When present, a created element whose
  source id is in the map gets `visual.linkId` set to the mapped value. No
  other caller passes it.
- `copyElements` is unchanged; the payload snapshot may contain `linkId`.
- The implementer must grep for other paths that create an element from an
  existing element's `visual` (for example drag-duplicate in
  `packages/core/src/editor/transform.ts` or `paste.ts`). Each one must also
  drop `linkId`. If a path does not go through `planPaste`, it is fixed in
  place and listed in the plan.

### 3.2 Cross-page copies (`packages/core/src/editor/pages.ts`)

`planPageElementsCopy(editor, idSource, fromPageId, toPageId)` (used by
`planDuplicatePage` and by the facade `copyPageElements`, and therefore also
by `nodetto-cli pages copy-shapes`):

1. Build `copyElements` as today.
2. For each payload element: `link = source.visual.linkId ?? source.id`.
3. For each source element with no `linkId`, emit
   `{ type: "updateVisual", id: source.id, visual: { linkId: source.id } }`.
4. Call `planPaste(payload, { ..., linkIds })`.
5. Return `PastePlan` with `commands = [...sourceUpdates, ...paste.commands]`
   and the same `ids` and `mapping`.

Properties:

- The caller already applies the whole plan in one `apply`, so source tagging
  plus copies are one undo step. Undo restores each source's `visual` exactly
  (`updateVisual` inverts to `replaceVisual` of the previous visual).
- Ports that `copyElements` adds for a selected component get links like any
  other payload element.
- Element-id consumption order of `idSource` is unchanged (the source
  updates use no new ids), so existing duplicate tests that check ids still
  hold.
- Existing assertions that a copy's `visual` equals the source's visual
  (`packages/core/src/copy-page-elements.test.ts` lines 76-77) change on
  purpose: the copy now also has `linkId`. Those tests are updated, not
  weakened: they assert equality apart from `linkId`, and assert the
  `linkId` values.

### 3.3 Ambiguity

A `linkId` that appears on more than one plannable element (section 4.2) of
the same page is ambiguous on that page and is never matched there. This is
the same rule as `smartPlan` in `packages/core/src/prototype.ts` for
`componentKey`. Copying shapes twice from page A onto page B therefore makes
those links ambiguous on B; they are shown as fade-out / draw-on.

## 4. Transition planner (`packages/core/src/presentation/`)

Pure TypeScript, no DOM, co-located tests, exported through
`packages/core/src/presentation/index.ts` (which the core barrel already
re-exports, so `packages/core/src/index.ts` does not change).

### 4.1 Contract (`slide-transition-types.ts`)

```text
interface SlideBox { x; y; width; height; rotation }   // slide-relative units
interface SlideAppearance { opacity: number; fill?: string; stroke?: string; strokeWidth?: number }
type SlideStepKind = "transform" | "crossfade" | "draw-on" | "grow" | "fade-in" | "fade-out"
interface SlideTransitionStep {
  kind: SlideStepKind;
  from?: ElementId;          // element on the outgoing page (transform, crossfade, fade-out)
  to?: ElementId;            // element on the incoming page (all kinds except fade-out)
  start: number;             // ms after the transition starts
  duration: number;          // ms
  easing: "ease-in-out";
  fromBox?: SlideBox; toBox?: SlideBox;              // transform only
  fromAppearance?: SlideAppearance; toAppearance?: SlideAppearance; // transform only
  appearanceChanged?: boolean;                       // transform only
}
type SlideTransitionPlan =
  | { kind: "cut"; reason: "size-mismatch" | "empty" }
  | { kind: "animate"; duration: number; steps: SlideTransitionStep[] }
```

The plan is plain JSON (`structuredClone` / `JSON.stringify` safe).

Timing constants (exported, no document setting, user-qa Q3):

| Constant | Value |
| --- | --- |
| `SLIDE_MOVE_MS` (transform, crossfade) | 700 |
| `SLIDE_FADE_OUT_MS` | 300 |
| `SLIDE_ENTRANCE_MS` (draw-on, grow, fade-in) | 700 |
| `SLIDE_ENTRANCE_OFFSET_MS` | 300 |
| `SLIDE_STAGGER_MS` | 60 |
| `SLIDE_STAGGER_BUDGET_MS` | 480 |

`staggerStart(rank, count) = count <= 1 ? 0 : rank * min(SLIDE_STAGGER_MS, SLIDE_STAGGER_BUDGET_MS / (count - 1))`.
The longest possible transition is 300 + 480 + 700 = 1480 ms, however many
shapes a slide has.

The same file holds `scopeSvgIds` and `svgViewBox` (section 5.1) because both
are needed in wave 1 by the runner.

### 4.2 `planSlideTransition` (`slide-transition.ts`)

```text
planSlideTransition(store, registry, {
  from: { page: PageId; rect: SlideRect },
  to:   { page: PageId; rect: SlideRect },
}): SlideTransitionPlan
```

`SlideRect` is `{ x, y, width, height }` in page units: the slide's visible
region (section 6.2 says where it comes from).

Plannable elements of a page: every element of `store.getPageElements(page)`
that

- is not a `group` (its children are planned instead; group containers stay
  rendered as exported and are never hidden by the runner, section 5.5),
- is not a prototype `edge.generic` link,
- is not hidden (`visual.hidden` or the effective predicate of
  `createShapeContext(store, registry, 1).isHidden`) and not a mask source,
- has non-null bounds from `registry.getOrFallback(type).getBounds`.

These are the same filters `renderElementsSvg` uses, so every planned id has
a `g[data-id]` in the SVG. The runner ignores a step whose node is missing.

Rules, in order:

1. If `|from.rect.width - to.rect.width| > 0.5` or the same for height, the
   result is `{ kind: "cut", reason: "size-mismatch" }`. With an explicit
   document slide size this never happens.
2. If neither page has a plannable element, the result is
   `{ kind: "cut", reason: "empty" }`.
3. Index each page's plannable elements by `visual.linkId` (trimmed,
   non-empty). A linkId found more than once on a page is ambiguous on that
   page (section 3.3).
4. A pair is an outgoing element `a` and an incoming element `b` with the
   same linkId that is unique on both pages.
   - `a.type !== b.type`: no pair. `a` gets `fade-out`, `b` gets an entrance.
   - Edge category (`getElementTypeDefinition(type)?.category === "edge"`):
     `crossfade` (`from = a`, `to = b`). Connectors are never scaled.
   - Otherwise: `transform` with `fromBox` / `toBox` (bounds minus the rect
     origin, `rotation = visual.rotation ?? 0`), `fromAppearance` /
     `toAppearance` (`style.opacity ?? 1`, `style.fill`, `style.stroke`,
     `style.strokeWidth`), and
     `appearanceChanged = canonical(a) !== canonical(b)` where `canonical`
     is a sorted-key JSON of `{ style, semantic, colorTokens, textStyle }`.
5. Every unpaired outgoing element gets `fade-out`.
6. Every unpaired incoming element gets an entrance:
   - edge category: `grow`;
   - `text.note` and `image.raster`: `fade-in`;
   - everything else: `draw-on`.
7. Timing:
   - `fade-out`: `start 0`, `duration SLIDE_FADE_OUT_MS`, not staggered.
   - `transform` and `crossfade`: ranked in incoming paint order,
     `start = staggerStart(rank, count)`, `duration SLIDE_MOVE_MS`.
   - Entrances: ranked in incoming paint order,
     `start = offset + staggerStart(rank, count)` where `offset` is
     `SLIDE_ENTRANCE_OFFSET_MS` when the plan has any fade-out, transform or
     crossfade step, else 0; `duration SLIDE_ENTRANCE_MS`.
   - Paint order is ascending `(index, id)` with `compareFractional`, the
     store's z-order.
   - `duration` of the plan is the maximum `start + duration` over steps.
8. Step order in `steps`: fade-outs (outgoing paint order), then
   transform/crossfade, then entrances, each in rank order.

Going backwards is `planSlideTransition` with `from` = the current slide and
`to` = the previous slide. Pairs are the same, with roles swapped, so the
reverse of a move is a move back; shapes only on the later slide fade out
and shapes only on the earlier slide draw on.

## 5. Runner (`packages/ui-solid/src/presentation/`)

### 5.1 Unique def ids (`scopeSvgIds`, core)

`scopeSvgIds(svg, prefix): string` (pure, core
`slide-transition-types.ts`): collect every `id="X"` attribute value in the
markup, then rewrite those declarations to `id="<prefix>X"` and every
reference to a declared id in `url(#X)`, `href="#X"` and `xlink:href="#X"`.
`data-id` attributes and undeclared references are untouched. The
exporter's output (`renderElementsSvg`) is not changed, so SVG export, golden
fixtures and the resting `<img>` stay byte-identical.

Prefixes are `nodetto-slide-<n>-`, where `<n>` is a per-view counter that
increases for every inlined SVG. Two inlined slides, the editor canvas and
any earlier layer can therefore never share an id.

`svgViewBox(svg): SlideRect | null` reads the root `viewBox` (four finite
numbers, positive size), else `null`.

### 5.2 Keyframes (`transition-keyframes.ts`, pure)

Converts one step into Web Animations keyframes for an element node, with no
DOM access. A transform is a wrapper transform in SVG user units
(`transform-box: view-box; transform-origin: 0 0`):

```text
pose(box B, as box A) = translate(cA) rotate(rA') scale(sx, sy) rotate(-rB) translate(-cB)
```

`c` is the box center plus the SVG's rect origin, `sx = A.width / B.width`
(1 when `B.width <= 0`), likewise `sy`, and `rA' = rB + shortestDelta(rA, rB)`
(the `rotationDelta` rule of `prototype.ts`). Identity is the same function
list with `A = B`, so the browser interpolates function by function.

- `transform`, incoming node `b`: `pose(toBox as fromBox)` -> identity.
  When `appearanceChanged`, also `opacity 0 -> 1`, and the outgoing node `a`
  goes identity -> `pose(fromBox as toBox)` with `opacity 1 -> 0` (a
  crossfade carried by the same motion). When the appearance did not change,
  `a` is hidden for the whole transition.
- `crossfade`: `a` `opacity 1 -> 0`, `b` `opacity 0 -> 1`.
- `fade-in`: `b` `opacity 0 -> 1`. `fade-out`: `a` `opacity 1 -> 0`.
- All use `delay = start`, `duration`, `easing: "ease-in-out"`,
  `fill: "both"`, so a staggered entrance is invisible before it starts.

### 5.3 Draw-on and grow (runner, DOM-measured)

Path lengths are DOM facts, so the plan carries only kind and timing.

Fill and stroke are often separate SVG nodes. For example `rectStrokeMarkup`
(`packages/core/src/svg-export/rect-strokes.ts`, used by
`basic-shapes.ts` for aligned strokes) emits a fill-only `<path stroke="none">`
and a separate border path or clip-based border. Each painted node is
therefore classified on its own.

Painted descendants of an entering node `b` are the `path, rect, circle,
ellipse, line, polyline, polygon, text, image, foreignObject, use` elements
under `b`, **excluding** anything inside `defs, clipPath, mask, marker,
pattern, linearGradient, radialGradient, filter, symbol`. Definition geometry
is never animated or modified.

Classification is a pure function, `classifyDrawOn(nodes)` in
`transition-keyframes.ts`, over a probe record per node:
`{ tag, fill, stroke, strokeWidth, dasharray, fillOpacity, length }`.
The runner fills the probe from computed style with an attribute fallback
and `getTotalLength()` (`length = null` when it is missing or not finite).
Each painted node gets exactly one class:

| Class | Condition | Animation (fractions of the step) |
| --- | --- | --- |
| outline | geometry tag, stroke not `none`, `strokeWidth > 0`, no dasharray, `length > 0` | `stroke-dasharray: L; stroke-dashoffset: L -> 0` over `[0, 0.6]`; when its own fill is not `none`, also `fill-opacity` held at 0 until 0.5 -> `fillOpacity` at 1 |
| fill | geometry tag, stroke `none` or `strokeWidth <= 0`, fill not `none` | `fill-opacity` held at 0 until 0.5 -> `fillOpacity` at 1 |
| other | anything else painted (text, image, foreignObject, use, unmeasurable or dashed strokes) | `opacity` held at 0 until 0.5 -> 1 |
| none | fill and stroke both `none` | no animation |

- If no node is classed `outline`, the per-node plan is dropped and the
  whole node `b` fades in (`opacity 0 -> 1` over the step). This covers
  stroke-less shapes and environments without `getTotalLength` (happy-dom).
- Every animation uses `delay = start` and `fill: "both"`, so every painted
  node, including separate fill-only paths, is invisible from the
  transition start until its own phase. No painted node shows before its
  outline.
- At the end, `fill-opacity` returns to the exported value (`fillOpacity`,
  1 when unset) and `opacity` to 1. The layer is discarded right after
  anyway (section 5.5).
- `grow` on a connector node `b`: the same classification. `outline` dash
  runs over `[0, 1]`, and `fill` and `other` (labels) appear over
  `[0.5, 1]`. `marker-start`, `marker-mid` and `marker-end` are removed when
  the step starts and restored when it ends, so arrowheads appear when the
  line arrives. With no `outline` node the connector fades in.

### 5.4 Lifecycle (`transition-runner.ts`)

`SlideTransitionRunner`, modeled on `PrototypeAnimation`
(`packages/ui-solid/src/prototype-transition.ts`):

- `play(nodes, plan): Promise<"finished" | "cancelled">`. `nodes` looks up
  `g[data-id]` in the outgoing and incoming SVG by element id. Each play
  first cancels the previous one and takes a new generation number.
- `cancel()`: cancels every `Animation`, resolves the pending play with
  `"cancelled"`, and is idempotent.
- Completion uses `Promise.all(animation.finished)`. A finished or cancelled
  play from an older generation never touches state.
- Tests use fake targets (objects with `animate()` returning
  `{ finished, cancel }`), the same style as the prototype transition tests,
  so no new dev dependency and no real Web Animations API are needed.

### 5.5 Transition layer (`TransitionLayer.tsx`)

- Mounted inside the existing `.presentation-slide` box only while a
  transition runs. It holds the scoped outgoing SVG beneath the scoped
  incoming SVG, both `position: absolute; inset: 0; width: 100%;
  height: 100%`, and has `pointer-events: none` (a click still reaches the
  stage and means next).
- Each animated element node is wrapped at mount time in a `<g>` that
  carries the wrapper transform of section 5.2, so the exporter's own
  `transform="rotate(...)"` on `g[data-id]` is never overwritten.
- Outgoing hiding is limited to one set: the `from` ids of `transform`
  steps with `appearanceChanged === false`. Those `g[data-id]` nodes, and
  only those, get `visibility: hidden` from the start, because the incoming
  counterpart represents them.
  - Structural group containers (`g[data-type="group"]`), which the planner
    never plans (section 4.2), are never hidden. The same holds for any other
    outgoing node that has no step. They keep their exported opacity, mask
    and isolation, so their children render exactly as exported.
  - Outgoing `fade-out`, `crossfade` and appearance-changing `transform`
    nodes therefore stay visible inside nested groups until their own
    animations finish.
  - Incoming groups are never hidden either. Their entering children are
    hidden before their own start by `fill: "both"`.
- While the layer is mounted the resting `<img>` gets `visibility: hidden`.
  The layer adds no colors: the existing white slide backing shows through,
  so no new theme token or literal is introduced, and dark theme is
  unaffected (presentation is always black letterbox and white slide).
- The SVG strings are inserted as markup. They come only from the local
  exporter, which escapes text and attribute values, the same trust level
  as the editor canvas rendering the same document.

## 6. Presentation view integration (wiring)

### 6.1 When a transition plays

A transition plays only when all hold:

- the action is `next`, `prev`, or `enter` without digits, and the current
  slide index changed by exactly 1;
- the presentation is not black before or after the action;
- `window.matchMedia?.("(prefers-reduced-motion: reduce)").matches` is not
  true (read at the start of each transition);
- the plan is `kind: "animate"`.

Otherwise the slide switches instantly, exactly as today. `goto`, `first`
and `last` (jumps) are always instant cuts.

### 6.2 Inputs

`renderSlide(editor, page): { svg: string | null; rect: SlideRect | null }`
(new `slide-render.ts`) is the body of the existing `controller.slide()`
branch: explicit slide size gives `resolveSlideRect` and the viewport
export; otherwise artboard or `exportPageSvgOf(page, { padding: 0 })` with
`rect = svgViewBox(svg)`. `controller.slide()` is refactored to call it and
keeps its contract (`{ src, size }`, cache by page and revision), so
`controller.test.ts` and `slide-clip.test.ts` pass unchanged.

When either rect is `null` (an empty page without an explicit slide size),
the switch is a cut. An explicit-size empty page has a rect and an empty
SVG, so its content simply fades out or draws on.

### 6.3 Cancellation and rapid input

- Any action that changes the current slide or `black`, `exit`, a document
  revision change (live or remote edit), and unmount cancel the running
  transition, remove the layer and show the resting state of the new
  current slide. Digit and `clearDigits` actions do not cancel.
- If the cancelling action is itself an animated `next`/`prev`, the new
  transition starts from the resting state of the slide that was the target
  of the cancelled one (not from mid-animation poses). The final slide is
  therefore always `currentSlide(state)`.
- The layer is removed only by the play that created it (generation check),
  so a stale completion can never remove a newer layer.

## 7. Inspector and link actions (`packages/ui-solid/src/inspector/`)

Pure helpers in `slide-link-edits.ts` (the existing `*-edits.ts` pattern;
the UI applies them with `editor.apply`, as `PresentationSection` does):

- `linkedPages(store, element): PageId[]`: distinct pages, in tab order,
  that hold an element with the same `linkId` (including the element's own
  page). Empty when the element has no `linkId`.
- `planUnlink(element): Command[]`: one `replaceVisual` with `visual`
  minus `linkId`. Other elements keep theirs.
- `planApplyToLinked(store, element, { geometry }): Command[]`: one
  `replaceVisual` per element with the same `linkId` on another page and the
  same `type` (others are skipped):
  - style: copy `style`, `colorTokens` and `textStyle` exactly (a key absent
    on the source is removed on the target);
  - `geometry: true`, only when both have numeric `x` and `y`: set
    `x = source.x - so.x + to.x`, `y` likewise, and copy `width`, `height`
    and `rotation` (absent removes). `so` / `to` are each page's
    `slideOrigin ?? {x: 0, y: 0}` when the document has `slideSize`, else
    `(0, 0)`.
  - Returns `[]` when nothing would change.
- Each action is one `editor.apply(commands)`, so one undo step. Nothing is
  applied for an empty command list.

`SlideLinkSection.tsx`, shown for a single selected element that has a
`linkId`, in a `<details>` block next to "Containing frame" in
`packages/ui-solid/src/Inspector.tsx`:

- text "Linked on N pages" (`N = linkedPages(...).length`, "page" when 1);
- button "Apply to linked shapes" (disabled when `N < 2`) with a checkbox
  "Include position and size" (off by default);
- button "Unlink".

It reuses existing inspector classes and controls (`Field`, buttons), so it
adds no CSS.

Edits stay per page: no other code propagates changes between linked
elements.

## 8. Plan decomposition (`slk-*`)

| Wave | Plan | Owns (writePaths) | Depends on |
| --- | --- | --- | --- |
| 1 | `slk-00-strict-index-gate` | new `.agents/scripts/strict-index-gate.ts` and `.agents/scripts/strict-index-gate.test.ts` (section 9.1) | none |
| 1 | `slk-01-link-field` | `packages/ir/src/{types,validate,keyOrder}.ts`; new tests `packages/ir/src/link-id.test.ts`, `packages/io/src/jsonl/link-id.test.ts`, `packages/collab/src/link-id.test.ts` | none |
| 1 | `slk-02-transition-contract` | new `packages/core/src/presentation/slide-transition-types.ts` and its test; `packages/core/src/presentation/index.ts` (append) | none |
| 2 | `slk-03-copy-links` | `packages/core/src/clipboard.ts`, `packages/core/src/editor/pages.ts`, `packages/core/src/copy-page-elements.test.ts`, new `packages/core/src/link-id-copy.test.ts`; pre-authorised: other copy paths found by the section 3.1 grep, `packages/core/src/pages.test.ts`, `packages/core/src/duplicate-slide-origin.test.ts`, `apps/cli/src/pages-command.test.ts`, `packages/collab/src/binding*.test.ts` when their assertions see the new `linkId` | 00, 01 |
| 2 | `slk-04-transition-planner` | new `packages/core/src/presentation/slide-transition.ts` and its test; `packages/core/src/presentation/index.ts` (append) | 00, 01, 02 |
| 2 | `slk-05-transition-runner` | new `packages/ui-solid/src/presentation/{transition-keyframes.ts, transition-runner.ts, TransitionLayer.tsx, slide-render.ts}` and tests beside them | 00, 02 |
| 2 | `slk-06-link-inspector` | new `packages/ui-solid/src/inspector/{slide-link-edits.ts, slide-link-edits.test.ts, SlideLinkSection.tsx}` | 00, 01 |
| 3 | `slk-07-wiring` | `packages/ui-solid/src/presentation/{controller.ts, PresentationView.tsx, Presentation.css}`, new `packages/ui-solid/src/presentation/controller-transition.test.ts`, `packages/ui-solid/src/Inspector.tsx`, `packages/ui-solid/src/index.ts` and `packages/core/src/index.ts` (only if an export is missing), `docs/editing.md`, `README.md` | 00, 03, 04, 05, 06 |

`packages/core/src/presentation/index.ts` is edited by 02 (wave 1) and 04
(wave 2) only, so it never has two writers in one wave. It is a sub-barrel
already re-exported by `packages/core/src/index.ts`; without these lines the
wave-2 ui-solid plans could not import the contract.

Every plan: `artifactRoots: ["target"]`, a non-empty `acceptanceCriteria`,
and every edited file in `writePaths`.

## 9. Verification

- Every plan: `bun run typecheck`, `mise run lint-ts`, and `bun test` on its
  own test files (each plan has at least one).
- `slk-00`: `bun test ./.agents/scripts/strict-index-gate.test.ts` (explicit
  path, because the directory is hidden). Asserts: parsing of
  `path(line,col): error TSnnnn: message` lines; new-file zero rule; subset
  rule ignoring line numbers; failure on exit codes other than 0/2, on exit
  2 without diagnostics, and on a missing baseline.
- `slk-01`: `bun test packages/ir packages/io packages/collab` (golden and
  round-trip suites unchanged; new tests: with `linkId` round-trips through
  JSONL and Yjs; without it byte-identical; `""` is `value.empty`; a number
  is `type.string`).
- `slk-02`: `bun test packages/core/src/presentation` (stagger budget;
  `scopeSvgIds` on a real `renderPageSvg` output with a gradient, a clip
  and a marker: two scopings declare disjoint ids, every `url(#..)` and
  `href="#.."` resolves to a declared id, `data-id` values unchanged).
- `slk-03`: `bun test packages/core/src/copy-page-elements.test.ts
  packages/core/src/link-id-copy.test.ts packages/core/src/pages.test.ts
  packages/core/src/duplicate-slide-origin.test.ts packages/collab
  apps/cli/src/pages-command.test.ts`. Asserts: duplicate page and copy
  shapes give new ids with the source's `linkId` (or the source id, also
  written to the source); one `undo` restores both pages exactly; same-page
  paste, duplicate and component instances carry no `linkId`.
- `slk-04`: `bun test packages/core/src/presentation`. Asserts transform for
  uniquely linked same-type shapes, crossfade for linked connectors,
  draw-on / grow / fade-in for new shapes / connectors / text, fade-out for
  removed, no match for a duplicated linkId or differing types, strictly
  increasing entrance starts in paint order, `cut` on size mismatch and on
  two empty pages, reverse pairing, `JSON.parse(JSON.stringify(plan))`
  equals the plan.
- `slk-05`: `bun test packages/ui-solid/src/presentation`. Asserts:
  - keyframes pure math; runner cancel idempotence, generation guard and the
    `"cancelled"` result;
  - draw-on regression on real exporter output: a new geo rectangle with a
    visible fill and `strokeAlign: "inside"`, exported by `renderPageSvg`
    (so it goes through `rectStrokeMarkup` and has separate fill and border
    paths), is parsed with happy-dom (an existing dependency) with
    `getTotalLength` stubbed on geometry nodes. `classifyDrawOn` puts the
    fill-only path in `fill` and the border in `outline`. The fill path's
    keyframes hold `fill-opacity: 0` until 0.5, after the outline's dash
    phase has started, and end at the exported fill opacity. Every
    animation has `delay = start` and `fill: "both"` (hidden before a
    delayed start). No node inside `defs` / `clipPath` / `mask` / `marker`
    is selected or modified;
  - grouped outgoing content: an outgoing group holding a removed child
    (fade-out) and a linked child with changed appearance (transform with
    `appearanceChanged`). After layer setup the group `g[data-type="group"]`
    is not hidden, and both children are not hidden and have their
    animations attached until they finish. A linked child with unchanged
    appearance is the only hidden node;
  - cancel removes the whole layer and leaves no `Animation` running.
- `slk-06`: `bun test packages/ui-solid/src/inspector/slide-link-edits.test.ts`
  (counts, unlink, style apply, geometry apply relative to slide origin,
  one undo step).
- `slk-07`: `bun test packages/ui-solid/src/presentation
  packages/core/src/presentation`, plus a controller test: next/prev
  produce a transition descriptor only for adjacent non-black moves;
  reduced motion and jumps give none; a second `next` during a transition
  cancels it and the final current slide is correct; existing
  `controller.test.ts` and `slide-clip.test.ts` pass unchanged.
- Final: `bun run typecheck`, `bun test packages/ir packages/io
  packages/collab packages/core/src/presentation
  packages/core/src/copy-page-elements.test.ts
  packages/ui-solid/src/presentation`, `mise run lint`, `mise run verify`.
  `mise run verify` may be retried up to 3 times for deadline tests under
  machine load; deadlines are never relaxed.
- `git diff packages/core/src/commands.ts` must be empty.
- Strict-index gate (section 9.1): wave-2 plans run it on their own
  `writePaths`; `slk-07` runs it on the union of all feature-owned
  TypeScript files and owns the final pass.

### 9.1 `noUncheckedIndexedAccess` gate

Baseline fact: `package.json` `typecheck` is `tsc --noEmit`, and
`tsconfig.base.json` does not enable `noUncheckedIndexedAccess`. Step 3
review ran `bun run typecheck --noUncheckedIndexedAccess` twice at the
original head `ccac2d3`. Both runs exited 2 with existing diagnostics outside
this feature (among them tests, fixtures,
`packages/ui-solid/src/compare-dialog.ts` and `CompareDialog.tsx`). A
repository-wide exit 2 is therefore never reported as passing. Those
baseline diagnostics are out of scope and are not repaired here; repairing
them needs an explicit scope amendment. The compiler configuration is not
changed.

Gate semantics (compiler-based, not review-based):

1. Baseline capture (Step 4, once, before the first implementation commit,
   on the tree at `ccac2d3` plus design docs only): run
   `bun run typecheck --noUncheckedIndexedAccess` to terminal exit and keep
   the complete output in `target/strict-index/baseline.log` and the exit
   code in `target/strict-index/baseline.exit`. The expected exit is 2.
   Exit 0 means an empty baseline. Any other exit, or exit 2 with no
   parsable `path(line,col): error TSnnnn: message` line, is a compiler
   failure and blocks planning.
2. Gate tool: `.agents/scripts/strict-index-gate.ts` (new, next to the
   existing `.agents/scripts/lint-ts.sh`), owned by plan
   `slk-00-strict-index-gate` (wave 1) with a test of its parser and rules
   on recorded sample output. It takes the baseline log, a log path and a
   list of feature-owned files. It runs
   `bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess` to
   terminal exit and writes the complete output to the given log under
   `target/strict-index/`.
3. Rules (exit 0 only when all hold):
   - Compiler launch failure, a missing or unreadable baseline log, a
     tsc exit other than 0 or 2, or exit 2 with no parsable diagnostic all
     fail the gate. They are never treated as success.
   - A new file in the list has zero strict diagnostics.
   - For each existing file in the list, the multiset of
     `(error code, message)` (line numbers excluded) is a subset of that
     file's baseline multiset. Pre-existing diagnostics may remain; no new
     one may appear.
   - Diagnostics in files outside the list are ignored for pass/fail but
     kept in the complete log and counted in the summary.
4. Step 4 writes the exact command line per plan (file list = that plan's
   TypeScript `writePaths`; `slk-07` = the union across `slk-01`..`slk-07`),
   with the log path and the exit-0 success condition. Each plan's evidence
   records the exit status and the complete log path.

## 10. Risks

- Byte-identical round trip: only a missing `keyOrder` entry or a binding
  that writes `linkId: undefined` could break it; the slk-01 tests cover
  both directions.
- Def id collisions: `scopeSvgIds` must cover every id the exporter emits
  (gradients, clips, filters, masks, markers). The slk-02 test uses a real
  export with each kind.
- Lifecycle races: covered by the generation guard and the cancel rules in
  section 6.3, and by the controller test.
- Dense slides: the stagger budget caps total duration at 1480 ms; per-node
  dash measurement happens once per transition.
- Clip paths of frame children stay at the destination geometry while a
  child moves (accepted visual limitation in Phase 1).
- Crossfade of changed appearance dips slightly in coverage at mid-point
  for semi-transparent content (accepted; true paint interpolation is a
  later phase).
- Mixed-version cloud clients drop nothing: `visual` is carried as one map.

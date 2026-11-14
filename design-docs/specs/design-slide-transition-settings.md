# Slide transition and slide animation settings (Phase 2)

Status: design for implementation. Task `slk-s855-phase2`. It extends
`design-docs/specs/design-slide-link-animation.md` (Phase 1, commit
`a9abe26`). Everything there still holds unless this document changes it.
Scope: the public `nodetto-app` repository only (`packages/ir`,
`packages/io`, `packages/collab`, `packages/core`, `packages/ui-solid`,
`docs/`, `README.md`). No server, auth, deployment or Rust change.

Owner decisions with a default already applied are Q7 to Q11 in
`design-docs/user-qa/slide-link-animation.md`.

## 1. Goals and non-goals

Goals:

1. A page (slide) can carry transition settings: mode `auto | cut | fade`,
   an optional duration and an optional stagger switch. They are stored on
   an artwork-free slide settings element of that page (section 3.1.1),
   because the hosted Worker rejects new `Page` fields. They survive
   artwork deletion and work on empty slides.
2. An element can store animation settings: an entrance effect, an exit
   effect, a linked-pair motion, and optional delay, duration and order.
3. The pure planner honours both. The Web Animations runner plays every new
   step kind. The inspector edits both.
4. A document with none of the new fields plans, plays and round-trips
   exactly as Phase 1 does.

Non-goals: morphing between different shape types, glyph-outline text
writing, click-by-click builds, video export, LaTeX/math, a timeline editor,
animated jumps (goto/first/last stay cuts), a document-level setting.

## 2. Ownership rule (owner decision)

Slide N is the slide entered when going forward from N-1. It owns the
N-1 <-> N transition in both directions.

| Navigation | Slide settings from | Entering element uses | Exiting element uses | Linked pair decided by |
| --- | --- | --- | --- | --- |
| forward N-1 -> N | page N (`to`) | its own `enter` | its own `exit` | the element on N (`to`) |
| backward N -> N-1 | page N (`from`) | `mirror(its own exit)` | `mirror(its own enter)` | the element on N (`from`) |

Per-shape `delayMs`, `durationMs` and `order` always come from the element
the step is about (for a pair: the element on N), in both directions.

Mirror table (applied before the applicability check of section 5.2):

| enter | as exit when going back | exit | as enter when going back |
| --- | --- | --- | --- |
| `auto` | `auto` | `auto` | `auto` |
| `none` | `none` | `none` | `none` |
| `fade-in` | `fade-out` | `fade-out` | `fade-in` |
| `draw-on` | `undraw` | `undraw` | `draw-on` |
| `grow` | `undraw` | | |
| `scale-in` | `scale-out` | `scale-out` | `scale-in` |
| `slide-in` from side S | `slide-out` to side S | `slide-out` to side S | `slide-in` from side S |

`auto` mirrors to `auto`, so with no settings going back is exactly the
Phase 1 reverse pairing (shapes only on N fade out, shapes only on N-1 get
their Phase 1 entrance).

## 3. Data model

### 3.1 Storage (decision)

- Per-shape settings: new optional `Element.visual.animation`, written with
  the existing `updateVisual` / `replaceVisual`, exactly like Phase 1
  `linkId`.
- Per-slide settings: `visual.animation.slide` on the slide's single
  artwork-free `presentation.slide` resource element. It is created,
  updated and removed with `createElement`, `replaceVisual` and
  `deleteElements` (section 3.1.1). This is the intake's explicit fallback ("if
  Page fields cannot pass the Worker unchanged, store per-slide settings
  somewhere that does"). There is no `Page` field and no `updatePage`
  change. The only `packages/core/src/commands.ts` edit is the validation
  wiring of section 3.3, so the Phase 1 rule "no change to the `Command`
  union" still holds and `updateDocument` is unchanged.

#### Sync Worker compatibility (confirmed, Step 3 review evidence)

The Worker was not edited and is not edited by this work. The Step 2
sandbox cannot read it, so the facts below come from the Step 3 reviewer
diagnostic (`bun -e` calling `parseAuthoringBatch` from
`nodetto-cloud/workers/sync/src/authoring.ts`, exit 0):

- `authoring.ts:167-172,197-200`: the hosted authoring batch parser
  (`command()`) allows only `name`, `kind`, `tokenMode` and `order` inside
  `updatePage.page`. `{type:"updatePage", page:{transition:{...}}}` is
  rejected with HTTP 400 `invalid_commands` ("missing or unknown fields").
  The same whitelist already rejects the existing `slideOrigin` and
  `hiddenInPresentation` page fields, so they are not a precedent for
  hosted authoring.
- `updateVisual` and `replaceVisual` with `visual.animation` are accepted.

Consequence: a `Page` field cannot pass the unchanged Worker, and
`updateDocument` must not change. Per-slide settings therefore go into
`visual.animation` of a dedicated page element (section 3.1.1). No Worker
change and no scope amendment is needed, subject to the `createElement`
check in section 10.

#### 3.1.1 Per-slide settings on a slide settings element

Settings must not depend on user artwork: they must survive deleting
every shape and be editable on an empty slide. They therefore live on a
dedicated, artwork-free **slide settings element** per page. This follows
the existing page-scoped resource elements (`design.guide` page guides in
`packages/core/src/page-guides.ts`, `design.token`, `review.comment`):
they are ordinary elements of category `"resource"`, already excluded from
paint order, the layer tree, masks, hit testing and bounds.

- Element type `presentation.slide`, category `"resource"`:
  - IR definition in a new `packages/ir/src/registry/presentation-slide.ts`
    (pattern: `DESIGN_GUIDE` in `registry/resources.ts`), registered in
    `packages/ir/src/registry.ts` and mapped in `packages/ir/src/semantics.ts`.
    `semantic` is `{}`; unknown semantic keys produce a `field.unknown`
    warning.
  - Shape util in `packages/core/src/shapes/index.ts`: `canResize: false`,
    `getBounds: () => null`, `hitTest: () => false`, `defaultSemantic: () =>
    ({})`, `defaultVisual: () => ({})`, the same as `design.guide`. It is
    never drawn, hit, measured, exported or planned: the planner already
    skips elements with null bounds.
  - The settings live in its `visual.animation.slide: SlideSettings`.
    `animation.slide` on any other element type is valid but ignored.
- Read rule, `readSlideSettings(pageElements)` (pure, in the same IR module
  so the planner and the inspector share it): take the page's
  `presentation.slide` elements in `(index, id)` order and return the first
  one's `visual.animation?.slide`, else `undefined`, meaning all defaults.
  Normally there is at most one carrier. A second one (for example from
  concurrent creation by two collaborators) is ignored deterministically,
  and the next inspector edit writes to the first one.
- Write rule (inspector, section 7), always one `editor.apply`, so one undo
  step:
  - carrier exists and the result is not all defaults: one `replaceVisual`
    on it;
  - carrier exists and the result is all defaults: one `deleteElements` of
    it, so the document returns to the no-field form;
  - no carrier and the result is not all defaults: one `createElement` of a
    `presentation.slide` built with `editor.buildElement` (page = this page,
    `visual: { animation: { slide } }`);
  - no change: no commands.
  Undo inverts with the existing command inverses (`createElement` <->
  delete, `replaceVisual`). No new Command kind, no `updatePage` and no
  `updateDocument` change.
- Lifecycle and deletion:
  - The carrier has no bounds and no hit area, so canvas click, marquee
    and the layer tree (which filters `"resource"`) never select it.
  - `selectAll` (`packages/core/src/editor/facade/core.ts`) excludes
    `presentation.slide`, so Select all + Delete removes only artwork. This
    is the only selection change; guides keep their current behaviour.
  - Deleting every shape and then adding new ones keeps the settings.
    Deleting the page deletes them with it.
- Empty slides: the carrier can be created on a page with no artwork, so
  the "Slide transition" controls work on every page, including blank
  ones.
- Copy rules:
  - The clipboard never contains a carrier, because it is never selected.
    `planPaste` (`packages/core/src/clipboard.ts`) also drops
    `presentation.slide` elements from the payload before ids are
    allocated, unless `PasteOptions.keepSlideCarrier` is true. This covers
    explicit-id payloads (CLI, cross-document paste).
  - `planPageElementsCopy` (`packages/core/src/editor/pages.ts`) gains an
    optional `carrier: "keep" | "skip"` argument, default `"skip"`. It
    never adds a `linkId` to the carrier or tags the source carrier.
    `planDuplicatePage` passes `"keep"` (with `keepSlideCarrier: true`), so
    a duplicated slide keeps how it comes in. Copy shapes from page
    (`copyPageElements` in `editor/facade/page-editing.ts`, unchanged) uses
    the default `"skip"`, so it never moves one slide's settings to
    another slide.
- Export and other type lists: the explicit artwork-free type lists that
  contain `design.guide` (`packages/io/src/drawio/export.ts`
  `SILENT_TYPES`, `packages/io/src/d2/export.ts`) add `presentation.slide`.
  The implementer greps for `"design.text-style"` / `"design.guide"`
  (current hits also include `packages/core/src/handoff.ts`,
  `interface-tree.ts`, `editor/dirty-pages.ts`, `arrange.ts`) and edits only
  the lists where the carrier would otherwise appear as content.
- Hosted transport: `createElement` of a `presentation.slide`,
  `updateVisual` / `replaceVisual` with `visual.animation` (accepted by the
  unchanged Worker in the Step 3 diagnostic, including nested
  `animation.slide`), and `deleteElements`. The Step 3 diagnostic (chunk
  051f24) also observed the unchanged Worker parser accepting
  `createElement` of a `presentation.slide` with `visual.animation.slide`
  and `deleteElements` of its id.
- Older builds read a document with a carrier as an element of unknown
  type: a `type.unknown` warning, payload preserved
  (`packages/ir/src/validate.ts`). Rendering falls back to the unknown shape
  util, so older builds may show a placeholder. This is accepted, the same
  forward-compat path as any new element type.

### 3.2 Types (`packages/ir/src/types.ts`, exported from `packages/ir/src/index.ts`)

```text
type SlideSide = "left" | "right" | "top" | "bottom";

interface SlideSettings {                  // Visual.animation.slide of a presentation.slide element (3.1.1)
  mode?: "auto" | "cut" | "fade";           // absent = auto
  durationMs?: number;                      // absent = Phase 1 timing
  stagger?: boolean;                        // absent = true
}

type SlideEnterEffect = "auto" | "none" | "fade-in" | "draw-on" | "grow" | "scale-in" | "slide-in";
type SlideExitEffect  = "auto" | "none" | "fade-out" | "undraw" | "scale-out" | "slide-out";

interface ElementAnimation {               // Visual.animation, after linkId
  enter?: SlideEnterEffect;                 // absent = auto
  enterFrom?: SlideSide;                    // slide-in only; absent = "bottom"
  exit?: SlideExitEffect;                   // absent = auto
  exitTo?: SlideSide;                       // slide-out only; absent = "bottom"
  linked?: "auto" | "cut" | "crossfade";    // absent = auto
  delayMs?: number;
  durationMs?: number;
  order?: number;
  slide?: SlideSettings;                    // read only on presentation.slide elements
}

const SLIDE_SETTINGS_TYPE = "presentation.slide";
function readSlideSettings(pageElements: readonly Element[]): SlideSettings | undefined;
```

`enterFrom` / `exitTo` on a non-slide effect are valid and ignored (they
are kept so switching the effect back restores the side).

### 3.3 Validation (IR documents and core commands)

There are two separate validators, and both must call the shared helper:

1. IR document validation (`packages/ir/src/validate.ts`, used by JSONL
   load and document checks). The new exported helper
   `validateElementAnimation(value, path): ValidationIssue[]` is called
   from the visual check next to the `linkId` check. It returns errors and
   `field.unknown` warnings, which are reported as they are today.
2. Core command validation (`packages/core/src/commands.ts`). The private
   `validateVisualFields(visual)` (line 247) does not call IR document
   validation. It is used by `createElement` (via the element validator,
   line 387), `updateVisual` (line 625, on the merged visual),
   `replaceVisual` (line 649) and `convertElement` (line 696). This file
   gets one narrow change: import `validateElementAnimation` from
   `@nodetto/ir`, and at the end of `validateVisualFields`, when
   `visual.animation !== undefined`, append
   `validateElementAnimation(visual.animation, "visual.animation")`
   **filtered to error severity**. The filter is required because
   `updateVisual` / `replaceVisual` fail on any returned issue
   (`if (visualIssues.length) fail(...)`), and unknown nested keys must stay
   warning-only (accepted and preserved). No `Command` type, no
   `updateDocument`, and no other handler changes.

Invalid values therefore throw `CommandError` ("invalid visual fields", or
"createElement: invalid element") before any state changes, on every
command that can write `visual.animation`, including the carrier's
`createElement`.

| Field | Rule | Error code |
| --- | --- | --- |
| `animation`, `animation.slide` | plain object | `type.object` |
| `mode`, `enter`, `exit`, `linked`, `enterFrom`, `exitTo` | one of the listed strings | `value.enum` |
| `slide.stagger` | boolean | `type.boolean` |
| `slide.durationMs` | integer, 100..5000 | `range.animation` |
| `animation.durationMs` | integer, 50..5000 | `range.animation` |
| `animation.delayMs` | integer, 0..5000 | `range.animation` |
| `animation.order` | integer, -999..999 | `range.animation` |
| unknown key inside either object | warning, value preserved | `field.unknown` |

Paths are `elements[i].visual.animation.<key>` and
`elements[i].visual.animation.slide.<key>`. A non-number for a numeric key
is also `range.animation`. Command issues use the paths
`visual.animation.<key>` and `visual.animation.slide.<key>`. An empty
object is valid, but the inspector never writes one (section 7).

### 3.4 Key order and round trip

- `packages/ir/src/keyOrder.ts`: visual keys get `"animation"` right after
  `"linkId"`, and the visual children get
  `animation: { keys: ["enter", "enterFrom", "exit", "exitTo", "linked", "delayMs", "durationMs", "order", "slide"], children: { slide: { keys: ["mode", "durationMs", "stagger"] } } }`
  (`KeyOrder` already supports nested `children`).
- `packages/io` and `packages/collab` need no code change: JSONL orders
  `visual` by `keyOrder.ts`, and `packages/collab/src/ydoc.ts` carries
  `visual` as one map (Phase 1 section 2.1). Only round-trip tests are
  added.
- No reader, writer or binding adds, empties or normalises the key, so
  documents without it are byte-identical. No schema-version bump, no
  migration. Older builds keep it as an unknown visual field, and older
  collab clients carry it inside the visual map.

## 4. Plan contract changes (`slide-transition-types.ts`)

Additions only; every Phase 1 field and value keeps its meaning, and new
fields are present only on steps that use them.

```text
SlideStepKind adds: "undraw" | "scale-in" | "scale-out" | "slide-in" | "slide-out"
                  | "appear" | "disappear" | "swap" | "slide-fade"
SlideTransitionStep adds: offset?: { x: number; y: number }   // slide-in / slide-out only
cut reason adds: "setting"
SlideNavigation = "forward" | "backward"
```

| Kind | from | to | Extra fields | Meaning |
| --- | --- | --- | --- | --- |
| `undraw` | yes | | | reverse of draw-on (or grow for a connector) on the outgoing node |
| `scale-in` | | yes | `toBox` | grow from the box centre, scale 0 -> 1, opacity 0 -> 1 |
| `scale-out` | yes | | `fromBox` | shrink to the box centre, scale 1 -> 0, opacity 1 -> 0 |
| `slide-in` | | yes | `offset` | translate from `offset` to 0 |
| `slide-out` | yes | | `offset` | translate from 0 to `offset` |
| `appear` | | yes | | invisible until `start`, then shown; `duration` 0 |
| `disappear` | yes | | | visible until `start`, then hidden; `duration` 0 |
| `swap` | yes | yes | | linked cut: at `start` the outgoing hides and the incoming shows; `duration` 0 |
| `slide-fade` | | | | whole outgoing SVG 1 -> 0, whole incoming SVG 0 -> 1 |

`offset` is in slide units. It moves the element's rotated axis-aligned
extent (the four corners of the box rotated about its centre) just past the
slide edge: `left` gives `x = -(maxX)`, `right` gives
`x = rect.width - minX`, `top` gives `y = -(maxY)`, `bottom` gives
`y = rect.height - minY`, the other axis 0. The plan stays plain JSON.

## 5. Planner (`packages/core/src/presentation/`)

### 5.1 Input

`planSlideTransition(store, registry, { from, to, navigation? })`.
`navigation` is `"forward"` when absent, so every Phase 1 call site and
test keeps its meaning. The owner page is `to` when forward, `from` when
backward. Its settings are `readSlideSettings(store.getPageElements(owner))`
(section 3.1.1); `undefined` means mode `auto`, Phase 1 timing and stagger
on. `readSlideSettings` lives in the IR module of plan `slt-01`, so both
the planner and the inspector can use it in wave 2. The carrier itself is
never a plannable item, because its bounds are null.

### 5.2 Settings resolution (new `slide-transition-settings.ts`, pure)

- `mirrorEnter(effect, side)` / `mirrorExit(effect, side)`: the section 2
  table.
- `resolveEntrance(element, effect)`: applicability, then `auto` resolution.
  Edge category allows `none | fade-in | grow`; others allow
  `none | fade-in | draw-on | scale-in | slide-in`. Anything else, and
  `auto`, gives the Phase 1 entrance (`grow` for edges, `fade-in` for
  `text.note` / `image.raster`, `draw-on` otherwise). `none` -> `appear`.
- `resolveExit(element, effect)`: edge category allows
  `none | fade-out | undraw`; others allow all. Otherwise and `auto` ->
  `fade-out`. `none` -> `disappear`.
- `resolveLinked(owner, pairDefault)`: `auto` -> the Phase 1 kind
  (`transform`, or `crossfade` for edges); `crossfade` -> `crossfade`
  (no motion); `cut` -> `swap`.
- `slideTiming(durationMs?)`: with `durationMs` absent returns the Phase 1
  constants themselves (no multiplication, so float results are
  identical). With it, every constant (move, fade-out, entrance, entrance
  offset, stagger, stagger budget) is multiplied by `durationMs / 700`.
  Results are not rounded.

### 5.3 Rules (in order)

1. Size mismatch -> `{ kind: "cut", reason: "size-mismatch" }` (unchanged).
2. Owner `mode: "cut"` -> `{ kind: "cut", reason: "setting" }`.
3. Neither page has a plannable element -> `cut` `empty` (unchanged).
4. Owner `mode: "fade"` -> `{ kind: "animate", duration: d, steps: [{ kind:
   "slide-fade", start: 0, duration: d, easing: "ease-in-out" }] }` with
   `d = durationMs ?? SLIDE_MOVE_MS`. Per-shape settings and links are
   ignored.
5. Otherwise (`auto`): Phase 1 pairing and classification, then per-shape
   settings as follows, using `T = slideTiming(owner durationMs)`:
   - Exits (unpaired outgoing): kind from section 5.2 with the role table
     of section 2. `start = delayMs ?? 0`. Default duration: `fade-out`
     `T.fadeOut`; `undraw`, `scale-out`, `slide-out` `T.move`;
     `disappear` 0. Not staggered; listed in outgoing paint order.
   - Pairs: kind, `order`, `delayMs` and `durationMs` come from the owner
     element (the pair member on slide N). Ranking is
     `(owner order ?? 0, incoming paint order)`, a stable sort of the pairs
     as Phase 1 builds them: in the paint order of the **incoming** page
     (the `to` page in both directions), not of the owner page. Going
     backwards the owner is the outgoing element, but its paint order is
     never used for ranking. `start = stagger(rank) + delayMs`, duration
     `durationMs ?? T.move`; `swap` duration 0.
   - Entrances: kind from section 5.2. Ranked by
     `(order ?? 0, paint order)`. `start = offset + stagger(rank) + delayMs`
     where `offset = T.entranceOffset` when any exit or pair step exists
     (Phase 1 rule), else 0. Duration `durationMs ?? T.entrance`; `appear`
     duration 0.
   - `stagger(rank)` is `staggerStart` with `T`'s stagger and budget, and is
     0 when the owner has `stagger: false`.
   - The instant kinds `swap`, `appear` and `disappear` always have
     duration 0 and ignore `durationMs`; `delayMs` still moves their start.
   - Step order and plan `duration` follow Phase 1 rule 8 and 7.
   - Ranking with no `order` anywhere is exactly Phase 1: pairs and
     entrances in incoming paint order, exits in outgoing paint order (the
     sort is stable and the key is 0 for all). Serialised step order is
     Phase 1 rule 8 (exits, pairs, entrances, each in rank order), so
     absent settings give the same steps, starts and order.

`scale-*` steps carry the element's slide box (Phase 1 `box()`); `slide-*`
steps carry `offset` (section 4).

### 5.4 Phase 1 pin

A new test pins the full JSON of the forward and backward plans for one
fixture to literals captured from the unmodified `a9abe26` planner before
`slide-transition.ts` is edited (never regenerated from the modified
planner). The fixture has: a linked same-type shape with changed geometry,
a linked connector, a removed shape, a new shape, a new connector, a new
text, and at least two linked pairs A and B whose paint order differs
between the pages (A before B on N-1, B before A on N). The test asserts
complete `toEqual` of both plans. With the Phase 1 planner the backward
plan N -> N-1 ranks A at 0 ms and B at 60 ms (reviewer diagnostic); owner
paint ordering would reverse them, so this fixture catches that
regression. A second test sets `order` on the slide N members and asserts
the explicit owner order overrides incoming paint order in both
directions. `slide-transition.test.ts` is not edited.

## 6. Runner (`packages/ui-solid/src/presentation/`)

- `transition-keyframes.ts` (pure, unit-tested): `stepKeyframes` gains
  - `scale-in` / `scale-out`: wrapper transform
    `translate(c) scale(s) translate(-c)` with `c` = box centre plus SVG
    origin (as `poseTransform`), `s` 0 -> 1 or 1 -> 0, opacity the same way;
  - `slide-in` / `slide-out`: `translate(offset)` -> `translate(0, 0)` and
    the reverse, in user units (`px`, as Phase 1);
  - `appear`, `disappear`, `swap`: two-keyframe opacity animations with
    `duration 0`, `delay = start`, `fill: "both"` (hidden or shown exactly
    at `start`); `swap` animates both nodes;
  - `undrawKeyframes(cls, probe)`: the `drawOnKeyframes` result reversed
    (keyframe order reversed, `offset -> 1 - offset`).
- `transition-dom.ts` `prepareTransition`:
  - `undraw` uses the draw-on classification on the **outgoing** node with
    reversed keyframes; with no `outline` node the wrapper fades out. It
    removes `marker-*` attributes at the step start (connectors lose their
    arrowheads first) using the existing `removeMarkers`.
  - `slide-fade` targets the two SVG roots, not element nodes.
  - Other new kinds go through `stepKeyframes` and `wrap()`, like Phase 1.
  - The Phase 1 outgoing hiding rule is unchanged: only `transform` with
    `appearanceChanged === false` hides its outgoing node up front.
- Cancel: unchanged lifecycle. All new effects live on the transition layer
  copies, so removing the layer leaves no stale node and the resting
  `<img>` (with its markers) is shown again; `onFinish` restores markers on
  normal completion as in Phase 1. `transition-runner.ts` and
  `TransitionLayer.tsx` need no change unless a test shows otherwise.

## 7. Inspector (`packages/ui-solid/src/inspector/`)

Pure helpers, tested, applied with one `editor.apply(commands)` (one undo
step; nothing applied for an empty list):

- `slide-transition-edits.ts`: `planSlideSettingsEdit(editor, pageId,
  patch): Command[]` merges `patch` into the current
  `readSlideSettings(...)` and normalises the result: it drops
  `mode: "auto"` and `stagger: true`, and an empty result means "all
  defaults". It then applies the section 3.1.1 write rule and returns
  exactly one `createElement`, one `replaceVisual`, one `deleteElements`,
  or `[]` when nothing changes. It works the same on pages with no
  artwork.
- `slide-animation-edits.ts`: `planAnimationEdit(elements, patch)` returns
  one `replaceVisual` per element whose normalised per-shape keys change.
  It drops `auto` values, never touches `animation.slide`, and removes the
  `animation` key when it ends up empty. `sharedAnimationValue(elements,
  key)` returns the common value or `"mixed"`.

Sections (existing `Section`, `Field`, `SelectInput`, `NumberInput`,
`Checkbox` from `controls.tsx`; no new CSS, no new colors, so the dark
theme is unaffected; every control disabled when `editor.readOnly`):

- `SlideTransitionSection.tsx` ("Slide transition"), shown with no selection
  under `PresentationSection`: Mode (Auto / Cut / Fade), Duration (ms, blank
  = default), Stagger (enabled only in Auto). It is available on every page,
  including pages with no artwork.
- `SlideAnimationSection.tsx` ("Slide animation"), shown for one selected
  element next to `SlideLinkSection` and for a multi-selection in the
  "N elements selected" block: Enter, Enter from (shown for Slide in),
  Exit, Exit to (shown for Slide out), Linked motion, Delay (ms),
  Duration (ms), Order. Mixed values show a "Mixed" placeholder option;
  choosing a value writes it to every selected element. Inapplicable
  choices are allowed and fall back to auto at play time (section 5.2).

## 8. Wiring

- `controller.ts`: pass `navigation: state.index > before.index ?
  "forward" : "backward"` to `planSlideTransition`. Nothing else in section
  6 of Phase 1 changes (jumps, black and reduced motion still cut).
- `packages/core/src/presentation/index.ts` exports
  `slide-transition-settings.ts`; `packages/ui-solid/src/index.ts` exports
  the new sections only if `Inspector.tsx` needs them through the barrel;
  `packages/core/src/index.ts` changes only if an export is missing.
- `Inspector.tsx` mounts both sections. `docs/editing.md` and `README.md`
  describe the settings.

## 9. Plan decomposition (`slt-*`)

| Wave | Plan | Owns (writePaths) | Depends on |
| --- | --- | --- | --- |
| 1 | `slt-01-settings-fields` | `packages/ir/src/{types,validate,keyOrder,index,registry,semantics}.ts`, new `packages/ir/src/registry/presentation-slide.ts` (type definition, `SLIDE_SETTINGS_TYPE`, `readSlideSettings`), new `packages/ir/src/slide-settings.test.ts`; `packages/core/src/commands.ts` (validation wiring only: the `validateElementAnimation` import and the error-filtered call at the end of `validateVisualFields`, section 3.3), new `packages/core/src/visual-animation-command.test.ts` | none |
| 1 | `slt-02-plan-contract` | `packages/core/src/presentation/slide-transition-types.ts` (step kinds, cut reason, `SlideNavigation`) and its test | none |
| 2 | `slt-03-settings-plumbing` | `packages/core/src/shapes/index.ts` (carrier shape util), `packages/core/src/clipboard.ts` (`keepSlideCarrier`), `packages/core/src/editor/pages.ts` (`carrier: "keep" \| "skip"`), `packages/core/src/editor/facade/core.ts` (`selectAll` exclusion), `packages/io/src/drawio/export.ts`, `packages/io/src/d2/export.ts`, new tests `packages/core/src/slide-settings-carrier.test.ts`, `packages/io/src/jsonl/slide-settings.test.ts`, `packages/collab/src/slide-settings.test.ts`; pre-authorised: `packages/core/src/{handoff,interface-tree,arrange}.ts`, `packages/core/src/editor/dirty-pages.ts` (only if the section 3.1.1 grep shows the carrier leaking), `packages/core/src/copy-page-elements.test.ts`, `packages/core/src/link-id-copy.test.ts`, `packages/core/src/pages.test.ts`, `packages/collab/src/binding*.test.ts`, io export tests beside the touched exporters | 01 |
| 2 | `slt-04-planner-settings` | new `packages/core/src/presentation/{slide-transition-settings.ts, slide-transition-settings.test.ts, slide-transition-phase1-pin.test.ts}`, `packages/core/src/presentation/slide-transition.ts` | 01, 02 |
| 2 | `slt-05-runner-effects` | `packages/ui-solid/src/presentation/{transition-keyframes.ts, transition-dom.ts}` and their tests; pre-authorised: `transition-runner.ts`, `TransitionLayer.tsx` and their tests | 02 |
| 2 | `slt-06-inspector-sections` | new `packages/ui-solid/src/inspector/{slide-transition-edits.ts, slide-transition-edits.test.ts, slide-animation-edits.ts, slide-animation-edits.test.ts, SlideTransitionSection.tsx, SlideAnimationSection.tsx}` | 01 |
| 3 | `slt-07-wiring` | `packages/ui-solid/src/presentation/controller.ts`, new `packages/ui-solid/src/presentation/controller-navigation.test.ts`, `packages/core/src/presentation/index.ts`, `packages/core/src/index.ts` (only if needed), `packages/ui-solid/src/index.ts`, `packages/ui-solid/src/Inspector.tsx`, `docs/editing.md`, `README.md`, the new manifest and the archive move of `impl-plans/active/slk-s855-dispatch.json` to `impl-plans/completed/` | 01-06 |

Every plan: `artifactRoots: ["target"]`, non-empty `acceptanceCriteria`,
every edited file in `writePaths`. No shared registration file has a writer
before wave 3.

## 10. Verification

- Every plan: `bun run typecheck`, `mise run lint-ts`, `bun test` on its
  own test files, and `bun .agents/scripts/strict-index-gate.ts` on its
  TypeScript `writePaths` (Phase 1 section 9.1 semantics; `slt-07` runs the
  union of all `slt-*` TypeScript files).
- `slt-01`: `bun test packages/ir packages/core/src/visual-animation-command.test.ts`.
  IR: each range bound and enum including `slide`, and the `field.unknown`
  warning. Commands, each for `createElement` (a `presentation.slide`
  carrier and an ordinary shape), `updateVisual` (merged visual) and
  `replaceVisual`:
  - valid `animation` / `animation.slide` values are accepted, and set or
    removed as requested;
  - an unknown enum (`enter: "invalid-effect"`, `slide.mode:
    "invalid-mode"`) and an out-of-range number (`durationMs: -1`,
    `delayMs: 5001`, non-integer `order`) each throw `CommandError` with the
    `visual.animation...` path, and the store is unchanged after the
    rejection (the reviewer's reproduction, chunk 960187, is a test case);
  - an unknown nested key (`animation: { future: 1 }`) is accepted and
    preserved (warning-only);
  - one undo restores the previous visual exactly.
- `slt-01` also: `presentation.slide` validates with `{}` semantic and
  warns on unknown semantic keys; `readSlideSettings` returns the first
  carrier in `(index, id)` order, ignores `animation.slide` on other
  types, and returns `undefined` with no carrier.
- `slt-02`: `bun test packages/core/src/presentation/slide-transition-types.test.ts`.
- `slt-03`: `bun test packages/io packages/collab packages/core/src/slide-settings-carrier.test.ts packages/core/src/copy-page-elements.test.ts packages/core/src/link-id-copy.test.ts packages/core/src/pages.test.ts`.
  Asserts:
  - JSONL and Yjs round trip of a carrier and of per-shape `animation`;
    documents without them are byte-identical; canonical nested key order;
  - the carrier commands (`createElement`, `replaceVisual`,
    `deleteElements`) applied to a bound document reach a second binding
    unchanged, and one undo restores both;
  - an empty page gets a carrier; after deleting every artwork element
    (including through `selectAll` + delete) and adding a new shape,
    `readSlideSettings` still returns the settings, also after a JSONL and
    Yjs round trip;
  - the carrier has null bounds, is not hit, and is not in `selectAll`;
  - Duplicate page copies the carrier (new id, same settings, no
    `linkId`); Copy shapes from page and `planPaste` of a payload that
    contains a carrier create none;
  - drawio and d2 export output does not change when a carrier is added.
- `slt-04`: `bun test packages/core/src/presentation` (Phase 1 pin forward
  and backward; existing Phase 1 tests unchanged; cut -> `cut setting`;
  fade -> single `slide-fade`; durationMs scales every timing; stagger off
  gives equal starts; enter/exit/linked kinds, delay, duration and order;
  inapplicable -> auto; backward mirrors including slide sides; owner page
  selection per direction; `JSON.parse(JSON.stringify(plan))` equals plan).
- `slt-05`: `bun test packages/ui-solid/src/presentation` (keyframes for
  every new kind; undraw reversal; markers removed for undraw; slide-fade
  targets roots; cancel leaves no layer and no running animation).
- `slt-06`: `bun test packages/ui-solid/src/inspector/slide-transition-edits.test.ts packages/ui-solid/src/inspector/slide-animation-edits.test.ts`
  (normalisation, one command list per edit, multi-selection, mixed).
- `slt-07` and final: `bun run typecheck`;
  `bun test packages/ir packages/io packages/collab packages/core/src/presentation packages/ui-solid/src/presentation packages/ui-solid/src/inspector`;
  `bun .agents/scripts/strict-index-gate.ts` (union); `mise run lint`;
  `mise run verify` (up to 3 attempts for deadline tests under load,
  deadlines never relaxed). `git diff a9abe26 -- packages/core/src/commands.ts`
  is reviewed: it may contain only the section 3.3 validation wiring (one
  import, one error-filtered `validateElementAnimation` call inside
  `validateVisualFields`). The `Command` union, every handler and
  `updateDocument` are unchanged.
- `slt-06` additionally asserts that `planSlideSettingsEdit` returns one
  `createElement` on a page with no carrier (including an empty page), one
  `replaceVisual` when a carrier exists, one `deleteElements` when
  returning to the defaults, and `[]` for no change. Applying each is one
  undo step.
- Hosted transport (observed by the Step 3 diagnostics, read-only, not a
  plan gate because the Worker is private): `parseAuthoringBatch` from
  `nodetto-cloud/workers/sync/src/authoring.ts` accepts `updateVisual` /
  `replaceVisual` with nested `animation.slide` (chunk 8909db), and
  `createElement` of
  `{type:"presentation.slide", semantic:{}, visual:{animation:{slide:{mode:"fade"}}}}`
  plus `deleteElements` of its id (chunk 051f24). The integration review
  may repeat these diagnostics.

## 11. Risks

- Phase 1 regression: guarded by the pin test, unedited Phase 1 tests and
  the "absent duration uses the constants unmultiplied" rule.
- Round-trip drift: guarded by key-order entries and byte-identical tests
  without the fields.
- Hosted compatibility: every new setting travels in `visual.animation`
  through `updateVisual` / `replaceVisual`, which the unchanged Worker
  accepts (reviewer diagnostic). A Worker that later starts inspecting
  nested `animation` keys is not covered here.
- Carrier element: hosted `createElement` / `deleteElements` acceptance
  was observed (section 10). Two carriers on one page resolve
  deterministically to the first. A user can still delete the carrier by
  explicit id (CLI or API), which resets the slide to the defaults, the
  same as clearing the settings. Older builds see an unknown element type.
- Mirror mismatch between planner and runner: the planner resolves mirrors;
  the runner only plays concrete kinds.
- Older collab clients carry `visual.animation` unchanged inside the
  visual map, as they do Phase 1 `linkId`.

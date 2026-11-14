# tll-01-core-lint

- planId: tll-01-core-lint
- planPath: impl-plans/active/tll-01-core-lint.md
- wave: 1
- dependsOn: none
- Design: `design-docs/specs/design-text-layout-lint.md`, sections:
  - "Module: packages/core/src/text-layout-lint/";
  - "Rule label-overflow";
  - "Rule label-collision";
  - "Rule note-overflow";
  - "Spatial prefilter and determinism";
  - "Test plan" (core and fixture parts).
- Read `impl-plans/active/tll-00-overview.md` first: protocol, pinned
  contracts, global non-goals.

## Intent and context

Implement the deterministic text-layout lint in `@nodetto/core` and the
canonical CLI fixture builder. The lint answers one question: does the SVG
export draw this text clipped, spilling, covered or crowding the element
below?

It must call the same layout functions and box lookups as the export, never
a re-derived copy:

- `packages/core/src/svg-export/basic-shapes.ts:renderNode`
- `packages/core/src/svg-export/paint.ts:centredLabel`
- `packages/core/src/svg-export/connectors.ts:renderConnector`
- `packages/core/src/svg-export/text-note.ts:renderTextNote`
- `packages/core/src/svg-export/document.ts:renderElementsSvg` and
  `renderPageSvg`

This plan also owns `apps/cli/src/__fixtures__/text-layout.ts`, so the
fixture geometry is checked against the real lint before the wave-2 CLI
plans assert on it.

## Non-goals

- No change to any file under `packages/core/src/svg-export/`, to
  `label-layout.ts`, `node-label.ts`, `shapes/**`, `apps/cli/src/*.ts`
  (other than the new fixture file) or `apps/cli/native/**`.
- No configuration, no severities other than `warning`, no other page kinds,
  no real-font metrics, no frame-clip (`clipOf`) modelling.
- No new abstraction layer (no generic geometry library). Keep the sweep a
  private helper in `rules.ts`.

## writePaths

- packages/core/src/text-layout-lint/rules.ts (new)
- packages/core/src/text-layout-lint/engine.ts (new)
- packages/core/src/text-layout-lint/index.ts (new)
- packages/core/src/text-layout-lint/rules.test.ts (new)
- packages/core/src/text-layout-lint/engine.test.ts (new)
- packages/core/src/text-layout.ts
- packages/core/src/index.ts
- apps/cli/src/__fixtures__/text-layout.ts (new)
- impl-plans/progress/tll-01-core-lint.md
- tmp/text-layout-lint-s551/tll-01-core-lint

sharedPaths: none.

## File-level changes

### `packages/core/src/text-layout.ts`

- Add one exported function, next to `wrapTextLines`:

  ```ts
  export function estimatedTextWidth(text: string, fontSize: number, letterSpacing = 0): number
  ```

  It returns `graphemes(text).length * glyphAdvance(fontSize, letterSpacing)`,
  using the existing private `graphemes` and `glyphAdvance`.
- Do not change any existing function. Export output must stay
  byte-identical.

### `packages/core/src/index.ts`

- Add `estimatedTextWidth` to the existing `export { ... } from "./text-layout.ts";`
  list (around line 295-303).
- Add `export * from "./text-layout-lint/index.ts";` directly after
  `export * from "./breadboard/index.ts";` (line 370).
- Change nothing else.

### `packages/core/src/text-layout-lint/index.ts`

Imitate `packages/core/src/bpmn/lint/index.ts`. It re-exports:

- `TEXT_LAYOUT_LINT_RULE_IDS`
- `TEXT_LAYOUT_LINT_PAGE_KINDS`
- `lintTextLayoutPage`
- the types `TextLayoutLintFinding` and `TextLayoutLintRuleId`

### `packages/core/src/text-layout-lint/engine.ts`

`lintTextLayoutPage(document, pageId)` does the following.

1. **Build the context.** Build the same inputs as `Editor.exportPageSvg`:
   - `new Store(document)`
   - `createDefaultRegistry()` (from `../shapes/index.ts`)
   - `createShapeContext(store, registry, 1)` (from `../hit-test.ts`)
   - `DEFAULT_SVG_THEME.fontSize` (from `../svg-export/theme.ts`; read-only
     import)

   Import from concrete modules, never from `../index.ts`, to avoid cycles.
2. **Walk the page elements.** Walk `store.getPageElements(pageId)` in order.
   Record `order = index`.
3. **Skip what the renderer skips.** Copy the conditions from
   `svg-export/document.ts:renderElementsSvg`:
   - `visual.hidden`
   - `context.isHidden?.(id)`
   - `context.isMaskSource?.(id)`
   - `type === "group"`
   - a null `registry.getOrFallback(type).getBounds(element, context)`
4. **Classify each remaining element.** Edges are detected with
   `getElementTypeDefinition(type)?.category === "edge"` from `@nodetto/ir`.
   - **Label item:** an edge whose type does not start with `bpmn.`,
     `resolveConnector(element, context, endpointReaderFor(type))` is
     non-null, and `connectorDecoration(element).label !== ""`.
     - Its box is `connectorLabelBackdrop(connectorLabelLayout(label, element.visual), resolved.labelPoint)`.
     - Keep `resolved.points` for the zone exclusion.
   - **Body item:** a non-edge whose type is not `frame`, `group`,
     `draw.freehand` or `draw.path`, whose `visual.rotation` is `0` or
     undefined, and whose box is non-null.
   - **label-overflow subject:** a `node.generic` or `shape.geo` element with
     a non-empty `semantic.label`. Read the label the way the renderer does:
     `readString(element.semantic, "label")`, or the equivalent `typeof`
     check.
   - **note-overflow subject:** a `text.note` element.
5. **Run the rules.** Call the three rule functions from `rules.ts`.
6. **Order the findings.** Dedupe by
   `JSON.stringify([ruleId, elementId, message])`. Sort by:
   1. element order;
   2. index in `TEXT_LAYOUT_LINT_RULE_IDS`;
   3. `message.localeCompare`.

   Imitate the dedupe and sort in
   `packages/core/src/bpmn/lint/engine.ts:lintBpmnPage`.

### `packages/core/src/text-layout-lint/rules.ts`

- Constants:
  - `TEXT_LAYOUT_LINT_RULE_IDS = ["label-overflow", "label-collision", "note-overflow"] as const`
  - `TEXT_LAYOUT_LINT_PAGE_KINDS: readonly PageKind[] = ["architecture"]`
  - `EPS = 0.01`
  - `fmt(v) = String(Math.round(v * 10) / 10)`
- Message templates. Use them exactly; `<x>` means `fmt(x)`, and ids and
  types are raw strings.
  - **label-overflow, width.** For the first line `i` whose
    `line.trim() !== ""` and whose
    `W = estimatedTextWidth(line, fontSize, letterSpacing) > A + EPS`, the
    message is
    `Label line <i+1> of <n> is <W> wide but the text area is <A> wide at <fontSize>px; export clips it.`
    - For `shape.geo`, the sentence ends `export draws it past the label padding.`
    - `letterSpacing` is `visual.style?.letterSpacing ?? 0`.
  - **label-overflow, height.** When `H = n * lineHeight > B + EPS`, the
    message is
    `Label needs <n> lines (<H> high) but the box is <B> high at <fontSize>px; export clips <k> lines.`
    - For geo, the ending is `the text spills outside the shape.`
    - `k` counts the lines `j` with `top + (j + 1) * lineHeight > B + EPS`.
    - For a node, `top = layout.top`. For geo, `top = (B - H) / 2`.
  - **label-collision, label vs label:**
    `Label box <w>x<h> overlaps the label of <otherEdgeId> by <ow>x<oh>.`
  - **label-collision, label vs body:**
    `Label box <w>x<h> overlaps <type> <bodyId> by <ow>x<oh>.`
  - **note-overflow, clipped:**
    `Text needs <n> lines (<paddingY*2 + n*lineHeight> high with padding) but the box is <box.height> high; export drops <n-d> lines.`
  - **note-overflow, into the element below:**
    `Text runs <textBottom - b.y> into <type> <bodyId> below; keep <paddingY> clear.`
  - **note-overflow, too close above the element below:**
    `Text ends <b.y - textBottom> above <type> <bodyId>; keep <paddingY> clear.`
- `label-overflow` layouts:
  - **node:** `nodeLabelLayout(label, { ...visual, width: box.width, height: box.height })`.
    `A = layout.width`, `B = box.height`.
  - **geo:** `boxLabelLayout(label, box.width, visual, DEFAULT_SVG_THEME.fontSize)`.
    `A = box.width - 2 * TEXT_NOTE_PADDING_X` (16), `B = box.height`.
  - `fontSize` and `lineHeight` come from the layout object.
- `note-overflow` values. Repeat the arithmetic of
  `svg-export/text-note.ts:renderTextNote` exactly:
  - `paddingX = textPadding ?? TEXT_NOTE_PADDING_X`
  - `paddingY = textPadding ?? TEXT_NOTE_PADDING_Y`
  - `fontSize = style.fontSize ?? DEFAULT_SVG_THEME.fontSize`
  - `lineHeight = fontSize * (style.lineHeight ?? TEXT_NOTE_LINE_HEIGHT)`
  - lines from `wrapTextLines(textNoteText(semantic), Math.max(1, box.width - paddingX * 2), fontSize, letterSpacing)`
  - `freeHeight` and `verticalOffset` (top, middle or bottom), as in the
    renderer
  - the drawn count `d`: count lines `j` while
    `paddingY + verticalOffset + (j + 1) * lineHeight <= box.height + EPS`
  - The proximity probe applies only when the note's rotation is 0 or
    undefined, `d >= 1`, and at least one of the first `d` lines is
    non-empty.
- Sweep helper (private):
  - input: items `{ box, order, ref }`;
  - sort by `box.x`, then `order`;
  - keep an active list; drop active items whose `box.x + box.width < current.box.x`;
  - for each active item whose y-range overlaps the current one, emit the
    candidate pair;
  - the exact overlap test is done by the caller:
    `ow = min(right) - max(left)` and `oh = ...`, both `> EPS`.
- Pair rules:
  - **Label vs label:** emit one finding per pair, on the edge with the
    larger `order`.
  - **Label vs body:** skip the body when its box contains every point of
    that edge's `resolved.points`. Use inclusive bounds widened by `EPS`.
    Endpoint elements are not excluded.
  - **Note probe vs body:**
    - the probe box is `[box.x, textTop, box.width, textBottom + paddingY - textTop]`;
    - skip the note itself;
    - require x-overlap `> EPS`, `b.y > textTop + EPS` and
      `b.y < textBottom + paddingY - EPS`.

### `apps/cli/src/__fixtures__/text-layout.ts`

Imitate `apps/cli/src/__fixtures__/dense-relations.ts`:

1. Build the document from a parsed JSONL header and page line with
   `parseDocument` from `@nodetto/io`:
   - `{"kind":"document","schemaVersion":1,"id":"doc-text-layout","title":"Text layout"}`
   - `{"kind":"page","id":"page-architecture","name":"Architecture","pageKind":<kind>}`
2. Create `new Editor({ document })` and call `setCurrentPage("page-architecture")`.
3. Build elements with `editor.buildElement(type, { id, semantic, visual })`.
4. Add them with one `editor.apply([{ type: "createElement", element }])` batch.
5. Return `serializeDocument(editor.getSnapshot())`.

The document has exactly one page. Exports follow the overview contract.

Problem document layout. All coordinates are page units.

- `L` is `"Payment gateway authorisation service"`.
- For `text.note` elements, set `textResize: "fixed"`.
- For `shape.geo` elements, set only `label`, and let the geo kind use the
  `buildElement` default.

| id | type | visual x,y,w,h | semantic |
| --- | --- | --- | --- |
| node-wrapped | node.generic | 0,0,140,80 | label L |
| node-clipped | node.generic | 200,0,140,30 | label L |
| node-narrow | node.generic | 400,0,24,60 | label "Payment gateway" |
| geo-spill | shape.geo | 480,0,140,30 | label L |
| edge-https | edge.generic | - | fromPoint 0,400; toPoint 400,400; label "HTTPS" |
| edge-grpc | edge.generic | - | fromPoint 200,250; toPoint 200,550; label "gRPC" |
| edge-audit | edge.generic | - | fromPoint 600,400; toPoint 1000,400; label "Events" |
| node-audit | node.generic | 740,370,120,60 | label "Audit log" |
| zone-private | shape.geo | 1100,250,500,300 | label "Private network" |
| edge-tls | edge.generic | - | fromPoint 1150,480; toPoint 1550,480; label "TLS" |
| note-retry | text.note | 0,800,200,30 | text "Retry policy: retry each failed request three times with exponential backoff, then move it to the dead letter queue." |
| note-cache | text.note | 400,800,200,60 | text "Cache invalidation runs after every deploy" |
| node-queue | node.generic | 400,841,200,60 | label "Message queue" |

Expected findings, hand-derived from the design formulas, in lint order.
`TEXT_LAYOUT_EXPECTED` is these `{ruleId, elementId}` pairs:

1. label-overflow node-clipped: `Label needs 3 lines (46.8 high) but the box is 30 high at 13px; export clips 2 lines.`
2. label-overflow node-narrow: `Label line 1 of 15 is 7.2 wide but the text area is 4 wide at 13px; export clips it.`
3. label-overflow node-narrow: `Label needs 15 lines (234 high) but the box is 60 high at 13px; export clips 12 lines.`
4. label-overflow geo-spill: `Label needs 3 lines (46.8 high) but the box is 30 high at 13px; the text spills outside the shape.`
5. label-collision edge-grpc: overlaps the label of edge-https.
6. label-collision edge-audit: overlaps `node.generic node-audit`.
7. note-overflow note-retry: `... export drops <n-1> lines.` (`d = 1`)
8. note-overflow note-cache: `Text ends 3.8 above node.generic node-queue; keep 6 clear.`

No finding for:

- node-wrapped (the wrapped-but-fitting control);
- zone-private and edge-tls (the zone encloses the whole edge);
- edge-https (the earlier edge of the pair).

If the real lint gives a different set or a different message for these
cases, do not fix it by editing the fixture. First re-derive the value from
the renderer code. A layout fact the plan got wrong (for example the page
order of elements) may be corrected in the fixture. A formula deviation is
fixed in `rules.ts`. Record either decision in the progress log.

Clean document:

| id | type | visual | semantic |
| --- | --- | --- | --- |
| node-gateway | node.generic | 0,0,200,60 | label "Payment gateway" |
| edge-https | edge.generic | - | fromPoint 0,200; toPoint 300,200; label "HTTPS" |
| edge-grpc | edge.generic | - | fromPoint 0,400; toPoint 300,400; label "gRPC" |
| note-first | text.note | 400,0,200,48 (fixed) | text "Retry three times" |
| note-second | text.note | 400,48,200,48 (fixed) | text "Then alert the on-call engineer" |

Expected result: zero findings. The notes are stacked flush, and the gap
below note-first's text is 26.4, which is at least 6.

`textLayoutDenseDocument(count)`:

- `count` nodes `node-<i>` with label `Service <i>`, 160x60, at
  `((i % 20) * 250, Math.floor(i / 20) * 200)`;
- `count` edges `edge-<i>` with label `call <i>`, from
  `(x + 160, y + 30)` to `(x + 250, y + 30)` of node i;
- the result must be deterministic (two builds are byte-equal).

## Pitfalls

- Use `nodeLabelLayout` with the box's width and height overridden, exactly
  as `renderNode` does. `visual.width` can differ from `getBounds`.
- `boxLabelLayout` trims lines and `nodeLabelLayout` does not. Measure the
  line string you got back.
- Geo text spills and is not clipped, so geo uses the "spills" wording. The
  node clip rect has the full box height, so `B = box.height`. Do not
  subtract padding for node or geo.
- For notes, the clip check uses `box.height` and not `box.height - paddingY`.
  Copy the renderer's `<= box.y + box.height + 0.01` condition.
- A label-vs-label pair is reported once, on the later edge. Never report
  it on both edges.
- Do not lay out a label twice. Never call layout code inside the pair loop.
- No regex splitting in new lint code. It runs in the Boa engine.
- Message numbers must use `fmt`. Never use `toFixed`, so output stays the
  same across engines.
- Do not edit `packages/core/src/svg-export/**`, even to export a helper.

## Tests to add

`rules.test.ts` builds small documents inline with `Editor` and an
`architecture` page. It must not import from `apps/cli`.

- Node 140x80 with L -> no finding. Node 140x30 with L -> exactly the
  height message pinned above.
- Node 24x60 "Payment gateway" -> a width finding and a height finding, in
  that order.
- Geo 140x30 with L -> a height finding ending in "spills outside the
  shape."
- Agreement with the renderer:
  - take `editor.exportPageSvg()`;
  - in the `data-id="<node id>"` group, read the `<text` `y` values (a test
    regex is fine in Bun);
  - for the clipped node, some `y + lineHeight / 2 > box.y + box.height`,
    and the lint reports it;
  - for the wrapped node, none does, and the lint is silent.
- Two edges with coinciding midpoints -> one `label-collision` on the later
  edge only.
- An edge label over an unrelated node -> a finding naming `node.generic <id>`.
- A rectangle enclosing a labelled edge and its endpoints -> no finding.
- A labelled edge between two attached nodes (`semantic.from` and `.to`) 20
  units apart -> findings against the endpoint nodes. Endpoints are not
  excluded.
- A rotated node under a label -> no finding.
- A fixed 200x30 note with long text -> the "export drops" finding.
- Notes:
  - a fixed note with a node 3.8 below its text bottom -> "Text ends 3.8
    above";
  - a node starting inside the text -> "Text runs ... into";
  - a node exactly `paddingY` below -> nothing;
  - a container rectangle starting above the note -> nothing.

`engine.test.ts`:

- Hidden element -> skipped.
- Element inside a `group` -> still linted; the group itself is skipped.
- Unlabelled edge -> nothing.
- A page that is not passed in -> no cross-page findings.
- Ordering by element order, then rule, then message. Deduplication.
- `TEXT_LAYOUT_LINT_RULE_IDS` equals the three ids in order.
- `TEXT_LAYOUT_LINT_PAGE_KINDS` equals `["architecture"]`.
- `estimatedTextWidth("abc", 10)` is `3 * 5.5`. A ZWJ emoji counts as one
  grapheme.
- A 300-node and 300-edge dense page (same layout as
  `textLayoutDenseDocument`, built inline):
  - two runs give equal results;
  - the test passes a 10000 ms timeout argument;
  - it makes no timing assertion.

Fixture smoke check. This is a scratch script, not a test file:

- Put it at `tmp/text-layout-lint-s551/tll-01-core-lint/fixture-check.ts`.
- It imports the fixture builders and `lintTextLayoutPage`, then prints the
  findings for the problem, clean and freeform-problem documents.
- The freeform variant still returns findings, because the lint API takes
  any page id. Only the CLI filters by kind.
- Paste the printed findings into the progress log.

## Verification (each must exit 0; logs under the scratch root)

1. `BUN_OPTIONS=--jsx-runtime=classic bun test packages/core/src/text-layout-lint > tmp/text-layout-lint-s551/tll-01-core-lint/core-lint.log 2>&1; echo "exit=$?"`.
   Evidence: all new tests pass, 0 fail.
2. `BUN_OPTIONS=--jsx-runtime=classic bun test packages/core/src/text-layout.test.ts packages/core/src/label-layout.test.ts packages/core/src/node-label.test.ts packages/core/src/svg-export.test.ts > tmp/text-layout-lint-s551/tll-01-core-lint/core-render.log 2>&1; echo "exit=$?"`.
   Evidence: the existing render tests are unchanged and pass.
3. `bun tmp/text-layout-lint-s551/tll-01-core-lint/fixture-check.ts > tmp/text-layout-lint-s551/tll-01-core-lint/fixture-check.log 2>&1; echo "exit=$?"`.
   Evidence: the problem document gives exactly the 8 `TEXT_LAYOUT_EXPECTED`
   pairs in order, and the clean document gives 0.
4. `bunx biome check packages/core/src/text-layout-lint packages/core/src/text-layout.ts packages/core/src/index.ts apps/cli/src/__fixtures__/text-layout.ts > tmp/text-layout-lint-s551/tll-01-core-lint/biome.log 2>&1; echo "exit=$?"`.
5. `bunx tsc -p tsconfig.json --noEmit > tmp/text-layout-lint-s551/tll-01-core-lint/tsc.log 2>&1; echo "exit=$?"`.
   This is a shared-input gate (tll-02 edits `help.ts`).
6. `git diff --quiet -- packages/core/src/svg-export packages/core/src/label-layout.ts packages/core/src/node-label.ts packages/core/src/shapes; echo "exit=$?"`.
   Evidence: exit 0, so the renderer is untouched.

## Done criteria

- All six commands exit 0, or a gate is recorded as `pending-join` with its
  owner.
- `grep -n "export \* from \"./text-layout-lint/index.ts\"" packages/core/src/index.ts`
  prints one line.
- `grep -n "estimatedTextWidth" packages/core/src/index.ts` prints one line.
- The progress log has pre and post hashes, the intent snapshot, the
  fixture-check output and `STATUS: done` as the last line.

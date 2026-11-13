# slt-01-settings-fields

- planId: slt-01-settings-fields; wave 1; dependsOn: none
- Design: sections 3.1, 3.1.1 (type definition and read rule), 3.2, 3.3,
  3.4 (keyOrder only) and 10 (`slt-01`) of
  `design-docs/specs/design-slide-transition-settings.md`.
- writePaths: `packages/ir/src/types.ts`, `packages/ir/src/validate.ts`,
  `packages/ir/src/keyOrder.ts`, `packages/ir/src/index.ts`,
  `packages/ir/src/registry.ts`, `packages/ir/src/semantics.ts`,
  `packages/ir/src/registry/presentation-slide.ts` (new),
  `packages/ir/src/slide-settings.test.ts` (new),
  `packages/ir/src/registry.test.ts`, `packages/core/src/commands.ts`,
  `packages/core/src/visual-animation-command.test.ts` (new), progress file,
  `tmp/slt-s856/slt-01-settings-fields`, `target`
- artifactRoots: `target`.

## Intent and context

Add the data model for all Phase 2 settings and make both validators
reject bad values. Per-shape settings live in `Element.visual.animation`.
Per-slide settings live in `visual.animation.slide` of one artwork-free
resource element of type `presentation.slide` per page. The hosted Worker
rejects new `Page` fields, so there is no `Page` field. Export the names
pinned in `slt-overview.md` exactly.

## Non-goals

- No `Page` field, no `updatePage`/`updateDocument` change, no new Command
  kind, no change to any command handler body.
- No shape util, copy rule, exporter or inspector work (slt-03 and slt-06).
- No io/collab code (visual is carried generically).

## File-level changes

1. `types.ts`: add the overview types. `Visual.animation?: ElementAnimation`
   goes right after `linkId`, with a one-line doc comment. Imitate how
   `Visual.linkId` was added.
2. `validate.ts`: export `validateElementAnimation(value, path)`.
   - Rules: a non-plain-object -> `type.object`. Each enum (`enter`, `exit`,
     `linked`, `enterFrom`, `exitTo`, `slide.mode`) -> `value.enum` via the
     existing `checkEnum`. `slide.stagger` -> `type.boolean`.
   - Numeric ranges use code `range.animation` (also for a non-number or
     non-integer): `durationMs` 50..5000, `delayMs` 0..5000, `order`
     -999..999, `slide.durationMs` 100..5000.
   - Unknown keys in `animation` or `slide` -> `field.unknown` warning
     (imitate `warnUnknownFields`).
   - Paths: `${path}.<key>` and `${path}.slide.<key>`.
   - Call it from the visual validation right after the `linkId` check when
     `raw["animation"] !== undefined`, with path `${path}.animation`.
   - Also export `ANIMATION_LIMITS` (overview) and use it here.
3. `registry/presentation-slide.ts` (new):
   - `PRESENTATION_SLIDE: ElementTypeDefinition`: `type:
     "presentation.slide"`, `category: "resource"`, `references:
     noReferences`, `onReferenceDeleted: "detach"`, `keyOrder: { keys:
     ["note"] }` (a reserved optional string, so the registry key-order
     test holds). `validateSemantic`: plain object; optional `note`
     string; other keys -> `field.unknown` warning.
   - Pattern: `DESIGN_GUIDE` in `registry/resources.ts`.
   - Also export `SLIDE_SETTINGS_TYPE` and `readSlideSettings(pageElements)`.
     `readSlideSettings` filters `type === SLIDE_SETTINGS_TYPE`, sorts by
     `(index, id)` with plain string comparison (the same order as
     `compareFractional` for base62 keys; do not import core), and returns
     the first one's `visual.animation?.slide`, or `undefined`.
4. `semantics.ts`: map `"presentation.slide": PresentationSlideSemantic`
   with `interface PresentationSlideSemantic { readonly note?: string }`.
5. `registry.ts`: import and append `PRESENTATION_SLIDE` to `DEFINITIONS`
   next to `DESIGN_GUIDE`.
6. `registry.test.ts`: add `"presentation.slide"` to the expected
   `ELEMENT_TYPES` list. That is the only allowed change in this file.
7. `keyOrder.ts`: add `"animation"` right after `"linkId"` in the visual
   keys, and the child order `animation: { keys: ["enter", "enterFrom",
   "exit", "exitTo", "linked", "delayMs", "durationMs", "order", "slide"],
   children: { slide: { keys: ["mode", "durationMs", "stagger"] } } }`.
8. `index.ts`: export every overview IR name, `PRESENTATION_SLIDE` and
   `PresentationSlideSemantic`.
9. `packages/core/src/commands.ts`, validation wiring only (design 3.3):
   - Import `validateElementAnimation` from `@nodetto/ir`.
   - At the end of the private `validateVisualFields(visual)` (line ~247),
     before its final return: when `visual.animation !== undefined`,
     append `validateElementAnimation(visual.animation, "visual.animation")`
     filtered to `severity === "error"`.
   - Pitfall: `updateVisual`/`replaceVisual` fail on ANY returned issue
     (`if (visualIssues.length) fail(...)`). Without the filter, unknown
     nested keys would be rejected.
   - Do not touch the `Command` union, `updateDocument` or any `case` body.

## Invariants

- Documents without `animation` or a carrier serialize byte-identically
  (keyOrder only orders present keys).
- Existing IR and core tests pass unchanged, except the one
  `registry.test.ts` list line.

## Tests

`packages/ir/src/slide-settings.test.ts`:
- each enum with a bad value -> `value.enum` at the exact path;
- `durationMs` 49 and 5001, `delayMs` -1, `order` 1.5,
  `slide.durationMs` 99 and 5001 -> `range.animation`; each boundary value
  is valid;
- `{ future: 1 }` in `animation` and in `slide` -> only a `field.unknown`
  warning;
- a `presentation.slide` element with `semantic: {}` validates with no
  error; `{ x: 1 }` -> warning only;
- `readSlideSettings`: no carrier -> `undefined`; a shape carrying
  `animation.slide` -> ignored; two carriers -> the one with the lower
  `(index, id)` wins.

`packages/core/src/visual-animation-command.test.ts` (use
`applyCommands`, `Store`, `test-helpers.ts` `document`/`element` as in the
reviewer reproduction in design section 10). For `createElement` (a
carrier and a `shape.geo`), `updateVisual` and `replaceVisual`:
- valid `animation` with `slide` -> accepted and stored;
- `enter: "invalid-effect"`, `slide: { mode: "invalid-mode" }`,
  `durationMs: -1` -> each throws `CommandError` with an issue path that
  starts with `visual.animation`, and the store is deep-equal to before;
- `animation: { future: 1 }` -> accepted and preserved;
- `editor.undo()` after a valid `updateVisual` restores the previous
  visual exactly (use the Editor test pattern in
  `packages/core/src/copy-page-elements.test.ts`).

## Verification (all must exit 0; logs in `tmp/slt-s856/slt-01-settings-fields/`)

1. `bun test packages/ir packages/core/src/visual-animation-command.test.ts`
2. `bun run typecheck`
3. `bunx biome check --diagnostic-level=warn packages/ir/src/types.ts packages/ir/src/validate.ts packages/ir/src/keyOrder.ts packages/ir/src/index.ts packages/ir/src/registry.ts packages/ir/src/semantics.ts packages/ir/src/registry/presentation-slide.ts packages/ir/src/slide-settings.test.ts packages/ir/src/registry.test.ts packages/core/src/commands.ts packages/core/src/visual-animation-command.test.ts`
4. `bun .agents/scripts/strict-index-gate.ts check --baseline target/strict-index/baseline.log --log target/strict-index/slt-01-settings-fields.log -- packages/ir/src/types.ts packages/ir/src/validate.ts packages/ir/src/keyOrder.ts packages/ir/src/index.ts packages/ir/src/registry.ts packages/ir/src/semantics.ts packages/ir/src/registry/presentation-slide.ts packages/ir/src/slide-settings.test.ts packages/ir/src/registry.test.ts packages/core/src/commands.ts packages/core/src/visual-animation-command.test.ts`
Recorded evidence (not an exit-0 gate, because the diff is expected to be
non-empty): save the output of `git diff a9abe26 --
packages/core/src/commands.ts` to
`tmp/slt-s856/slt-01-settings-fields/commands-diff.log` and confirm in the
progress log that it shows only the import and the filtered call.

## Done criteria

- All overview IR names import from `@nodetto/ir`.
- The commands above exit 0.
- No file outside writePaths changed.

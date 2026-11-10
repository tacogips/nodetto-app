# ipd-01-ir-schema

- planId: ipd-01-ir-schema
- planPath: impl-plans/active/ipd-01-ir-schema.md
- progressPath: impl-plans/progress/ipd-01-ir-schema.md
- wave: 2. dependsOn: ipd-00-baseline
- Design (binding): `design-docs/specs/design-iphone-app-design.md`, "Global rules" and Decisions 1.2, 2.2, 3.2, 3.3, 4.2-4.5, 5.1, 6.6, 8.1, 8.2.
- Evidence: `tmp/ipd-s772/ipd-01-ir-schema/`.
<!-- ownership:start -->
- writePaths:
  - `packages/ir/src/types.ts`
  - `packages/ir/src/keyOrder.ts`
  - `packages/ir/src/validate.ts`
  - `packages/ir/src/ui-controls.ts`
  - `packages/ir/src/semantics/design.ts`
  - `packages/ir/src/semantics/connectors.ts`
  - `packages/ir/src/semantics.ts`
  - `packages/ir/src/registry.ts`
  - `packages/ir/src/registry/containers.ts`
  - `packages/ir/src/registry/generic.ts`
  - `packages/ir/src/registry/icons.ts`
  - `packages/ir/src/registry.test.ts`
  - `packages/ir/src/index.ts`
  - `packages/ir/src/ipd-schema.test.ts`
  - `packages/io/src/jsonl/golden.test.ts`
  - `packages/io/src/__fixtures__/ui-icon.jsonl`
  - `impl-plans/progress/ipd-01-ir-schema.md`
  - `tmp/ipd-s772/ipd-01-ir-schema`
- sharedPaths:
  - `packages/core/src/semantic-field-audit.test.ts`
- sharedPathNotes:
  - path: `packages/core/src/semantic-field-audit.test.ts`; intendedEdit: update expectations only if the audit enumerates IR keys and fails solely because of the new optional fields; record the reason
- artifactRoots:
  - `tmp/ipd-s772/ipd-01-ir-schema`
<!-- ownership:end -->

## Intent and context

Every later plan reads new optional IR fields. This plan is the schema contract.

It adds:

- the types, validation and key order for all new fields;
- one new element type, `ui.icon`;
- two new prototype actions.

`SCHEMA_VERSION` stays 1, and no migration is written. Documents without the new fields must validate and serialize byte-identically. Unknown-field handling is unchanged: unknown keys warn and are preserved (`packages/ir/src/validate.ts:102-159`).

## Non-goals

- No rendering, editor, CLI or UI code.
- No icon name registry. IR checks name syntax only; unknown icon names are reported in core (`ipd-07`).
- No migrations.
- Do not edit `packages/core`, except the audit test listed under sharedPaths if it pins IR keys.

## File-level changes (exact contract)

`packages/ir/src/types.ts`:

- `VisualStyle` gains:
  - `accentColor?: string`;
  - `selectedColor?: string`;
  - `strokeAlign?: StrokeAlign`;
  - `strokeSides?: StrokeSides`.
- New exports:
  - `STROKE_ALIGNS = ["inside","center","outside"] as const`;
  - `type StrokeAlign`;
  - `interface StrokeSides { readonly top?: number; readonly right?: number; readonly bottom?: number; readonly left?: number }`.
- `Visual` gains:
  - `textMeasure?: "proportional"`;
  - `textTruncate?: "ellipsis"`.

`packages/ir/src/semantics/design.ts`, `FrameSemantic` gains:

- `titlePlacement?: "inside" | "outside"`, with exported `FRAME_TITLE_PLACEMENTS`;
- `prototypeFlowName?: string`;
- `kit?: string`.

`packages/ir/src/ui-controls.ts`:

- `UiControlSemantic` gains:
  - `indicator?: "cell" | "underline" | "pill"`, with exported `TAB_INDICATORS`;
  - `leadingIcon?: string`;
  - `trailingIcon?: string`;
  - `iconSize?: number`;
  - `badge?: string`.
- Validate them:
  - indicator is in the enum;
  - icon names match `ICON_NAME_PATTERN`;
  - `iconSize` is finite, > 0 and <= 256;
  - `badge` is a string that may be empty, at most 16 characters.
- Add the new keys to `keyOrder.keys` after `disabled`.

`packages/ir/src/semantics/connectors.ts`: `PROTOTYPE_ACTIONS` appends `"back"` and `"swap-overlay"`, in that order, after the existing values.

New `packages/ir/src/registry/icons.ts`:

- `export const ICON_NAME_PATTERN = /^(lucide:)?[a-z0-9]+(-[a-z0-9]+)*$/`
- `export const MAX_ICON_PATH_LENGTH = 8192`
- `export interface UiIconSemantic { readonly icon?: string; readonly path?: string; readonly viewBox?: number }`
- `export const uiIconDefinition: ElementTypeDefinition` with:
  - type `"ui.icon"`, category `"node"`, `onReferenceDeleted: "detach"`, `references: () => []`;
  - `keyOrder` keys `icon`, `path`, `viewBox`.

Validation error codes:

| Condition | Code |
| --- | --- |
| Neither or both of `icon` / `path` | `icon.source` |
| Bad name syntax | `icon.name` |
| `path` longer than 8192 or containing characters outside `[MmLlHhVvCcSsQqTtAaZz0-9eE+\-.,\s]` | `icon.path` |
| `viewBox` not finite, <= 0 or > 4096 | `value.range`, using the existing numeric check helpers in `packages/ir/src/checks.ts` |

Registration:

- `packages/ir/src/registry.ts`: register `uiIconDefinition`, next to `uiControlDefinition`.
- `packages/ir/src/semantics.ts`: add `"ui.icon": UiIconSemantic` to the type-to-payload map.

`packages/ir/src/keyOrder.ts`:

- Style key order: add `accentColor`, `selectedColor` (after `color`), `strokeAlign` and `strokeSides` (after `strokeWidth`).
- Visual key order: add `textMeasure` and `textTruncate` (after `textPadding`).
- Frame semantic key order (wherever frame keys are ordered, `registry/containers.ts`): `titlePlacement` after `showTitle`, `prototypeFlowName` after `prototypeStart`, `kit` after `component`.

The CLI derives allowed style keys from `VISUAL_STYLE_KEY_ORDER.keys` (`apps/cli/src/edit/operation-fields.ts:126-166`), so the order list is the CLI contract.

`packages/ir/src/validate.ts`, visual and style validation (around `:243-672`):

- `accentColor` and `selectedColor`: same color check as `fill`.
- `strokeAlign`: enum.
- `strokeSides`: plain object with only those four keys, each finite, >= 0 and <= 1000. An unknown key is an error `value.key`.
- `textMeasure` and `textTruncate`: enum.
- Document-level warning `prototype.flowName.duplicate` when two frames with `prototypeStart: true` share the same explicit `prototypeFlowName`. Report it on the second frame, in document order. Imitate an existing document-level duplicate check in `validate.ts`, if one exists, or element-level issue emission.

`packages/ir/src/registry/containers.ts`, frame validation:

- `titlePlacement` is in the enum;
- `prototypeFlowName` is a non-empty string, <= 80 characters;
- `kit` matches `/^[a-z]+:[a-z0-9-]+@[0-9]+$/`.

`packages/ir/src/registry/generic.ts`: prototype validation accepts the new actions. A `back` link keeps the existing rule that `to` must be a frame.

`packages/ir/src/index.ts` exports every new name above.

## Patterns to imitate

- `packages/ir/src/ui-controls.ts:uiControlDefinition` for the `ui.icon` definition.
- `packages/ir/src/registry/drawing.ts` (text.note validation) for check helpers.
- The `prototypeFixed` boolean visual field (`validate.ts:260`, `validate.test.ts:518-536`) for adding a visual field with tests.

## Pitfalls

- Do not change any existing enum order or remove a value. `PROTOTYPE_ACTIONS` only appends.
- Key order changes affect serialization only when a key is present. Never default-fill new keys.
- `strokeSides` is an object. Arrays, nulls and negative numbers are errors.
- Do not reject `lucide:` prefixed names, and do not lowercase on validation. Uppercase is an `icon.name` error.
- `ui.icon` must be a `node` category element, so it is selectable and boxed. It has no references.

## Tests to add: new `packages/ir/src/ipd-schema.test.ts`

- A document with every new field at a valid value -> no issues. JSONL round trip through `@nodetto/io` is byte-stable. Use the existing validate test helpers; if `@nodetto/io` is not importable from ir tests, round-trip with `JSON.stringify` and key order only.
- `strokeSides: {top: -1}` -> an error at `visual.style.strokeSides.top`.
- `strokeSides: {middle: 1}` -> an error.
- `ui.icon` with both `icon` and `path`, or neither -> `icon.source`.
- `icon: "Bell"` -> `icon.name`.
- `icon: "lucide:bell"` -> valid.
- `path` of 8193 characters -> `icon.path`.
- `path: "M0 0 L 10 10 Z"` -> valid.
- Prototype edge with `prototypeAction: "back"` to a frame -> valid. `"swap-overlay"` -> valid.
- Two start frames with the same `prototypeFlowName` -> one `prototype.flowName.duplicate` warning.
- `kit: "ios:list-row@1"` -> valid. `kit: "list-row"` -> error.
- Every existing ir test still passes.

## Verification (evidence in `tmp/ipd-s772/ipd-01-ir-schema/final/`)

1. `bun test packages/ir` -> exit 0, with 0 fail in the summary.
2. `bun test packages/core/src/semantic-field-audit.test.ts packages/core/src/svg-export.test.ts` -> exit 0. If the audit test fails only because it enumerates IR keys, update its expectation (sharedPaths) and record why.
3. `bun run typecheck` -> full log. No `error TS` line names a file under `packages/ir/src`. Errors elsewhere are recorded as findings with file and line.
4. `bunx biome check packages/ir/src` -> exit 0.

## Done criteria

- The verification above passes.
- `rg -n 'ICON_NAME_PATTERN|uiIconDefinition|STROKE_ALIGNS|TAB_INDICATORS|FRAME_TITLE_PLACEMENTS' packages/ir/src/index.ts` -> 5 matches.
- `rg -n '"swap-overlay"' packages/ir/src/semantics/connectors.ts` -> 1 match.
- The progress log has hash records and the evidence table.

Implementation status: done criteria verified on the shared tree; independent review and workflow finalization remain pending. See `impl-plans/progress/ipd-01-ir-schema.md`.

## Worker rules

- Record `git hash-object` of this plan first.
- Read each file fresh before editing it. Record pre and post `git hash-object` per edited file. On drift, re-read, keep the other change and record it.
- Edit only writePaths. The sharedPaths file only for the stated reason.
- No state-changing git commands, no lockfile edits, no broad formatting, no emojis. Generic names only.
- Evidence files must not match Bun test name patterns. Every evidence command records the command, exit code, counts and log path.

## Amendment 2026-11-10 (blocked-wave-scope-or-contract, round 1)

- Blocker (session-772 wave 2): `bun test packages/ir` could not pass because `packages/ir/src/registry.test.ts` asserts the complete element-type list and was outside writePaths.
- Decision: `packages/ir/src/registry.test.ts` is added to writePaths. The only permitted edit is to add `ui.icon` to its complete ELEMENT_TYPES expectation, in the registry's ordering. Change nothing else in that file.
- Test: `bun test packages/ir/src/registry.test.ts` -> exit 0, 0 fail, and the expectation lists `ui.icon` exactly once.
- Dependency note: ipd-00-baseline is an accepted dependency (its baseline evidence is in `impl-plans/progress/ipd-00-baseline.md`); this plan has no pending dependency and does not redo the baseline.

## Amendment 2026-11-10 (integration-paths-outside-writePaths, round 2)

Second manifest amendment overall. The runtime `checkpointAmendment.amendmentRound` was 0, and the checkpoint was 7c88950. The scope is bounded: this round only assigns the unowned integration path. It changes no IR contract.

- Finding `integration-s775-w1-golden-ui-icon` (mid): this plan registers `ui.icon` in `ELEMENT_TYPES`. `packages/io/src/jsonl/golden.test.ts` "golden file coverage" requires every registered type to appear in some GOLDEN fixture, and it now fails with `missing = ["ui.icon"]`. Reproduced: `bun test packages/io/src/jsonl/golden.test.ts` -> exit 1, 53 pass / 1 fail (log `tmp/ipd-s772/plan-check/amend-s775/golden-before.log`).
- Decision: add `packages/io/src/jsonl/golden.test.ts` and the new file `packages/io/src/__fixtures__/ui-icon.jsonl` to writePaths. No sharedPaths change.
- Ordered changes:
  1. Read `packages/io/src/__fixtures__/ui-controls.jsonl` and use it as the format model: a document record, a page record (`pageKind: "freeform"`), then element records. Create `ui-icon.jsonl` with one document, one page and two `ui.icon` elements. Give one the semantic `{"icon":"bell"}` and the other `{"path":"M0 0L24 24","viewBox":24}`. Each gets a plain `visual` box such as `{"x":20,"y":20,"width":24,"height":24}`. Use generic ids such as `icon-1` through `icon-4`.
  2. Produce the canonical bytes with a throwaway script under `tmp/ipd-s772/ipd-01-ir-schema/`. The script must run `serializeDocument(parseDocument(draft))` from `packages/io/src/jsonl/` and must not be a `*.test.ts` file. Write that output to the fixture. Confirm that `parseDocumentResult` reports `ok: true` and no errors.
  3. In `golden.test.ts`, append `"ui-icon"` as the last entry of the `GOLDEN` array. Change nothing else.
  4. In `impl-plans/progress/ipd-01-ir-schema.md`, record the pre and post `git hash-object` of `golden.test.ts`, the post hash of the new fixture, and the command log.
- Forbidden:
  - Do not edit any existing fixture under `packages/io/src/__fixtures__/`.
  - Do not remove, skip or loosen the coverage assertion, and do not filter `ui.icon` out of `ELEMENT_TYPES`.
  - Do not change `ui.icon` semantics, key order or the registry order.
  - Do not touch `apps/cli/src/edit/label-field.test.ts`. Its `ui.icon` failure comes from `defaultSemantic()` in the core shape registry and is owned by ipd-07-icon-core-cli (`packages/core/src/shapes/ui-icon.ts`).
- Tests:
  - fixture `ui-icon` -> parses without errors, reserializes byte-for-byte, and round-trips identically.
  - coverage test -> `missing` equals `[]`.
- Verification (logs in `tmp/ipd-s772/ipd-01-ir-schema/amend-s775/`):
  - `bun test packages/io/src/jsonl/golden.test.ts` -> exit 0, 0 fail.
  - `bun test packages/ir packages/io` -> exit 0, 0 fail.
  - `bunx biome check packages/io/src/jsonl/golden.test.ts` -> exit 0.
  - `bun run typecheck` -> exit 0.
  - `git diff --exit-code -- packages/io/src/__fixtures__` -> exit 0. The new fixture is untracked, so no existing fixture may change.
- Done: all of the above pass. In `bun test packages apps/cli/src`, the only remaining failure is the ipd-07-owned `label-field.test.ts`.

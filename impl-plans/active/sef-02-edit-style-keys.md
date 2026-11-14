# sef-02-edit-style-keys

- planId: sef-02-edit-style-keys
- planPath: impl-plans/active/sef-02-edit-style-keys.md
- progressPath: impl-plans/progress/sef-02-edit-style-keys.md
- wave: 1
- dependsOn: none
- Design: `design-docs/specs/design-style-export-fixes.md`, section "Unknown `visual.style` keys".
- Worker rules: `impl-plans/active/sef-00-overview.md`.
- writePaths:
  - `apps/cli/src/edit/operation-fields.ts`
  - `apps/cli/src/edit/operation-fields.test.ts`
  - `impl-plans/progress/sef-02-edit-style-keys.md`
  - `tmp/sef-s733/sef-02-edit-style-keys`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Intent and context

Unknown keys inside `visual.style`, such as `textVerticalAlign` or `valign`, are accepted silently
by `edit` and have no effect. `add` and `update` must reject them with an error naming the key and
suggesting the closest valid keys. `checkOperationFields` already runs for each operation before it
is applied (`apps/cli/src/edit/batch.ts:255`).

## Non-goals

- Do not change `checkFields` or its message; `selectors.ts` and existing tests depend on it.
- Do not reject in `connect` (user-qa Q2) or any other operation.
- Do not change IR validation: documents that are only loaded keep the warning path
  (`warnUnknownFields`, `packages/ir/src/validate.ts`).
- Do not add a second key list.

## File-level changes

`apps/cli/src/edit/operation-fields.ts`:

- Import `VISUAL_STYLE_KEY_ORDER` from `@nodetto/ir` (`packages/ir/src/index.ts:55`).
- Add `checkVisualStyleFields(operation: JsonObject, index: number): void`, called from
  `checkOperationFields` when `op` is `add` or `update` and `visual.style` is a plain object.
  A non-object `visual` or `style` is left to the existing errors.
- Valid keys: `VISUAL_STYLE_KEY_ORDER.keys` plus `extensions`.
- A null value for an unknown key is also rejected.
- Report all unknown keys in one error, in patch order:
  `unknown visual.style key "valign". Did you mean "verticalAlign"? Valid style keys: fill, ...`
- Add a private ranking helper, reusing `distance`. Compare case-insensitively. A candidate
  qualifies when edit distance is 2 or less, or either name contains the other, or the unknown key
  is a subsequence of the candidate. Show up to three, ordered by distance and then key order.
  With several, use `Did you mean "a", "b" or "c"?`. With none, omit that sentence.

## What a careless implementation gets wrong

- The `checkFields` matcher cannot suggest `verticalAlign` for either example: `textVerticalAlign`
  has distance 4 and `valign` has distance 7. Test both.
- `extensions` must stay accepted.
- Reading `VISUAL_STYLE_KEY_ORDER.keys` at call time means sef-05's new `boxLabelAlign` becomes
  valid with no change here. Do not hard-code it.
- Keep `noUncheckedIndexedAccess` safety, as `distance` does.

## Tests (`apps/cli/src/edit/operation-fields.test.ts`, add; existing cases stay)

- `update` with `style.valign` -> error names `valign`, suggests `verticalAlign`, lists valid keys.
- `add` with `style.textVerticalAlign` -> suggests `verticalAlign`.
- `add` with a `shape` and `style.valign` -> rejected the same way.
- `style.align` -> suggestions include `textAlign` and `verticalAlign`.
- `style.bogusxyz` -> names the key, no "Did you mean", lists valid keys.
- Two unknown keys -> both named.
- `style.valign: null` -> rejected.
- `style: {fill: "#112233", verticalAlign: "top", extensions: {}}` -> no error.
- `connect` with `style.valign` -> no error from this check.
- `visual: 3` and `visual: {style: 3}` -> no error from this check.

## Verification (each must exit 0)

1. `bun test apps/cli/src/edit/operation-fields.test.ts` -> new cases pass.
2. `bun test apps/cli/src/edit apps/cli/src/ai-commands.test.ts apps/cli/src/ai-features.test.ts apps/cli/src/commands.test.ts` -> 0 fail. If an existing test or built-in operation uses an unknown style key, report it in the progress log and do not edit it.
3. `bun run typecheck`.
4. `bunx biome check apps/cli/src/edit/operation-fields.ts apps/cli/src/edit/operation-fields.test.ts`.

Native behavior goes through the shared engine and is exercised by the sef-06 parity test.

## Done criteria

- Verification 1-4 exit 0 with logs recorded.
- `grep -n "checkVisualStyleFields" apps/cli/src/edit/operation-fields.ts` matches.
- Progress log complete.

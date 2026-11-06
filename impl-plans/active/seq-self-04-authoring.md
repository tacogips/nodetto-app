# seq-self-04-authoring

Workflow mode: `issue-resolution`. Manifest: `impl-plans/active/seq-self-s750-dispatch.json`. Wave 2;
dependsOn: `seq-self-01-contract`. Design: `design-docs/specs/design-sequence-self-messages.md` section 5.
Evidence: `tmp/seq-self-s750/seq-self-04-authoring/`. Progress: `impl-plans/progress/seq-self-04-authoring.md`.

## Intent and context

Commands that place new elements must leave room for a loop: the next message goes 52 below the loop's return, and lifelines
grow to cover it. Plan 01 already lets `connectSmart(a, a)` reach `planSequenceMessage`.

Contract from plan 01: `sequenceMessageExtent(element)` and `SEQUENCE_SELF_LOOP_HEIGHT` in `packages/core/src/sequence-layout.ts`.

## Non-goals

- No edit to `planSequenceMove`: its saved-`y` swap is safe because the loop height (32) is below the row pitch (52).
- No edit to `connections.ts`, `shapes/sequence.ts` or the CLI.
- No change to message kind or label defaults (`sync`, `Message`).
- Do not rewrite existing messages' `y` when one becomes a self-message.

## File-level changes

`packages/core/src/editor/sequence.ts`:

1. `planSequenceMessage`:
   - The `reduce` accumulator uses `sequenceMessageY(element, context) + sequenceMessageExtent(element)`. The seed
     (`participant y + 112`) and `y = existingY + 52` are unchanged.
   - `requiredHeight` for each unlocked participant adds the new message's extent: the loop height when `from === to`,
     otherwise 0. The element does not exist yet, so compare the ids.
2. `planSequenceActivation`: `endY` becomes the last message's `sequenceMessageY + sequenceMessageExtent`. With no message, the
   existing `startY + 52` stays. `startY`, `fromOrder` and `toOrder` are unchanged. Height and lifeline growth follow from `endY`.
3. `buildSequenceParticipant`: `bottom` uses `sequenceMessageY(element, context) + sequenceMessageExtent(element) + 60`.

## Pitfalls

- A locked participant is still skipped when growing lifelines.
- For an activation on a single self-message, `first === last` and `toOrder` stays `keyAfter(fromOrder)`. Only `endY` changes.
- Without self-messages every result must match today's, so existing `sequence-authoring.test.ts` expectations must pass unedited.

## Tests

`packages/core/src/sequence-authoring.test.ts` (extend; do not change existing expectations):

- `connectSmart(a, b)`, `connectSmart(a, a)`, `connectSmart(a, b)` -> second y = first y + 52; third y = second y + 32 + 52.
- `connectSmart(a, a)` as the first message -> y = seed + 52, kind `sync`, label `Message`.
- After `connectSmart(a, a)` -> every unlocked participant's height >= y + 32 + 60 - participant y.
- A locked other participant -> its height unchanged.
- Locked `a` with `connectSmart(a, a)` -> null and no new element.
- `editor.createSequenceActivation` on a participant whose only message is a self-message -> height
  covers `y + 32`, and lifeline height >= y + 32 + 60 - participant y.
- A new participant after a trailing self-message -> height covers `y + 32 + 60`.
- Moving a self-message with its neighbour through `planSequenceMove` -> swapped y values differ by at least the loop height.
- Three `connectSmart(a, b)` calls -> pitch stays 52 (no self-message regression).

## Verification

Each command must exit 0.

- `bun test packages/core/src/sequence-authoring.test.ts`: all pass, including unedited existing tests.
- `bun run typecheck`
- `bunx biome check packages/core/src/editor/sequence.ts packages/core/src/sequence-authoring.test.ts`

If a failure comes from a file another wave 2 plan owns, read it fresh, re-run once it is stable, and do not edit it.

## Acceptance criteria

- All test cases exist and pass.
- The diff of `sequence-authoring.test.ts` only adds lines (`git diff --numstat` shows 0 deletions for it).

## Working rules

Before each edit, read the file fresh and record its sha256 in the progress log; record it again afterwards. If a file
changed unexpectedly, stop and report the drift. Edit only your writePaths. Never use worktrees, private branches or
concurrent git operations. Do not commit or archive plans. Fixtures use neutral text only. No emojis. The progress log
records each step, command, exit status and complete log path under the evidence directory.

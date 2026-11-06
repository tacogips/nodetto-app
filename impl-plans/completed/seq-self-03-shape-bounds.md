# seq-self-03-shape-bounds

Workflow mode: `issue-resolution`. Manifest: `impl-plans/active/seq-self-s750-dispatch.json`. Wave 2;
dependsOn: `seq-self-01-contract`. Design: `design-docs/specs/design-sequence-self-messages.md` sections 5 and 7.
Evidence: `tmp/seq-self-s750/seq-self-03-shape-bounds/`. Progress: `impl-plans/progress/seq-self-03-shape-bounds.md`.

## Intent and context

Lifelines and activation bars with omitted geometry must cover a trailing self-message loop. The loop also lies entirely
inside the participant's rectangular hit box, so this plan pins that a click on the loop selects the message.

Contract from plan 01, in `packages/core/src/sequence-layout.ts`: `sequenceMessageExtent(element)` and
`sequenceOrderBottomY(element, order, context)`.

## Non-goals

- A saved `visual.height` stays authoritative. Do not rewrite or extend saved geometry.
- No edit to `editor/sequence.ts`, `resolve.ts`, `sequence-layout.ts` or export code.
- Do not change `createConnectorUtil`, `hitTestPoint` or paint order.

## File-level changes

`packages/core/src/shapes/sequence.ts`:

1. `sequenceParticipantShapeUtil.getBounds`: where `height` is undefined, each message's term becomes
   `sequenceMessageY(message, context) + sequenceMessageExtent(message) + 60 - y`.
2. `sequenceActivationShapeUtil.getBounds`: `bottom` uses `sequenceOrderBottomY(element, semantic.toOrder, context)`. `top`
   and the saved `height` handling are unchanged.
3. Hit-test fallback, only if the required pick test below fails: `sequenceParticipantShapeUtil.hitTest` returns false when a
   self-message on that participant has a route within `CONNECTOR_HIT_TOLERANCE / zoom` of the point. Paint order reads from
   `pagePaintOrder` by z-index, and sequence participants are not expected to reorder, so the test should pass without it.
   Record in the progress log whether the fallback was needed.

## Pitfalls

- Every new term is zero without a self-message. `height ?? Math.max(24, bottom - top)` must not change for such documents.
- Do not use `sequenceOrderBottomY` for `top`.
- The activation's `Math.max(24, ...)` minimum stays.
- If the fallback is needed, watch the import cycle: `sequence.ts` already imports from `./connector.ts`.

## Tests

`packages/core/src/sequence-self-bounds.test.ts` (new):

- Participant with no `visual.height`, self-message last at resolved y -> bounds bottom = y + 32 + 60.
- Same document with a normal last message -> `y + 60`, as today.
- Participant with saved `visual.height` -> unchanged.
- Activation with no saved height whose `toOrder` is a self-message's order -> bottom = order y + 32.
- Activation ending on a normal order -> same height as today's formula.
- Activation with saved `visual.height` -> saved value wins.

`packages/core/src/hit-test.test.ts` (extend the "sequence diagrams" fixture style; do not alter existing tests). Participant
at x=0, width=100, height=300; self-message with a higher `index`, y=150, so cx=50:

- Pick (90,166), on the right leg -> the message.
- Pick (70,150), on the top leg -> the message.
- Pick (70,166), in the loop's hollow -> the participant.
- Pick (50,280), lifeline below the loop -> the participant.

## Verification

Each command must exit 0.

- `bun test packages/core/src/sequence-self-bounds.test.ts packages/core/src/hit-test.test.ts packages/core/src/sequence-layout.test.ts`
- `bun test apps/cli/src/sequence-self-golden.test.ts`: goldens stay byte-identical.
- `bun run typecheck`
- `bunx biome check packages/core/src/shapes/sequence.ts packages/core/src/sequence-self-bounds.test.ts packages/core/src/hit-test.test.ts`

If a failure comes from a file another wave 2 plan owns, read it fresh, re-run once it is stable, and do not edit it.

## Acceptance criteria

- All test cases exist and pass, including all four picks.
- The progress log states whether the hit-test fallback was needed, with the test output as evidence.

## Working rules

Before each edit, read the file fresh and record its sha256 in the progress log; record it again afterwards. If a file
changed unexpectedly, stop and report the drift. Edit only your writePaths. Never use worktrees, private branches or
concurrent git operations. Do not commit or archive plans. Fixtures use neutral text only. No emojis. The progress log
records each step, command, exit status and complete log path under the evidence directory.

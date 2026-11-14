# Sequence self-messages: owner decisions

Design: `design-docs/specs/design-sequence-self-messages.md`. Both questions are
open. The design implements the defaults below, so neither blocks implementation.
A different answer changes only the section named in the question.

## Q1. Is `reply` a separate message kind? (section 7) - OPEN

The request lists "sync, async, reply and other existing message kinds", but
`MESSAGE_KINDS` is `sync`, `async`, `return`.

- Default: treat `return` as the reply kind. Add no alias or enum value, so
  `reply` stays outside `MESSAGE_KINDS` and the type's validator still flags it.
- Alternative: accept `reply` as a CLI alias for `return`. This is additive and
  applies to every sequence message, not only self-messages.

## Q2. Which canvas gestures may create a self-message? (section 7) - OPEN

- Default: only the message tool (`Tool.SequenceMessage`), the same way the
  state-transition and relation tools work. Dropping a port-handle or generic
  connector drag back on its source keeps cancelling the drag.
- Alternative: also allow port-handle and generic connector drags. This is one
  more condition in `selfConnects`, but a drag dropped back on its source would
  then create a message instead of cancelling.

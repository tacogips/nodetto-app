# seq-self-07-wiring

Workflow mode: `issue-resolution`. Manifest: `impl-plans/active/seq-self-s750-dispatch.json`. Wave 3; dependsOn: `seq-self-02-export`,
`seq-self-03-shape-bounds`, `seq-self-04-authoring`, `seq-self-05-canvas`. Design: `design-docs/specs/design-sequence-self-messages.md` section 9.
Evidence: `tmp/seq-self-s750/seq-self-07-wiring/`. Progress: `impl-plans/progress/seq-self-07-wiring.md`.

## Intent and context

Help and docs say only that a table or state may connect to itself. This plan documents self-messages. It owns the shared help and docs files, so no other
plan edits them.

## Non-goals

- `apps/cli/src/commands.ts` needs no change: no command is added.
- `packages/core/src/index.ts`: edit only if a sibling plan recorded a needed root export. None is expected, so the expected diff is empty.
- No edit to `types-command.ts` (plan 06), to design docs, or to `impl-plans/README.md`.
- Name no issue numbers or plan ids in user-facing text.

## File-level changes

1. `apps/cli/src/help.ts`, edit `connect` notes (near line 276): keep the existing table and state sentence, and add that a sequence participant may connect to
   itself, creating a self-call loop on the next timeline row, with `semantic.kind` one of `sync`, `async`, `return`. Keep the existing line width.
2. `apps/cli/src/help.ts`, `types` help: add that `nodetto-cli types sequence.message` describes self-messages.
3. `docs/cli.md`, the sequence paragraph near line 201: describe the same behavior, including that the label sits beside the loop, following rows and lifelines
   leave room, saved positions stay authoritative, and a connector-tool drag does not make one (only the message tool does). Include one example:
   `{"op":"connect","from":"@a","to":"@a","label":"check","semantic":{"kind":"sync"}}`.
4. `README.md`: read its connect summary. Edit only if it contradicts the new rule, and record the decision in the progress log.

## Pitfalls

- `help.ts` output is compared between Bun and native. Use plain ASCII.
- The `help` overview must stay under 40 lines (`ai-commands.test.ts:93`): put text on the `edit` and `types` pages, not the overview.
- Do not describe `reply` as a kind.

## Tests

`apps/cli/src/sequence-self-help.test.ts` (new, Bun):

- `help edit` -> contains `participant`, `itself` and `self-call`, and still contains the table and state sentence.
- `help types` -> contains `types sequence.message`.

`apps/cli/src/native-parity/sequence-self-help.test.ts` (new; `nativeTest`, `compare`):

- `help edit` and `help types` -> byte parity between Bun and native.

## Verification

Each command must exit 0.

- `bun test apps/cli/src/sequence-self-help.test.ts apps/cli/src/ai-commands.test.ts`
- `CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli`
- `sh -c 'NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity/sequence-self-help.test.ts'`: tests run, not skipped.
- `bun run typecheck`
- `bunx biome check apps/cli/src/help.ts apps/cli/src/sequence-self-help.test.ts apps/cli/src/native-parity/sequence-self-help.test.ts`
- `grep -n 'self-call' docs/cli.md`
- `grep -nF '"from":"@a","to":"@a"' docs/cli.md`

## Acceptance criteria

- Help and docs state the rule, the three kinds and the example.
- All tests pass, and native tests actually ran.
- `git diff --quiet HEAD -- apps/cli/src/commands.ts` exits 0.

## Working rules

Before each edit, read the file fresh and record its sha256 in the progress log; record it again afterwards. If a file
changed unexpectedly, stop and report the drift. Edit only your writePaths. Never use worktrees, private branches or
concurrent git operations. Do not commit or archive plans. No emojis. The progress log
records each step, command, exit status and complete log path under the evidence directory. Cargo commands use `CARGO_TERM_QUIET=true`.

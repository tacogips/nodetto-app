# seq-self-01-contract

Workflow mode: `issue-resolution`. Manifest: `impl-plans/active/seq-self-s750-dispatch.json`. Wave 1;
dependsOn: none. Design: `design-docs/specs/design-sequence-self-messages.md` sections 2 to 5 and 7.
Evidence: `tmp/seq-self-s750/seq-self-01-contract/`. Progress: `impl-plans/progress/seq-self-01-contract.md`.

## Intent and context

A sequence participant must be able to call itself. A self-message is any `sequence.message` with
`from === to`. This plan runs alone and first. It captures pre-change evidence, then lands everything later
plans read: geometry constants and helpers, row layout, the route, the label anchor and the connect rule.
After this plan `connectSmart(a, a)` creates a message that resolves to a loop.

## Non-goals

- No edit to `svg-export/*`, `shapes/sequence.ts`, `editor/sequence.ts`, `packages/ui-solid`, `apps/cli`
  source (except the golden test and fixtures), help or docs. Later plans own them.
- No new IR type, semantic field or stored geometry. No adapter or Rust change. No root export in
  `packages/core/src/index.ts`.
- Do not honour `labelPosition`, ports or `routing` on a self-message.

## Ordered steps

### Step 1: pre-change evidence, before any source edit

1. Confirm `git diff --quiet 1e8f43d224d7b43e200eb2229e7be17b39ca033c -- packages apps/cli/src apps/cli/native`
   exits 0. If it does not, stop and report: goldens would not be pre-change.
2. Run `CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli`, then copy `target/release/nodetto-cli` to
   `target/seq-self-baseline/nodetto-cli`. This is the timing and golden reference. Never delete it and never
   run `cargo clean`. Before any source edit, record in `impl-plans/progress/seq-self-01-contract.md`: the output of
   `git rev-parse HEAD`, `rustc --version`, the build command with its exit status, and
   `shasum -a 256 target/seq-self-baseline/nodetto-cli`. `target` is git-ignored, so this log is the tracked proof of the binary's identity.
3. Author `apps/cli/src/__fixtures__/sequence-golden/omitted-geometry.jsonl`, imitating the record shape of
   `packages/io/src/__fixtures__/sequence.jsonl`: a neutral title, one `pageKind: sequence` page, participants
   named Widgets, Orders and Stock with no `visual`, four messages (`sync`, `async`, `return`, `sync`) with
   distinct endpoints and no `visual` except one with a saved `visual.y`, and one activation.
   No message may have `from === to`.
4. Using the baseline binary, write the stdout of `export <doc> --format svg` to:
   - `apps/cli/src/__fixtures__/sequence-golden/io-sequence.expected.svg` for `packages/io/src/__fixtures__/sequence.jsonl`
   - `apps/cli/src/__fixtures__/sequence-golden/omitted-geometry.expected.svg` for the authored document

   These are literal bytes. Never regenerate them with changed code. If a later check fails, the code is wrong.
   Record `shasum -a 256` of both `.expected.svg` files in the same progress log.

### Step 2: `packages/core/src/sequence-layout.ts`

Add these exports, with exact names and values:

- `SEQUENCE_SELF_LOOP_WIDTH = 40`, `SEQUENCE_SELF_LOOP_HEIGHT = 32`, `SEQUENCE_SELF_LABEL_GAP = 8`,
  `SEQUENCE_SELF_LABEL_BOUNDS_GLYPH_WIDTH = 1.15`
- `isSequenceSelfMessage(element: Element): boolean`: type is `sequence.message`, `from` is a string, and
  `from === to`. Guard the type so a malformed semantic with both ends undefined is false.
- `sequenceMessageExtent(element: Element): number`: the loop height for a self-message, otherwise 0.
- `sequenceOrderBottomY(element: Element, order: string, context: ShapeContext): number`: `sequenceOrderY` plus
  the loop height when a self-message has exactly that order.

Change `sequenceOrderY`: the implicit result adds `32 * (self-messages with order strictly before this order,
by compareFractional)`. Collect those orders in the existing `for (const candidate of elements)` loop. Do not add
another pass over the page. The saved `explicit` return at the top stays first and unchanged.

### Step 3: `packages/core/src/shapes/connector/route.ts`

Add to `ConnectorEndpoints`, with this doc comment:

`/** Page x of left-aligned label text. Absent means centred on labelPoint. */ readonly labelStartX?: number;`

`withRoute` is unchanged.

### Step 4: `packages/core/src/shapes/connector/resolve.ts`

Inside the existing `element.type === "sequence.message"` branch, before the `fromCenter.x === toCenter.x` check,
when `ids.from === ids.to`:

- Points: `(cx, y) -> (cx+40, y) -> (cx+40, y+32) -> (cx, y+32)`, with `cx = fromCenter.x`,
  `y = sequenceMessageY(element, context)`, and start and end being the first and last points. Use the constants.
- Build the base with `route(...)`, then return it with `labelStartX` and an overriding `labelPoint`:
  - Take the layout from `connectorLabelLayout(connectorDecoration(element).label, element.visual)` and the extent
    from `connectorLabelExtent(layout, { x: 0, y: 0 })`.
  - `labelStartX = cx + 40 + 8`.
  - With text: `labelPoint = { x: labelStartX + extent.width / 2, y: (y + 16) - (extent.y + extent.height / 2) }`.
  - With no text (null extent): `labelPoint = { x: labelStartX, y: y + 16 }`.

Import from `../../label-layout.ts` and `./decoration.ts` (neither imports `resolve.ts`, so there is no cycle). Keep
the stub branch: two distinct participants at the same x must keep today's output.

### Step 5: `packages/core/src/editor/connections.ts`

In `connectByType`, add `source?.type !== "sequence.participant"` to the `from === to` condition and update the comment
above it. `planSequenceMessage` needs no change here. Do not touch `Editor.connect`, `connectUmlComponents` or
`connectUseCases`.

## Pitfalls

- Run step 1 before any source edit. Goldens or a baseline built from changed code prove nothing.
- Without self-messages every new term must be zero, so that output stays byte-identical.
- Use `compareFractional`, not `<`, for order keys.
- Boa: no per-point destructuring and no regex split. Compute the label only in the self-message branch, so other
  connectors pay nothing.
- `noUncheckedIndexedAccess`: no unchecked index or array access.
- `state.transition` is handled by an earlier branch. Do not reorder branches.

## Tests

`packages/core/src/sequence-layout.test.ts` (extend). Imitate its existing setup:

- Orders a1, a2 (self), a3 with omitted geometry -> a1 and a2 unchanged, a3 = base + 2*52 + 32.
- Two self-messages before a3 -> +64.
- A saved `visual.y` on a message -> returned unchanged.
- A document with no self-message -> same value as today's formula.
- `sequenceOrderBottomY` at a self-message's order -> `sequenceOrderY + 32`; at a normal order -> equal.
- `isSequenceSelfMessage` -> true for equal ids, false for distinct ids, false for missing ends.

`packages/core/src/sequence-self-route.test.ts` (new), using `resolveConnector` and `endpointReaderFor`:

- Participant x=0, width=160, message y=120 -> points exactly (80,120),(120,120),(120,152),(80,152); `labelStartX` 128.
- Label "check" -> `connectorLabelExtent(layout, labelPoint)` has x close to 128 and a vertical centre close to 136.
- Empty label -> `labelPoint` (128,136).
- A `labelPosition` in the semantic -> `labelPoint` unchanged.
- Each of `sync`, `async`, `return` -> same points.
- Distinct participants at the same x -> two points and no `labelStartX`.
- Normal message -> no `labelStartX` key.

`packages/core/src/connector-policy.test.ts` (extend; keep line 161):

- `connectSmart(p, p)` -> a `sequence.message` with from and to equal to p.
- Locked participant -> null (imitate the locking in `sequence-authoring.test.ts`).
- `usecase.node` self-connect -> null.
- `shape.geo` self-connect -> null.

`apps/cli/src/sequence-self-golden.test.ts` (new), spawning `main.ts` as `export-determinism.test.ts` does:

- Each fixture document exported with `--format svg` -> stdout bytes equal the `.expected.svg` file. Compare bytes,
  not trimmed strings. No hash.

## Verification

Each command must exit 0.

- `sh -c 'target/seq-self-baseline/nodetto-cli export packages/io/src/__fixtures__/sequence.jsonl --format svg | cmp - apps/cli/src/__fixtures__/sequence-golden/io-sequence.expected.svg'`: goldens are pre-change bytes.
- `sh -c 'target/seq-self-baseline/nodetto-cli export apps/cli/src/__fixtures__/sequence-golden/omitted-geometry.jsonl --format svg | cmp - apps/cli/src/__fixtures__/sequence-golden/omitted-geometry.expected.svg'`: same.
- `bun test packages/core/src/sequence-layout.test.ts packages/core/src/sequence-self-route.test.ts packages/core/src/connector-policy.test.ts packages/core/src/sequence-authoring.test.ts packages/core/src/svg-export.test.ts apps/cli/src/sequence-self-golden.test.ts`: all pass with no skips in the new tests.
- `bun run typecheck`
- `bunx biome check packages/core/src/sequence-layout.ts packages/core/src/sequence-layout.test.ts packages/core/src/sequence-self-route.test.ts packages/core/src/shapes/connector/route.ts packages/core/src/shapes/connector/resolve.ts packages/core/src/editor/connections.ts packages/core/src/connector-policy.test.ts apps/cli/src/sequence-self-golden.test.ts`

## Acceptance criteria

- The golden files and baseline binary exist, and both `cmp` commands pass.
- The progress log records the base commit, `rustc` version, build exit status and golden digests, and its baseline digest
  equals the current `shasum -a 256 target/seq-self-baseline/nodetto-cli` output.
- All listed exports exist with the exact names and values.
- `connectSmart(p, p)` returns a message whose route has four points.
- `git diff 1e8f43d224d7b43e200eb2229e7be17b39ca033c --stat` shows no file outside this plan's writePaths, apart from
  the committed design and plan documents.

## Working rules

Before each edit, read the file fresh and record its sha256 in the progress log; record it again afterwards. If a file
changed unexpectedly, stop and report the drift. Edit only your writePaths. Never use worktrees, private branches or
concurrent git operations. Do not commit or archive plans. Fixtures use neutral text only. No emojis. The progress log
records each step, command, exit status and complete log path under the evidence directory. Cargo commands use
`CARGO_TERM_QUIET=true`.

# zorder-08-native-parity

- planId: zorder-08-native-parity
- planPath: impl-plans/active/zorder-08-native-parity.md
- progressPath: impl-plans/progress/zorder-08-native-parity.md
- wave: 3
- dependsOn: zorder-04-paint-consumers, zorder-06-cli-order-op
- Design: `design-docs/specs/design-z-order.md` section 5.
- writePaths:
  - `apps/cli/src/native-parity/order.test.ts` (new)
  - `impl-plans/progress/zorder-08-native-parity.md`
  - `tmp/zorder-s734/zorder-08-native-parity`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

Follow the worker rules in `impl-plans/active/zorder-00-overview.md`.

## Intent and context

The native CLI runs the shared TypeScript engine in Boa. This plan proves `order` and the
paint rule behave the same there and adds no meaningful CPU cost.

Existing code to imitate: `apps/cli/src/native-parity/harness.ts` (`binary`, `compare`,
`nativeTest`) and `apps/cli/src/native-parity/drawing.test.ts`.

## Tests (`apps/cli/src/native-parity/order.test.ts`)

All use `nativeTest`.

- `order` batch covering `to`, `before`, `after`, `@ref`, a prefix, `name:` and `where`,
  on a fixture of literal elements with fixed ids. The batch contains no `add` or
  `connect`. Bind `@ref` with the existing `select` op, for example
  `{"op":"select","id":"<fixed id>","ref":"panel"}`, then use it in `order` operations in
  the same batch. `compare` on stdout, stderr and exit code with `--dry-run`. Then apply
  with Bun and with native in separate copies and compare stored element order and exported
  SVG bytes, without masking or normalizing ids. Do not compare `index` keys or whole JSONL
  files, because generated keys can differ.
- Group member `to: back`: `memberIds` are equal across engines.
- Unknown op `send-to-back`: `compare` shows the same exit 2 and hint.
- Bad `to` value: `compare` shows the same exit 2 and message.
- `export --format svg` for `[node, frame]` and for `[node, panel, frame, connector]`:
  `compare` is byte-identical across engines.

## CPU comparison

Evidence only under `tmp/zorder-s734/zorder-08-native-parity/`, plus binaries under
`target`.

1. Baseline binary from the pristine base commit, without touching the working tree:
   - `mkdir -p target/zorder-baseline/src`
   - `git archive 29f8691135fb6098a9496495f4a417e93ce0625e | tar -x -C target/zorder-baseline/src`
   - `ln -s "$PWD/node_modules" target/zorder-baseline/src/node_modules` (`gerber-parser`
     resolves through this link)
   - `mkdir -p target/zorder-baseline/src/packages/core/node_modules`
   - `ln -s "$PWD/packages/core/node_modules/polygon-clipping" target/zorder-baseline/src/packages/core/node_modules/polygon-clipping`
   - `CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli --manifest-path target/zorder-baseline/src/Cargo.toml --target-dir target/zorder-baseline/cargo`
   - Prove it is pre-change, because `node_modules` links could resolve to the changed
     packages: `edit` with an `order` op must exit 2 with `Unknown op "order"`, and
     `export --format svg` of `[node, frame]` must still place the frame's `data-id`
     after the node's. If either fails, or the build cannot run this way, record that in
     the log and report it. Do not substitute another binary.
2. Current binary: `CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli`.
3. Fixtures under the evidence directory, generated with an inline `bun -e`. No script
   files under `tmp/`.
   - `flat.jsonl`: one page, 40 filled frames, each enclosing 20 nodes, frames stored
     after their nodes, no connectors.
   - `connected.jsonl`: the same page with frames stored before nodes, and 200 generic
     edges between nodes.
4. `/usr/bin/time -p <binary> export <doc> --format svg` for both binaries and both
   fixtures. Take three runs each and record the median of user plus sys in
   `timing.txt`.
5. Current binary only: `/usr/bin/time -p` for a 50-op `order` batch on `flat.jsonl` with
   `--dry-run`, recorded in `timing.txt`. The baseline cannot run this op.

Pass condition: for `connected.jsonl`, whose order has no inversion, the current median is
at most 1.25 times the baseline. For `flat.jsonl`, it is at most 1.5 times. If either is
exceeded, record the numbers and report a blocker. Do not raise the limits or change
deadlines.

## Pitfalls

- Never list a binary-less run as verification. Without `NODETTO_CLI_TEST_BINARY` every
  test skips and the check proves nothing.
- Do not delete `target/zorder-baseline`, and do not run `cargo clean`.
- Do not stage anything under `target` or `tmp`.
- Do not edit existing parity files or `harness.ts`.
- Use `git archive` only. Do not use `git worktree`, `git checkout` or `git stash`.
- In the baseline copy, `@nodetto/*` must resolve through the root `tsconfig.json` paths of
  the copied tree. Never link `@nodetto/*` or a whole workspace `node_modules` directory,
  because those links point at the changed tree. If another third-party package is
  unresolved, link that one package the same way.
- `add` creates random ids, which appear in the edit report and in SVG `data-id`. Using it
  in a `compare` batch would produce a difference that has nothing to do with the engines.
  Use `select` for `@ref`, as stated in the tests above.

## Acceptance criteria

- The parity file runs against the release binary with 0 skipped tests.
- `timing.txt` records both binaries' medians and the pass condition holds.

## Verification (each must exit 0)

1. `CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli`
2. `sh -c 'NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity/order.test.ts'`:
   all pass, 0 skipped. Up to 3 attempts for deadline timeouts only.
3. `test -x target/zorder-baseline/cargo/release/nodetto-cli`
4. `test -s tmp/zorder-s734/zorder-08-native-parity/timing.txt`
5. `bun run typecheck`: no errors.
6. `bunx biome check apps/cli/src/native-parity/order.test.ts`

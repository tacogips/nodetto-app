# ipd-27p-native-edit-perf (amendment round 24)

- planId: ipd-27p-native-edit-perf
- planPath: impl-plans/active/ipd-27p-native-edit-perf.md
- progressPath: impl-plans/progress/ipd-27p-native-edit-perf.md
- Status: Ready
- dependsOn: none among pending plans (accepted dependencies include ipd-04-cli-edit-contracts, ipd-08-cli-layout-ops, ipd-11-frames, ipd-14-kit-core, ipd-24-parity-flows and ipd-27k-kit-grid)
- Design: `design-docs/specs/design-iphone-app-design.md`, Decision 7 (CLI-driven layout) and the TypeScript/native CLI parity rules
- Evidence: `tmp/ipd-s772/ipd-27p-native-edit-perf/` (git-ignored)
<!-- ownership:start -->
- writePaths:
  - `apps/cli/src/edit`
  - `packages/core/src/editor`
  - `packages/core/src/store.ts`
  - `packages/core/src/auto-layout.ts`
  - `packages/core/src/text-layout.ts`
  - `packages/core/src/text-styles.ts`
  - `packages/core/src/color-tokens.ts`
  - `packages/core/src/number-tokens.ts`
  - `packages/core/src/aspect-ratio.ts`
  - `packages/core/src/insertion-parent.ts`
  - `packages/core/src/kits/ios/insert.ts`
  - `apps/cli/native/src/engine.rs`
  - `apps/cli/src/native-parity/edit-performance.test.ts`
  - `impl-plans/progress/ipd-27p-native-edit-perf.md`
  - `tmp/ipd-s772/ipd-27p-native-edit-perf`
  - `target`
  - `apps/desktop/src-tauri/binaries`
- sharedPaths:
  - none
- sharedPathNotes:
  - none
- artifactRoots:
  - `tmp/ipd-s772/ipd-27p-native-edit-perf`
  - `target`
  - `apps/desktop/src-tauri/binaries`
<!-- ownership:end -->

`tmp/ipd-s772/ipd-27p-native-edit-perf` holds logs, profiles and timing JSON only. `target` (Cargo output, including the engine bundle under `target/**/out`) and `apps/desktop/src-tauri/binaries` (the sidecar staged by `mise run build-cli`) are build outputs with no authored source. Cargo's build lock serializes concurrent writes to `target`. The progress log `impl-plans/progress/ipd-27p-native-edit-perf.md` is a tracked source path.

## Operator amendment round 24 (binding; keep this section verbatim)

Native edit performance (operator round 24, binding): native nodetto-cli edit scales superlinearly with document size (a synthetic-like 135-operation batch takes over 90 s on a 300-element document, batches on 151/233/298 elements take 6/39/59 s), while the Bun CLI runs the same batches in about 1 s. macOS sample shows the time in the embedded Boa engine's garbage collector (GcHeader inc_ref_count, GC dropping, mark_heap), which points to per-operation work proportional to the whole document (cloning, rescanning or reserializing the document or its indexes for every operation, for example in auto-parenting containment, selection or kit insertion). Profile with `bun --cpu-prof` and with `sample` on the native binary, find the per-operation O(document) work in the edit path, and make batch application near-linear without changing any result (all parity, edit and kit tests stay green). Add a generic synthetic regression to apps/cli/src/native-parity/edit-performance.test.ts: build about 300 elements in several 390x844 iPhone frames over 3 to 4 edit batches that use parent, select and kit insertion; assert every native batch finishes in under 3 s and the batch on the largest document takes under 3 times the first batch. No private reference content in the fixture.

## Intent and context

- ipd-27b-reproduction-detail (screen 05) stalled because one native `nodetto-cli edit` batch stayed CPU-bound for minutes. A 300-element app page is a small document, so this is a product defect, not a reproduction problem. ipd-27b, ipd-27c, ipd-27-reproduction and ipd-28-finish all wait on this plan.
- The native CLI (`apps/cli/native`) runs the same TypeScript edit engine as the Bun CLI, bundled by `apps/cli/scripts/build-engine.ts` and evaluated by Boa in `apps/cli/native/src/engine.rs:context` / `execute`. Work that is cheap under a JIT (cloning a 300-element document per operation) becomes very slow under Boa's interpreter and GC. So the fix is to remove per-operation whole-document work in the shared TypeScript edit path. Both hosts get faster, and results stay byte-identical.
- Known candidates, found by reading code. Confirm them by profiling before you change anything:
  - `packages/core/src/editor/transaction.ts:planDerivedCommands` calls `store.getSnapshot()` and builds `new Store(snapshot)` for every `editor.apply` when any element has a text style, auto width or height, or a frame layout. iPhone documents always have one. It then runs `planTextStyles`, `planColorTokens`, `planNumberTokens`, `planTextResize`, `planAspectRatios` and `planAutoLayout` over the whole draft. Near `transaction.ts:226`, `new Store(store.getSnapshot())` is built twice.
  - `packages/core/src/editor/components.ts` builds `new Store(editor.getSnapshot())` before and after a resize (lines around 358 and 493). Kit insertion and instance refresh reach this code.
  - `apps/cli/src/edit/selectors.ts` (the `shortIds(listElements())` call per selector), `apps/cli/src/edit/batch.ts` (lines around 104 and 270 copy `listElements()`), `apps/cli/src/edit/carry-members.ts`, and `packages/core/src/kits/ios/insert.ts` (a linear definition lookup for every insert).
  - `apps/cli/src/edit/apply-batch.ts` already tracks changed ids incrementally per operation. Keep that pattern.

## Non-goals

- No change to any edit result: document bytes, stdout, stderr, exit codes, warnings, ids, ordering keys and validation messages stay identical, apart from the generated ids and ordering keys that the round-15/16 normalization already allows.
- No change to Boa version, `Cargo.toml`, `Cargo.lock`, `apps/cli/native/build.rs`, `apps/cli/scripts/build-engine.ts` or `package.json`.
- No GC tuning that only hides the cost: no disabling the collector, raising heap limits without bound, or skipping validation. A change to `engine.rs` is allowed only to cut host-call overhead that the native profile shows, and must keep its output unchanged.
- No skipping of the derived planners (text styles, tokens, text resize, aspect ratio, auto layout) when they could produce commands. You may limit them to affected elements or pages, but only when you can show the result is identical.
- No reproduction work, no lint rule changes, no kit geometry changes, no docs or help changes.
- Do not edit the Bun CLI fixtures under `apps/cli/src/__fixtures__`. Generate the new regression fixture inside `edit-performance.test.ts`.

## File-level changes

1. Profile first. Build a generic synthetic driver under `tmp/ipd-s772/ipd-27p-native-edit-perf/` (data and scratch only; the driver itself is a scratch script, not authored source). It must cover about 300 elements in 3 to 4 batches with `add` using `parent`, `select`, and kit insertion (`ios:tab-bar`, `ios:nav-bar`, `ios:list-row`). Record native and Bun times per batch, then run `bun --cpu-prof` on the Bun CLI and `sample <pid> 10` on the native binary during the slowest batch. Save the profiles and a summary of the top frames to the evidence directory.
2. Remove the O(document) work per operation that the profile identifies, in the owned files only. Allowed techniques:
   - Reuse one draft or index per batch instead of a fresh snapshot per apply.
   - Make `Store` copies cheaper (for example structural sharing of unchanged element records) while keeping the public `Store` API and its immutability semantics.
   - Restrict derived planning to the pages or elements a command touched, when the planners only read those.
   - Cache the short-id maps and kit definition lookups, and invalidate them on the store diff.
3. In `apps/cli/src/native-parity/edit-performance.test.ts`, add one `nativeTest` case (or a small group), using the pattern of the existing cases in that file: `mkdtempSync` under `tmpdir()`, Bun first, then native, then compare stdout, stderr and document text. The fixture is generic. It has 3 to 4 sequential batches reaching about 300 elements over several 390x844 frames, and it uses `parent`, `select` and kit shape ids. Compare Bun and native documents with the accepted round-15/16 normalization, so generated ids and fractional ordering keys are not compared raw. Reuse the normalizer from `apps/cli/src/native-parity/app-design-flows.test.ts` by copying it locally; do not edit that file. Assert that each native batch takes under 3000 ms, and that the batch on the largest document takes under 3 times the first batch.
4. Write the progress log `impl-plans/progress/ipd-27p-native-edit-perf.md` with: before and after native and Bun batch timings (element count, operation count, ms), the hot path you identified (file:symbol and top profile frames), each change, and every verification command with its exit code and pass/fail counts.

## Invariants

- `Store` public methods, the `Document` shape and the command semantics are unchanged. Snapshots returned to callers must not be mutated by later edits.
- Undo/redo, history batching (`beginBatch`/`endBatch`) and `ApplyOptions.keepMembers`/`placed` behave as before.
- The desktop app uses the same `packages/core/src/editor` code. Interactive edits must produce the same commands.
- Native and Bun outputs stay in parity: `mise run test-cli` shows no new failures against the ipd-00 baseline (438 pass, 0 fail).

## Pitfalls

- Shallow sharing of element records is safe only if nothing mutates a record in place. Check `applyCommands` and the planners for in-place writes before you share records.
- Planners such as `planAutoLayout` and `planTextResize` can cascade across parents and instances. If you restrict them to touched elements, include ancestors (the frame and auto-layout chains) and component instances of touched definitions. If you cannot prove an equivalence, keep the full pass and optimize something else.
- Caches keyed by element id must be invalidated on add, remove, reparent and page moves (`store.subscribe` diff: `added`, `updated`, `removed`, `pagesChanged`).
- Timing assertions must use wall time around the native spawn only. Keep each spawn's `timeout` at 60000 ms so that a regression fails the test instead of hanging it.
- `mise run test-cli` runs `cargo build --release -p nodetto-cli` and sets `NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli"`. Run the focused native test against that same binary after a release build, never against a stale sidecar.
- Never put tmp/ reference material or private names in the fixture or in the progress log.

## Test cases

- 4 synthetic batches, about 300 elements, 390x844 frames, `parent` + `select` + kit insertion -> each native batch under 3000 ms; the last batch under 3 times the first; Bun and native documents equal after normalization; stdout and stderr equal.
- Existing obstacle-routing cases in `edit-performance.test.ts` -> still pass, with byte-equal expected output.
- `bun test apps/cli/src/edit packages/core` -> 0 fail. This covers the editor, store, auto-layout, text-layout, text-styles and kit tests that guard result equality.

## Verification

1. `CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli` -> exit 0.
2. `NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity/edit-performance.test.ts` -> 0 fail, and the new synthetic regression is included in the pass count.
3. `bun test apps/cli/src/edit packages/core` -> 0 fail.
4. `CARGO_TERM_QUIET=true mise run test-cli` -> exit 0 and no new failures versus the ipd-00 baseline.
5. `CARGO_TERM_QUIET=true mise run build-cli` -> exit 0.
6. `sh -c 'mkdir -p tmp/ipd-s772/ipd-27p-native-edit-perf/final && bun run typecheck --pretty false > tmp/ipd-s772/ipd-27p-native-edit-perf/final/typecheck.log 2>&1'` -> exit 0. Record any `error TS` in non-owned files as owned_elsewhere.
7. `bunx biome check apps/cli/src/edit packages/core/src/editor packages/core/src/store.ts packages/core/src/auto-layout.ts packages/core/src/text-layout.ts packages/core/src/text-styles.ts packages/core/src/color-tokens.ts packages/core/src/number-tokens.ts packages/core/src/aspect-ratio.ts packages/core/src/insertion-parent.ts packages/core/src/kits/ios/insert.ts apps/cli/src/native-parity/edit-performance.test.ts` -> exit 0. This was clean before editing: 63 files, no fixes (baseline re-recorded in Step 4 session 815 after the three planner files were added).
8. `CARGO_TERM_QUIET=true cargo fmt --check -p nodetto-cli` -> exit 0, if `engine.rs` changed.

## Done criteria

- The progress log records before and after timings, and the after timings meet the 3000 ms and 3x limits on the synthetic driver.
- Verification items 1-7 (and 8 if applicable) exit 0, with counts recorded in the progress log.
- `git diff --name-only` plus `git ls-files -o --exclude-standard`, filtered to source, shows edits only inside this plan's writePaths.

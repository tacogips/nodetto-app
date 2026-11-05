# clm-02-connector-edit-perf

## Continuation 3 2026-11-05 (clm-s736) - authoritative

Workflow mode: `issue-resolution`. Manifest: `impl-plans/active/clm-s736-dispatch.json`,
base HEAD `d5b9bac98e29bba2159f7e6791dc39938e392953`, evidence
`tmp/clm-s736/clm-02-connector-edit-perf/`, CPU profiles under `target/clm-s736-profile/`.
wave: 1; dependsOn: none. This section overrides everything below where they differ. Replace
`tmp/clm-s732` and `tmp/clm-s731` with `tmp/clm-s736` in older sections. Design: "A7 decision
D3" in `design-docs/specs/design-cli-layout-merge-lint.md`.

### Intent

Close IR-S732-CLM02-A7-RATIO under owner decision D3. Parts 1 to 3 below are committed
(fixtures and expected files, dirty-page planning, page-bounded `applyCommands`,
`keepMembers`); do not redo them. Current native user CPU: single 0.54 s, multi 1.24 s (2.30x),
mixed single 0.72 s, mixed multi 1.33 s (1.85x). Bun profiles do not predict Boa costs, so
measure in Boa first.

### Order of work

1. Attribution.
   - Write a probe entry at `target/clm-a7-probe/probe.ts` that runs the fixtures from
     `apps/cli/src/__fixtures__/obstacle-routing-batch.ts` through the same steps as
     `apps/cli/src/edit/apply-batch.ts:applyBatch`, with a timer per phase. To time planners
     individually, call them in the order of
     `packages/core/src/editor/transaction.ts:planDerivedCommands`. Do not instrument tracked
     source.
   - Bundle it: `bun build --target browser --format iife` into `target/clm-a7-probe/`.
   - Host it in a temporary `apps/cli/native/examples/clm-a7-probe.rs`. Imitate the Boa setup and
     the `TextEncoder` and `Intl` polyfills in `apps/cli/native/src/engine.rs`, and expose a
     Rust-side clock. `boa_engine` is already a normal dependency of `nodetto-cli`, so
     `Cargo.toml` and `Cargo.lock` stay unchanged. Run it with
     `CARGO_TERM_QUIET=true cargo run --release -p nodetto-cli --example clm-a7-probe`.
   - Phases: see the design list. Measured phases must cover at least 90% of the probe's total
     per fixture; otherwise split the largest phase.
2. Classify each phase as (a), (b) or (c), per the design. Write the table to
   `tmp/clm-s736/clm-02-connector-edit-perf/phase-table.txt` and the progress log.
3. Remove all class (a) and (b) work, one change at a time, rerunning the probe. Candidates to
   check, not conclusions: repeated `getSnapshot` sorting, the two `new Store` copies in
   `planDerivedCommands`, the extra store in `EditorCore.apply`, `createShapeContext` on the
   live store per apply, `dirtyPages` per command, and the two maps for `countPageChanges`.
4. Delete `apps/cli/native/examples/` entirely. Probe files under `target/` may stay; never `cargo
   clean`, because `target/clm-baseline/nodetto-cli` must survive.
5. Final measurement on one release build: five `/usr/bin/time -p` runs per fixture, one after
   another (single, multiPage, mixedSingle, mixedMulti), and five runs of the single fixture
   with `target/clm-baseline/nodetto-cli` in the same session. Log all runs to
   `tmp/clm-s736/clm-02-connector-edit-perf/final/timing.log`.
6. Append to the progress log, exactly:
   `A7 ratio multiPage/single: <x>`, `A7 ratio mixedMulti/mixedSingle: <x>` and
   `A7 ratio single/baselineSingle: <x>`, each a decimal from median user CPU. Do not write these
   lines before the final measurement.
7. Replace `Pending.` under "A7 attribution record" in the design with the build id, four medians,
   both ratios, the phase table with classes, what was removed, and one line:
   `A7 outcome: met` or `A7 outcome: accepted-irreducible`. Edit nothing else in the design.

### Outcome rules (from D3)

- Both ratios at most 1.5: `A7 outcome: met`.
- Either above 1.5, both at most 2.0, no class (a) or (b) work left, and the gap is class (c):
  `A7 outcome: accepted-irreducible`, with the evidence and reason in the record and progress
  log. This does not block.
- Either above 2.0 with no class (a) or (b) work left: stop and report a blocker finding with
  the phase table, citing user-QA Q12. Write no outcome line. Do not raise the ceiling.
- `A7 ratio single/baselineSingle` above 1.1 is a defect to fix, because a slower denominator
  would make the ratio meaningless.

This replaces the "report as blocked above 1.5" text in the older done criteria.

### Invariants

- Expected file hashes never change: `341fcd8654fc18d560c8895df1a05617a6b8ac39` (single),
  `872e266430b5a59930a4f87474869514a2c126cc` (multi), `4f5c88d5b1c4bc44c3afbd743fb76089bb0d34aa`
  (mixed multi). Never regenerate them.
- Class (c) work stays: input parsing and validation, whole-result validation and serialization,
  and the first-apply whole-document pass. Skipping any of them changes accepted behavior.
- `applyCommands` signature, atomicity, `CommandResult` and messages; operation-index errors;
  all-or-nothing semantics; concurrency re-apply; planner order; and `keepMembers` all stay.
- No deadline changes and no fixture changes to fit a ratio.

### Non-goals

- No edit to `apps/cli/src/edit/operations/elements.ts`, `arrange-*.ts`, `bpmn/notation.ts` or the
  shared registration files. No Rust apart from the temporary example.
- `packages/core/src/bpmn/containment.ts` is listed only for a `keepMembers` defect found in review
  of this plan. If attribution calls for a D3 edit there, record an amendment request instead;
  clm-12 tests read it in this wave.

### Tests to add (input -> expected)

Only what the removals need, in the tests next to the touched module:

- Each removal -> the expected-file tests stay byte-identical, and the `Store.prototype` spy in
  `packages/core/src/dirty-pages.test.ts` is tightened if the allowance drops.
- A shared or skipped computation -> a case that changes its input between two applies and gets the
  fresh result, so no stale value is reused.

### Done criteria (mechanical)

All manifest verification commands exit 0. `git status --short` shows only this plan's writePaths
changed by it. `apps/cli/native/examples` does not exist. Keep under 300 evidence files.

## Amendment 2026-11-05 (integration-paths-outside-writePaths, round 1)

Workflow mode: `issue-resolution` (manifest `workflowMode`, repeated in
`reviewContext.workflowMode`). The first s732 dispatch of this plan stopped at readiness
because its worker found no mode in its input, and it edited no source. Do not stop for
that reason again: start Part 1. writePaths are unchanged.

## Continuation 2 2026-11-05 (clm-s732) - authoritative

Status at HEAD `29f8691135fb6098a9496495f4a417e93ce0625e`: only the s725 work
has landed (IR connector fields, resolver, single-page fixture, one snapshot
reuse). The s731 worker stopped at readiness and edited nothing: no multi-page
fixture, no profile, no dirty-page planning and no `keepMembers` exist. Implement
Parts 1 to 3 of the s731 section below, as amended here. Every
`tmp/clm-s731/...` path below becomes `tmp/clm-s732/...`. Do not dispatch the
s731 manifest.

- wave: 1; dependsOn: none. Manifest: `impl-plans/active/clm-s732-dispatch.json`.
- Design: "A7 continuation", E1 "Mechanics", "Continuation contracts" (clm-02
  block), "Continuation 2 partition" and "Continuation 2 verification".

### Intent

An `edit` batch's per-operation cost must be bounded by the edited page, with
byte-identical output. Owner evidence (native release binary): the 50-op batch
takes 0.56 s on one page and 3.4 s with an unrelated page of 973 elements; the
mixed batch takes 5 to 6 s. Target: multi-page user CPU within 1.5x of the
single-page counterpart on the same build.

### Non-goals

- No change to `applyCommands`' signature, atomicity, `CommandResult`
  (`undo`/`redo` content and order) or `CommandError` messages.
- No planner order change and no new CLI field. `carryMembers` routing in
  `apps/cli/src/edit/operations/elements.ts` is clm-11's. Never edit that file,
  `arrange-*.ts`, `bpmn/notation.ts` or the shared registration files.
- No Rust. A host-side cost is a blocker to record.

### writePaths additions (pre-authorized; edit only what the profile needs)

The s731 list below stays, with `tmp/clm-s732/clm-02-connector-edit-perf`
replacing the old evidence path. Added:

- New module: `packages/core/src/editor/dirty-pages.ts`.
- Core: `hit-test.ts`, `layer-state.ts`, `clipping.ts`, `frame-membership.ts`,
  `orthogonal-routing.ts`, `shapes/connector/resolve.ts`, `bpmn/model.ts`,
  `editor/facade/element-editing.ts`, `editor/facade/page-editing.ts`.
- CLI: `apps/cli/src/edit/batch.ts`, `apps/cli/src/edit/selectors.ts`,
  `apps/cli/src/edit/selectors.test.ts`, `apps/cli/src/edit/apply-batch.test.ts`.
- Existing tests next to touched modules, additive cases only:
  `packages/core/src/{hit-test,layer-state,clipping,frame-translation,frame-tree,frame-membership,constraints,auto-layout,text-layout,text-styles,color-tokens,number-tokens,aspect-ratio,manual-route-preservation,editor}.test.ts`,
  `packages/core/src/bpmn/{containment,editor-bpmn}.test.ts`,
  `packages/core/src/breadboard/{board,editor-breadboard}.test.ts`,
  `packages/core/src/pcb-board/follow.test.ts`.

The exact paths are in the manifest. Anything else needs an amendment.

### Order of work

1. Part 1 of the s731 section, before any A7 source edit: fixtures, both
   expected files, the cross-check against `target/clm-baseline/nodetto-cli`
   (that binary predates clm-13, so a match also confirms clm-13 left edit output
   unchanged), and baseline timings. A difference is a blocker to record; never
   regenerate an expected file.
2. Profile (Part 2). Write `.cpuprofile` output under
   `target/clm-s732-profile/`, not under `tmp/`. Record the top frames and the
   per-planner scope table in the progress log.
3. Implement the scoping below, then `keepMembers` (Part 3).

### Decisions the implementation must follow

All read sites at HEAD: `editor/transaction.ts:planDerivedCommands`,
`commands.ts:applyCommands` (lines 429-436), `store.ts:getPageElements` (a full
`elementMap` scan on each cache miss), `edit/apply-batch.ts` (lines 102-118).

**Scoped stores, not edited planners.** `planDerivedCommands` keeps one code path
and today's planner order. In a scoped apply, it passes planners a before-store
and draft holding only the in-scope elements (all page records, so `listPages`
is unchanged). Then every planner is bounded without being rewritten, and a
filtered subsequence keeps today's command order. Add a `Store` method that
returns a document with all pages and only the given pages' elements, in
`compareSnapshotOrder` order. Build a scoped `ShapeContext` for
`planManualRoutePreservation`; do not pass it the live-store context.

**When an apply covers the whole document.** `editor/dirty-pages.ts` holds this
decision (internal; not exported from `packages/core/src/index.ts`). Whole
document, using today's stores, when any of these holds:

1. Stale state: this is the first non-empty apply on this editor, or
   `store.revision` or `registry.revision` differs from the values recorded at the
   end of the previous successful apply. Undo, redo, `loadDocument`,
   `reconcileDerivedState` and direct `applyCommands` all change the revision.
2. Any page command is permitted: `createPage`, `updatePage`, `deletePage`.
3. A changed element is `design.token`, `design.text-style` or a component
   master read by `planAutoComponentRefresh`.
4. A dirty page is cross-linked (below).
5. A `createElement` id already exists in the store, or a created or updated
   `semantic` references an id whose page is out of scope.

Why rule 1 is required: `applyBatch` does not call `reconcileDerivedState`, and
at HEAD the first apply runs `planTextResize`, `planAutoLayout`, the token
planners and others over every page, so it normalizes stale derived values on
pages the batch never touches. Skipping that would change output for such
documents. After one whole-document apply, untouched pages are at the planners'
fixed point, so later applies may skip them. This costs one pass per batch, not
one per operation, so it satisfies "bounded per operation" and the byte-identity
rule of the design.

**Cross-linked page.** A page with at least one element that references an element
on another page, in either direction, through the registry's
`references(semantic)`, `visual.colorTokens`, `visual.numberTokens`,
`visual.textStyle` or a component master or instance link. Read
`auto-component-refresh.ts`, `color-tokens.ts`, `number-tokens.ts` and
`text-styles.ts` for the exact fields. Build the set during each whole-document
apply. Later, add pages when a changed element creates a link; never remove any.
Widening more than needed is always safe; widening less is the bug to avoid.

**`applyCommands` overlay.**

- Replace the eager maps with read-through working state (`store.get`,
  `store.getPage`) plus a local change log.
- `deleteElements` and `deletePage` need the whole map. Materialize it by building
  it from `store.listElements()` and then replaying the change log in order, so
  iteration order equals today's. `expandDeletes` order feeds `undo`; a differently
  ordered map changes `undo` content.
- Deletes therefore stay O(document) for that one command. Record this in the
  progress log.

**Store index.** Keep a page-to-element-ids index, maintained in `loadDocument`
and `commit`, including elements that change page, so `getPageElements` costs
O(page log page). Sorted output must not change.

**`applyBatch`.** Replace the per-operation full maps with
`editor.store.subscribe`: keep `records` updated only for ids in each diff, and
keep the `records.get(id) !== element` and `semantic` identity checks. Build the
initial map once. Unsubscribe in a `finally`.

**Prefix references.** `edit/selectors.ts:ordered` sorts the whole document for
each non-exact reference, and fixtures with full ids never reach it. Time
`multiPage` with its ops' ids rewritten through `shortIds` (`apps/cli/src/ids.ts`).
If that is above 1.5x of the same rewrite on the single-page fixture, memoize the
sorted id list on `Batch`, invalidated by diffs with `added`, `removed` or
`pagesChanged`. Otherwise record the measurement and leave it.

### Pitfalls

- A scoped draft that throws where today's would not, or the reverse: rule 5
  covers duplicate ids and out-of-scope references. An unknown id must raise
  the same `CommandError` as today.
- `permitted` empty returns `[]` and must not mark the editor as clean. A thrown
  `CommandError` must not either.
- Do not compute the scope from derived commands: derived commands stay inside
  the scope by construction.
- Boa rules: no regex split on documents, no per-point destructuring in hot loops.
- `noUncheckedIndexedAccess`-safe array access in every new core line.
- Keep `.log`, `.txt`, `.json` and `.jsonl` only under `tmp/`, and keep under 300
  evidence files in total: the plan snapshot limit counts them. Reuse one log per
  gate instead of one per edit.

### Added tests (input -> expected)

`packages/core/src/dirty-pages.test.ts`, in addition to the s731 list:

- A page-2 text with `textResize: "auto-width"` and a stale stored width; first
  update on page 1 -> the same commands as the HEAD code (capture before editing),
  so page 2 is normalized once.
- A second update on page 1 -> no command names a page-2 element, and page-2
  element objects are identical (`toBe`).
- Spy on `Store.prototype.getSnapshot` and `listElements`, recording `this.size`:
  during the second apply, every `getSnapshot` call has `this.size` at most the
  page-1 element count. `listElements` calls on the live store are at most the
  recorded allowance listed in the progress log.
- Undo the first apply, then update on page 1 -> a whole-document pass runs again
  and the state equals the HEAD result.
- One test each for rules 2, 3, 4 and 5, each confirming the other page updates
  or the error text equals HEAD.

`packages/core/src/store-commands.test.ts`:

- Invalid second command -> store revision unchanged, no diff emitted.
- `undo` and `redo` deep-equal captured HEAD values for update, create and
  cross-page delete cascades.
- `deletePage` on a multi-element page, and the last-page refusal, keep their messages.

### Done criteria (mechanical)

- Manifest verification commands all exit 0.
- The progress log contains the lines `A7 ratio multiPage/single: <x>` and
  `A7 ratio mixedMulti/mixedSingle: <x>`, both at most 1.5, from
  `/usr/bin/time -p` on the same release build, plus the ratios against
  `target/clm-baseline/nodetto-cli`. If a ratio exceeds 1.5, record the remaining
  cost with a profile and report the plan as blocked. Do not mark it done and do
  not write a passing line.
- `git status --short` shows only this plan's writePaths changed by this plan.

## Continuation 2026-11-04 (clm-s731) - authoritative for the remaining work

This section supersedes the header fields below (wave, writePaths,
verification and evidence paths) for the clm-s731 run. The sections below it
are history: the IR fields, resolver changes, `pointAlongRoute`,
`connectorLabelBoxAt`, the same-side self-loop, the single-page fixture and
its Bun and native tests are landed at HEAD 4d82d91 and accepted. Do not
redo them.

- wave: 1; dependsOn: none
- Design: `design-docs/specs/design-cli-layout-merge-lint.md`, "A7
  continuation: per-operation cost must be bounded by the edited page", E1
  "Mechanics" (engine part), contracts in "Continuation contracts" (clm-02
  block), Verification rows "A7 continuation" and E1 (engine).
- writePaths (clm-s731):
  - `packages/core/src/editor/transaction.ts`
  - `packages/core/src/editor/types.ts`
  - `packages/core/src/editor.ts`
  - `packages/core/src/store.ts`
  - `packages/core/src/constraints.ts`
  - `packages/core/src/frame-translation.ts`
  - `packages/core/src/frame-tree.ts`
  - `packages/core/src/auto-layout.ts`
  - `packages/core/src/text-layout.ts`
  - `packages/core/src/text-styles.ts`
  - `packages/core/src/color-tokens.ts`
  - `packages/core/src/number-tokens.ts`
  - `packages/core/src/aspect-ratio.ts`
  - `packages/core/src/auto-component-refresh.ts`
  - `packages/core/src/uml-ports.ts`
  - `packages/core/src/manual-route-preservation.ts`
  - `packages/core/src/bpmn/containment.ts`
  - `packages/core/src/breadboard/board-carry.ts`
  - `packages/core/src/pcb-board/follow.ts`
  - `packages/core/src/keep-members.test.ts` (new)
  - `packages/core/src/dirty-pages.test.ts` (new)
  - `apps/cli/src/edit/apply-batch.ts`
  - `apps/cli/src/__fixtures__/obstacle-routing-batch.ts`
  - `apps/cli/src/__fixtures__/obstacle-routing-batch.multi-page.expected.jsonl` (new)
  - `apps/cli/src/__fixtures__/obstacle-routing-batch.mixed-multi-page.expected.jsonl` (new)
  - `apps/cli/src/edit-performance.test.ts`
  - `apps/cli/src/native-parity/edit-performance.test.ts`
  - `impl-plans/progress/clm-02-connector-edit-perf.md`
  - `tmp/clm-s731/clm-02-connector-edit-perf`
  - `target`
- sharedPaths: none; artifactRoots: `target`
- Amendment 2026-11-04 (integration-paths-outside-writePaths, round 1), for
  finding IR-CLM02-SCOPE. The worker blocked twice
  (`tmp/clm-s731/clm-02-connector-edit-perf/readiness.log`) because two files
  outside writePaths form the per-operation path:
  - `packages/core/src/commands.ts:applyCommands` copies every element and page
    into working maps on each call.
  - `packages/core/src/editor/facade/core.ts` calls `planDerivedCommands` (it
    passes `placed` at about line 301) and `applyCommands` on the live store.
  Decisions:
  - Both files are added to the clm-02 writePaths below. No other pending
    plan owns either file.
  - `applyCommands` may stop copying elements outside the pages its commands
    touch (copy-on-write or page-scoped working maps). Results, command order,
    `CommandResult` and diffs must stay identical.
  - The facade forwards `ApplyOptions.keepMembers` into `DerivedPlanInput`,
    next to `placed`.
  - Existing coverage `packages/core/src/store-commands.test.ts` is added to
    writePaths for new cases (multi-page apply leaves other pages' elements
    identical, and the same CommandResult as before).
  - Verification 2 already runs `store-commands.test.ts`. Biome (verification
    9) must include `packages/core/src/commands.ts` and
    `packages/core/src/editor/facade/core.ts`.
  - The expected-output, byte-identity and "no file outside writePaths" rules
    are unchanged.
- writePaths added in round 1: `packages/core/src/commands.ts`,
  `packages/core/src/editor/facade/core.ts`,
  `packages/core/src/store-commands.test.ts`.
- Read-only and never edited: `apps/cli/src/__fixtures__/obstacle-routing-batch.expected.jsonl`
  (its git hash must stay `341fcd8654fc18d560c8895df1a05617a6b8ac39`),
  `target/clm-baseline/nodetto-cli` (never delete; never `cargo clean`), and
  every file owned by another clm-s731 plan (notably `bpmn/notation.ts`,
  `arrange-*.ts`, `apps/cli/src/edit/batch.ts`, `operations/*.ts`).
- Only files the profile shows are needed are edited; an untouched writePath
  is fine. If the fix needs a file outside this list, stop and record an
  amendment request in the progress log; do not edit it.

### Part 1: multi-page fixtures and expected output (before any source change)

- Extend `apps/cli/src/__fixtures__/obstacle-routing-batch.ts` with exported
  builders `obstacleRoutingMultiPage()`, `obstacleRoutingMixedMultiPage()` and
  `obstacleRoutingMixedSinglePage()` returning `{ document, operations }`
  like `obstacleRoutingBatch()`. `obstacleRoutingBatch()` output must stay
  byte-identical.
  - multiPage: the single-page document plus a second page `Grid`
    (`kind: "freeform"`) with 600 `node.generic` labelled `Widget000` to
    `Widget599` on a 30 x 20 grid (fixed integer x/y/width/height, ids
    deterministic), and 300 `edge.generic` between horizontal grid
    neighbours (`routing: "orthogonal"`, `routingAvoidObstacles: true`).
    Ops: the same 50 updates.
  - mixedMultiPage: the multiPage document, ops in fixed interleaved order:
    20 `move` of `state.node`, 3 `update` frame moves (`visual.x/y`), 50
    connector updates setting `routingAvoidObstacles: true`.
  - mixedSinglePage: the same mixed ops on the single-page document.
- Capture expected output with the HEAD code before editing any source file:
  run Bun `runCli edit` on multiPage and mixedMultiPage and write the two
  `.expected.jsonl` files; record `git hash-object` of both. Cross-check with
  `target/clm-baseline/nodetto-cli edit <doc> --ops <ops> --output <file>` (or
  its stdout form) and `cmp` -> identical; record in the progress log.
- Baseline timings with `/usr/bin/time -p` on the current HEAD release build
  (`CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli`) and on
  `target/clm-baseline/nodetto-cli` for all four ops sets (single, multiPage,
  mixedSingle, mixedMulti), written to
  `tmp/clm-s731/clm-02-connector-edit-perf/baseline-timing.log`. Run docs from
  `tmp/clm-s731/clm-02-connector-edit-perf/work/` (only .jsonl/.json data).

### Part 2: profile, then dirty-page planning

- Profile the multiPage and mixedMultiPage batches with Bun
  (`bun --cpu-prof`) and record the top self-time and total-time frames in
  the progress log. Confirm which of the design's listed sites dominate:
  `planDerivedCommands` full snapshot sort/copy and `beforeLayout` copy,
  `planConstraints` `frameParents` over every page, `planFrameTranslations`
  over every page, the BPMN/breadboard/PCB guards that scan `listElements`,
  token/style/layout planner scans, `applyBatch` per-op full maps.
- Implement the design rule: per `editor.apply`, dirty pages = pages of
  elements created/updated/deleted by permitted commands, plus pages touched
  by page commands. Every derived planner considers only dirty pages and
  must produce exactly the same commands, in the same order, as today.
  Widen to the whole document (today's behavior) when: any page command is
  permitted; a changed element is `design.token` or `design.text-style`; a
  changed element is a component master read by `planAutoComponentRefresh`;
  or a changed element's id is referenced by an element on another page
  (registry `references(semantic)`).
- Allowed techniques: page-scoped iteration (`store.getPageElements`),
  page-scoped drafts or copy-on-write, per-batch memoization keyed by
  unchanged inputs, store diffs instead of full maps in `applyBatch`. Not
  allowed: changing planner order, changing command order within a page,
  skipping a planner on a dirty page, relaxing validation.
- Record each planner's trigger scope (same-page only or cross-page) as a
  table in the progress log.

### Part 3: `keepMembers` (E1 engine)

- `packages/core/src/editor/types.ts:ApplyOptions` gains
  `readonly keepMembers?: ReadonlySet<ElementId>`; `editor.ts` forwards it;
  `DerivedPlanInput` gains `readonly keepMembers: ReadonlySet<ElementId> | undefined`.
- `planFrameTranslations`: treat `keepMembers` like `placed` (pass the union).
- `planConstraints(before, after, registry, onlyIds?, keep?)`: never move an
  element in `keep`.
- `planBpmnTranslations(before, after, keep?)`, `planBreadboardTranslations(before, draft, keep?)`:
  skip ids in `keep`.
- `planBpmnMembership(before, after, reparent?)`: re-evaluate the parent of
  every id in `reparent` even if it did not move (same geometric rule).
- Pass `keepMembers` at both `planFrameTranslations`/`planConstraints` call
  sites in `planDerivedCommands`. `planReconciliation` is unchanged.
- Without the option, every output is byte-identical.

### Tests (input -> expected)

- `apps/cli/src/edit-performance.test.ts`: single-page test unchanged; new
  tests for multiPage and mixedMultiPage -> exit 0, output byte-identical to
  the new expected files, each under 10000 ms.
- `apps/cli/src/native-parity/edit-performance.test.ts`: the same two fixtures
  with `NODETTO_CLI_TEST_BINARY`, each under 10000 ms (spawn timeout 60000,
  test timeout 120000), output equal to the expected files. Existing
  deadlines unchanged.
- `packages/core/src/dirty-pages.test.ts`: a two-page document; an update on
  page 1 leaves page 2 elements identical and produces the same commands as
  the pre-change code for page 1 (compare against an expected command list
  captured before the change); each widening case (design.token change,
  design.text-style change, component master change, cross-page reference,
  add-page) still updates the dependent element on page 2.
- `packages/core/src/keep-members.test.ts`: per planner, with and without
  `keepMembers`: frame move and frame resize with a constrained child; pool
  move (lanes follow, tasks kept, tasks re-parented); lane height change
  (sibling lane members still carried); sub-process move; board move. Without
  the option, results equal the current behavior.

### Verification (each must exit 0)

1. `bun test apps/cli/src/edit-performance.test.ts apps/cli/src/edit/apply-batch.test.ts packages/core/src/dirty-pages.test.ts packages/core/src/keep-members.test.ts`
2. `bun test packages/core/src/frame-translation.test.ts packages/core/src/frame-tree.test.ts packages/core/src/frame-membership.test.ts packages/core/src/frame.test.ts packages/core/src/constraints.test.ts packages/core/src/auto-layout.test.ts packages/core/src/text-layout.test.ts packages/core/src/store-commands.test.ts packages/core/src/manual-route-preservation.test.ts packages/core/src/bpmn/containment.test.ts packages/core/src/bpmn/editor-bpmn.test.ts packages/core/src/breadboard/board.test.ts packages/core/src/breadboard/editor-breadboard.test.ts packages/core/src/pcb-board/follow.test.ts packages/core/src/svg-export.test.ts packages/io/src/jsonl/golden.test.ts`
3. `bun test packages/core/src/editor.test.ts packages/core/src/editor-ux.test.ts apps/cli/src/commands.test.ts apps/cli/src/edit-frame-carry.test.ts`
4. `bun run typecheck`
5. `sh -c 'd="$1"; mkdir -p "$d" && rm -f "$d"/native-[123].log "$d/native.log"; CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli > "$d/native-build.log" 2>&1 || exit 1; for i in 1 2 3; do NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity/edit-performance.test.ts > "$d/native-$i.log" 2>&1 && cp "$d/native-$i.log" "$d/native.log" && exit 0; done; exit 1' sh tmp/clm-s731/clm-02-connector-edit-perf/final`
6. `grep -E '^ *[1-9][0-9]* pass$' tmp/clm-s731/clm-02-connector-edit-perf/final/native.log` and `grep -E '^ *0 fail$' tmp/clm-s731/clm-02-connector-edit-perf/final/native.log`
7. `sh -c 'test "$(git hash-object apps/cli/src/__fixtures__/obstacle-routing-batch.expected.jsonl)" = 341fcd8654fc18d560c8895df1a05617a6b8ac39'`
8. `test -x target/clm-baseline/nodetto-cli`
9. `bunx biome check <every edited TS file of this plan>` (list them explicitly in the progress log and the command).
10. Manual timing (recorded, not a gate command): `/usr/bin/time -p target/release/nodetto-cli edit ...` for the four ops sets into `tmp/clm-s731/clm-02-connector-edit-perf/after-timing.log`; report user CPU for multiPage / single and mixedMulti / mixedSingle (target <= 1.5 each) and the ratio against the baseline binary.

### Done criteria

- Expected files captured before source edits, hashes recorded and unchanged
  at the end; profile evidence and the planner scope table recorded.
- Verification 1-9 exit 0; the manual ratios recorded. If a ratio exceeds 1.5,
  record it as an unmet target with the profile showing the remaining cost;
  do not mark the plan done.
- `git status --short` shows only clm-s731 writePaths of this plan changed by
  this plan.

---

- planId: clm-02-connector-edit-perf
- planPath: impl-plans/active/clm-02-connector-edit-perf.md
- progressPath: impl-plans/progress/clm-02-connector-edit-perf.md
- wave: 1
- dependsOn: none
- Design: `design-docs/specs/design-cli-layout-merge-lint.md`, sections
  "Shared IR additions (connector semantics)" and A7, plus the "IR fields"
  and A7 rows of "Verification".
- This plan merges the drafts clm-02-edit-perf and clm-05-connector-fields,
  which both edited `shapes/connector/resolve.ts`.
- writePaths:
  - `packages/ir/src/semantics/connectors.ts`
  - `packages/ir/src/registry/generic.ts`
  - `packages/ir/src/registry/uml.ts`
  - `packages/ir/src/registry/erd.ts`
  - `packages/ir/src/registry/bpmn.ts`
  - `packages/ir/src/connector-positions.test.ts` (new)
  - `packages/core/src/shapes/connector/resolve.ts`
  - `packages/core/src/shapes/connector/boundary.ts`
  - `packages/core/src/shapes/connector/route.ts`
  - `packages/core/src/shapes/connector/label-box.ts`
  - `packages/core/src/connector-positions.test.ts` (new)
  - `packages/core/src/orthogonal-routing.ts`
  - `packages/core/src/frame-translation.ts`
  - `packages/core/src/frame-tree.ts`
  - `packages/core/src/manual-route-preservation.ts`
  - `packages/core/src/editor/transaction.ts`
  - `apps/cli/src/edit/apply-batch.ts`
  - `apps/cli/src/__fixtures__/obstacle-routing-batch.ts` (new)
  - `apps/cli/src/__fixtures__/obstacle-routing-batch.expected.jsonl` (new)
  - `apps/cli/src/edit-performance.test.ts` (new)
  - `apps/cli/src/native-parity/edit-performance.test.ts` (new)
  - `impl-plans/progress/clm-02-connector-edit-perf.md`
  - `tmp/clm-s725/clm-02-connector-edit-perf`
  - `target`
- sharedPaths: none
- artifactRoots: `target`

## Amendment 2026-11-04 (blocked-wave-scope-or-contract, round 1)

- Blocker: the baseline binary location
  `tmp/clm-s725/clm-02-connector-edit-perf/nodetto-cli-baseline` sat inside a
  source path. The shared-write protocol forbids binaries under source paths.
- Decision: the pre-change baseline binary goes to
  `target/clm-baseline/nodetto-cli`, inside the existing artifact root
  `target`. writePaths and artifactRoots do not change. Logs
  (`baseline-native.log`, `after-native.log`) stay as text files under
  `tmp/clm-s725/clm-02-connector-edit-perf/`.
- "Pre-change" means the current shared tree before any clm-02 source edit.
  That tree already contains the accepted clm-01, clm-03, clm-04 and clm-08
  changes, which is expected. Build the baseline first, before task 1's
  expected-output capture changes anything.
- Do not run `cargo clean` or delete `target/clm-baseline`. clm-09 reads it
  for the final timing comparison.
- Verification: the check `test -x tmp/clm-s725/clm-02-connector-edit-perf/nodetto-cli-baseline`
  is replaced by `test -x target/clm-baseline/nodetto-cli`.
- No design change.

## Intent and context

Part 1 (A7): an `edit` batch of about 50 `update` operations that set
`routingAvoidObstacles: true`, on a state page with about 20 states and 3
frames, takes more than two minutes natively. Fix it to take a few seconds,
with byte-identical output.

Part 2 (IR fields): add three optional connector fields and one resolver
case. clm-06 uses them for label placement, port spreading and self-loops.
Documents without the fields must render byte-identically.

Do Part 1's baseline (tasks 1 and 2) before any source change, including
Part 2's changes.

Context:

- Routes are never stored. `resolveConnector` (`shapes/connector/resolve.ts`)
  and `avoidOrthogonalObstacles` (`orthogonal-routing.ts`) compute them at
  render and bounds time. Their caches are keyed by a `ShapeContext`
  (`pageObstacles`, `resolvedRoutes`) or an element object (`routeCache`).
- Per operation, `planDerivedCommands` (`editor/transaction.ts`) copies the
  store and runs all planners. `planFrameTranslations` resolves frame
  membership, which includes connector routes, and
  `planManualRoutePreservation` creates a fresh shape context.
- `apps/cli/src/edit/apply-batch.ts:applyBatch` lists all elements after
  every operation and validates every changed element.
- The label anchor comes from `route.ts:withRoute` at 0.5 of the route
  length. Ports come from `boundary.ts:pinnedPort` at the side midpoints of
  `connectionPorts`. The state self-loop is the hard-coded case in
  `resolve.ts`, around lines 200-227.
- The routing validator is in `registry/generic.ts`, around lines 51-110.
  `keyOrder` lists containing `"routingBend"` are at `generic.ts:141`,
  `uml.ts:154,250,367,422`, `erd.ts:329` and `bpmn.ts:311,338,364,390`.
  Re-grep for `"routingBend"`; these line numbers are approximate.

## Non-goals

- No change to written output, error text, operation indexes, exit codes,
  all-or-nothing semantics or the concurrency re-apply.
- No new CLI flags, no arrange logic and no UI inspector controls.
  `packages/ui-solid/src/connector-routing.ts` and `connectionPorts` stay as
  they are.
- Do not edit `apps/cli/src/edit/batch.ts`, `edit/operations/*.ts` or
  `edit/report.ts` (clm-04 owns them), and do not edit shared files.
- No Rust. If the profile proves a host-side cost, stop and record a Step-5
  blocker.
- Never relax an existing deadline.

## Contract (clm-06 depends on it)

- `ConnectorRoutingSemantic` gains `labelPosition?: number`,
  `fromPortPosition?: number` and `toPortPosition?: number`.
- `label-box.ts` exports `connectorLabelBoxAt(element: Element, anchor: Vec): Box`:
  the `connectorLabelBox` layout at a given anchor. `connectorLabelBox`
  keeps its values and calls it.
- `route.ts` exports `pointAlongRoute(points: readonly Vec[], ratio: number): Vec`
  (the existing private `pointAlong`). `withRoute` gains an optional
  `labelRatio` (default 0.5). `resolveConnector` passes the clamped
  `labelPosition`.

## Tasks

1. Fixture generator `apps/cli/src/__fixtures__/obstacle-routing-batch.ts`:
   - Export `obstacleRoutingBatch(): { document: string; operations: string }`.
     Build it with `new Editor()` and `createElement`, the way
     `apps/cli/src/__fixtures__/dense-relations.ts` does. The page kind is
     `state`.
   - 3 frames `Stage0` to `Stage2` with fixed integer geometry. 20
     `state.node` elements (`Idle`, `Running`, `Paused`, `Done`, then
     numbered names; one with `kind: "initial"`) placed inside the frames.
     50 `state.transition` elements between deterministic pairs (for
     example `i % 20` to `(i * 7 + 3) % 20`, skipping self-pairs), each with
     a `trigger`, `routing: "orthogonal"` and `routingAvoidObstacles: false`.
   - 50 `update` operations with `semantic: {routingAvoidObstacles: true}`.
     Use only `op`, `id` and `semantic`, so clm-04's field check accepts
     them.
   - All ids are fixed strings.
2. Baseline, before any other source change:
   - Run the edit with Bun and write the result to
     `obstacle-routing-batch.expected.jsonl`. Record its `git hash-object`.
   - `CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli`, then copy
     the binary to `target/clm-baseline/nodetto-cli` (inside the declared
     artifact root `target`; never under `tmp/`, which is a source path)
     and run
     `/usr/bin/time -p <baseline binary> edit <tmp doc> --ops <tmp ops>` into
     `baseline-native.log`. If it runs over 300 s, stop it and record
     "> 300 s". clm-09 reuses the baseline binary for the final comparison.
3. Profile with `bun --cpu-prof`, and temporary counters if needed (remove
   them afterwards). Record the top self-time functions and the work that
   repeats per operation in the progress log as "Confirmed root cause".
4. Fix only the confirmed cause, with a technique the design allows:
   - per-batch memoisation keyed by unchanged inputs (page obstacle geometry
     per store version, a resolved route per connector object);
   - skipping derived planners whose triggers the commands cannot meet;
   - avoiding per-operation full-document copies.
   A cache key must include everything the value depends on. Prefer
   `WeakMap` keyed by store or element objects, and never cache across
   documents.
5. IR fields:
   - In the shared validator, each field must be a finite number in [0, 1],
     otherwise it is an error at the path. A position without its port is a
     warning with code `semantic.portPositionWithoutPort`.
   - Add the three keys to every `keyOrder` that has `routingBend`, right
     after `routingBend`, unless an existing key-order test requires
     another position.
6. Resolver:
   - `pinnedPort(element, context, port, position?)`: when `position` is a
     finite number, shift the outward target along the side by
     `(position - 0.5) * sideLength` before `resolvedBoundary`. The side
     length is the unrotated box width for top/bottom and the height for
     left/right. Then apply the existing rotation.
   - Same-side self-loop: when `from === to`, both ports are set and equal,
     and the type is neither `erd.relation` nor `sequence.message`, the
     points are start (pinned at `fromPortPosition ?? 0.3`), start +
     normal*40, end + normal*40, end (pinned at `toPortPosition ?? 0.7`).
     This case comes before the generic orthogonal case and goes through
     `withRoute`. A self-loop without ports keeps today's loop.
   - Non-finite values are ignored at render time (validation reports
     them).
7. Tests: see below.
8. Final timing: `/usr/bin/time -p` with the new release binary, into
   `after-native.log`. Report the ratio against the baseline.

## Pitfalls

- Byte-identical means exact string equality with the expected file created
  in task 2. Never regenerate it after a change. Its hash must be the same
  at the end.
- The fixture does not use the new fields, so Part 2 must not change its
  output either.
- No regex `split` over the document, and no point destructuring in routing
  loops.
- `apps/cli/native/build.rs` bundles the shared TS engine. A sibling's
  broken file can break the native build: record drift and retry. Never
  edit that file.

## Tests (input -> expected)

- `apps/cli/src/edit-performance.test.ts` (Bun, through `runCli` with an
  in-memory io): output equals the expected file exactly, in under 10000 ms.
- `apps/cli/src/native-parity/edit-performance.test.ts`: spawn the binary
  from `NODETTO_CLI_TEST_BINARY` in a temp dir (spawn timeout 60000, test
  timeout 120000). Exit 0, the written file equals the expected file, wall
  time under 10000 ms, and stdout and stderr equal the Bun run (the
  `compare` pattern in `native-parity/harness.ts`).
- `packages/ir/src/connector-positions.test.ts`:
  - `labelPosition: 1.5` -> an error at `.labelPosition`.
  - `fromPortPosition: 0.2` without `fromPort` -> the warning code.
  - The fields on `state.transition`, `edge.generic`, `erd.relation` and a
    uml association -> no `semantic.unknownField`.
- `packages/core/src/connector-positions.test.ts`:
  - `labelPosition: 0.25` -> `labelPoint` at a quarter of the route.
  - No fields -> `labelPoint` equals `pointAlongRoute(points, 0.5)`.
  - `fromPort: "right"`, `fromPortPosition: 0.25` -> start y a quarter
    down the right side.
  - Self-transition with both ports `"bottom"` -> 4 points below the box,
    40 units out.
  - Self-transition without ports -> the same points as before.
  - `connectorLabelBoxAt(element, labelPoint)` equals `connectorLabelBox`.

## Verification (each must exit 0)

1. `bun test apps/cli/src/edit-performance.test.ts apps/cli/src/edit/apply-batch.test.ts`.
2. `bun test packages/ir/src packages/core/src/connector-positions.test.ts packages/core/src/connector-endpoints.test.ts packages/core/src/connector-policy.test.ts packages/core/src/connector-outlines.test.ts`.
3. `bun test packages/core/src/frame-translation.test.ts packages/core/src/frame-tree.test.ts packages/core/src/frame-membership.test.ts packages/core/src/frame.test.ts packages/core/src/frame-selection.test.ts packages/core/src/orthogonal-routing.test.ts packages/core/src/manual-route-preservation.test.ts packages/core/src/svg-export.test.ts packages/io/src/jsonl/golden.test.ts`.
   Confirm each file exists first (`ls`). Drop a missing one and record it.
   No golden may change.
4. `bun run typecheck`.
5. `CARGO_TERM_QUIET=true cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity/edit-performance.test.ts`:
   more than 0 tests run, and all pass. Use up to 3 attempts on a deadline
   timeout.
6. `bunx biome check <owned TS files>`.

The full core suite runs in clm-09's `mise run verify`, because wave-1
siblings edit core files at the same time.

## Done criteria

- The progress log has the baseline timing, the confirmed root cause, the
  after CPU time and the ratio.
- The expected file's hash is unchanged since task 2.
- `grep -n "export function connectorLabelBoxAt" packages/core/src/shapes/connector/label-box.ts`
  and `grep -n "export function pointAlongRoute" packages/core/src/shapes/connector/route.ts`
  both match.
- Verification 1 to 6 exit 0, and their logs are recorded.
- `git status --short` shows only writePaths changed.

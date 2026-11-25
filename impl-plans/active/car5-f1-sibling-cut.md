# car5-f1-sibling-cut

- planId: car5-f1-sibling-cut; wave 1; dependsOn: none
- planPath: impl-plans/active/car5-f1-sibling-cut.md
- progressPath: impl-plans/progress/car5-f1-sibling-cut.md
- Finding: function-capture-visible-sibling-cut-report (R5-1, high).
- Design: `design-docs/specs/design-ai-capture.md` 23.1 R5-1, 23.3, 23.5.
- writePaths: `packages/core/src/capture/describe.ts`,
  `packages/core/src/capture/describe.test.ts`,
  `apps/cli/src/native-parity/capture.test.ts`,
  `packages/cad-kernel/src/shared-cut.test.ts` (new), `tmp/capture/m09/timing.json`,
  `tmp/capture/m23/timing.json`, `tmp/car5-r5/car5-f1-sibling-cut`,
  `impl-plans/progress/car5-f1-sibling-cut.md`, `target`, `tmp/cad3d`
- sharedPaths: none; artifactRoots: `target`, `tmp/cad3d`
- The two `tmp/capture/*/timing.json` files are written by the existing native parity
  suite (`capture.test.ts:180`, `:317-319`, `:976-980`); do not redirect them.

Follow the worker rules in `impl-plans/active/car5-00-overview.md`.

## Intent and context

The editor rejects a whole Boolean when any target becomes empty
(`packages/core/src/cad/evaluate.ts:827`). Capture applies the shared step to every
visible target (`scene.ts:441`), and the census marks only the emptied body. The trimmed
visible sibling therefore shows a cut the app does not have, with no note. Add the note
in `describeBodies` only, from data already in the report and model.

Non-goals: no Rust, NCS1, report JSON, `report.ts`, `scene.ts`, `capture-cad.ts` or
desktop edit; no change to hidden-target (R4-1) text or selection.

## Changes (`describe.ts`, `describeBodies`)

- Existing attribution per body = exactly today's choice (`describe.ts:137-156`): a
  valid hidden attribution (`hiddenEmptiedByStep = h` present and `body.steps[h]` names
  a tool) wins whatever the indices; else the own one (`emptiedByStep = e != -1` and
  `body.steps[e]` names a tool); else none.
- Sources: visible body `a` whose existing attribution is the own one at step `j`,
  `report.bodies[a].open === false`, and `steps[j].op` is `"difference"` or
  `"intersection"` with tool `t`. One pass over raw report values; no chain resolution.
- Sibling candidate for every other body `b` with `open === false`: the first step
  index `k` in `b.steps` with the same `tool` and `op`. Over all sources take the
  smallest `k`; ties go to the source earlier in `model.bodies`.
- Selection: the sibling replaces the existing attribution only when there is none or
  `k` is strictly smaller than its step. Ties and earlier existing steps keep today's
  attribution and text.
- Sibling error: `{ id: tool.feature, code: "cad.result.empty", text: "(sampled): leaves no material in \"<e name>\"; the app rejects this feature and keeps \"<b name>\" as it was, this picture applies it" }`
  where `e` is the source; names through `plain()`. The source keeps its own error.
  Errors stay in `model.bodies` order, at most one per body.
- `[differs from the app, see errors]` is also appended when the sibling stands, under
  the existing state condition (`drawn`, `hidden`, `outside`).

Imitate the existing literal style of `describe.test.ts:153-195`.

## Pitfalls

- Do NOT take the minimum over hidden, own and sibling: `describe.test.ts:188`
  (`emptiedByStep 0`, `hiddenEmptiedByStep 1`) must keep the hidden text.
- An `unknown` body has `emptiedByStep -1` and is never a source; open bodies are never
  sources or siblings.
- Indexed reads must be typed (`body.steps[k]` may be undefined).

## Tests

`describe.test.ts` (model/report literals; `rail` steps `[union 0, difference 2]`, `tab`
steps `[union 1, difference 2]`, tools `[base, tabTool, slot]`):
- `rail` -1, `tab` `emptiedByStep 1` state `empty` -> errors `[sibling(slot) on rail
  naming "tab" and "rail", own(slot) on tab]`; rail line has the differs note.
- rail-only control -> no errors, no note.
- `rail` own `emptiedByStep 1` -> only own text.
- earlier sibling: `rail` `[union 0, difference 2, difference 3]`, own `emptiedByStep 2`,
  `tab` emptied at step 1 by tool 2 -> rail gets sibling text for `slot`.
- equal-step hidden: `rail` `hiddenEmptiedByStep 1`, sibling also step 1 -> hidden text.
- later sibling: `rail` `hiddenEmptiedByStep 1`, sibling at step 2 -> hidden text.
- open sibling; open source; source state `unknown` with -1 -> no sibling error.
- Existing tests (including `:188`) unchanged.

`packages/cad-kernel/src/shared-cut.test.ts` (new; imitate
`packages/cad-kernel/src/worker-host.test.ts:22` `evaluator`, `:126` `volumeOfStl`
copied locally, helpers from `../../core/src/cad/testing/documents.ts`): `rail`
rectangle 0,0,20,10 extruded 4 (`op: "new"`), `tab` 1,1,2,2 extruded 4, `slot` 0,0,5,10
cut 4.
- targets `[rail, tab]` -> status contains `["slot", { code: "cad.result.empty" }]`;
  rail STL volume 800 (toBeCloseTo, 6).
- targets `[rail]` -> no slot failure; rail volume 600.

`native-parity/capture.test.ts` (next to the hidden-cut test at `:571`, same helpers and
`runCad`, `--view top --no-interference`):
- visible `tab`, targets `[rail, tab]` -> `bodies:` line lists `rail` with
  `[differs from the app, see errors]`; one error line with `slot`, `"tab"` and
  `"rail"`; with `--json`, `errors` has that entry with `sampled: true` and full
  feature id `slot`.
- hidden `tab` -> today's hidden-target output (errors: 1, hidden text).
- targets `[rail]` -> `errors: 0`, no note.

## Verification (each exits 0 and runs tests)

1. `bunx biome check --diagnostic-level=warn packages/core/src/capture/describe.ts packages/core/src/capture/describe.test.ts packages/cad-kernel/src/shared-cut.test.ts apps/cli/src/native-parity/capture.test.ts && bun test packages/core/src/capture/describe.test.ts packages/cad-kernel/src/shared-cut.test.ts`
   - evidence: new describe cases fail before the change (log), all pass after.
2. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car5-f1-sibling-cut cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/car5-f1-sibling-cut/release/nodetto-cli" bun test apps/cli/src/native-parity/capture.test.ts`
   - evidence: the new visible-tab case passes; the whole native capture suite passes.

## Done criteria

- All listed cases present and passing; `:188` unchanged; no file outside writePaths
  edited; progress log `done` with pre-fix failure evidence.

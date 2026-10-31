# sms-01-editor-facade

- planId: sms-01-editor-facade
- planPath: impl-plans/active/sms-01-editor-facade.md
- progressPath: impl-plans/progress/sms-01-editor-facade.md
- wave: 1 of 3 in session 589. It runs alone in its wave.
- dependsOn: none. Base `b52e4dbe5509f739a3c1e996377ee2ac0e70059b`.
  Implementation commit under review:
  `9ef8639acdb29e0882fe958d5045aff531a5fe44` (session 579). Run HEAD:
  `9e6ccc7` plus the session-589 design and plan commit, with the same
  source as 9ef8639.
- Design: `design-docs/specs/design-source-module-split.md`. Read
  "Invariants", "1. Editor facade" (1.1-1.4, including the session 589
  paragraph), "4. Documentation", "5. Verification" (commands 1-3, 5-9
  and 10), "Rollout constraints", "Risks" and D11.
- Evidence directory: `tmp/source-module-split-s589/sms-01-editor-facade/`.
  `tmp/` is git-ignored. Write only `.log` and `.txt` files there, never
  `.ts` or `.sh`, because `bun test` collects stray `.ts` copies under
  `tmp/`. Baseline and review files go directly in it. The gate run goes
  in its `final/` subdirectory (the design's `$d`). If the gates must run
  again after a repair, first move `final/` to `attempt-<n>/` with `mv`
  inside the evidence directory, then rerun into a fresh `final/`.
  Session 579 and session 583 evidence under
  `tmp/source-module-split-s579/sms-01-editor-facade/` and
  `tmp/source-module-split-s583/sms-01-editor-facade/` may be read but
  not changed.
- Write paths (manifest `impl-plans/active/source-module-split-s589-dispatch.json`):
  `packages/core/src/editor.ts`, `packages/core/src/editor/facade`,
  `packages/core/src/editor/{paste,pages,sequence,bpmn,breadboard,connections}.ts`
  (six files), `docs/development.md`, the progress log, the evidence
  directory and `target/`. `target/` is the git-ignored build output root
  (`artifactRoots: ["target"]`) that `mise run verify` and `mise run
  test-cli` write to.

## Intent and context

Session 579 implemented this plan in commit 9ef8639. `Editor` is now a
single-inheritance chain (design 1.1):

```text
EditorCore            packages/core/src/editor/facade/core.ts               (531 lines)
  <- ElementEditing   packages/core/src/editor/facade/element-editing.ts    (226)
  <- SelectionEditing packages/core/src/editor/facade/selection-editing.ts  (397)
  <- PageEditing      packages/core/src/editor/facade/page-editing.ts       (238)
  <- NotationEditing  packages/core/src/editor/facade/notation-editing.ts   (285)
  <- Editor           packages/core/src/editor.ts                           (267)
```

Nobody has reviewed that work: the session-579 review branch failed with
a provider error. In session 583, this plan is the review-and-repair pass
of design section 1.4 (decision D8). You do not implement the split
again. You check the existing implementation against design sections 1.2
and 1.3 and against test integrity. You fix every finding inside the write
paths, then run the sms-01 gates. Those gates already pass at 9ef8639,
according to the session-579 logs: verify 2945 pass, 25 skip, 0 fail;
test-cli 172 pass, 0 fail. If the review finds nothing, this plan makes no
source edit, and its only outputs are the progress log and the evidence.

Session 583 ran R1-R10 as an implementer self-check (progress log section
"Session 583 review"). R1-R8 and R10 passed. R9 failed: test-cli had 166
pass and 6 fail, all deadline timeouts, at a load average of 87.94. That
self-check does not replace the independent review that follows this
plan. In session 589 you run R1-R10 again into the session-589 evidence
directory, and you run every gate fresh. Two things are new in session
589 (design D11):

- `mise run verify` and `mise run test-cli` run inside the design's
  three-attempt retry loops (G1 and G2 below). A gate passes on the first
  fully green attempt. Test deadlines and timeouts are never changed.
- A CPU-time regression check (G10, design command 10) compares
  `target/release/nodetto-cli` with the installed 0.8.5 binary
  `/opt/homebrew/bin/nodetto-cli` and fails if the new one is more than
  15% slower.

## Non-goals

- Do not reimplement, restructure or reformat the chain. Do not move a
  member unless a finding shows it is in the wrong class according to
  design 1.2.
- Do not touch:
  - `packages/core/src/index.ts`;
  - `packages/core/src/editor/components.ts`, `transaction.ts`,
    `transform.ts`, `style-text.ts` or `types.ts`;
  - any `component-*.ts` module;
  - any test file;
  - anything under `apps/`, `packages/io/` or `examples/`;
  - the design, the other plans or any manifest.
- Do not export the chain classes from `index.ts`. Do not add interfaces,
  mixins, prototype patching, decorators or `super.` calls.
- Do not change planner bodies. In the six planners, only the editor
  parameter type annotation and its `import type` line may differ from
  b52e4db.
- Do not add tests. This plan extracts no new pure helper (design D6).

## Invariants (must hold after this plan)

- The chain and member placement match design 1.2. Each member name is
  declared once in the chain. No class overrides a member and no class
  calls `super.`.
- Only `EditorCore` declares instance fields and a constructor. The fields
  keep the b52e4db declaration order, and `requireAsset` is the last
  field (`useDefineForClassFields` is true in `tsconfig.base.json`).
- A member is `protected` only when a later class in the chain uses it.
  Members that are public at b52e4db stay public.
- Only `editor.ts` and `editor/facade/*.ts` import a chain class as a
  value, and each one imports only the class it extends. Planners use
  `import type` (design command 9).
- `unlockedFrame` and `frameSemantic` in `editor.ts` run the same checks,
  in the same order, with the same early returns as the b52e4db code they
  replaced. That code is in `makeComponent`, `detachComponentInstance` and
  `detachResponsiveVariant` for the guard, and in the six frame-semantic
  sites.
- `index.ts`, `editor/types.ts` and `editor/components.ts` are
  byte-identical to b52e4db.

## Review procedure (file-level work)

Record each review item in the progress log as `SMS01-R<n>` with:

- the command or inspection you used;
- the evidence file;
- the outcome: `pass` or `finding`;
- for a finding, its severity (high, mid or low) and its disposition
  (`fixed` with the commit-free diff summary, or `no change needed` with
  the reason).

The commands below that produce residue files exit 0 even when they find
differences, because they use `|| test $? -eq 1`. They are evidence
steps, not gates. You must read every residue line and account for it.

1. R1, member placement. Write
   `tmp/source-module-split-s589/sms-01-editor-facade/r1-members.txt`.
   For each of the six classes, it lists the own prototype names, sorted,
   excluding `constructor`: `Object.getOwnPropertyNames(C.prototype)`,
   obtained with an inline `bun -e` that imports `Editor` from
   `packages/core/src/editor.ts` and walks `Object.getPrototypeOf`. Compare
   each list with the design 1.2 table. Extra names are allowed only for
   these helpers:
   - `notify`, `applyPlan` and `rejectBpmn` in `EditorCore`;
   - `insertCopies` in `SelectionEditing`;
   - `rebuildComponentInstance`, `rebuildResponsiveVariant`,
     `unlockedFrame` and `frameSemantic` in `Editor`.

   Getters such as `readOnly` appear as accessors and count as members. A
   name that appears in two classes is a finding.
2. R2, fields and constructors. Run
   `grep -nE '^  (constructor\(|(private |protected |public )?(readonly )?[A-Za-z_]+[!?]?(: [^(]*)? = |(private |protected |public )?(readonly )?[A-Za-z_]+[!?]?: [^(]*;$)' packages/core/src/editor.ts packages/core/src/editor/facade/*.ts > tmp/source-module-split-s589/sms-01-editor-facade/r2-fields.txt || test $? -eq 1`.
   Every hit must be in `facade/core.ts`. Compare the order of the field
   names with
   `git show b52e4db:packages/core/src/editor.ts`, lines 201-256 and the
   `requireAsset` field at line 1154. The field order is also checked at
   runtime by gate G6 (`Object.keys(new Editor())`).
3. R3, moved bodies are unchanged. Run
   `diff <(git show b52e4db:packages/core/src/editor.ts | sed -E 's/^[[:space:]]+//' | grep -v '^$' | sort) <(cat packages/core/src/editor.ts packages/core/src/editor/facade/*.ts | sed -E 's/^[[:space:]]+//' | grep -v '^$' | sort) > tmp/source-module-split-s589/sms-01-editor-facade/r3-line-residue.txt || test $? -eq 1`
   in bash. If `cmp` shows this file is byte-identical to
   `tmp/source-module-split-s583/sms-01-editor-facade/r3-line-residue.txt`,
   you may cite the session-583 line accounting, but you still read every
   line yourself. Otherwise each residue line must be one of these, and
   you note which for each line in the progress log:
   - an import line;
   - a class header;
   - a `private` to `protected` keyword change;
   - the updated `editor.ts` header comment;
   - a line of `unlockedFrame` or `frameSemantic`, or a call site that
     now uses them;
   - a line that Biome rewrapped, joined or split, with the same tokens.

   Any other residue line is a finding.
4. R4, planner diffs. Run
   `git diff b52e4db 9ef8639 -- packages/core/src/editor/paste.ts packages/core/src/editor/pages.ts packages/core/src/editor/sequence.ts packages/core/src/editor/bpmn.ts packages/core/src/editor/breadboard.ts packages/core/src/editor/connections.ts > tmp/source-module-split-s589/sms-01-editor-facade/r4-planners.txt`.
   Every hunk may change only an `import type` line or the editor
   parameter's type annotation. The expected types are:
   - `EditorCore` for `planInsertCopies`, `planDuplicatePage`, the
     `sequence.ts` planners, `planBpmnLane` and `buildBreadboardPart`;
   - `NotationEditing` for `connections.ts`.

   If a planner takes a higher class than design 1.3 lists, that is a
   finding only when a lower class has every member it uses.
5. R5, deduplication. Read `unlockedFrame` and `frameSemantic`
   (`packages/core/src/editor.ts:36-53`) next to the b52e4db bodies of
   `makeComponent`, `detachComponentInstance`, `detachResponsiveVariant`,
   `resetComponentInstance`, `switchComponentVariant`,
   `updateComponentStructure`, `planComponentStructureUpdate`,
   `updateResponsiveStructure` and `refreshResponsiveVariant`. Check:
   - `store.get(id)`, then the frame type check, then
     `createShapeContext().isLocked?.(id)`, in that order, with the same
     short-circuit;
   - every `return false`, `return null` and `return undefined` at the
     call sites is preserved;
   - `applyPlan` and `apply` are not merged.
6. R6, visibility. For each `protected` member, grep its uses in later
   classes. A `protected` member with no use in a later class should be
   `private`; report it as a low finding and fix it. A `private` member
   that a later class uses would fail typecheck, which G1 covers.
7. R7, import direction and side effects. Gate G8 covers import direction.
   Also check that no facade file has a module-level statement other than
   imports and the class declaration.
8. R8, test integrity. Run
   `test -z "$(git diff --name-only b52e4dbe5509f739a3c1e996377ee2ac0e70059b 9ef8639 | grep -E '\.test\.tsx?$')"`
   (exits 0). The fresh verify pass and skip counts must equal the
   session-579 pre-edit baseline: 2945 pass, 25 skip, 0 fail.
9. R9, the parity timeout disposition. In session 579 the standalone
   parity rerun timed out:
   `tmp/source-module-split-s579/sms-01-editor-facade/retry2-native-parity.log`
   shows 16 pass and 1 fail, golden fixtures over 95 s, 278.80 s in total.
   In session 583, `tmp/source-module-split-s583/sms-01-editor-facade/test-cli.log`
   shows 166 pass and 6 fail (timeouts) at a load average of 87.94.
   Record both as `no change needed (machine load)` only when all three
   are true:
   - G2 here exits 0, and its green copy `final/test-cli.log` shows
     ` 0 fail`, ` 172 pass` and no skip line;
   - G10 exits 0 (CPU time within 15% of 0.8.5);
   - `final-hashes.txt` from session 579 matches the current source.

   If G2 fails on all three attempts, or G10 fails on all three attempts,
   that is a high finding. Do not waive it as load and do not loosen any
   deadline. Record it as a blocker and stop.
10. R10, documentation. The `docs/development.md` paragraph added after
    "`collab` is still a scaffold." names the five classes in order, says
    that planners compute plans without applying them, and says that
    component members stay in `editor.ts`. The `editor.ts` header comment
    describes the split (design section 4). Check with
    `git diff b52e4db 9ef8639 -- docs/development.md`: there must be
    exactly one added paragraph.

### Repair rules

- Fix each finding in place, inside the write paths, following design
  1.2 and 1.3. Before each edit, read the file fresh and record its
  `shasum -a 256` before and after the edit.
- After any repair, run Biome only on the edited files
  (`bunx biome check --write <file>`), then run every gate again.
- If a fix would need a path outside the write paths, or a design change,
  stop and record a blocker in the progress log. Do not edit outside the
  write paths.

## Patterns to imitate

- The existing chain files themselves, for example
  `packages/core/src/editor/facade/element-editing.ts:ElementEditing`,
  which extends exactly one class and imports it as a value.
- Type-only planner imports, for example
  `packages/core/src/editor/pages.ts` (`import type { EditorCore } ...`).

## Pitfalls

- `useDefineForClassFields`. Declaring even a typed field without an
  initializer in a subclass redefines it on the instance and changes
  `Object.keys(new Editor())`. A repair must never add a field outside
  `EditorCore`.
- Do not "tidy" moved code. Any byte change in a body that R3 cannot
  account for is a behavior risk.
- Do not run Biome over the whole repo. Do not touch the generated
  `apps/desktop/src-tauri/gen/schemas/*.json` if `mise run verify`
  rewrites them; report any drift in `git status --short`.
- A gate that fails because of load (a parity timeout) is never waived.
  Retry only through the G1/G2/G10 loops, never by hand. Follow R9.
- Never edit a test deadline, a timeout, `mise.toml` or a test file to
  make a gate pass.
- Run the retry loops exactly as written, through `sh -c` or `bash -c`.
  A bare `exit` in your own shell would end the session.

## Shared working directory protocol

- Before the first action, record the intent snapshot in the progress
  log: this plan's review items R1-R10 and the repair rules.
- Record the `shasum -a 256` of every file in the write paths at the
  start. Compare them with
  `tmp/source-module-split-s579/sms-01-editor-facade/final-hashes.txt`.
  A mismatch is drift: record it and re-read before you continue.
- Before each edit, read the file fresh and record its pre and post
  hashes.

## Steps

1. Baseline (B1, B2) on the untouched tree. Record the hashes.
2. Run the review items R1-R8 and R10. Record each outcome.
3. Repair every finding (if there is none, skip this step).
4. Run gates G1-G10 in order into `final/`, with G10 directly after G2.
   All must exit 0. Then settle R9.
5. Write the review summary in the progress log: the findings table,
   final hashes and final `wc -l`.

## Verification

Run every command from the repository root, with output redirected to the
evidence directory. Record each exit code and log path in the progress
log. Every gate must exit 0. Below, `F` stands for
`tmp/source-module-split-s589/sms-01-editor-facade/final`; write the
literal path in every command. Run `mkdir -p` on it first.

- B1, with up to three attempts because `bun test` has deadlines too:
  `sh -c 'd=tmp/source-module-split-s589/sms-01-editor-facade; mkdir -p "$d"; for i in 1 2 3; do BUN_OPTIONS=--jsx-runtime=classic bun test > "$d/baseline-bun-test-$i.log" 2>&1 && cp "$d/baseline-bun-test-$i.log" "$d/baseline-bun-test.log" && exit 0; done; exit 1'`.
  From `baseline-bun-test.log`, record the ` N pass`, ` N skip` and
  ` N fail` lines. The expected values are 2945 pass, 25 skip and 0 fail.
  A different value is drift from session 579: stop and report it.
- B2: `wc -l packages/core/src/editor.ts packages/core/src/editor/*.ts packages/core/src/editor/facade/*.ts > tmp/source-module-split-s589/sms-01-editor-facade/baseline-wc.txt`.
- G1 (design command 1, load-tolerant):
  `sh -c 'd="$1"; mkdir -p "$d" && rm -f "$d"/verify-[123].log "$d/verify.log"; for i in 1 2 3; do BUN_OPTIONS=--jsx-runtime=classic CARGO_TERM_QUIET=true mise run verify > "$d/verify-$i.log" 2>&1 && cp "$d/verify-$i.log" "$d/verify.log" && exit 0; done; exit 1' sh F`
  exits 0. Then `grep -E '^ *0 fail$' F/verify.log` exits 0, and
  `grep -Ex ' *2945 pass' F/verify.log` exits 0. This is B1's pass count;
  sms-01 adds no tests.
- G2 (design commands 2 and 3, load-tolerant):
  `sh -c 'd="$1"; mkdir -p "$d" && rm -f "$d"/test-cli-[123].log "$d/test-cli.log"; for i in 1 2 3; do CARGO_TERM_QUIET=true mise run test-cli > "$d/test-cli-$i.log" 2>&1 && cp "$d/test-cli-$i.log" "$d/test-cli.log" && exit 0; done; exit 1' sh F`
  exits 0. Then all of these exit 0:
  - `grep -E '^ *0 fail$' F/test-cli.log`
  - `test -z "$(grep -E '^ *[1-9][0-9]* skip$' F/test-cli.log)"`
  - `grep -Ex ' *172 pass' F/test-cli.log`

  Record, for each attempt log that exists (`test-cli-1.log` to
  `test-cli-3.log`), its pass and fail lines and the current
  `uptime` load average. A failed earlier attempt is evidence, not a
  waiver.

  Command 2 sets `NODETTO_CLI_TEST_BINARY`, so all 17 parity blocks run on
  `target/release/nodetto-cli`, in Boa with the chain. The collection
  check is
  `env -u NODETTO_CLI_TEST_BINARY bun test apps/cli/src/native-parity > F/parity-collect.log 2>&1`,
  which exits 0, followed by
  `grep -Ex ' *17 skip' F/parity-collect.log`,
  which also exits 0. At this wave the filter matches
  `apps/cli/src/native-parity.test.ts`.
- G10 (design command 10, CPU time). Run it directly after G2, with no
  source edit in between. Copy the multi-line `bash -c` command verbatim
  from design section 5, command 10. Replace only the trailing `"$d"`
  with the literal `F` path. Keep `/opt/homebrew/bin/nodetto-cli 0.8.5`
  as the last two arguments. It exits 0, and `F/cpu-time.log` holds the
  green attempt's reference and new user times. Record both values and
  their ratio. If the command prints `reference binary is not 0.8.5`, or
  `/opt/homebrew/bin/nodetto-cli` is missing, stop and record a blocker.
  The orchestrator then builds the b52e4db reference as the design
  describes. Do not create a git worktree yourself.
- G3:
  `find packages/core/src/editor.ts packages/core/src/editor -name '*.ts' -exec awk 'FNR == 701 { print FILENAME " exceeds 700 lines"; bad = 1 } END { exit bad }' {} +`
  exits 0.
- G4: `test "$(wc -l < packages/core/src/editor.ts)" -le 450` exits 0.
- G5: `test -z "$(find packages/core/src/editor -name '*[0-9]*')"` exits 0.
- G6: design command 7 (export surface) exits 0 and prints
  `export surface unchanged`. Copy the command verbatim from the design.
- G7 (design command 8):
  `test -z "$(bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess 2>&1 | grep -E '^packages/core/src/(editor\.ts|editor/)')"`
  exits 0.
- G8: design command 9 (the facade import scan) exits 0 and prints
  `facade imports ok`. Copy the command verbatim from the design.
- G9: `git diff --exit-code b52e4dbe5509f739a3c1e996377ee2ac0e70059b -- packages/core/src/index.ts packages/core/src/editor/types.ts packages/core/src/editor/components.ts`
  exits 0, and
  `test -z "$(git diff --name-only b52e4dbe5509f739a3c1e996377ee2ac0e70059b -- '*.test.ts' '*.test.tsx')"`
  exits 0.

## Acceptance criteria

- The progress log has an `SMS01-R<n>` entry for each of R1-R10, with
  evidence files, and every finding has a disposition: `fixed` or
  `no change needed` with a reason. No high or mid finding is left open.
- The chain, fields, visibility, planner types, deduplication and
  documentation satisfy the invariants above.
- G1-G10 exit 0, with logs in `final/`. G1 shows ` 2945 pass` and
  ` 0 fail` in `final/verify.log`. G2 shows ` 172 pass`, ` 0 fail` and no
  skip line in `final/test-cli.log`, and the collection log shows
  ` 17 skip`. G10's `final/cpu-time.log` shows a new user time at most
  1.15 times the reference.
- R9 is dispositioned as R9 above requires.
- No test deadline, timeout, test file or `mise.toml` changed:
  `git diff --exit-code 9e6ccc7 -- mise.toml` exits 0, and G9's test-file
  check exits 0.
- If no finding needed a fix, `git diff --stat 9ef8639 -- packages docs`
  is empty.

## Progress log

Append a "Session 589 review" section to
`impl-plans/progress/sms-01-editor-facade.md`. Keep the session-579 and
session-583 content. The new section records:

- the intent snapshot;
- B1 and B2;
- the start hashes against `final-hashes.txt`;
- R1-R10 with their outcomes;
- the findings table;
- repair hashes;
- each gate's exit code and log path, the attempt that went green for G1,
  G2 and G10, and the G10 user times;
- drift events;
- the final `wc -l`.

Edit only this progress log, not any other plan or progress file.

# bpmn-export-ownership-04-roundtrip-integration

- planId: bpmn-export-ownership-04-roundtrip-integration
- planPath: impl-plans/active/bpmn-export-ownership-04-roundtrip-integration.md
- wave: 2; dependsOn: bpmn-export-ownership-01-import-collab-artifacts,
  bpmn-export-ownership-02-duplicate-id-guard,
  bpmn-export-ownership-03-export-placement
- design: `design-docs/specs/design-bpmn.md` section 5.3.1 "Duplicate-id
  safeguard"; section 11 "export ownership" bullets (round trip, safeguard
  positive and negative, fixture uniqueness); section 5.4 lossless contract
- progress log: impl-plans/progress/bpmn-export-ownership-04-roundtrip-integration.md
- scratch and logs: tmp/bpmn-export-ownership-s550/bpmn-export-ownership-04-roundtrip-integration/
- Read `impl-plans/active/bpmn-export-ownership-00-overview.md` "Rules for
  every worker" first.

## writePaths

- packages/io/src/bpmn/roundtrip.test.ts
- impl-plans/progress/bpmn-export-ownership-04-roundtrip-integration.md

## sharedPaths

- packages/io/src/bpmn/export.ts: wire the duplicate-id guard. Import
  `duplicateIdWarnings` from `./export-duplicates.ts`. In `exportBpmnXml`,
  after `root` is built and before `serializeXml(root)`, append
  `...duplicateIdWarnings(root)` to `warnings`. No other edit; plan 03's
  changes in this file stay as they are.

## Intent

Connect the three wave-1 slices and prove the end-to-end acceptance
criteria:
- The boundary-event-plus-group page exports with no warnings (so strict
  export succeeds).
- It re-imports without errors.
- It re-exports byte-identically.
- No BPMN id is duplicated.
- The safeguard fires on a real collision but not on extension ids.

## Before starting

- Re-read `export.ts`, `export-duplicates.ts`, `export-process.ts` and
  `import.ts` fresh. Confirm that plan 01's collaboration import, plan 02's
  `duplicateIdWarnings(root: XmlElement): BpmnExportWarning[]` and plan
  03's `collaborationArtifactElements` exist. If any is missing or has a
  different signature, record it as a blocker in the progress log and
  stop. Do not implement another plan's work.
- Record the `shasum -a 256` of `export.ts` before and after the wiring
  edit.

## Tests (add to packages/io/src/bpmn/roundtrip.test.ts)

Reuse the file's `inlineDefinitions`, `shapes`, `edges` and
`assertStableRoundtrip` helpers where they fit. Build the editor-shaped
page by importing and then deleting `semantic.parent`, as in plan 03.

1. "parentless boundary events and groups round-trip without an orphan process".
   - Source XML: write a dedicated definitions string. Do not use
     `inlineDefinitions`: it adds participants `Pa`/`Pb` and a second
     process, which breaks "exactly one process". Reuse `shapes`/`edges`.
     Pin the order so byte-identical re-export holds: inside process `P`
     put `laneSet`, then `Task_Review`, `Event_Timeout`, `Task_Escalate`,
     then `Flow_Timeout`, then `Group_Notes` as the last child. List
     `Group_Notes` last in the `shapes(...)` id list. The re-import adds
     collaboration artifacts after all process contents, so the group must
     already be the last shape record in the first import.
   - Setup: the plan 03 test 1 page. `Pool_Orders` holds `Lane_Review`,
     which holds `Task_Review` ("Review order") and `Task_Escalate`
     ("Escalate order"). `Event_Timeout` ("Timeout", timer) is attached to
     `Task_Review`. `Flow_Timeout` runs from `Event_Timeout` to
     `Task_Escalate`, and `Group_Notes` is present. Strip `parent` from
     `Event_Timeout` and `Group_Notes`.
   - Expected:
     - `first = exportBpmnXml(...)` has `warnings` of `[]`, which is the
       strict-export condition
     - `importBpmnXml(first.xml)` does not throw, and its `warnings` is
       `[]`
     - in the re-import, `Group_Notes` has no `parent` key and
       `Event_Timeout.semantic.parent === "Lane_Review"`
     - `exportBpmnXml(reimported.document, reimported.pageId).xml === first.xml`
     - every `id="..."` in `first.xml` is unique
2. "a model id colliding with a diagram id is reported".
   - Setup: a process with tasks `A` and `A_di`; source DI shape ids `S1`
     and `S2`, so the import itself is clean.
   - Expected: the export warnings contain exactly one message equal to
     `Duplicate BPMN id A_di was emitted.`
3. "repeated ids inside extension elements are not reported".
   - Setup: a process with tasks `Task_One` and `Task_Two`, each with
     `<bpmn:extensionElements><ext:field id="amount"/></bpmn:extensionElements>`
     and `xmlns:ext="urn:example:ext"` declared on the definitions.
   - Expected: the export warnings contain no message starting with
     `Duplicate BPMN id`, and the export XML contains `ext:field` twice
     (preserved).
4. "fixture exports contain no duplicate BPMN ids".
   - Setup: each entry of the existing `fixtures` array (four
     purchase-request variants).
   - Expected: the export warnings contain no `Duplicate BPMN id` message.

All existing tests in the file must pass unchanged. Do not modify them.

## Pitfalls

- Do not change any exporter or importer logic to make a test pass. If
  test 1 fails because of placement or import, record the failing
  assertion and the responsible plan (01 or 03) in the progress log as a
  blocker for serial repair.
- Do not catch the importer's exception to make the test pass. A throw is
  a failure.
- Do not weaken the byte-identical re-export assertion in test 1. If it
  fails, record the first differing line of the two XML strings in the
  progress log as a blocker for serial repair.
- No CLI test changes. `--strict` exits 3 exactly when warnings exist, and
  test 1 asserts `warnings` is `[]`.

## Verification (run from nodetto-app/)

- `bun test packages/io/src/bpmn > <log>/bpmn-tests.log 2>&1`: exit 0,
  0 fail. Expected pass count: at least the baseline 29 plus 1 (plan 01),
  7 (plan 02), 5 (plan 03) and 4 (this plan); `reference.test.ts` may
  skip.
- `bun test apps/cli/src/bpmn-commands.test.ts > <log>/cli-bpmn.log 2>&1`:
  exit 0, 0 fail.
- `bunx biome format --write packages/io/src/bpmn/roundtrip.test.ts packages/io/src/bpmn/export.ts`
  then `bunx biome check packages/io/src/bpmn/roundtrip.test.ts packages/io/src/bpmn/export.ts > <log>/biome.log 2>&1`:
  exit 0.
- `bun run typecheck > <log>/typecheck.log 2>&1`: exit 0. This is wave 2,
  so all slices are joined.
- Temporary reproduction, kept outside the repo. Write
  `tmp/bpmn-export-ownership-s550/bpmn-export-ownership-04-roundtrip-integration/repro.ts`
  with the step-2 reproduction: import the inline page, strip parents,
  export, re-import. Run
  `bun tmp/bpmn-export-ownership-s550/bpmn-export-ownership-04-roundtrip-integration/repro.ts > <log>/repro.log 2>&1`.
  Expected: no pool-less warning, no `Process_orphan_`, and re-import
  succeeds. This is extra evidence only; the bun tests are the gate.

## Done criteria

- `grep -n "duplicateIdWarnings" packages/io/src/bpmn/export.ts` shows the
  import and exactly one call.
- The four new tests pass. The full `packages/io/src/bpmn` suite and the
  CLI BPMN tests have 0 failures, and typecheck exits 0.
- The progress log records the hashes, commands, exit codes and log paths.

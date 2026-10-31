# sms-01-editor-facade

- planId: sms-01-editor-facade
- planPath: impl-plans/active/sms-01-editor-facade.md
- progressPath: impl-plans/progress/sms-01-editor-facade.md
- wave: 1 of 3 in session 575. It runs alone in its wave.
- dependsOn: none. Base `b52e4dbe5509f739a3c1e996377ee2ac0e70059b`.
- Design: `design-docs/specs/design-source-module-split.md`. Read
  "Invariants", "1. Editor facade", "4. Documentation", "5. Verification"
  (commands 1, 2 and 5-9) and "Rollout constraints".
- Evidence directory: `tmp/source-module-split-s575/sms-01-editor-facade/`.
  `tmp/` is git-ignored. Write only `.log` and `.txt` files there, never
  `.ts`, because `bun test` collects stray `.ts` copies under `tmp/`.

## Intent and context

`packages/core/src/editor.ts` is 1926 lines. It holds one class, `Editor`,
with about 165 public members, and most of them call a planner in
`packages/core/src/editor/*.ts` and then `this.apply(...)`. This plan is a
pure refactor: it splits the class into a single-inheritance chain with one
class per responsibility, so that each file is at most 700 lines and
`editor.ts` is at most 450. Callers see the same `Editor`: every public
member is inherited with the same signature.

```text
EditorCore            packages/core/src/editor/facade/core.ts
  <- ElementEditing   packages/core/src/editor/facade/element-editing.ts
  <- SelectionEditing packages/core/src/editor/facade/selection-editing.ts
  <- PageEditing      packages/core/src/editor/facade/page-editing.ts
  <- NotationEditing  packages/core/src/editor/facade/notation-editing.ts
  <- Editor           packages/core/src/editor.ts
```

## Non-goals

- Do not change behavior, command plans, the order of `apply` calls, or
  undo grouping.
- Do not touch:
  - `packages/core/src/index.ts`;
  - `packages/core/src/editor/components.ts`, `transaction.ts`,
    `transform.ts`, `style-text.ts` or `types.ts`;
  - any `component-*.ts` module;
  - anything under `apps/`, `packages/io/` or `examples/`.
- Do not export the chain classes from `index.ts`.
- Do not add interfaces, mixins, prototype patching
  (`Object.assign(Editor.prototype, ...)`), decorators or `super.` calls.
- Do not change planner bodies. In planners, only the parameter type
  annotation changes.

## File-level changes

1. `packages/core/src/editor/facade/core.ts` (new): `export class
   EditorCore`.
   - Fields: every instance field of today's `Editor`, in today's
     declaration order (`editor.ts:201-256`), then `requireAsset`
     (`editor.ts:1154-1161`) as the last field. Keep the initializers and
     comments as they are.
   - The constructor (`editor.ts:258-306`), unchanged. Its signature stays
     `constructor(options: EditorOptions = {})`.
   - Public members: `readOnly`, `setReadOnly`, `documentOpenRevision`,
     `revision`, `subscribe`, `onBpmnRejection`, `breadboardProbe`,
     `setBreadboardProbe`, `onBreadboardProbeChange`, `currentPageId`,
     `setCurrentPage`, `loadDocument`, `getSnapshot`, `apply`,
     `reconcileDerivedState`, `undo`, `redo`, `canUndo`, `canRedo`,
     `beginBatch`, `endBatch`, `abortBatch`, `getShapeUtil`,
     `setRasterMaskSampler`, `createShapeContext`, `getBounds`,
     `getSelectionBounds`, `hitTest`, `nextIndex`, `buildElement`,
     `createElement`, `resolveSelectionTarget`, `selectAll`,
     `movableSelection`, `expandedSelection`.
   - Helpers: `notify` stays `private`. `applyPlan` and `rejectBpmn` become
     `protected`.
2. `packages/core/src/editor/facade/element-editing.ts` (new):
   `export class ElementEditing extends EditorCore`. Members:
   `reparentElement`, `connect`, `moveElements`, `resizeElement`,
   `deleteElements`, `editableField`, `getText`, `setText`, `setRichText`,
   `toggleTextMark`.
3. `packages/core/src/editor/facade/selection-editing.ts` (new):
   `export class SelectionEditing extends ElementEditing`. Members:
   `deleteSelection`, `copySelection`, `cutSelection`, `canPaste`, `paste`,
   `duplicateSelection`, `reorderSelection`, `bringToFront`,
   `bringForward`, `sendBackward`, `sendToBack`, `nudgeSelection`,
   `groupSelection`, `booleanSelection`, `flattenBooleanSelection`,
   `frameSelection`, `canFrameSelection`, `ungroupSelection`,
   `alignSelection`, `distributeSelection`, `arrangeLayout`, `arrangePage`,
   `matchSelectionSize`, `setSelectionStyle`, `setSelectionTextResize`;
   `private insertCopies`.
4. `packages/core/src/editor/facade/page-editing.ts` (new):
   `export class PageEditing extends SelectionEditing`. Members:
   `createPage`, `reorderPage`, `reorderPageTo`, `renamePage`,
   `setPageKind`, `setPageMode`, `setPageSqlDialect`, `setPageTokenMode`,
   `deletePage`, `duplicatePage`, `pageBounds`, `zoomToFit`,
   `zoomToSelection`, `zoomIn`, `zoomOut`, `resetZoom`, `exportPageSvg`,
   `exportArtboardSvg`, `exportSelectionSvg`.
5. `packages/core/src/editor/facade/notation-editing.ts` (new):
   `export class NotationEditing extends PageEditing`. Members:
   `moveSequenceElement`, `createSequenceParticipant`,
   `createSequenceActivation`, `connectSmart`, `connectErdRelation`,
   `connectComponent`, `connectUseCase`, `createUmlPort`, `connectBpmn`,
   `reconnectBpmnFlow`, `updateBpmnSemantic`, `addBpmnLane`,
   `createBreadboardPart`, `rotateBreadboardParts`,
   `updateBreadboardSemantic`, `annotateBreadboard`, `rotatePcbFootprints`,
   `addPcbTrack`, `addPcbVia`.
6. `packages/core/src/editor.ts`: `export class Editor extends
   NotationEditing`. It keeps:
   - the header comment, updated so that it says the state and the core API
     live in `editor/facade/core.ts` and the other responsibilities in
     `editor/facade/*`, with `editor.ts` holding components and responsive
     variants;
   - the `export type { ... } from "./editor/types.ts"` block, unchanged;
   - the members `makeComponent`, `createComponentInstance`,
     `detachComponentInstance`, `resetComponentInstance`,
     `switchComponentVariant`, `updateComponentStructure`,
     `planComponentStructureUpdate`, `updateResponsiveStructure`,
     `reorderFrameMember`, `refreshComponentInstance`,
     `refreshResponsiveVariant`, `detachResponsiveVariant`,
     `resetComponentOverride` and `createResponsiveVariant`;
   - private `rebuildComponentInstance` and `rebuildResponsiveVariant`. The
     latter still constructs `new Editor(...)`.
7. Planner parameter types. Change only the editor parameter's type
   annotation. Use `import type`, and keep the parameter names:
   - to `EditorCore`: `editor/paste.ts` (`planInsertCopies`; `topLevelAmong`
     only if it takes an editor), `editor/pages.ts` (`planDuplicatePage`),
     every exported function in `editor/sequence.ts` that takes `Editor`,
     `editor/bpmn.ts` (`planBpmnLane`) and `editor/breadboard.ts`
     (`buildBreadboardPart`);
   - to `NotationEditing`: every function in `editor/connections.ts` that
     takes `Editor`.

   If a retyped planner then fails to type-check because it uses a member
   that its new type does not have, report it in the progress log and use
   the lowest chain class that has that member. Never change the planner
   body.
8. Visibility rule (design 1.3):
   - a member that is `private` today and is used by a later class in the
     chain becomes `protected`;
   - a member used only in its own class stays `private`;
   - for fields, check every use. Likely `protected`: `pageId`, `idSource`,
     `rng`, `requireAsset`. Likely `private`: `pendingTop`,
     `rasterMaskSampler`, `readonlyMode`, `openRevision`, `revisionCount`,
     `silenceHistory`, the listener sets, `probe`, `shapeContextCache`,
     `pageViews`, `selectionAfterLoad`, `knownPageOrder`. The compiler
     decides; follow it.
9. Deduplication, as a separate step after the move passes its gates
   (design 1.3). Add two private helpers in `Editor`:
   - the "unlocked frame" guard, used by `makeComponent`,
     `detachComponentInstance` and `detachResponsiveVariant`. It runs
     `store.get(id)`, then `type !== "frame"`, then
     `createShapeContext().isLocked?.(id)`, in that order, and returns the
     element or `null`;
   - a frame-semantic lookup that returns `FrameSemantic | undefined` when
     the element is a frame, used by `resetComponentInstance`,
     `switchComponentVariant`, `updateComponentStructure`,
     `planComponentStructureUpdate`, `updateResponsiveStructure` and
     `refreshResponsiveVariant`.

   Choose descriptive names, for example `unlockedFrame` and
   `frameSemantic`. Every early `return false` / `return null` must stay
   the same. Do not merge `applyPlan` with `apply`.
10. `docs/development.md` (shared with sms-02, which runs later): after the
    paragraph that ends "`collab` is still a scaffold.", add one short
    paragraph on the `Editor` chain. Name the five
    `packages/core/src/editor/facade/` classes in order with a few words on
    each, say that planners in `packages/core/src/editor/*.ts` compute
    command plans without applying them, and say that component members
    stay in `editor.ts`. Edit nothing else in that file.
11. `impl-plans/progress/sms-01-editor-facade.md` (new): the progress log.

## Patterns to imitate

- The section dividers and doc comments in `packages/core/src/editor.ts`,
  for example `// ---------------------------------------------------------------- shapes`.
  Move them with their members.
- Type-only imports of the editor in planners:
  `packages/core/src/editor/pages.ts` (`import type { Editor } from "../editor.ts"`).
- Import style with `.ts` extensions, as used throughout
  `packages/core/src`.

## Pitfalls

- `useDefineForClassFields` is `true` (`tsconfig.base.json`). Any field
  declared in a subclass, even without an initializer, redefines it on the
  instance and changes `Object.keys(new Editor())`. Only `EditorCore` may
  declare fields. No subclass may declare a constructor.
- `requireAsset` must be the last field, because today it is declared at
  line 1154, after every other field. Command 7 compares field order.
- Runtime import cycles. Only `editor.ts` and `editor/facade/*.ts` may
  import a chain class as a value, and each imports only the class it
  extends (command 9). Planners must use `import type`.
  `facade/core.ts` already imports values from `editor/pages.ts` and
  `editor/breadboard.ts`; those modules may import `EditorCore` only as a
  type.
- Default parameters such as `page: PageId = this.pageId` and
  `context = this.createShapeContext()` stay exactly as written.
- Each member is declared once in the whole chain. Do not leave a copy
  behind in `editor.ts`.
- `noUncheckedIndexedAccess` (command 8): moved code already compiles in
  the cloud Worker. Do not add new unguarded index access, for example
  `const [groupId] = ...` is already guarded.
- Do not reformat unrelated code. Run Biome only on the files this plan
  owns.

## Shared working directory protocol

- Before each edit, read the file fresh. Record its `shasum -a 256` before
  and after the edit in the progress log.
- If a file's pre-hash differs from the last recorded post-hash, another
  writer changed it. Stop, record the drift, and re-read before you
  continue.
- Before the first edit, record an immutable intent snapshot in the
  progress log: the member-to-class table from "File-level changes".

## Steps

1. Baseline, on the tree before any edit. Run commands B1-B3 (below) and
   record the summaries and exit codes.
2. Create the five facade files and move the members. Retype the planners.
   Fix visibility until `bun run typecheck` passes.
3. Run gates G1-G9. Fix until they all pass.
4. Deduplicate (step 9), then run G1-G9 again.
5. Edit `docs/development.md` (step 10). Run G1 again.

## Verification

Run every command from the repository root and redirect output to the
evidence directory. Record the exit code and log path of each one in the
progress log. Every gate must exit 0.

- B1:
  `BUN_OPTIONS=--jsx-runtime=classic bun test > tmp/source-module-split-s575/sms-01-editor-facade/baseline-bun-test.log 2>&1`.
  Record the ` N pass`, ` N skip` and ` N fail` lines.
- B2: `wc -l packages/core/src/editor.ts packages/core/src/editor/*.ts > tmp/source-module-split-s575/sms-01-editor-facade/baseline-wc.txt`.
- B3: `test -z "$(bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess 2>&1 | grep -E '^packages/core/src/(editor\.ts|editor/)')"`
  exits 0 on the base tree. If it does not, stop and report a blocker.
- G1:
  `BUN_OPTIONS=--jsx-runtime=classic CARGO_TERM_QUIET=true mise run verify > tmp/source-module-split-s575/sms-01-editor-facade/verify.log 2>&1`
  exits 0. The log has ` 0 fail`, and its ` N pass` count is at least B1's
  pass count.
- G2:
  `CARGO_TERM_QUIET=true mise run test-cli > tmp/source-module-split-s575/sms-01-editor-facade/test-cli.log 2>&1`
  exits 0, with ` 0 fail` in the log. Then, against the binary it built:
  `NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity > tmp/source-module-split-s575/sms-01-editor-facade/native-parity.log 2>&1`
  exits 0, and
  `grep -Ex ' *17 pass' tmp/source-module-split-s575/sms-01-editor-facade/native-parity.log`
  exits 0. At this wave the parity tests are still in
  `apps/cli/src/native-parity.test.ts`, which the path filter matches. This
  gate runs the Boa engine with the new chain under the parity deadlines.
- G3:
  `find packages/core/src/editor.ts packages/core/src/editor -name '*.ts' -exec awk 'FNR == 701 { print FILENAME " exceeds 700 lines"; bad = 1 } END { exit bad }' {} +`
  exits 0.
- G4: `test "$(wc -l < packages/core/src/editor.ts)" -le 450` exits 0.
- G5: `test -z "$(find packages/core/src/editor -name '*[0-9]*')"` exits 0.
- G6: design command 7 (export surface) exits 0 and prints
  `export surface unchanged`. Copy the command verbatim from the design.
- G7: `test -z "$(bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess 2>&1 | grep -E '^packages/core/src/(editor\.ts|editor/)')"`
  exits 0.
- G8: design command 9 (facade import scan) exits 0 and prints
  `facade imports ok`. Copy the command verbatim from the design.
- G9: `git diff --exit-code b52e4dbe5509f739a3c1e996377ee2ac0e70059b -- packages/core/src/index.ts packages/core/src/editor/types.ts packages/core/src/editor/components.ts`
  exits 0.

## Tests

No new test file: this plan only moves code and extracts no new pure
helper. The existing suites cover the behavior:

- the `packages/core` tests that drive `Editor` (all of `bun test`) ->
  unchanged pass count, 0 fail;
- the desktop and ui-solid typecheck -> the inherited members type-check at
  every call site;
- the native parity tests (G2) -> 17 pass on the release binary.

## Acceptance criteria

- The five facade files exist and declare the chain exactly as above.
  `editor.ts` declares `class Editor extends NotationEditing`.
- G1-G9 exit 0, with logs in the evidence directory.
- The progress log has the baseline numbers, every gate's exit code and log
  path, the per-file hashes, and the final `wc -l` of every file under
  `packages/core/src/editor` and of `editor.ts`.
- `docs/development.md` has the new paragraph and no other change
  (`git diff docs/development.md` shows one added paragraph).

## Progress log

`impl-plans/progress/sms-01-editor-facade.md` records:

- the intent snapshot;
- the baseline numbers (B1-B3);
- each step's status;
- every gate's exit code and log path;
- drift events;
- the final line counts.

Edit only this progress log, not any other plan or progress file.

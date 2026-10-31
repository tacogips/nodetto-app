# Splitting the oversized editor, edit and parity sources

Status: DESIGNED, 2026-10-31 (session 575). Base b52e4db "Derive the App
Store build number from the app version". No GitHub issue; the request came
as inline workflow input. This is a pure refactor. Behavior, CLI output, exit
codes, JSONL bytes, export bytes and MCP responses do not change.

Re-validated, 2026-10-31 (session 579) at 1b6b669 "Plan the split of the
oversized editor, edit and parity sources". `git diff --stat b52e4db
1b6b669` lists only this design, the three sms plans and the session-575
manifest, so the source tree is the same as at b52e4db. Every b52e4db
reference below (line counts, line numbers, commands 7 and 8) still holds.
The session-575 run stopped before any code change because its dispatch
manifest was wrong. The design was not the cause. The manifest rules
under "Rollout constraints" fix that.

## Overview

Three hand-written files are over 1000 lines:

| File | Lines at b52e4db | Content |
|---|---|---|
| `packages/core/src/editor.ts` | 1926 | The `Editor` facade class (about 165 members) |
| `apps/cli/src/edit-command.ts` | 1372 | `nodetto-cli edit`: operation parsing, the `Batch` class (about 870 lines), `applyBatch`, `editCommand`, `runOperations` |
| `apps/cli/src/native-parity.test.ts` | 1012 | 17 `nativeTest` blocks plus the shared `compare` harness |

Each one is split into modules named for their responsibility. After the
split, no file in these areas is over 700 lines and no file name has a
numeric suffix or part number. No other hand-written file outside
`examples/` is over 1000 lines. `packages/core/src/bpmn/notation.ts` (970
lines) and `packages/io/src/bpmn` are out of scope.

## Invariants

- `@nodetto/core` has one entry point, `packages/core/src/index.ts`. That
  file does not change. `Editor` and the types it re-exports
  (`ApplyOptions`, `BpmnEditResult`, `CreateElementOptions`,
  `CreatePageOptions`, `EditableField`, `EditorListener`, `EditorOptions`,
  `StylePatch`) are still exported from `packages/core/src/editor.ts`, so
  existing deep imports of that path keep working. The private
  nodetto-cloud submodule consumer is one such case.
- Every public method, accessor and property of `Editor` keeps its name,
  parameters, defaults and return type. `new Editor(options?: EditorOptions)`
  is unchanged. The instance's own enumerable properties (`Object.keys(new
  Editor())`) keep the same names in the same order.
- `apps/cli/src/edit-command.ts` stays the entry point. It still exports
  the values `parseOperations`, `deepMerge`, `applyBatch`, `editCommand`,
  `runOperations` and `EXIT_CONTENDED`, and the types `EditWarning` and
  `RunOptions`. Re-exports are allowed. `commands.ts`, `draw-command.ts`
  and `ai-commands.test.ts` do not change.
- Inside each operation, operations, refs, warnings and errors keep their
  order. The error message for every failure path stays the same,
  including which check fails first.
- Every existing test name and assertion is kept. The 17 native parity
  blocks only move into new files.
- New modules have no module-level side effects other than constant
  definitions. Code moves as written: no regex splitting of long strings,
  no new recursion, and no per-operation closures or handler tables that
  the old code did not have. The native CLI runs this code in Boa.
- Moved and new code under `packages/core` type-checks with
  `noUncheckedIndexedAccess`, because the private cloud Worker compiles it
  that way.

## 1. Editor facade (`packages/core`)

### 1.1 Why a class chain

The `Editor` class is already a facade: most method bodies call a planner in
`packages/core/src/editor/*.ts` (or another core module) and then
`this.apply(...)`. What makes the file long is the number of public members,
each with a multi-line signature and a doc comment. Turning the bodies into
free-function calls would still leave about 165 signatures, more than 700
lines. Patching methods onto `Editor.prototype` is not allowed either: it is
a module-level side effect and it hides the methods from the type system.

So the members are split across a single-inheritance chain of classes, one
per responsibility. `Editor` is the last class in the chain. Inherited
methods are public members of `Editor` with the same signatures, so every
call site keeps working without a change.

```text
EditorCore            editor/facade/core.ts
  <- ElementEditing   editor/facade/element-editing.ts
  <- SelectionEditing editor/facade/selection-editing.ts
  <- PageEditing      editor/facade/page-editing.ts
  <- NotationEditing  editor/facade/notation-editing.ts
  <- Editor           editor.ts
```

`packages/core/src/editor/facade/` holds only these chain classes. The
planner modules in `packages/core/src/editor/*.ts` keep their names and
their role: they compute command plans and do not apply them.

### 1.2 Member placement

Each class may use members of the classes above it in the chain, and never
members of the classes below it. Line counts are estimates from the
current bodies, including imports.

| Class | Members | Est. lines |
|---|---|---|
| `EditorCore` | Every instance field, in today's declaration order (`assets`, `readonlyMode`, `openRevision`, `store`, `camera`, `selection`, `registry`, `history`, `clipboard`, `idSource`, `rng`, `rasterMaskSampler`, `shapeContextCache`, listener sets, `probe`, `pendingTop`, `pageId`, `pageViews`, `selectionAfterLoad`, `knownPageOrder`, `revisionCount`, `silenceHistory`, `requireAsset`). The constructor. `readOnly`/`setReadOnly`, `documentOpenRevision`, `revision`, `subscribe`, `onBpmnRejection`, `breadboardProbe`/`setBreadboardProbe`/`onBreadboardProbeChange`, `currentPageId`, `setCurrentPage`, `loadDocument`, `getSnapshot`. Transactions: `apply`, `reconcileDerivedState`, `undo`, `redo`, `canUndo`, `canRedo`, `beginBatch`, `endBatch`, `abortBatch`. Shape queries: `getShapeUtil`, `setRasterMaskSampler`, `createShapeContext`, `getBounds`, `getSelectionBounds`, `hitTest`, `nextIndex`, `buildElement`, `createElement`. Selection queries: `resolveSelectionTarget`, `selectAll`, `movableSelection`, `expandedSelection`. Protected helpers: `notify`, `applyPlan`, `rejectBpmn` | ~540 |
| `ElementEditing` | Per-element commands by id: `reparentElement`, `connect`, `moveElements`, `resizeElement`, `deleteElements`, `editableField`, `getText`, `setText`, `setRichText`, `toggleTextMark` | ~230 |
| `SelectionEditing` | Commands on the current selection: `deleteSelection`, `copySelection`, `cutSelection`, `canPaste`, `paste`, `duplicateSelection`, `reorderSelection`, `bringToFront`, `bringForward`, `sendBackward`, `sendToBack`, `nudgeSelection`, `groupSelection`, `booleanSelection`, `flattenBooleanSelection`, `frameSelection`, `canFrameSelection`, `ungroupSelection`, `alignSelection`, `distributeSelection`, `arrangeLayout`, `arrangePage`, `matchSelectionSize`, `setSelectionStyle`, `setSelectionTextResize`; private `insertCopies` | ~400 |
| `PageEditing` | Pages: `createPage`, `reorderPage`, `reorderPageTo`, `renamePage`, `setPageKind`, `setPageMode`, `setPageSqlDialect`, `setPageTokenMode`, `deletePage`, `duplicatePage`. Viewport: `pageBounds`, `zoomToFit`, `zoomToSelection`, `zoomIn`, `zoomOut`, `resetZoom`. SVG export: `exportPageSvg`, `exportArtboardSvg`, `exportSelectionSvg` | ~250 |
| `NotationEditing` | Sequence: `moveSequenceElement`, `createSequenceParticipant`, `createSequenceActivation`. Typed connectors: `connectSmart`, `connectErdRelation`, `connectComponent`, `connectUseCase`, `createUmlPort`. BPMN: `connectBpmn`, `reconnectBpmnFlow`, `updateBpmnSemantic`, `addBpmnLane`. Breadboard: `createBreadboardPart`, `rotateBreadboardParts`, `updateBreadboardSemantic`, `annotateBreadboard`. PCB: `rotatePcbFootprints`, `addPcbTrack`, `addPcbVia` | ~270 |
| `Editor` (`editor.ts`) | Components and responsive variants: `makeComponent`, `createComponentInstance`, `detachComponentInstance`, `resetComponentInstance`, `switchComponentVariant`, `updateComponentStructure`, `planComponentStructureUpdate`, `updateResponsiveStructure`, `reorderFrameMember`, `refreshComponentInstance`, `refreshResponsiveVariant`, `detachResponsiveVariant`, `resetComponentOverride`, `createResponsiveVariant`; private `rebuildComponentInstance`, `rebuildResponsiveVariant`. The `export type { ... } from "./editor/types.ts"` block | ~320 |

The component members stay in `Editor` for two reasons:
`rebuildResponsiveVariant` constructs `new Editor(...)`, and the component
planners (`editor/components.ts`, `component-variants.ts`,
`component-refresh.ts`, `component-overrides.ts`) take the full `Editor`
type.

### 1.3 Rules for the chain

- Only `EditorCore` declares instance fields or a constructor. The project
  compiles with `useDefineForClassFields: true`. Any field declared in a
  subclass would be defined after the base constructor runs, would change
  the own-property order, and would reset an inherited field to
  `undefined`. `requireAsset`, an arrow-function field, therefore stays in
  `EditorCore`.
- A member that used to be `private` and is now used by a later class in the
  chain becomes `protected`. A member used only inside its own class stays
  `private`. Public members stay public. Private and protected members are
  both hidden from callers, so the public surface does not change.
- A member name is declared once in the chain. No class overrides a member,
  and no class calls `super.`.
- Import direction: only `editor.ts` and `editor/facade/*.ts` import a chain
  class as a value, and each chain class imports only the class it extends.
  Planner modules refer to chain classes only with `import type`. This keeps
  `class X extends Y` from running before `Y` has been evaluated, in Bun
  and in the bundled Boa engine.
- Planner parameter types. A planner that a chain class calls with `this`
  takes the lowest chain class that has every member it uses. Every
  `Editor` is still accepted.
  - `EditorCore`: `editor/paste.ts` (`planInsertCopies`),
    `editor/pages.ts` (`planDuplicatePage`), `editor/sequence.ts` (all
    planners), `editor/bpmn.ts` (`planBpmnLane`) and `editor/breadboard.ts`
    (`buildBreadboardPart`). These use only `store`, `nextIndex`,
    `buildElement`, `createShapeContext` and `currentPageId`.
  - `NotationEditing`: `editor/connections.ts`. It calls `connect`,
    `connectBpmn`, `connectComponent`, `connectErdRelation`,
    `createElement`, `apply` and `readOnly`.
  - `Editor`, unchanged: `editor/components.ts` and every planner outside
    `editor/`.
- Duplicate logic removed, with no change in behavior. In `Editor`, the
  repeated "unlocked frame" guard (`store.get(id)`, then `type === "frame"`,
  then `createShapeContext().isLocked?.(id)`) in `makeComponent`,
  `detachComponentInstance` and `detachResponsiveVariant` becomes one
  private helper. It runs the checks in the same order and short-circuits
  the same way. The repeated `type === "frame" ? semantic as FrameSemantic`
  lookup becomes one private helper as well. Nothing else is merged.
  For example, `applyPlan` returns early when the editor is read-only and
  plain `apply` does not, so the two are not interchangeable.
- The pieces are moved without rewriting them. Comments and section
  dividers move with their members.

## 2. `nodetto-cli edit` (`apps/cli/src/edit-command.ts`)

### 2.1 Modules

| Module | Responsibility | Est. lines |
|---|---|---|
| `edit-command.ts` | Entry point. Header comment, `EDIT_OPTIONS`, `EDIT_FLAGS`, `EXIT_CONTENDED`, `MAX_ATTEMPTS`, `editCommand`, `RunOptions`, `runOperations` (read, apply, re-read and write, with retry while the file is contended). Re-exports `parseOperations`, `deepMerge`, `applyBatch` and `type EditWarning` | ~170 |
| `edit/operation-input.ts` | `Json`, `JsonObject`, `OperationError`, `parseOperations`, `deepMerge`, `fillIds`, and the field readers `requireText` and `requireNumber` (today's `text` and `number`, renamed; same messages) | ~95 |
| `edit/types.ts` | `Created`, `EditWarning`, `BatchResult`, `PageChangeCounts` | ~40 |
| `edit/batch.ts` | `Batch`: the batch state (`refs`, `created`, `touchedPages`, `replaced`, `lastPlaced`), resolvers (`element`, `page`, `targets`, `shape`, `resolveReferences`), geometry (`boundsOf`, `moveBoxTo`), `record`, and `apply`. `apply` is the `op` switch: it calls one handler per case and keeps today's unknown-op error text | ~320 |
| `edit/operations/pages.ts` | `add-page`, `move-page`, `rename-page`, `set-page-mode`, `delete-page`; `placePage`, `unknownMode` | ~140 |
| `edit/operations/add.ts` | `add` by type, `addShape`, `addParticipant`, auto placement, `placeRelative`, `PLACE_GAP` | ~260 |
| `edit/operations/connect.ts` | `connect`, including the ERD column patch and the label field choice | ~130 |
| `edit/operations/elements.ts` | `append`/`remove-item`, `update`, `move`, `delete`, `scale`, `replace-text` | ~200 |
| `edit/operations/groups.ts` | `group`, `ungroup` | ~50 |
| `edit/apply-batch.ts` | `applyBatch`: parse, run the operations, attribute unknown fields, arrange, validate, warnings, page counts. Pure helpers: `unknownFieldKey` (today's `warningKey` closure), `countPageChanges` (today's inline `bump` loop), `issueLine` | ~190 |
| `edit/report.ts` | `formatEditReport(result, path, dryRun, format)`: the JSON and text reports that `runOperations` returns through `ok(...)`, byte for byte | ~55 |

### 2.2 Boundaries

- A handler is a module-level function,
  `(batch: Batch, operation: JsonObject, index: number) => void`, or `=> string`
  when it returns the created id (`add` and `connect`). Handlers import
  `Batch` with `import type` only. `batch.ts` imports the handlers as
  values, so there is no runtime cycle. `connect.ts` and `add.ts` call
  `addElement` directly, the way `this.add(...)` was called before.
- Handlers can use the Batch members they call: `record`,
  `resolveReferences`, `boundsOf`, `targets`, `shape`, `moveBoxTo` and
  `lastPlaced` are no longer `private` (`lastPlaced` stays `readonly`).
  Members that only `Batch` uses, such as `elementIds`, stay `private`.
  `Batch` and the handlers are not exported from `edit-command.ts`.
- `OperationError` is defined once, in `edit/operation-input.ts`. Every
  `instanceof OperationError` check (`applyBatch`, `editCommand`,
  `runOperations`) uses that class.
- The stray first line, `import { connectScreenTransition } from
  "@nodetto/core"`, moves to `edit/operations/connect.ts`.

### 2.3 Duplicate logic removed

All of these changes are behavior-neutral:

- `add` and `connect` each repeat the body of `record` (ref uniqueness
  check, `refs.set`, `created.push`, `touchedPages.add`), in the same order.
  Both now call `batch.record(...)`. `add-page` keeps its own
  `refs.set` without the uniqueness check, because routing it through
  `record` would add an error case that does not exist today.
- `isKnownElementType(t) ? getElementTypeDefinition(t) : undefined` is
  repeated in `append`/`remove-item` and `update`. It becomes one local
  `definitionOf` in `edit/operations/elements.ts`.
- `applyBatch` formats issues as `${path ? `${path}: ` : ""}${message}` in
  two places. Both now use `issueLine`; each site keeps its own indent and
  join.

### 2.4 Focused tests for extracted pure helpers

These helpers used to be closures or inline code, tested only through
`edit` runs. Each gets a focused test next to it:

- `edit/apply-batch.test.ts`: `unknownFieldKey` (a matching path, a
  non-matching path, an out-of-range element index) and
  `countPageChanges` (added, updated, removed, unchanged, multiple pages).
- `edit/report.test.ts`: `formatEditReport` text output (applied and dry
  run, created with and without ref, replaced, warnings) and JSON output
  (the `replaced` key is present only when the list is non-empty).

Functions that were already standalone before the split (`fillIds`,
`requireText`, `requireNumber`, `parseOperations`, `deepMerge`) only move.
No test is added for them.

## 3. Native parity tests (`apps/cli/src/native-parity.test.ts`)

`apps/cli/src/native-parity.test.ts` is removed. Its content moves to
`apps/cli/src/native-parity/`:

| File | Content |
|---|---|
| `harness.ts` | Not a test file. Exports `binary`, `nativeTest` (`binary ? test : test.skip`), `compare`, `cliSrcDir` (the old `import.meta.dir`), `cliEntry` (the old module-level `source`, `main.ts`) and `fixtureRoot`. Constant definitions only: no file system access at import time |
| `documents.test.ts` | Golden fixtures for validate, format and inspect; help, catalogue, DDL, layout, diff, errors and BPMN; `--cwd`; page aliases; the 20,000-point path. `goldenFixtures` (a `readdirSync` call) is defined here, because the first block's timeout reads it when the test is registered |
| `drawing.test.ts` | `edit` with refs, arrangement, snapshots and rollback; state flow; flowchart; manual bends |
| `export.test.ts` | SVG, PNG, PDF and HTML ZIP; Mermaid, D2 and Code panel outputs; the PNG last row and column, with its local `decodeRgbaPng` |
| `pcb.test.ts` | Breadboard PCB archive, `pcb import` and `gerber`, `gerber import` |
| `text-layout.test.ts` | The two text-layout lint blocks |

That is 5 + 4 + 3 + 3 + 2 = 17 blocks. Names, bodies, timeouts and the
order of blocks within each file stay the same. Paths that used
`import.meta.dir` are rebuilt from `cliSrcDir` with the same relative
suffix. `./__fixtures__/text-layout.ts` becomes
`../__fixtures__/text-layout.ts`. Local variables named `source` stay as
they are. `bun test apps/cli/src`, used by `mise run test-cli`, still finds
every block, and `bun test apps/cli/src/native-parity` selects exactly
these 17.

## 4. Documentation

- `apps/cli/native/README.md`: the parity sentence points to
  `apps/cli/src/native-parity/` (`harness.ts` and the topic files).
- `docs/development.md` gets a short paragraph after "Layout". It describes
  the `Editor` chain (`editor/facade/*`, with planners in `editor/*.ts`)
  and the `edit` modules (`edit-command.ts`, `edit/`, `edit/operations/`).
- Completed design records that mention `native-parity.test.ts` stay as
  they are, because they describe work done before the split.
- `impl-plans/README.md`: while the plans run, its "Active" section lists
  the three sms plans and the session-579 manifest. When the plans are
  archived, that text is replaced by a "Completed" entry. The entry names
  the archived session-575 manifest as superseded and the session-579
  manifest as the final dispatch.

## 5. Verification

Every command below must exit 0 on a correct tree. Run them from the
repository root.

1. `BUN_OPTIONS=--jsx-runtime=classic CARGO_TERM_QUIET=true mise run verify`
   exits 0. Its bun summary has ` 0 fail`, and its pass count is at least
   the baseline pass count plus the focused tests added in section 2.4.
2. `CARGO_TERM_QUIET=true mise run test-cli` exits 0, with ` 0 fail` in its
   bun summary. This builds `target/release/nodetto-cli`.
3. After step 2, against that binary:
   `NODETTO_CLI_TEST_BINARY="$PWD/target/release/nodetto-cli" bun test apps/cli/src/native-parity > native-parity.log 2>&1`
   exits 0; `grep -Ex ' *17 pass' native-parity.log` exits 0; and
   `test -z "$(grep -E '^ *[1-9][0-9]* skip$' native-parity.log)"` exits
   0. Bun's quiet agent mode prints only the summary lines (see
   design-text-layout-lint.md, "Native evidence format").
4. Block count, which does not need a binary:
   `test "$(cat apps/cli/src/native-parity/*.test.ts | grep -c '^nativeTest(')" -eq 17`.
5. File sizes:
   `find packages/core/src/editor.ts packages/core/src/editor apps/cli/src/edit-command.ts apps/cli/src/edit apps/cli/src/native-parity -name '*.ts' -exec awk 'FNR == 701 { print FILENAME " exceeds 700 lines"; bad = 1 } END { exit bad }' {} +`,
   and the facade files are much smaller:
   `test "$(wc -l < packages/core/src/editor.ts)" -le 450 && test "$(wc -l < apps/cli/src/edit-command.ts)" -le 300`.
6. No numbered file names:
   `test -z "$(find packages/core/src/editor apps/cli/src/edit apps/cli/src/native-parity -name '*[0-9]*')"`,
   and the old file is gone: `test ! -e apps/cli/src/native-parity.test.ts`.
7. Export surface:
   `git diff --exit-code b52e4dbe5509f739a3c1e996377ee2ac0e70059b -- packages/core/src/index.ts`
   exits 0. A runtime comparison against the base commit also exits 0. It
   extracts the base tree to a temporary directory outside the repository,
   so `bun test` never collects it. Bun installs dependencies per workspace
   package (for example `packages/core/node_modules/polygon-clipping`), so
   each package's `node_modules` is symlinked into the extracted tree:

   ```sh
   base="$(mktemp -d)" && git archive b52e4dbe5509f739a3c1e996377ee2ac0e70059b packages apps/cli/src | tar -x -C "$base" && for d in packages/* apps/cli; do if [ -e "$d/node_modules" ]; then ln -s "$PWD/$d/node_modules" "$base/$d/node_modules"; fi; done && BASE="$base" bun -e '
   const chain = (C) => { const s = new Set(); for (let p = C.prototype; p && p !== Object.prototype; p = Object.getPrototypeOf(p)) for (const n of Object.getOwnPropertyNames(p)) if (n !== "constructor") s.add(n); return s; };
   const keys = (m) => Object.keys(m).sort().join(",");
   const coreBefore = await import(`${process.env.BASE}/packages/core/src/index.ts`);
   const coreAfter = await import(`${process.cwd()}/packages/core/src/index.ts`);
   const cliBefore = await import(`${process.env.BASE}/apps/cli/src/edit-command.ts`);
   const cliAfter = await import(`${process.cwd()}/apps/cli/src/edit-command.ts`);
   const missing = [...chain(coreBefore.Editor)].filter((n) => !chain(coreAfter.Editor).has(n));
   const fields = (E) => Object.keys(new E()).join(",");
   const problems = [
     keys(coreBefore) !== keys(coreAfter) && "core value exports differ",
     keys(cliBefore) !== keys(cliAfter) && "edit-command value exports differ",
     missing.length > 0 && `Editor members missing: ${missing.join(",")}`,
     fields(coreBefore.Editor) !== fields(coreAfter.Editor) && "Editor instance fields differ",
   ].filter(Boolean);
   if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
   console.log("export surface unchanged");
   '
   ```

   The new private helpers can add prototype names. Only missing names fail
   the check; TypeScript keeps the added names out of the public type. Type
   exports are covered by `index.ts` being unchanged, by the unchanged
   `export type` block in `editor.ts`, and by step 1's typecheck of every
   dependent: the desktop app, `ui-solid`, the CLI and the tests.
8. Strict index access for core code:
   `test -z "$(bunx tsc --noEmit -p tsconfig.json --noUncheckedIndexedAccess 2>&1 | grep -E '^packages/core/src/(editor\.ts|editor/)')"`.
9. Runtime imports of chain modules follow section 1.3. The check
   transpiles each file, which drops type-only imports, then scans the
   runtime imports that remain. Biome wraps long imports over several
   lines, so a line-based grep is not enough:

   ```sh
   bun -e '
   const fs = require("node:fs");
   const ts = new Bun.Transpiler({ loader: "ts" });
   const js = new Bun.Transpiler({ loader: "js" });
   const names = "(core|element-editing|selection-editing|page-editing|notation-editing)";
   const viaDir = new RegExp(`facade/${names}\\.ts$`);
   const local = new RegExp(`^\\./${names}\\.ts$`);
   const allowed = {
     "packages/core/src/editor/facade/core.ts": [],
     "packages/core/src/editor/facade/element-editing.ts": ["./core.ts"],
     "packages/core/src/editor/facade/selection-editing.ts": ["./element-editing.ts"],
     "packages/core/src/editor/facade/page-editing.ts": ["./selection-editing.ts"],
     "packages/core/src/editor/facade/notation-editing.ts": ["./page-editing.ts"],
     "packages/core/src/editor.ts": ["./editor/facade/notation-editing.ts"],
   };
   const bad = [];
   for (const file of new Bun.Glob("packages/core/src/**/*.ts").scanSync(".")) {
     const inFacade = file.startsWith("packages/core/src/editor/facade/");
     const runtime = js.scanImports(ts.transformSync(fs.readFileSync(file, "utf8"))).map((i) => i.path);
     for (const path of runtime)
       if ((viaDir.test(path) || (inFacade && local.test(path))) && !(allowed[file] ?? []).includes(path))
         bad.push(`${file} -> ${path}`);
   }
   if (bad.length) { console.error(bad.join("\n")); process.exit(1); }
   console.log("facade imports ok");
   '
   ```

Baselines are recorded before any edit, on the untouched tree. Each plan's
first step runs `BUN_OPTIONS=--jsx-runtime=classic bun test > baseline.log
2>&1` and keeps its ` N pass` / ` N skip` / ` 0 fail` lines. It also runs
command 8. That command is expected to exit 0 at b52e4db, after f033691
"Type the wide-range lookup for strict index access". If it does not, the
plan stops and reports a blocker; it must not list a failing gate. The
intake reports 17 native parity blocks at baseline. At 1b6b669, `grep -c
'^nativeTest(' apps/cli/src/native-parity.test.ts` prints 17. The
repo-wide `--noUncheckedIndexedAccess` error total (91 at 28c9ded) may be
recorded in a progress log for reference. It is not a gate, because that
command exits non-zero on the untouched tree. Command 8 is the gate.

## Rollout constraints

- Three plans in three serial waves (revised at plan creation, session
  575). The plans own disjoint files, but their gates are coupled at run
  time: plans share one working directory, every CLI test and the release
  binary load `packages/core`, and the binary bundles `edit-command.ts`.
  If two plans ran at once, one plan's half-finished edit could fail the
  other plan's gate. Each plan therefore runs alone in its wave, so
  repository-wide gates are valid for it:
  1. `sms-01-editor-facade`: `packages/core/src/editor.ts`,
     `packages/core/src/editor/facade/*` (new), the planner parameter types
     in `editor/{paste,pages,sequence,bpmn,breadboard,connections}.ts`, and
     the editor paragraph in `docs/development.md`. Gates: commands 1, 2
     (test-cli, for the Boa cost of the chain; review finding DR-L2), 7, 8
     and 9; command 5 limited to the editor paths, plus the `editor.ts` size
     check; command 6 limited to `packages/core/src/editor`.
  2. `sms-02-cli-edit` (depends on 1): `apps/cli/src/edit-command.ts`,
     `apps/cli/src/edit/**` (new, with the focused tests), and the edit
     sentence in `docs/development.md`. Gates: commands 1, 2 and 7;
     command 5 limited to the edit paths, plus the `edit-command.ts` size
     check; command 6 limited to `apps/cli/src/edit`.
  3. `sms-03-native-parity` (depends on 2): `apps/cli/src/native-parity.test.ts`
     (removed), `apps/cli/src/native-parity/**` (new) and
     `apps/cli/native/README.md`. This is the last plan, so its gates are
     commands 1-9 on the combined tree.
- Within plans 1 and 2, the move comes first: code is moved and only
  re-pointed (`this` becomes a `batch` parameter, imports change). Behavior-
  neutral deduplication (sections 1.3 and 2.3) is a separate step in the
  same plan, run after the gates pass on the moved code.
- The native bundle needs no manifest or registration change.
  `apps/cli/scripts/build-engine.ts` bundles from `src/native-engine.ts`
  through the import graph. `apps/cli/native/build.rs` already reruns when
  anything under `apps/cli/src` or `packages/core/src` changes, so the new
  directories are picked up.
- Dispatch manifest rules (session 579; these fix the session-575
  manifest):
  - Every plan declares `artifactRoots: ["target"]`. Commands 1 and 2
    build into the git-ignored `target/`, including
    `target/release/nodetto-cli`, which command 3 runs.
  - Every file a plan's steps edit is in that plan's `writePaths`, not
    only in `sharedPaths`. `docs/development.md` is a write path of both
    sms-01 and sms-02. That is safe only because the two plans run in
    separate serial waves, 1 then 2. `apps/cli/native/README.md` is a
    write path of sms-03. Each plan's progress log and evidence directory
    are also write paths.
  - Evidence goes under `tmp/source-module-split-s579/<planId>/`.
    `tmp/` is git-ignored (`.gitignore` line 41). Only `.log` and `.txt`
    files go there. The plan bodies and the manifest name the same
    evidence root. In the plan bodies, only the session-575 evidence paths
    and session labels change; every other part of the plans is reused
    as is.
  - The manifest records `originalHead` 1b6b669 and the upstream
    `origin/main`. Command 7 and the sms-01/sms-02 `git diff` gates keep
    comparing against b52e4db, which has the same source tree.
  - `impl-plans/active/source-module-split-s575-dispatch.json` is
    superseded and never dispatched. At archival it moves to
    `impl-plans/completed/` along with the three sms plans. The
    session-579 manifest stays in `impl-plans/active/`, and its `planPath`
    values keep naming the pre-archive `active/` locations, as the other
    historical manifests there do. The orchestrator owns
    `impl-plans/README.md`, the plans, this design and both manifests.
    Workers do not edit them.
- No version bump, tag or release. `gitPush` is false: commit locally only,
  with no push or merge.

## Risks

- The class chain adds prototype lookups to every `Editor` call. The chain
  is at most six levels deep, so a method lookup in Boa walks at most six
  shapes. That is small next to command planning. The `test-cli` parity
  deadlines (command 2) would catch a regression.
- Field order and `useDefineForClassFields`. Section 1.3 rules this out
  (fields only in `EditorCore`), and command 7 compares
  `Object.keys(new Editor())`.
- Import cycles. Planners may import chain classes only with `import type`
  (command 9). A violation shows up as "Class extends value undefined"
  when the module is evaluated, which commands 1 and 2 would hit.
- Parity runs that pass with nothing run. Commands 3 and 4 require exactly
  17 blocks and no skips when the binary is set.
- Ordering inside `edit`. Handlers are moved, not rewritten. Golden parity
  tests, `ai-commands.test.ts` and `edit-scale-text-group.test.ts` cover the
  output and error text.

## Decisions

- D1. A single-inheritance class chain is used, not delegation stubs. Stubs
  cannot fit about 165 public signatures in 700 lines, and prototype
  patching is a module-level side effect.
- D2. Component and responsive-variant members stay in `Editor`, the last
  class in the chain, because they need `new Editor` and planners typed as
  the full `Editor`.
- D3. Planner parameters are typed as the lowest chain class that has the
  members they use (section 1.3). This is the typed interface between the
  facade and the planners; no new interface types are introduced.
- D4. `Batch` stays a class that holds batch state and resolvers. Operation
  handlers are module-level functions grouped by domain under
  `edit/operations/`. The `op` switch stays in `Batch.apply`, so dispatch
  order and the unknown-op error are unchanged.
- D5. The parity tests move into `apps/cli/src/native-parity/` and the old
  file is removed. A topic file named `native-parity.test.ts` would be
  misleading, and `bun test apps/cli/src/native-parity` still selects all
  17 blocks.
- D6. Only helpers newly extracted from closures or inline code get focused
  tests. Functions that only move do not.
- D7 (session 579). The design and the three plans are reused. Only the
  dispatch manifest is rebuilt, following the rules under "Rollout
  constraints". The superseded session-575 manifest is archived to
  `completed/`, as the workflow input asks. This differs on purpose from
  the README convention that historical manifests stay in `active/`. That
  convention covers manifests that were dispatched, and the session-575
  manifest never was.

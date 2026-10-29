# slc-07-cli-docs

- planId: slc-07-cli-docs
- planPath: impl-plans/active/slc-07-cli-docs.md
- wave: 3; dependsOn: slc-02-ir-unknown-field, slc-03-geo-actor
- design:
  - section 1 "CLI: nodetto-cli edit" and "CLI: nodetto-cli validate";
  - section 5 (types, help, `docs/cli.md`, `docs/editing.md`);
  - the `apps/cli/src` Verification bullets.
- progress log: impl-plans/progress/slc-07-cli-docs.md
- scratch and logs: tmp/shape-lateral-s544/slc-07-cli-docs/

## Intent

Surface the new `semantic.unknownField` warnings to CLI users and agents:

- `nodetto-cli edit` (and `draw`, which shares `runOperations`) reports each
  newly introduced warning with the operation that introduced it, in text
  and JSON output. The batch still succeeds with exit 0.
- `nodetto-cli validate --strict` exits 3 when the document has warnings.

Also make the stick figure and the use-case types discoverable on
architecture pages, and document all four changes.

## Repository context

- `apps/cli/src/edit-command.ts`:
  - `BatchResult` (~66);
  - `applyBatch(documentText, operations, arrange)` (~907-998). It parses
    with `parseDocumentResult`, applies `operations.forEach(... batch.apply(
    operation, index))`, then runs `validateDocument(snapshot)` filtered to
    errors (~961);
  - `runOperations` JSON output (~1120-1132) and text lines (~1133-1144).
- `packages/core/src/store.ts:listElements()` gives the current element
  records. Records are replaced, not mutated, on update. Confirm this in a
  test.
- `apps/cli/src/commands.ts`:
  - `loadDocument(io, path)` (~153-167) returns `{ document, warnings:
    string }`;
  - `validateCommand` (~816-835) uses `parseArgs(args, new Set(), new
    Set())`;
  - `EXIT_WARNINGS = 3` (~62);
  - the `--strict` pattern is the draw.io import at ~522-553.
- `apps/cli/src/help.ts`:
  - `COMMAND_HELP.validate` (~435);
  - `edit` help (around ~180-245);
  - `draw` and `shapes` help (~250-305);
  - `EXIT_CODES` already mentions `3 warnings with --strict`.
- `apps/cli/src/types-command.ts`: `TYPICAL.architecture: GENERAL` (~40)
  and the overview text (~173-175).
- Test pattern: `apps/cli/src/shapes-command.test.ts` (`memoryIo`,
  `singlePage`, `runCli`).
- The generic connector shape ID is `Tool.Connector` = `"edge"`
  (`packages/core/src/tools.ts:66`).
- Docs:
  - `docs/cli.md`, the "Drawing with AI agents and live co-editing"
    section (~60-160);
  - `docs/editing.md`, the "Shapes, arrowheads and connector styles"
    section (~203-222).

## File-level changes

1. `edit-command.ts`:
   - Add the exported interface `EditWarning { readonly operation: number;
     readonly op: string; readonly element: string; readonly type: string;
     readonly path: string; readonly code: string; readonly message: string
     }` and `warnings: readonly EditWarning[]` on `BatchResult`.
   - In `applyBatch`, keep `lastTouch: Map<string, number>`. After each
     successful `batch.apply(operation, index)`, compare
     `editor.store.listElements()` with the previous id-to-record map by
     object identity, and set `lastTouch(id) = index` for every new or
     replaced record.
   - Baseline: from `parsed.issues`, the `semantic.unknownField` keys
     `<element id>|<relative path>`. Map `elements[i]` to
     `parsed.document.elements[i].id`; the relative path is the issue path
     after `elements[i].`, for example `semantic.kind`.
   - After the batch:
     - reuse a single `validateDocument(snapshot)` call (also for the
       existing error check);
     - take its `semantic.unknownField` issues, map them the same way, and
       drop the baseline keys;
     - attribute each remaining issue to `lastTouch.get(id)`, and skip it
       if that is undefined;
     - sort by operation index, then path.
   - `runOperations`, JSON: add `warnings: result.warnings` as the last key
     (always present, possibly empty).
   - `runOperations`, text: after the created lines, one line per warning:
     ``  warning operation ${operation} (${op}): ${element} (${type})
     ${path}: ${message} (${code})``.
   - Exit code stays 0. Nothing about writing changes.
2. `commands.ts`:
   - `loadDocument`'s success result gains `readonly warningCount: number`
     (the count of `severity === "warning"` issues). This is additive, so
     other callers are unaffected.
   - `validateCommand` parses `new Set(["--strict"])`. When `--strict` is
     given and `warningCount > 0`, return `{ exitCode: EXIT_WARNINGS,
     stdout: <same summary>, stderr: `${loaded.warnings}${n} validation
     warning(s) with --strict.\n` }`.
3. `help.ts`:
   - `validate` usage becomes `nodetto-cli validate <document.jsonl>
     [--strict]`, with lines explaining that warnings (including
     `semantic.unknownField` for fields a type does not define) are
     printed, and that `--strict` exits 3 on any warning;
   - `edit` help: one paragraph on per-operation warnings and the JSON
     `warnings` array;
   - `draw`/`shapes` help: one example `nodetto-cli draw doc.jsonl geo:actor
     --label "Visitor"`. Keep each page short.
4. `types-command.ts`:
   - `architecture: [...GENERAL, "usecase.node", "usecase.relationship"]`;
   - the overview output adds the line `Run "nodetto-cli shapes <words>"
     for drawable shapes by shape ID, e.g. geo:actor (stick figure).`
     before the existing final line.
5. `apps/cli/src/shape-lateral.test.ts` (new): tests below.
6. `docs/cli.md`: document `validate --strict`, the edit warning output
   (text example line and JSON `warnings` shape) and the `geo:actor` draw
   example.
7. `docs/editing.md`, section "Shapes, arrowheads and connector styles":
   - the Stick figure shape (General palette, `geo:actor`, picked and
     connected by its box, label centred);
   - open `draw.path` contours (`closed: false`, at least 2 points, drawn as
     an unfilled stroke, no arrowheads; handoff and mobile code omit them);
   - the `semantic.unknownField` warning (preserved, never an error).
   Keep the surrounding prose style.

## Shared path

- `apps/cli/src/commands.test.ts`: only update existing expectations that
  break because of the new edit JSON `warnings` key or the validate
  `--strict` flag. No new tests here, and no other edits.

## Pitfalls and what not to do

- Do not fail the batch or change the exit code on warnings.
- Do not repeat warnings that already existed in the input document.
- Do not report other warning codes in the edit output. Only
  `semantic.unknownField` is in scope.
- Do not call `validateDocument` once per operation. Use one call at the end
  plus cheap per-operation identity tracking.
- Do not change MCP code. MCP returns the CLI stdout as is.
- Do not edit `draw-command.ts`; it inherits the behaviour through
  `runOperations`.

## Tests (`shape-lateral.test.ts`)

- `edit` adds `{ op: "add", page: <p>, type: "uml.component", semantic: {
  name: "Ledger", kind: "actor" } }`:
  - exit 0; the file is written;
  - stdout contains `warning operation 0 (add)` and `semantic.kind`.
- Same with `--format json`:
  - `warnings` has length 1, with `operation: 0`, `op: "add"`, `path:
    "semantic.kind"`, `code: "semantic.unknownField"`, and `element` equal
    to the created id.
- An `update` op adding an unknown key to an existing element -> attributed
  to that op's index.
- A document that already had an unknown key, plus an unrelated op -> no
  warnings reported.
- A clean `edit` -> JSON `warnings` is `[]`.
- `validate doc.jsonl` on a document with an unknown semantic key:
  - exit 0, and stderr contains `semantic.unknownField`;
  - with `--strict`, exit 3 and stderr ends with `1 validation warning(s)
    with --strict.`;
  - a clean document with `--strict` exits 0.
- `shapes actor` stdout contains `geo:actor`.
- `draw doc.jsonl geo:actor --label Visitor`:
  - exit 0;
  - the saved element is `shape.geo` with `{ geo: "actor", label:
    "Visitor" }` and size `60 x 110`.
- Then `draw doc.jsonl edge --from <actor id> --to <other id>` -> exit 0 and
  an `edge.generic` element exists.
- `types --kind architecture` stdout contains `usecase.node` and
  `usecase.relationship`, and the overview contains `geo:actor`.

## Verification

```
mkdir -p tmp/shape-lateral-s544/slc-07-cli-docs
BUN_OPTIONS=--jsx-runtime=classic bun test apps/cli/src/shape-lateral.test.ts apps/cli/src/commands.test.ts apps/cli/src/shapes-command.test.ts > tmp/shape-lateral-s544/slc-07-cli-docs/cli.log 2>&1; echo "exit=$?"
BUN_OPTIONS=--jsx-runtime=classic bun test apps/cli/src > tmp/shape-lateral-s544/slc-07-cli-docs/cli-all.log 2>&1; echo "exit=$?"
bunx tsc -p tsconfig.json --noEmit > tmp/shape-lateral-s544/slc-07-cli-docs/tsc.log 2>&1; echo "exit=$?"
bunx biome check apps/cli/src/edit-command.ts apps/cli/src/commands.ts apps/cli/src/help.ts apps/cli/src/types-command.ts apps/cli/src/shape-lateral.test.ts apps/cli/src/commands.test.ts
grep -c 'with --strict' apps/cli/src/commands.ts
grep -c 'geo:actor' docs/cli.md docs/editing.md
```

Expected:

- `cli` exits 0;
- `cli-all` and `tsc` exit 0 (rule-8 gates; sibling slc-06);
- biome exits 0;
- `with --strict` count is one more than before (record before and after);
- each doc has a `geo:actor` count of at least 1.

## Done criteria

- Logged commands and exit codes.
- The `docs/editing.md` section mentions `closed: false` and
  `semantic.unknownField`.
- The last line is `STATUS: done`.

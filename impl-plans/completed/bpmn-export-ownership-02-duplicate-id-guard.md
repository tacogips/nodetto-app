# bpmn-export-ownership-02-duplicate-id-guard

- planId: bpmn-export-ownership-02-duplicate-id-guard
- planPath: impl-plans/active/bpmn-export-ownership-02-duplicate-id-guard.md
- wave: 1; dependsOn: none
- design: `design-docs/specs/design-bpmn.md` section 5.3.1 "Duplicate-id
  safeguard" (scope narrowed by review DR-1: model and BPMNDI ids only;
  warn, never throw or rename)
- progress log: impl-plans/progress/bpmn-export-ownership-02-duplicate-id-guard.md
- scratch and logs: tmp/bpmn-export-ownership-s550/bpmn-export-ownership-02-duplicate-id-guard/
- Read `impl-plans/active/bpmn-export-ownership-00-overview.md` "Rules for
  every worker" first.

## writePaths

- packages/io/src/bpmn/export-duplicates.ts
- packages/io/src/bpmn/export-duplicates.test.ts
- impl-plans/progress/bpmn-export-ownership-02-duplicate-id-guard.md

sharedPaths: none. Plan 04 wires the function into `export.ts`. Do not
edit `export.ts`.

## Intent

The task asks for a general safeguard that no BPMN id is emitted twice.
This plan provides it as a pure function over the assembled XML tree. It
reports repeated ids among BPMN model and BPMNDI elements as export
warnings, so `bpmn export --strict` exits 3 instead of writing a file the
importer rejects. It must not flag ids in extension or foreign XML, whose
vocabularies have their own id scopes (DR-1).

## Contract (pinned for plan 04)

```ts
export function duplicateIdWarnings(root: XmlElement): BpmnExportWarning[];
```

- File: `packages/io/src/bpmn/export-duplicates.ts`, with a two-line header
  comment in the style of `export-scope.ts` and `export-process.ts`.
- Imports: `MODEL`, `BPMNDI` and `type BpmnExportWarning` from
  `./export-common.ts`; `type XmlElement` (and `XmlNode` if needed) from
  `./xml.ts`.
- Warning shape: `{ message: \`Duplicate BPMN id ${id} was emitted.\` }`,
  with no `elementId`. Emit one warning per repeated id, however many times
  it repeats. Order the warnings by first occurrence in document order
  (depth-first, children in order).

## Scan rules

- Visit an element only if `element.ns === MODEL` or
  `element.ns === BPMNDI`. Any other namespace (foreign, `dc`, `di`, or
  undefined) is not entered, and none of its descendants are scanned.
- A MODEL element with `local === "extensionElements"` is not entered.
- For a visited element, collect the attribute whose `name === "id"`.
  Prefixed attributes such as `ext:id` are not ids.
- Recurse into element children only. Text nodes have `kind: "text"`, so
  `"kind" in child` distinguishes them (see `rawXml` in `import.ts`).
- The function is pure: it does not mutate the tree and does not throw.

## Pitfalls

- Do not dedupe, rename or drop anything, and do not throw (design 5.3.1).
- Do not scan by prefix string. Use the resolved `ns`. Exporter-built
  elements get `ns` from `element()` in `export-common.ts`, and parsed
  raw XML gets it from `parseXml`.
- Keep BPMNDI in scope: a model id equal to a DI shape id must be reported.

## Tests (packages/io/src/bpmn/export-duplicates.test.ts, new)

Build trees with `parseXml` from inline strings that declare
`xmlns:bpmn`, `xmlns:bpmndi`, `xmlns:dc` and `xmlns:ext="urn:example:ext"`.
- definitions with tasks `A` and `B` and DI shapes `A_di` and `B_di` ->
  `[]`
- two `bpmn:task id="A"` -> exactly one warning, whose message is
  `Duplicate BPMN id A was emitted.`
- three elements with id `A` -> exactly one warning
- `bpmn:task id="A_di"` plus `bpmndi:BPMNShape id="A_di"` -> one warning
  for `A_di`
- two tasks, each with
  `<bpmn:extensionElements><ext:field id="amount"/></bpmn:extensionElements>`
  -> `[]`
- a foreign `ext:wrapper` holding two `bpmn:task id="X"` -> `[]` (the
  foreign subtree is not entered)
- two different repeated ids `B` then `A` in document order -> two warnings
  in the order `B`, `A`

## Verification (run from nodetto-app/)

- `bun test packages/io/src/bpmn/export-duplicates.test.ts > <log>/guard-test.log 2>&1`:
  exit 0, at least 7 pass, 0 fail.
- `bunx biome format --write packages/io/src/bpmn/export-duplicates.ts packages/io/src/bpmn/export-duplicates.test.ts`
  then `bunx biome check packages/io/src/bpmn/export-duplicates.ts packages/io/src/bpmn/export-duplicates.test.ts > <log>/biome.log 2>&1`:
  exit 0.
- `bun run typecheck > <log>/typecheck.log 2>&1`: no diagnostics in owned
  files.

## Done criteria

- `duplicateIdWarnings` is exported with exactly the pinned signature.
- The function is not exported from `packages/io/src/bpmn/index.ts`, which
  stays unchanged.
- All tests pass and the progress log has the commands, exit codes and log
  paths.

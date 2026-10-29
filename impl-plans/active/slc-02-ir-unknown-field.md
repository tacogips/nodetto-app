# slc-02-ir-unknown-field

- planId: slc-02-ir-unknown-field
- planPath: impl-plans/active/slc-02-ir-unknown-field.md
- wave: 1; dependsOn: none
- design: section 1 (Rule, Walk, Round trip and forward compatibility,
  keyOrder audit)
- progress log: impl-plans/progress/slc-02-ir-unknown-field.md
- scratch and logs: tmp/shape-lateral-s544/slc-02-ir-unknown-field/

## Intent

`validateDocument` must warn, and never error, for every `semantic` key
that the element type's registry `keyOrder` does not declare. It recurses
through `keyOrder.children`. Unknown keys stay in the document. First, fix
the four known keyOrder omissions so that no legitimate field warns. Then
add an audit test that keeps every fixture, example, default semantic,
design template and BPMN import at zero warnings.

## Repository context

- `packages/ir/src/validate.ts`:
  - `validateElement`, around lines 662-678: `definition.validateSemantic`
    runs at ~668 when `semanticIsObject`;
  - `warnUnknownFields` (~98-116) is the style to imitate;
  - `isPlainObject` and `warning` are already imported.
- `packages/ir/src/keyOrder.ts:KeyOrder`: `keys`, optional `children`,
  `coordinates`.
- `packages/ir/src/registry/bpmn.ts`:
  - `BPMN_BOUNDARY_EVENT` keys `["name", "attachedTo", "cancelActivity",
    "definitions"]` (line ~244);
  - `BPMN_GATEWAY` keys `["name", "gatewayType", "markerVisible",
    "parent"]` (~256);
  - `BPMN_GROUP` keys `["name"]` (~292);
  - the 3rd `bpmnDefinition` argument is the keyOrder keys and the 4th is
    the reference fields. Leave the 4th unchanged.
- The BPMN importer writes `parent` (`packages/io/src/bpmn/import.ts:644`,
  `:704`) and `gatewayDirection` (`:650`).
- `packages/ir/src/semantics/bpmn.ts`: interfaces at ~109-137
  (boundary event, gateway, group).
- `packages/ir/src/database-objects.ts:48`: `columns` children keys are
  `["id", "name", "dataType"]`. The `ErdColumn` type
  (`packages/ir/src/semantics/erd.ts`) also allows `pk`, `nullable`,
  `autoIncrement`, `identityGeneration`, `defaultExpression`,
  `generatedExpression` and `comment`.
- `packages/io/src/__fixtures__/forward-compat.jsonl`: element `n-known`
  (`node.generic`) carries semantic `__proto__`, `constructor` and
  `futureSemantic`. Element `z-future` has an unregistered type.
- The core test may import `@nodetto/io` (core devDependency).
  `createDefaultRegistry` is in `packages/core/src/shapes/index.ts`;
  `DESIGN_TEMPLATES` and `createDesignTemplate` are in
  `packages/core/src/templates/design-templates.ts`; `importBpmnXml` is in
  `packages/io/src/bpmn/import.ts` and returns a `BpmnImportReport`.

## File-level changes

1. `packages/ir/src/validate.ts`:
   - Add a private walker, for example `warnUnknownSemanticFields(out,
     value, order: KeyOrder, path, type)`.
   - Enumerate keys with `Object.keys(value)` on plain objects only.
   - A key is unknown when `!order.keys.includes(key)`. Push
     `warning("semantic.unknownField", `${path}.${key}`, `unknown semantic
     field for ${type}; preserved but ignored by this build`)`.
   - A known key recurses only when `order.children` exists and
     `Object.hasOwn(order.children, key)`:
     - plain-object value: walk it with that child order;
     - array value: walk each item that `isPlainObject` accepts, with path
       `${path}.${key}[${i}]`, and skip non-object items;
     - anything else: stop.
   - Call it in `validateElement` right after
     `out.push(...definition.validateSemantic(...))`, inside the same
     `if (semanticIsObject)` block, with `definition.keyOrder`,
     `${path}.semantic` and `type`.
   - Never call it when there is no definition.
   - Add a short doc comment that unknown semantic keys stay inline and are
     preserved by the serializer.
2. `packages/ir/src/registry/bpmn.ts`. Append the keys at the end; this
   is what keeps output byte-identical:
   - `BPMN_BOUNDARY_EVENT` keys += `"parent"`;
   - `BPMN_GATEWAY` keys += `"gatewayDirection"`;
   - `BPMN_GROUP` keys += `"parent"`.
3. `packages/ir/src/semantics/bpmn.ts`:
   - add optional `readonly parent?: ElementId` to the boundary event and
     group interfaces;
   - add `readonly gatewayDirection?: string` to the gateway interface.
   - No validation changes.
4. `packages/ir/src/database-objects.ts`: `columns` children keys become
   `["id", "name", "dataType", "autoIncrement", "comment",
   "defaultExpression", "generatedExpression", "identityGeneration",
   "nullable", "pk"]`, with the appended keys in lexicographic order.
5. `packages/ir/src/validate.test.ts`: add a `describe("semantic.unknownField")`
   block (tests below).
6. `packages/core/src/semantic-field-audit.test.ts` (new): the audit (tests
   below).

## Pitfalls and what not to do

- Never use `in` or bracket lookup on `children` without `Object.hasOwn`.
  `children["constructor"]` would return `Object`.
- `__proto__` parsed from JSON is an own key and must be reported. Do not
  construct a fresh object that drops it.
- Never emit severity `error`. Never strip or move unknown keys. Do not
  touch `jsonl/parse.ts` or the serializer.
- Do not add `parent` to the BPMN reference-field arguments. That would
  change delete behaviour, which is out of scope.
- Do not reorder existing keyOrder keys. Insert only at the end, in
  lexicographic order. Any other order changes serialization.
- Do not edit any fixture or example to silence a warning. If the audit
  finds a new legitimate key, fix the registry keyOrder with the same
  append rule and record it in the progress log.
- The `field.unknown` code for `visual` is unchanged.

## Tests

`validate.test.ts`. Build each document in memory, using `base()` and the
helpers already in that file:

- `uml.component` semantic `{ name: "Ledger", kind: "actor" }` -> exactly
  one `semantic.unknownField` warning, path `elements[0].semantic.kind`,
  and no errors.
- One unknown key each on `node.generic`, `shape.geo`, `usecase.node`,
  `state.node` and `text.note` -> one warning each, with the expected path.
- `erd.table` column with an extra `shade` key -> path
  `elements[0].semantic.columns[0].shade`.
- `draw.path` contour with an extra `tint` key -> path
  `elements[0].semantic.contours[0].tint`.
- Own keys `__proto__` and `constructor` (built with `JSON.parse`) -> both
  reported.
- Unregistered type `future.gadget` -> no `semantic.unknownField`; the
  `type.unknown` warning is unchanged.
- A known key without a `children` entry holding an object with arbitrary
  keys -> not recursed, no warning. Use `group` `fabricationLayer` if its
  shape allows, or any opaque object field.
- PCB-style array of number tuples under a known children key -> no
  warning and no crash.

`semantic-field-audit.test.ts`. Collect every issue with code
`semantic.unknownField` and expect `[]` for each source:

- every `*.jsonl` under `packages/io/src/__fixtures__` (recursive) except
  `forward-compat.jsonl`, through `parseDocumentResult` issues;
- every `*.jsonl` under `examples/` (recursive);
- every `add`/`connect` operation in `examples/**/*.ops.json` that has
  `type` and `semantic`: wrap it as a one-element document, run
  `validateDocument(doc, { checkReferences: false })`, and check the
  issues;
- `createDefaultRegistry()`: for each `types()` entry, its
  `defaultSemantic()` wrapped the same way;
- `createDesignTemplate(id)` for every `DESIGN_TEMPLATES` entry;
- `importBpmnXml` over each `packages/io/src/__fixtures__/bpmn/*.bpmn`
  (the report's document).

Also in the audit file: `forward-compat.jsonl` -> the
`semantic.unknownField` paths are exactly the three `n-known` keys
(`__proto__`, `constructor`, `futureSemantic`), and none come from
`z-future`.

Resolve paths with `join(import.meta.dir, ...)`.

## Verification

```
mkdir -p tmp/shape-lateral-s544/slc-02-ir-unknown-field
BUN_OPTIONS=--jsx-runtime=classic bun test packages/ir > tmp/shape-lateral-s544/slc-02-ir-unknown-field/ir.log 2>&1; echo "exit=$?"
BUN_OPTIONS=--jsx-runtime=classic bun test packages/core/src/semantic-field-audit.test.ts > tmp/shape-lateral-s544/slc-02-ir-unknown-field/audit.log 2>&1; echo "exit=$?"
BUN_OPTIONS=--jsx-runtime=classic bun test packages/io > tmp/shape-lateral-s544/slc-02-ir-unknown-field/io.log 2>&1; echo "exit=$?"
bunx tsc -p tsconfig.json --noEmit > tmp/shape-lateral-s544/slc-02-ir-unknown-field/tsc.log 2>&1; echo "exit=$?"
bunx biome check packages/ir/src/validate.ts packages/ir/src/validate.test.ts packages/ir/src/registry/bpmn.ts packages/ir/src/semantics/bpmn.ts packages/ir/src/database-objects.ts packages/core/src/semantic-field-audit.test.ts
grep -c 'semantic.unknownField' packages/ir/src/validate.ts
git diff --quiet -- packages/io/src/__fixtures__ examples; echo "exit=$?"
```

Expected:

- `ir` and `audit` exit 0;
- `io` exits 0. This is a shared-input gate: it reads slc-01's open-path
  test, so it counts only after slc-01 is done. Otherwise record it as
  `pending-join`.
- tsc exits 0 (rule 8);
- biome exits 0;
- the grep prints at least `1`;
- the last command prints `exit=0`.
- Run `BUN_OPTIONS=--jsx-runtime=classic bun test packages/core apps/cli/src`
  once and record any failure caused by the new warnings, together with the
  owning file. Expected: none, other than the overview rule-9 transient
  failures.

## Done criteria

- All of the above is logged with exit codes and log paths.
- The progress log lists each keyOrder change as `type: added keys`.
- The last line is `STATUS: done`.

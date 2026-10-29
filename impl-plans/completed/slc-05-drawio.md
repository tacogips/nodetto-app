# slc-05-drawio

- planId: slc-05-drawio
- planPath: impl-plans/active/slc-05-drawio.md
- wave: 2; dependsOn: slc-01-ir-drawing-contract
- design: section 3 (draw.io mappings: import table, export table, tests),
  plus section 5's `docs/import-export.md` bullet
- progress log: impl-plans/progress/slc-05-drawio.md
- scratch and logs: tmp/shape-lateral-s544/slc-05-drawio/

## Intent

Map draw.io `umlActor` exactly to geo `actor`, with no approximation
warning. Export geo `actor` as `umlActor`. Export UML component, interface
and port as native draw.io shapes instead of labelled-rectangle fallbacks.
These mappings stay unchanged: `actor` -> `person`, `folder` -> `package`,
`ext` and the 4/6/8-point stars (still approximate), and the
`usecase.node`, `state.node`, `uml.class` and `erd.table` exports. Sequence
participants are still skipped.

## Repository context

- `packages/io/src/drawio/style.ts:DRAWIO_SHAPES`:
  - line 135 `umlActor: { geo: "person", approximate: true }`;
  - 139 `ext`;
  - 161-163 the star variants;
  - `NODETTO_GEO_KEY` = `"nodettoGeo"` (208).
- `packages/io/src/drawio/import.ts:~463-475` reads the `nodettoGeo`
  override, and the approximation warning ``Shape "${shape}" was
  approximated as a ${geo} shape.``. Do not edit import.ts; the table
  change is enough.
- `packages/io/src/drawio/export-shape-style.ts:geoStyle(geo, box,
  visual)`, with the local `shape(name, entries, flipped)` helper. The
  `case "person": return shape("actor")` pattern is at ~324.
- `packages/io/src/drawio/export-page.ts:PageWriter.node`:
  - the switch after the fixed-geometry check (~283);
  - the `usecase.node` case (~388-416) is the pattern to imitate:
    `this.vertex(element, box, textToHtmlLabel(name), formatStyle(names,
    [...entries, ...common, ...paint]))`;
  - the `default` case calls `this.fallback(element, "was exported as a
    labelled rectangle")`.
- UML component semantics (`packages/ir/src/semantics/uml.ts`):
  `uml.component { name }`, `uml.interface { name, kind:
  "provided"|"required" }` (check `UML_INTERFACE_KINDS`), `uml.port { name,
  owner, side, offset }`. Fixture:
  `packages/io/src/__fixtures__/uml-component.jsonl`.
- `packages/io/src/drawio/drawio.test.ts`:
  - palette expectations at ~375 (`"person", // UML actor, approximated`);
  - the warning expectation at ~406-408;
  - the use-case export test at ~672-691 is the pattern for new tests.
- `docs/import-export.md`:
  - section "draw.io import and export";
  - the approximation sentence at ~120-122;
  - the mapping table at ~124-161 (`| person | actor, mermaidPerson,
    umlActor (approximated) |`);
  - the export paragraph at ~111-116.

## File-level changes

1. `style.ts`: `umlActor: { geo: "actor" }`. Leave every other entry
   untouched.
2. `export-shape-style.ts`: `case "actor": return shape("umlActor",
   [["verticalLabelPosition", "bottom"], ["verticalAlign", "top"]]);` next
   to `person`. The `shape.geo` caller already appends `nodettoGeo=actor`.
3. `export-page.ts`, in the `node` switch, add cases after `usecase.node`:
   - `uml.component`: `formatStyle([], [["shape", "component"], ["align",
     "left"], ["spacingLeft", 36], ...common, ...paint])`, label from
     `semantic.name`.
   - `uml.interface`: kind `required` -> entries `[["shape",
     "requiredInterface"]]` with names `[]`; otherwise names `["ellipse"]`.
     Then `...common, ...paint`, label `semantic.name`.
   - `uml.port`: `formatStyle([], [["rounded", 0], ...common, ...paint])`,
     label `semantic.name`.
   - None of these calls `this.fallback`.
4. `drawio.test.ts`:
   - line ~375 becomes `"actor", // UML actor`;
   - the `toContain('Shape "umlActor" was approximated as a person
     shape.')` expectation becomes `not.toContain` of any message
     mentioning `umlActor`;
   - add the new tests below.
5. `docs/import-export.md`:
   - add a table row `| actor | umlActor |` after `person`;
   - the `person` row becomes `actor, mermaidPerson`;
   - the approximation sentence lists only draw.io's double rectangle and
     its 4/6/8-point stars;
   - the export paragraph adds that UML components, interfaces and ports
     use draw.io's component, interface and square shapes.

## Pitfalls and what not to do

- Do not map draw.io `actor` to `actor`. Draw.io's `actor` is the bust, so
  it stays `person`.
- Do not change `ext` or the star entries. There is no native equivalent
  (user-qa Q4).
- Do not export sequence participants. Keep the "has no fixed geometry"
  skip.
- Do not change the `usecase.node`, `state.node`, `uml.class` or
  `erd.table` exports, or the edge exports.
- Do not edit any fixture, including
  `__fixtures__/drawio/diagrams-net-palettes.drawio`.
- If draw.io's style name for component or required interface proves wrong
  (record your evidence in the progress log), stop and report to the
  orchestrator. Do not invent another mapping.

## Tests (`drawio.test.ts`)

- Palette import: `umlActor` -> `actor`. The warnings list contains no
  message mentioning `umlActor`.
- A geo actor with label "Visitor" -> the export XML contains
  `shape=umlActor` and `nodettoGeo=actor`. Re-import gives semantic
  `{ geo: "actor", label: "Visitor" }`, and the import warnings are empty.
- `usecase.jsonl` export, extending the existing test:
  - contains `shape=umlActor`, `ellipse` and `container=1`;
  - re-import has at least one geo `actor` element;
  - no import warning mentions "approximated".
- `uml-component.jsonl` export:
  - contains `shape=component` and `ellipse`;
  - `warnings` has no message containing "labelled rectangle" for
    `uml.component`, `uml.interface` or `uml.port`.
- A required interface (built in the test) -> `shape=requiredInterface`.

## Verification

```
mkdir -p tmp/shape-lateral-s544/slc-05-drawio
BUN_OPTIONS=--jsx-runtime=classic bun test packages/io/src/drawio > tmp/shape-lateral-s544/slc-05-drawio/drawio.log 2>&1; echo "exit=$?"
BUN_OPTIONS=--jsx-runtime=classic bun test packages/io > tmp/shape-lateral-s544/slc-05-drawio/io.log 2>&1; echo "exit=$?"
bunx tsc -p tsconfig.json --noEmit > tmp/shape-lateral-s544/slc-05-drawio/tsc.log 2>&1; echo "exit=$?"
bunx biome check packages/io/src/drawio/style.ts packages/io/src/drawio/export-shape-style.ts packages/io/src/drawio/export-page.ts packages/io/src/drawio/drawio.test.ts
grep -c 'umlActor: { geo: "actor" }' packages/io/src/drawio/style.ts
grep -c 'umlActor (approximated)' docs/import-export.md
```

Expected:

- `drawio` exits 0;
- `io` and `tsc` exit 0. They are rule-8 gates (siblings slc-03 and
  slc-04; slc-03 owns `d2/export.ts`);
- biome exits 0;
- the greps print `1` and `0`.

## Done criteria

- Logged commands and exit codes.
- The progress log records the draw.io shape-name evidence used.
- The last line is `STATUS: done`.

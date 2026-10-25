# breadboard-05-collab

- planId: breadboard-05-collab
- planPath: impl-plans/active/breadboard-05-collab.md
- wave: 2; dependsOn: breadboard-01-ir-contract
- design: design-docs/specs/design-breadboard.md section 8.5 (collab)
- progress log: impl-plans/progress/breadboard-05-collab.md
- protocol: overview "Per-worker protocol", gates G1 and G2
- G1 ownRegex: `^packages/collab/src/(test-fixtures|breadboard\.test)\.ts`

## Intent

Prove that breadboard pages and all 13 types sync through the existing
generic Yjs binding without new code, as BPMN did
(`impl-plans/completed/bpmn-07-collab.md`).

## Non-goals

- No change to `ydoc.ts`, `binding.ts` or any collab runtime file. If a
  test reveals a runtime defect, stop and record it under Open issues.
- No sync server code (that is private).

## writePaths

- packages/collab/src/test-fixtures.ts
- packages/collab/src/breadboard.test.ts (new)
- impl-plans/progress/breadboard-05-collab.md

## sharedPaths

none

## File-level changes

### test-fixtures.ts

Add `export const BREADBOARD_PAGE: Page = { id: "p-breadboard", name: "Breadboard", kind: "breadboard" };`
and `export function breadboardDocument(): Document`, imitating
`bpmnDocument()` (test-fixtures.ts:159). The document holds:
- one half board
- a resistor `R1`
- an LED `D1`
- a wire with 3 points
- a `breadboard.netlist` card with 2 parts and 1 net

Use literal semantics that pass ir `validateSemantic`, and write `visual`
fields only as needed. Append `breadboardDocument()` as the last entry
of `allFixtures()` (line 390). Change nothing else.

### breadboard.test.ts

Imitate `packages/collab/src/bpmn.test.ts` ("BPMN collaboration" suite):
- a round trip of `breadboardDocument()` through a Y.Doc gives an equal
  document, including wire `points` order and the nested netlist `nets`
  nodes
- two peers, one moving R1 (`visual.x`) and the other changing the wire
  `color` concurrently, converge to both edits
- one peer editing the netlist card while the other deletes the wire
  converges with no exception

## Pitfalls

- `ydoc.test.ts` loops `allFixtures()` with no count. Do not edit it.
- Keep fixture ids unique across all fixtures (prefix them `bb-`).

## Tests (input -> expected)

The three cases above, plus the existing `ydoc.test.ts` all-fixture loop
passing with the new fixture.

## Verification

```
cd /Users/taco/gits/tacogips/nodetto-app-breadboard
mkdir -p tmp/breadboard-mode-s485/breadboard-05-collab
bun test packages/collab/src/breadboard.test.ts packages/collab/src/ydoc.test.ts   # exit 0, >0 pass, 0 fail
bun test packages/collab > tmp/breadboard-mode-s485/breadboard-05-collab/collab.log 2>&1   # G2
bun run typecheck > tmp/breadboard-mode-s485/breadboard-05-collab/typecheck.log 2>&1       # G1
bunx biome check packages/collab/src/test-fixtures.ts packages/collab/src/breadboard.test.ts   # exit 0
git diff --quiet -- packages/collab/src/ydoc.ts packages/collab/src/binding.ts packages/collab/src/ydoc.test.ts   # exit 0
```

## Done criteria

- `allFixtures()` returns 6 documents, the last one being the breadboard document.
- All verification lines pass, with exit codes and counts in the progress log.

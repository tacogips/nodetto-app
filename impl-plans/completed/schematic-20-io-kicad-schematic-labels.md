# schematic-20-io-kicad-schematic-labels

- planId: schematic-20-io-kicad-schematic-labels; wave 5;
  dependsOn: schematic-15-io-kicad-schematic-contacts
- design: section 8.3 importer net naming (lines 445-457 rewrite,
  `labelVisits`)
- progress log: impl-plans/progress/schematic-20-io-kicad-schematic-labels.md

## Intent

Remove the remaining all-pairs path in the `.kicad_sch` importer: resolve
label texts once by final union-find root, with identical names.

## Non-goals

No change to name precedence, `usedNames` suffixing or contacts.

## writePaths

- packages/io/src/kicad/schematic.ts
- packages/io/src/kicad/schematic.test.ts
- impl-plans/progress/schematic-20-io-kicad-schematic-labels.md
- target
- tmp/cad3d

artifactRoots: target, tmp/cad3d. sharedPaths: none.

## Changes

- After the last union, one pass over label anchors builds
  `Map<root, string[]>` (anchor index known, no `indexOf`); sort each list
  once; the name pass reads the map. Precedence: power value, alphabetically
  first label, `N_<ref>_<pin>`, then existing `usedNames` loop.
- `stats.labelVisits += 1` per anchor visited and per net read.

## Tests (schematic.test.ts additions)

- N=500 disjoint labelled resistor nets: `labelVisits <= anchors + nets`.
- oracle equality (plan 15 oracle extended with the old label filter) on all
  fixtures and generated inputs including stacked labels and duplicate label
  texts.

## Verification

- `bun test packages/io/src/kicad/schematic.test.ts packages/core/src/breadboard/kicad-golden.test.ts` exits 0.
- `bunx biome check packages/io/src/kicad/schematic.ts packages/io/src/kicad/schematic.test.ts` exits 0.

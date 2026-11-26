# schematic-26-core-breadboard-target-intent

- planId: schematic-26-core-breadboard-target-intent; wave 6;
  dependsOn: schematic-13-io-breadboard-target, schematic-16-core-editor-intents,
  schematic-21-core-netlist-names
- design: section 8.1 step 3, section 11 `interop.test.ts`
- progress log: impl-plans/progress/schematic-26-core-breadboard-target-intent.md

## Intent

`Editor.setBreadboardTarget` writes or replaces the breadboard target card
from a projected schematic target, and an interop test proves breadboard
parity works end to end.

## writePaths

- packages/core/src/schematic/target-card.ts (new)
- packages/core/src/editor/facade/notation-editing.ts
- packages/core/src/schematic/interop.test.ts (new)
- impl-plans/progress/schematic-26-core-breadboard-target-intent.md
- target
- tmp/cad3d

artifactRoots: target, tmp/cad3d. sharedPaths: none.

## Changes

- `target-card.ts`: `planBreadboardTarget(store, breadboardPageId, target):
  Command[]`: replace the semantic of the first visible `breadboard.netlist`
  (element order) or create one with `NETLIST_CARD_SIZE` at the right of the
  page bounds + 2 pitches, top aligned. Never touches parts.
- `notation-editing.ts`: `setBreadboardTarget(pageId, target): boolean`, one
  undo step.

## Tests (interop.test.ts; core may import io in tests)

- example-like schematic -> `toSchematicNetlist` -> `breadboardTargetFromSchematic`
  -> `setBreadboardTarget` on a breadboard page built to match: zero
  `parity-*` findings from `lintBreadboardPage`; removing one breadboard wire
  gives `parity-missing-connection`.
- failure (sparse ic) leaves the existing card byte-identical
  (`serializeDocument` before/after equal).
- second call replaces the card semantic; card count stays 1; undo restores.

## Verification

- `bun test packages/core/src/schematic/interop.test.ts packages/core/src/breadboard/parity.test.ts packages/core/src/schematic/editor-schematic.test.ts`
  exits 0. `editor-schematic.test.ts` is plan 16's test on the shared
  `notation-editing.ts`.
- `bunx biome check <owned .ts files>` exits 0.

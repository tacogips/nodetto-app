# schematic-35-ui-workspace-palette

- planId: schematic-35-ui-workspace-palette; wave 9; dependsOn: schematic-29-core-tools-catalogue
- design: section 7.3 Workspace and Shape search
- progress log: impl-plans/progress/schematic-35-ui-workspace-palette.md

## Continuation status (SERIAL-W9-PLAN35-REDISPATCH)

The code is already in the working tree and matches
`tmp/schematic-s933/schematic-35-ui-workspace-palette/final-hashes.txt`
(5/5). This run is **confirm-only**:
- Do not edit `workspaces.ts`, `shape-palette.ts`, `tools.ts` or
  `schematic-palette.test.ts`. `workspaces.test.ts` must stay byte-identical
  to checkpoint `da5c257`, and there is no writePaths amendment.
- Run the gate and biome below in the foreground. Write the logs under
  `tmp/schematic-s933/schematic-35-ui-workspace-palette/attempt-<n>/` and
  record the exit code and pass/fail counts. A count of at least 14 pass
  and 0 fail is expected (14/0 reproduced by the Step 3 reviewer).
- In the progress log only, mark the old failing-gate entry and the
  amendment request as superseded, cite the new logs, and leave the
  test-integrity and adversarial decisions to the review nodes.
- An empty checkpoint commit is expected and is not a failure.

## writePaths

- packages/ui-solid/src/workspaces.ts
- packages/ui-solid/src/shape-palette.ts
- packages/ui-solid/src/tools.ts
- packages/ui-solid/src/schematic-palette.test.ts (new)
- impl-plans/progress/schematic-35-ui-workspace-palette.md
- target
- tmp/cad3d

artifactRoots: target, tmp/cad3d. sharedPaths: none.

## Changes

- `workspaces.ts`: workspace `{id:"schematic", label:"Schematic",
  design:false, shapes:false}` with primary tools Resistor, Capacitor,
  Ground, Wire, Label (imitate the breadboard entry ~line 118);
  `WorkspaceId` gains `schematic`.
- `tools.ts` (ui-solid re-export list): add `SCHEMATIC_TOOLS` and
  `type SchematicToolKind` next to the breadboard names.
- `shape-palette.ts`: `SCHEMATIC_SHAPES` with icons (reuse existing icon
  names where suitable; add none that need new artwork beyond simple path
  icons following the existing palette icon pattern).

## Tests (imitate `breadboard-palette.test.ts`)

- workspace exists with 5 primary tools; palette lists every schematic tool
  except duplicates; existing workspaces lists unchanged.

## Verification

- `bun test packages/ui-solid/src/schematic-palette.test.ts packages/ui-solid/src/workspaces.test.ts packages/ui-solid/src/breadboard-palette.test.ts` exits 0.
- `bunx biome check <owned .ts files>` exits 0.

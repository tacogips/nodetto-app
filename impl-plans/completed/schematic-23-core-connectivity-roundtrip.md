# schematic-23-core-connectivity-roundtrip

- planId: schematic-23-core-connectivity-roundtrip; wave 5;
  dependsOn: schematic-05-ir-range-golden, schematic-11-core-transform-extraction,
  schematic-17-core-move-contract, schematic-18-core-connectivity
- design: sections 3.3, 11 ("save and reload stability")
- progress log: impl-plans/progress/schematic-23-core-connectivity-roundtrip.md

## Intent

Prove live and reloaded connectivity agree, including off-grid positions,
negative ties and moves through the real move path.

## writePaths

- packages/core/src/schematic/connectivity-roundtrip.test.ts (new)
- impl-plans/progress/schematic-23-core-connectivity-roundtrip.md
- target
- tmp/cad3d

artifactRoots: target, tmp/cad3d. sharedPaths: none.

## Cases (each compares nets, membership and `lintSchematicPage` findings for
the live document and `parseDocument(serializeDocument(doc))` from
`@nodetto/io`)

- wire origin x 0.004, end offset 10.004, junction at 10.008: separate both.
- junction and wire end at x -0.125: joined both.
- off-grid resistor anchor (3.37, 0) wired, rotated by applying
  `planSchematicRotation` (plan 11) through the editor's apply path, saved,
  reloaded: connected.
- negative-tie group move via `editor.nudgeSelection`: origins -1 and -0.999,
  delta -0.005 -> both -1.01, joined live and after reload; and -0.125/-0.13
  with +1 -> key 87 joined.
- validation: point x 1e307 and visual x 2e307 -> `schematic.coordinateRange`;
  +-1e9 valid with distinct keys.

## Pitfalls

Do not use Editor facade methods from plan 16 (not a dependency); import
modules by path, not through a core barrel (plan 28 adds the barrel later).

## Verification

- `bun test packages/core/src/schematic/connectivity-roundtrip.test.ts` exits 0.
- `bunx biome check packages/core/src/schematic/connectivity-roundtrip.test.ts` exits 0.

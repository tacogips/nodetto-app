# schematic-44-native-parity

- planId: schematic-44-native-parity; wave 10;
  dependsOn: schematic-38-cli-schematic-command, schematic-40-example-goldens
- design: section 11 native parity
- progress log: impl-plans/progress/schematic-44-native-parity.md

## Intent

Prove the native CLI (embedded interpreter) and the Bun CLI give identical
schematic lint, netlist and SVG export output.

## writePaths

- apps/cli/src/native-parity/schematic.test.ts (new)
- impl-plans/progress/schematic-44-native-parity.md
- target
- tmp/cad3d

artifactRoots: target, tmp/cad3d. sharedPaths: none.

## Changes

- Using `apps/cli/src/native-parity/harness.ts` (`nativeTest`, `compare`):
  compare `lint` (text and `--format json`), `schematic netlist --format
  text`, `schematic netlist --format kicad` and `export --format svg` on
  `examples/schematic/led-switch.jsonl`.

## Pitfalls

- The gate must build the binary first; without `NODETTO_CLI_TEST_BINARY`
  the file runs zero tests, which is not an acceptable gate.
- Use the plan-local `CARGO_TARGET_DIR`; do not touch Rust sources.

## Verification (in order, foreground)

1. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR="$PWD/target/schematic-44" cargo build --release -p nodetto-cli` exits 0.
2. `NODETTO_CLI_TEST_BINARY="$PWD/target/schematic-44/release/nodetto-cli" bun test apps/cli/src/native-parity/schematic.test.ts`
   exits 0 with at least 5 passing comparisons (not skipped).
3. `bunx biome check apps/cli/src/native-parity/schematic.test.ts` exits 0.

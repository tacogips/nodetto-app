# car3-g1g-native-docs progress

Implementation: done; formal review and serial integration pending.

- Added native stacked-cap and shared-side touching and 0.01 mm overlap controls, and a PCB behind a sheet imported through the production STL path.
- Documented ordered translucent mixing, drawn-through visibility and the storage-bound refusal.
- Board bounds: `packages/core/src/capture/scene.test.ts` reference-body fixture confirms `[0,0,0]` to `[30,40,1.2]` for a 30 by 40 mm board of thickness 1.2 mm; the native fixture uses the same dimensions and a sheet at z=5 spanning -5..35 by -5..45.
- Source SHA-256: `apps/cli/src/native-parity/capture.test.ts` `05b0ea74a64818285e3ef887d81d91976137829167265ca365bba4e5089433ad`; `docs/capture.md` `989a783b335c6836bdaa0cb2664aec30a43f95081a860bc14ed37e6db7c7f38d`.
- Gate: `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car3-g1g-native-docs cargo build --release -p nodetto-cli && NODETTO_CLI_TEST_BINARY="$PWD/target/car3-g1g-native-docs/release/nodetto-cli" bun test apps/cli/src/native-parity/capture.test.ts apps/cli/src/capture-docs.test.ts && bunx biome check --diagnostic-level=warn apps/cli/src/native-parity/capture.test.ts` exited 0, 16 passed, 0 failed; `tmp/car3-r3b/car3-g1g-native-docs/gate.log`.
- Plan-delta scan: `find target tmp -name '*.test.ts' -print | LC_ALL=C sort | LC_ALL=C comm -23 - tmp/car3-r3b/checkpoint/inventory-sorted.txt > tmp/car3-r3b/car3-g1g-native-docs/stray-delta.txt && test ! -s tmp/car3-r3b/car3-g1g-native-docs/stray-delta.txt` exited 0; `tmp/car3-r3b/car3-g1g-native-docs/stray-final.log`, empty `stray-delta.txt`.
- Workspace typecheck and integration gates remain assigned to serial integration.

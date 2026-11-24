# car2-a1-ts-decoder progress

Status: done (implementation; formal review and integration remain downstream).

Implemented streaming inspection, allocation reporting, bounded capture decoding, quantized bounds and F1 eligibility; added fixture, corruption and allocation regressions. Dependencies: none. The accepted plan and design sections 19.1 and 20.2 agree.

Pre/post SHA-256 for each changed source file is recorded below; the progress file was absent before this edit. Its final SHA-256 is recorded in the separate evidence file `tmp/car2-r2b/car2-a1-ts-decoder/attempt1/progress-post-sha256.txt` to avoid self-reference.

## Pre-edit hashes
e7a9afb4b20cedfd951e2898e717452b7daeeced234f195320ca46f96e85203b  packages/nmesh/src/decode.ts
11c47355d15ef52287667c937de84c34e13a7a2165a0a83526db0ba819108b52  packages/nmesh/src/index.ts
c8c0834dce720a622609e38a4a852db593748ebf888b88623a272b75ff64bc0e  packages/nmesh/src/codec.test.ts
3a13023076a50814790c7a4534000186bbe7f46818d7caa0f23e707909bbc79c  packages/io/src/nmesh/capture-decoder.ts
40af048369a0c86ee8778001e501c034d348976de82c2d2cf4a124f8c930998f  packages/io/src/nmesh/index.ts
8ddc94917a424f21b1f802c145afc88fe6aa8f9903322afcd8a982912ff1676d  packages/io/src/nmesh/capture-decoder.test.ts
a3a9df2698f01e76a9b31397cadbe0f3cfb83e64b7562fe7c638429d6ba9b671  impl-plans/active/car2-a1-ts-decoder.md

## Post-edit hashes

2839ba0f4a71521e968bbb0d00bfe060b9d2b07cda35b2608f5f2eacc8ec97f3  packages/nmesh/src/decode.ts
81bacac8f8cd81fd9990c63550e1932c665f9c15c099b6a8bf9d410143a364f7  packages/nmesh/src/index.ts
0c944980ef4d30f5793329185d8d1d982ba8bfea9b2053442ad3811ef9550bab  packages/nmesh/src/codec.test.ts
0277cde55cd75863547c4a209bfc92a0372ce6217674235dbd9276f40896b57b  packages/io/src/nmesh/capture-decoder.ts
bfda57e3cb4ef2d73a176ae2bff242237faf4f803fa4631fc7937d66cedfbe32  packages/io/src/nmesh/index.ts
dcad0127069049b2a3bf8b55cc0582e62fafadb3825f4658dc5190ce275fe1f6  packages/io/src/nmesh/capture-decoder.test.ts

## Verification

- Negative control before implementation: `bun test packages/io/src/nmesh/capture-decoder.test.ts`, exit 1, 1 pass and 1 fail: missing `decodeCaptureMeshWith`; `target/car2-car2-a1-ts-decoder/logs/baseline-test.log`.
- `bun test packages/nmesh/src packages/io/src/nmesh`, exit 0, 32 passed, 0 failed; `target/car2-car2-a1-ts-decoder/logs/final-test-4.log`.
- `bunx biome check --diagnostic-level=warn packages/nmesh/src/decode.ts packages/nmesh/src/index.ts packages/nmesh/src/codec.test.ts packages/io/src/nmesh/capture-decoder.ts packages/io/src/nmesh/index.ts packages/io/src/nmesh/capture-decoder.test.ts`, exit 0; `target/car2-car2-a1-ts-decoder/logs/final-biome-4.log`.
- `bunx tsc --noEmit --strict --noUncheckedIndexedAccess --skipLibCheck --target ES2022 --module ESNext --moduleResolution bundler --allowImportingTsExtensions packages/nmesh/src/decode.ts packages/nmesh/src/index.ts packages/io/src/nmesh/capture-decoder.ts packages/io/src/nmesh/index.ts`, exit 0; `target/car2-car2-a1-ts-decoder/logs/final-typecheck-4.log`.
- Earlier Biome failure was corrected; complete evidence and per-edit intentions are under `tmp/car2-r2b/car2-a1-ts-decoder/attempt1/`. Runs occurred on a shared working tree; integration owns workspace gates.

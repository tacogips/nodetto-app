# dps-14 document export progress

Implementation and assigned regression tests are complete on the moving shared tree. The combined shapes and connector asset and CLI PDF attachment resolution are covered. Formal review, stable integration verification and final commit are downstream.

## Verification

- `bun test packages/core/src/document-export apps/cli/src/export-document.test.ts apps/cli/src/export-command.test.ts apps/cli/src/local-io.test.ts`: exit 0, 28 passed, `tmp/dps-s863/dps-14-document-export/continuation-bun.log`.
- `bun run typecheck`: exit 0, `tmp/dps-s863/dps-14-document-export/continuation-typecheck.log`.
- `bunx biome check --diagnostic-level=warn packages/core/src/document-export apps/cli/src/export-command.ts apps/cli/src/raster-backend.ts apps/cli/src/native-engine.ts apps/cli/src/export-document.test.ts apps/cli/src/commands.ts apps/cli/src/local-io.ts apps/cli/src/local-io.test.ts`: exit 0, `tmp/dps-s863/dps-14-document-export/continuation-biome.log`.
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/dps-14 cargo test -p nodetto-cli`: exit 0, 19 passed, `tmp/dps-s863/dps-14-document-export/continuation-cargo.log`.
- `CARGO_TERM_QUIET=true cargo fmt --manifest-path apps/cli/native/Cargo.toml --check`: exit 0, `tmp/dps-s863/dps-14-document-export/continuation-fmt.log`.

## SHA-256 (checkpoint / current)

- `packages/core/src/document-export/markdown.ts`: `new` / `7ad02d7691442f8ade1daff1472dcea4680062b29ff387d3a647da2e26677622`
- `packages/core/src/document-export/markdown.test.ts`: `new` / `e090f5ea8ce493aa29dba4b18cd6e1583cdcfc699689b7f9bee005d2c0c83c72`
- `packages/core/src/document-export/pdf-document.ts`: `new` / `b3cc7b2f55eabdaa84824d120aa5035bbeadb272aff1c5f03f904e3003dd440d`
- `packages/core/src/document-export/pdf-document.test.ts`: `new` / `f49cf2abe725e2ccd7e830403a2946294e58a7c5391fe8a16f6916b896b62d86`
- `packages/core/src/document-export/index.ts`: `e4d71158deaf3e47428dd8903cd99097a3b5ddb3d07dc154a206d224555eeba5` / `92b465130f0e1c2258c071a2873c23174030e7c774eb37735704fb5bb1beb65e`
- `apps/cli/src/export-command.ts`: `c4bb853035b4ed42f2bb65b95271bdfc1543be609a98267abe3cf703ff2bee5f` / `4efffb16340a36714533904e45384b219463ffd19ccad6797ba3c0fe874cd8ca`
- `apps/cli/src/raster-backend.ts`: `e78c0417d267764ecf78aec922f167017c261d5269d38dddbc2cd56f22c0d8d6` / `5fa82993cea71b31b0b8a7e0a6a469dcd2d6039a495e4bd325b1dd9425b1bd3e`
- `apps/cli/src/native-engine.ts`: `ee4c6f737fcff0055783839ee3614f235bd47389f13fb2cfb0a2fe23fe245486` / `603ca682729a61d99d668cfafc93911fc9323cbfff7e32aba7d9bc2fef02e089`
- `apps/cli/src/export-document.test.ts`: `new` / `4b2cd35702cc8916928e92616df880b11ccc549a4b01e434d4ed0b32f151d51d`
- `apps/cli/src/commands.ts`: `14fa5fb4bdec7562325f3a27d6deebc8dff3bc05e680895daf2ce0d0cfa5651a` / `f71011ecad3f2d64ded4e28859dac3a796405de1e6cf66d27f5017bbae66aca7`
- `apps/cli/src/local-io.ts`: `40e53b7c46236f1a8de1c1b68a91130535fb9af5c1cb0568cce6191f70da6da2` / `4ad9dda764301635907f62bd2458fd039d477710eb44d2b2e3c2be88d3298815`
- `apps/cli/src/local-io.test.ts`: `new` / `1ea33dc4972538f77f5d073046fc7cde6c8fcc98156a31d15258d16ad0a1cc16`
- `apps/cli/native/src/engine.rs`: `5ea58fddb4a852dc683ae60a27b951d1a4e48c14a80841c988c11c695ec6115e` / `86fe27f986519e87580a1ffa1b034fd80bca0b5ed9e4ab0d370675d996c87c6b`
- `apps/cli/native/src/engine_tests.rs`: `17e8090d5cdd6f22098732d0f5a864963ac2324ec03287d6cd111a4778f8c905` / `7772412c13fc95d7ba34f56c72a1b4bf45887efd9f5796e1b15bcef6aec2f767`

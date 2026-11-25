# car14-p6 native parity progress

Status: done. Formal review and integration remain downstream.

Admission: the manifest lists all seven accepted dependencies. Wave 2 hash readback passed every file; wave 1 passed every file except history.ts and scene.test.ts, both covered by the passing wave 2 readback. The draft capture hash matched capture-post.sha256 before editing. The upstream fail-before evidence is `tmp/car14-r14/car14-p1-prism-slab-proof/fail-before.log`.

Implemented native STL boss, tall and short contact and penetration cases in both views, including text reports and PNG equality. Added edge, face and crossed welded cut and uncut controls with pixel-level through-hole proof. Source snapshots, intended hunks, and pre/post hashes are in `tmp/car14-r14/car14-p6-native-parity/` (capture, format, cases and types files). Final source hash is in `types-post.sha256`.

Final checks (all exit 0):
- `bunx biome check apps/cli/src/native-parity/capture.test.ts`: `biome-typed.log`.
- `bun run typecheck`: `typecheck-final.log`. The earlier tuple-inference failure is in `typecheck.log`; tuple annotations fixed it.
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car14-p6 cargo build --release -p nodetto-cli && test -x "$PWD/target/car14-p6/release/nodetto-cli" && NODETTO_CLI_TEST_BINARY="$PWD/target/car14-p6/release/nodetto-cli" bun test apps/cli/src/native-parity/capture.test.ts`: `native-typed.log`, 22 passed, 0 failed. This complete log includes the quiet build and test run.
- The six new cases were separately rerun on the same source and fresh release binary: `cases-typed.log`, 6 passed, 0 failed; `cases-typed.junit.xml` names each case and records its assertions. Bun's normal console output reports totals without individual passing names.

The authorized generated timing files were rewritten by the full gate. SHA-256 before and after are recorded in `timing-typed-before.sha256` and `timing-typed-after.sha256` under the evidence directory. No test files were placed under tmp or target.

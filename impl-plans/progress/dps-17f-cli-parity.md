# dps-17f CLI parity progress

Mode: issue-resolution, Riela shared-branch implementation. Dependency dps-17b is accepted in runtime dispatch. Design sections 7.4, 10.2 and 11 and the committed plan were reviewed. No git state changes.

- `apps/cli/src/document-wiring.test.ts`: retained the code-add test; added editor SVG byte identity, three-page document PDF with exact plan text and Unicode assertions, and local Markdown snippet/one-asset export.
- `apps/cli/src/native-parity/export.test.ts`: added release-native versus Bun SVG, PDF page/text and explicit/shorthand Markdown and asset byte parity.
- SHA-256 before: document test `977836b420280cccdbe268f29af601c339f08abcccaf247d35a8ae59e22cb16e`; native test `ae3f67ae0b1f143d08904fa565bb9e94264769ce6acec8565087b0684f8e2ebc`.
- SHA-256 after: document test `ce7445143b115e639c5f7f75db9d0a1bd5e834e13d9cb3bf8aa585d38210da16`; native test `1b89963fdb269aeb1a9c41f5fb81757554e672e718b5e477860ea1d44f9deb2b`.

Verification on the shared tree (logs under `tmp/dps-s864/dps-17f-cli-parity/`):

- `bun test apps/cli/src/document-wiring.test.ts`: exit 0, 3 passed, 0 failed (`test-final.log`).
- `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/dps-17f cargo build --release -p nodetto-cli`: exit 0 (`build.log`, quiet and empty).
- Plan native retry wrapper: exit 0, first attempt, 4 passed, 0 failed, 0 skipped (`native-1.log`); `NODETTO_CLI_TEST_BINARY` points to the isolated release binary.
- `bun run typecheck`: exit 0 (`typecheck-final.log`); earlier `typecheck-initial.log` exited 2 due to a nullable test value, fixed before final verification.
- `bunx biome check --diagnostic-level=warn apps/cli/src/document-wiring.test.ts apps/cli/src/native-parity/export.test.ts`: exit 0 (`biome-final.log`).

Implementation criteria are met. Formal review and combined-tree final gates remain downstream.

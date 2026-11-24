# car3-native-attachment progress

Status: blocked. The required a964ad5 native release binary has no verified provenance among existing target binaries (see tmp/car3-r3/car3-native-attachment/baseline-binaries.log). Its exact refusal messages and exit codes cannot be established from an unverified binary; the current shared tree contains concurrent changes and cannot produce an exact-head build. Resume with a source-identified a964ad5 binary or a checkpoint amendment authorizing a safe isolated baseline build. The release-only multi-MiB oracle, parity fixture and final gates remain incomplete. Formal review and integration remain downstream.

The Rust host now reads confined attachments, enforces the 30 MiB cap, detects four raster formats, and encodes the data URL. The capture resolver uses and caches that URL, retaining its legacy fallback. Added host, caching, fallback and symlink tests.

Pre-fix negative controls: `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car3-native-attachment cargo test -p nodetto-cli attachment_data_url_preserves_formats_and_refusals` failed (1 test; missing host function), log `tmp/car3-r3/car3-native-attachment/baseline.log`; `bun test apps/cli/src/capture-command.test.ts -t 'capture caches native attachment'` failed (1 test; legacy reader called), log `tmp/car3-r3/car3-native-attachment/baseline-ts.log`. Both commands returned nonzero; their wrapper hit zsh's read-only `status` variable after command completion.

Current focused checks: `bun test apps/cli/src/capture-command.test.ts` passed 46 tests, log `tmp/car3-r3/car3-native-attachment/capture-test.log`; `bunx biome check --diagnostic-level=warn apps/cli/src/commands.ts apps/cli/src/native-engine.ts apps/cli/src/capture-artwork.ts apps/cli/src/capture-command.test.ts` exited 0, log `tmp/car3-r3/car3-native-attachment/biome.log`. `CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car3-native-attachment cargo clippy -p nodetto-cli --all-targets -- -D warnings && CARGO_TERM_QUIET=true CARGO_TARGET_DIR=target/car3-native-attachment cargo test --release -p nodetto-cli` exited 0 with 36 passing tests; complete log `tmp/car3-r3/car3-native-attachment/verification-rust.log`. This run does not include the required release oracle, which is not yet written. The required native binary parity command remains pending.

Per-edit intent and pre/post digests are in `tmp/car3-r3/car3-native-attachment/edit-*`. Digests before edits:

```
b7dad365ad90c111554a3cdd4337877d5ae4deda7983e14699e4475034c09d65  apps/cli/native/src/engine_tests.rs
49421aa6f59b79655e85246b69b5a20bb408836d35f72e6a0af08354be35c183  apps/cli/src/capture-command.test.ts
9387ce7bdbc75ea4d0e1ebd65802b58e0cf956150ce562043bb8dc7c793a2cb9  apps/cli/native/src/files.rs
9eb97595bec24052c90fa0cc865ba11bb90ac6e4ff58a64c475f75f9e2c2b62b  apps/cli/native/src/engine.rs
9141da28bf82d07b9fe02fbe107da1fee7f75a4863c456cc744f60a19f0a4a94  apps/cli/src/commands.ts
71b120385651b8d082e5a53115b6aa00d39db644608666e98725e82da9e4bbf9  apps/cli/src/native-engine.ts
1cb5c4bbddb582deff2dc359d5bce5a4c5a8e733145ebe1b562de681cf3a8ee2  apps/cli/src/capture-artwork.ts
7f7fd560982f1ad215c2fee7cc533ed30852ebd82756f6517fbb7b3ffba07d66  apps/cli/src/capture-artwork.ts
f722a2ae3db75ddbf9b907735650c8d5c0329f473fcfa057bc6fc3626462b187  apps/cli/native/src/files.rs
b0809304e139702b8a460a1660b56477003eaaf6f4aad1f3d896ceccc1850112  apps/cli/native/src/engine.rs
349bbc7a8e2589f8f98034e927d1ade5b5b164ca9a7601a066146f3a346240b6  apps/cli/native/src/engine_tests.rs
6198ccde4123ae7aa6b1be4893fada800ff42c26e78b4a59ecdcfd3364a7cbc6  apps/cli/src/commands.ts
2bbc73ac1140fb3c60f020c536eb8ef5d31aa192b806e3d7016393295fbb8d9b  apps/cli/src/native-engine.ts
a7983a479d0dd29cdc518d22a9028d7a24d1a3626ff5f1ef759760b8cec0c7b7  apps/cli/src/capture-artwork.ts
6fac9aacca5e80680fbd7efa19211cbeaf584aa7727e17a8ce4931abf4ff69ed  apps/cli/src/capture-command.test.ts
b2ccb6e9dff28454136ced9273621047452938e44032b6c38d659c37359e3aec  apps/cli/native/src/engine_tests.rs
d08570642e86c318f85c8c82d377b4b80fdae20ed7a2051df306bb00b9cfcecb  apps/cli/native/src/engine_tests.rs
```

Digests after edits:

```
349bbc7a8e2589f8f98034e927d1ade5b5b164ca9a7601a066146f3a346240b6  apps/cli/native/src/engine_tests.rs
6fac9aacca5e80680fbd7efa19211cbeaf584aa7727e17a8ce4931abf4ff69ed  apps/cli/src/capture-command.test.ts
f722a2ae3db75ddbf9b907735650c8d5c0329f473fcfa057bc6fc3626462b187  apps/cli/native/src/files.rs
b0809304e139702b8a460a1660b56477003eaaf6f4aad1f3d896ceccc1850112  apps/cli/native/src/engine.rs
6198ccde4123ae7aa6b1be4893fada800ff42c26e78b4a59ecdcfd3364a7cbc6  apps/cli/src/commands.ts
2bbc73ac1140fb3c60f020c536eb8ef5d31aa192b806e3d7016393295fbb8d9b  apps/cli/src/native-engine.ts
7f7fd560982f1ad215c2fee7cc533ed30852ebd82756f6517fbb7b3ffba07d66  apps/cli/src/capture-artwork.ts
a7983a479d0dd29cdc518d22a9028d7a24d1a3626ff5f1ef759760b8cec0c7b7  apps/cli/src/capture-artwork.ts
affe083cda4954273edede6e0496a43f595ac68e3c7bcc15072e7e7db5d0f499  apps/cli/native/src/files.rs
b0809304e139702b8a460a1660b56477003eaaf6f4aad1f3d896ceccc1850112  apps/cli/native/src/engine.rs
b2ccb6e9dff28454136ced9273621047452938e44032b6c38d659c37359e3aec  apps/cli/native/src/engine_tests.rs
6198ccde4123ae7aa6b1be4893fada800ff42c26e78b4a59ecdcfd3364a7cbc6  apps/cli/src/commands.ts
2bbc73ac1140fb3c60f020c536eb8ef5d31aa192b806e3d7016393295fbb8d9b  apps/cli/src/native-engine.ts
7422976868a07b338c1c056b12bc42731bcfccfb8a67b676d752c5c76746433e  apps/cli/src/capture-artwork.ts
6442995dd5d4569ca3446d1c4e48afcde0f53d546ce5310cbb953e10c90851c5  apps/cli/src/capture-command.test.ts
d08570642e86c318f85c8c82d377b4b80fdae20ed7a2051df306bb00b9cfcecb  apps/cli/native/src/engine_tests.rs
4ebabc2fbc194b49070224dc9d2b0070e2a73aa01cc9b4f5baef5107f9179792  apps/cli/native/src/engine_tests.rs
```

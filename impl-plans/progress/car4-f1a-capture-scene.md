# car4-f1a-capture-scene progress

Status: done (implementation; formal review and integration pending).

## Source hashes before and after

- `packages/core/src/capture/scene.ts`: `05a7e7091b69a63eb3d18362d942b46ede6acea4b1d9e01c9e8e25e58951b070` -> `08024d8410e9db6a4b5096da501df7bb59ab21f332adb3813c7025a191aab1ff`
- `packages/core/src/capture/scene-binary.ts`: `b5cc610eed62a6de6fb741e735799c9caa907ad505902f9370801c53f0dbfd15` -> `5a06638189eb1c549f601fb6b54e04877468e18bd0b072578f0a47d71b6d9bd3`
- `packages/core/src/capture/cad-request.ts`: `5fd0c6ccdb3c913ca3a128cc67be4fe5c33ca681466407736d8c08093f9c89f3` -> `565fb604f1ccce1d105939c4b525d2958472e8cba9c481a86291e5848829615a`
- `packages/core/src/capture/scene.test.ts`: `0ee6bf1e6515e6c8b09079bf4b93ff9b2da16102a15cfcead8498f853db35b80` -> `ed0b87e534fa9ae9b7dce4c73e223a5136c8b73f3fbd1a35accde40f66258f89`
- `packages/core/src/capture/scene-binary.test.ts`: `d7106b7a0052aa3f0d4cd9689a9f9f574f6f38bbd1e72cac59b9a7cd48b0d554` -> `2fbe20b05cdb55b8827982b9c87b254fae68ff4e0c9885e520886aa8db20796a`

## Verification

- Pre-fix regression: `bun test packages/core/src/capture/scene.test.ts packages/core/src/capture/scene-binary.test.ts`, exit 1, 42 passed and 2 failed as expected; `tmp/car4-r4/car4-f1a-capture-scene/pre-fix.log`.
- Focused plan gate: exit 0, 62 passed, 0 failed; `tmp/car4-r4/car4-f1a-capture-scene/gate-1.log`. The first attempt hit the existing 1,000 ms deadline under load (2,525 ms); the permitted retry passed at 668 ms.
- Integration owns workspace-wide typecheck, lint, verification and CLI tests. Rust reader, census and reporting are assigned to f1b, f1d and f1c.

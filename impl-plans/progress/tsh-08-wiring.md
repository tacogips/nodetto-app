# tsh-08-wiring progress

Status: implementation complete; formal review pending. Plan hash: 5eb16e79bda8a90944f0a85e6bcf5c2718c4e710.

## Edit hashes

Core:
```
packages/core/src/shapes/index.ts ad9e043803d7f63ac835570100f64930457df183 290a50f82e877c6382430e0810b919801ec2babd
packages/core/src/svg-export/shapes.ts 462c170838e3e4f7c4d159e935472ae02204de52 75a9752199d0be0847e4c2e4d10932766b1ba327
packages/core/src/tools.ts 3b67c7ed63d839915a90da6e0e743170311e031f 561fb246235391f6187068e50b7c175816cbbd9d
packages/core/src/shape-catalogue.ts 38c62508e41376f14b5ca035efe37a0bc30ac12b 29761b168850a665cf83040b5223ca5440529e6b
packages/core/src/shape-catalogue.test.ts 303230363e9e8e171cd154505e7297828c2047ab 80b1d95c1e859c1bff41b5c7a5736704e6ec7969
packages/core/src/table-sheet-export.test.ts absent 9991c8450c96793d2ec9b081fbcd78f5df0a8668
packages/core/src/table-sheet-export.test.ts 9991c8450c96793d2ec9b081fbcd78f5df0a8668 05d5ded349fdcbde7c6a4209dc301f9a62bc375e
```
UI:
```
packages/ui-solid/src/shape-palette.ts 7d12a1be4c56fbc4afc645f6adbf3cff30067969 ffa136536eb0748fa56fc158fdc2aba6b491461e
packages/ui-solid/src/shapes/ShapeView.tsx 25c611bacd461a7f39f913e9d3198491b6eb7b1a f013d9f7607fd44fe87deffc89f946b0a2258ec7
packages/ui-solid/src/Inspector.tsx 4b3342b1316ecafa5563cb355bdd00c4f76acd77 8c6ce65a2d61f8ff6e2746d8b8e8115648484ce5
```
```
README.md
Add spreadsheet table feature bullet and CLI example.
pre 0165ea6f65fd0451ee94c6c52270749040182325
post 8d4a9da39086abd05729b1dd55a17db0c0a20409
```
```
design-docs/specs/design-table-sheet.md
Mark design status implemented as required by wiring plan.
pre b94878f417bad8565cdd48cab98a116a2c4f2159
post c965773a973f37e50fe7f501c41b9d5002f571ca
```
CLI edit evidence:
```
tmp/tsh-s780/tsh-08-wiring/cli/cli-wiring.test.ts.hashes
1422567be3529237e6ead874fa02f18d96cf653c e75ff398b9bb0ff7ac83776bbe3058b14604d186
```
```
tmp/tsh-s780/tsh-08-wiring/cli/commands-table-issue.hashes
c5b9b904621a14710fa88e5943394a6755b3fe48 92e42c86883849dcd129e277301fe48fd4a3086e
```
```
tmp/tsh-s780/tsh-08-wiring/cli/commands.ts.hashes
f722b5a6d0d595b855544c0d7cda52eb85dc0f12 c5b9b904621a14710fa88e5943394a6755b3fe48
```
```
tmp/tsh-s780/tsh-08-wiring/cli/e2e-retry.hashes
b59f6545431e76946172613c1fd81253feb204f9 90d86c4118ec373f279d8b4291fa15f310bdb272
```
```
tmp/tsh-s780/tsh-08-wiring/cli/format-post.hashes
92e42c86883849dcd129e277301fe48fd4a3086e
bd26e3f18c4e5542b9ea0ce3dfada254689d6e76
e9e323b010765082f5a26dfbe9c78196cf6c5fd0
e75ff398b9bb0ff7ac83776bbe3058b14604d186
25afc8ccc8e5ea6632fede736f4aa19585bb2f29
```
```
tmp/tsh-s780/tsh-08-wiring/cli/help.ts.hashes
d18ce9c8836797c4af09b1df9e178edaf8f68a50 bd26e3f18c4e5542b9ea0ce3dfada254689d6e76
```
```
tmp/tsh-s780/tsh-08-wiring/cli/table-e2e.test.ts.hashes
b59f6545431e76946172613c1fd81253feb204f9
```
```
tmp/tsh-s780/tsh-08-wiring/cli/types-command.ts.hashes
8171b36afb5046090a827c82efd4524df83c8cb2 e9e323b010765082f5a26dfbe9c78196cf6c5fd0
```

## Verification
- Core focused tests: exit 0, 5 pass, 0 fail; core/tests-final.log. Earlier failed attempt: core/tests.log.
- CLI focused tests: exit 0, 15 pass, 0 fail; cli/test-final.log. Earlier attempts retained under cli/.
- ERD guard exit 0, empty: final/erd-guard.log.
- Required plan gates 1-9, typecheck and scoped lint remain pending; source is incomplete.

## Amendment request
- Add generated output roots apps/desktop/dist and apps/desktop/src-tauri/binaries to the checkpoint artifactRoots or provide an authorized alternative for exact mise run build and mise run build-cli. mise.toml tasks and apps/cli/scripts/build-sidecar.ts write these outside target. Do not execute those gates before amendment.
- Remaining work: Canvas and interaction wiring, UI integration tests, full plan verification and self-check. Inspector uses the documented undefined active-row fallback.

- Design status restored pending implementation: c965773a973f37e50fe7f501c41b9d5002f571ca -> b94878f417bad8565cdd48cab98a116a2c4f2159.

## Resumed implementation (amendment round 1)

Canvas selection, keyboard/clipboard routing, double-click editing, resize lifecycle and overlay are wired. Inspector uses the permitted undefined active-row fallback. Cursor uses the container style. The amended build roots are authorized.

### Per-edit hashes

- `packages/ui-solid/src/interaction/types.ts`: `c24032c00e1aa6a79984317282376a932789feb7` -> `422d4d32696fe6979f6310fedaf64bc4e21a8cfe` (intent: `resume/types.intent`).
- `packages/ui-solid/src/interaction/types.ts`: `422d4d32696fe6979f6310fedaf64bc4e21a8cfe` -> `aad6f482457f6df230f0e8384a3339d269dae3d7` (intent: `resume/types-2.intent`).
- `packages/ui-solid/src/interaction/keyboard.ts`: `88334f3d585c65d504a14fe2ac8673c8c3962bbd` -> `5ac2a9e65d0871b2f4e2f2c329916ac2de34b8b0` (intent: `resume/keyboard.intent`).
- `packages/ui-solid/src/interaction/keyboard.ts`: `5ac2a9e65d0871b2f4e2f2c329916ac2de34b8b0` -> `0ccd53f6fac99e565fa839c559e19ec09c187df2` (intent: `resume/keyboard-2.intent`).
- `packages/ui-solid/src/interaction/keyboard.ts`: `9317f13a81e863c991bf9b1d6cfd83e8a832b869` -> `bb773317d3a90160b527d7cb5ab6a2e202ccb025` (intent: `resume/keyboard-3.intent`).
- `packages/ui-solid/src/interaction.ts`: `68d18c42e28b49a19c0221f3dfc4110ba4f71495` -> `4aceea6633748c8d43480354ca932a6ff588212e` (intent: `resume/interaction.intent`).
- `packages/ui-solid/src/interaction/pointer.ts`: `90d025e5396d15725091e58b41c1676dd89922a4` -> `d6808fa70aafbf869bc9822a29f108b498876253` (intent: `resume/pointer.intent`).
- `packages/ui-solid/src/Canvas.tsx`: `d5d8f0544c3ca86fdb8b1656258f35ef51616f85` -> `c817e65e6cb420e16f0d96ee61093351f732b29d` (intent: `resume/canvas.intent`).
- `packages/ui-solid/src/table-sheet-wiring.test.ts`: `pre absent` -> `ce0fa6c4895059d1306bc096e455d6da49cc3983` (intent: `resume/wiring-test.intent`).
- `apps/cli/src/help.ts`: `bd26e3f18c4e5542b9ea0ce3dfada254689d6e76` -> `d9b57ab9f16f501a313740dd7b2d8c23b68ea273` (intent: `resume/help.intent`).
- `design-docs/specs/design-table-sheet.md`: `b94878f417bad8565cdd48cab98a116a2c4f2159` -> `c965773a973f37e50fe7f501c41b9d5002f571ca` (intent: `resume/design.intent`).
- Formatting `Canvas.tsx`: `c817e65e6cb420e16f0d96ee61093351f732b29d` -> `7923d95cbd474d0d5785836b1485ed4e1c34c301` (intent: `resume/format.intent`).
- Formatting `interaction.ts`: `4aceea6633748c8d43480354ca932a6ff588212e` -> `3c5786fc8fae2336b38b60b77a07dc9970961516` (intent: `resume/format.intent`).
- Formatting `interaction/types.ts`: `aad6f482457f6df230f0e8384a3339d269dae3d7` -> `96bd5820924e1a4812d2688b20976b2ca0311a52` (intent: `resume/format.intent`).
- Formatting `interaction/pointer.ts`: `d6808fa70aafbf869bc9822a29f108b498876253` -> `61172119aea85b6977e1dc89c11253af96fdc46b` (intent: `resume/format.intent`).
- Formatting `interaction/keyboard.ts`: `0ccd53f6fac99e565fa839c559e19ec09c187df2` -> `9317f13a81e863c991bf9b1d6cfd83e8a832b869` (intent: `resume/format.intent`).
- Formatting `table-sheet-wiring.test.ts`: `ce0fa6c4895059d1306bc096e455d6da49cc3983` -> `f558061c764d9626bbafb14b0aaa625f7c239c25` (intent: `resume/format.intent`).
- Formatting `packages/core/src/shape-catalogue.test.ts`: `80b1d95c1e859c1bff41b5c7a5736704e6ec7969` -> `5cc16353b0d61005d9818f372d961a641f62d3e3` (intent: `resume/core-format.intent`).
- Formatting `packages/core/src/table-sheet-export.test.ts`: `05d5ded349fdcbde7c6a4209dc301f9a62bc375e` -> `ac745c67f5bbe52eade12c8098b128eb44595cca` (intent: `resume/core-format.intent`).
- Formatting `packages/ui-solid/src/interaction/keyboard.ts`: `bb773317d3a90160b527d7cb5ab6a2e202ccb025` -> `d374ca5e62c485633ab7fc8eef03c058d64391d8` (intent: `resume/keyboard-format.intent`).

### Verification

- Core 67, UI 68, CLI 27 passed; typecheck, lint, aggregate test, CLI test, CLI build and desktop build exited 0. Logs: `tmp/tsh-s780/tsh-08-wiring/resume/`. CLI attempt 1: Bun 448 passed, 0 failed; Rust groups 2, 4 and 14 passed, 0 ignored.
- Earlier lint failure identified formatting in owned core tests; earlier aggregate failure identified CLI overview line count. Both were repaired; logs retained in `resume/lint.log` and `resume/test.log`.
- ERD guard and schema diff empty; schema hashes before and after build match. Schema hash lists:
  - `apps/desktop/src-tauri/gen/schemas/acl-manifests.json`: `f2f210aeb2a9a6f28fe06b54a955059295ceaeda` before and after.
  - `apps/desktop/src-tauri/gen/schemas/capabilities.json`: `1a8de95753f0b43ffcbea6442544e0444d2b97e1` before and after.
  - `apps/desktop/src-tauri/gen/schemas/desktop-schema.json`: `24c90014ed68021de21e9f8dd5da66e448fe87d5` before and after.
  - `apps/desktop/src-tauri/gen/schemas/macOS-schema.json`: `24c90014ed68021de21e9f8dd5da66e448fe87d5` before and after.

- Formal reviews and finalization remain downstream. No serial repair request is currently asserted.

- `CARGO_TERM_QUIET=true mise run verify` exited 0 after the design-status update; complete log: `tmp/tsh-s780/tsh-08-wiring/resume/verify.log`.

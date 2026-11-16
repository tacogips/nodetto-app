# dps-03-model implementation progress

Implementation complete; formal review and downstream registry wiring remain pending. Verification ran on the moving shared tree.

| File | Pre-edit SHA-256 | Final SHA-256 |
| --- | --- | --- |
| `packages/ir/src/semantics/document.ts` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | `d39d6b165eeef5138ff50ba472a04c1e8e40e677ba069e08619a4f30680152b1` |
| `packages/ir/src/registry/document.ts` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | `d598825dc4de05a4bcbe23276bde3931d23d15a7c189be34f42fdf99ad268323` |
| `packages/ir/src/semantics/design.ts` | `677d7e29b59fef9eb42d1bd6189e3381ac788ef9c2942b41ed9f3eca198e7294` | `a3b373ab63c203191a4038087811060a597da854d5993dadffa94311813de8e2` |
| `packages/ir/src/semantics.ts` | `84fe38c804af9078d6cf1ec18ef469e3248f9f0728d1f536c85095bad2db437f` | `391249ab687042de34864286a0aa5e90d7e4b759ac9c8baacdc038ecf51c6159` |
| `packages/ir/src/index.ts` | `905243999004d6a4df6f5166c0c5706be05549798acb75eb29f7e99a8ad974df` | `567156df35d6a5a1267614daa158bbe49d77ef1d19708358e88a1b10dad9d78b` |
| `packages/ir/src/registry/containers.ts` | `559d8a469c386e5c3056c5fa3d6e977d6249e8b290fe50b07229c283a7e372d2` | `7d517447f08ca270c2c563719a4251ae37f8cb0500d47addd2abf329878dc95c` |
| `packages/ir/src/types.ts` | `9f61ab1787684c2354834a008fbf2d8d5a118e3dacef684164a77e9b9d5a0788` | `504a44518ef2198243fecff3ba0f208b10116668846a11b05610df2073489fd8` |
| `packages/ir/src/validate.ts` | `72f0ec022b4c2b6e475e254f0229ac5d025fbd0053e70981bc6e1f9098115311` | `7ee1d849ca52d323a46dd4a99e29bbb413c00a976c19661060b29a583a2ff942` |
| `packages/io/src/jsonl/records.ts` | `4af23fef0558645c1fa1729ebe1b5922fc60b75565fdf7d5ffeb99abe40bb24d` | `93ec4207d3c6129fa32a505bb74cbd6492ff35b31df94bef541ba7aa9cd3ffb2` |
| `packages/io/src/jsonl/parse.ts` | `00faadd581325996e7c798b181fe99858f03c849cf77e51245023a7f84df3599` | `40ae1bbd74b880ef9ae67b9005852c3d2658021ebe28455c10fb32a086d55c7c` |
| `packages/collab/src/ydoc.ts` | `86842c7bb03cd6bebdd8575ead7d619ff8ef6a6affa9a8b74f9d6bcd44527d48` | `5b2d61c66f81fd1a55b2a32b3f9e182ad885c7a1f5669c549a4c33b023e99e9d` |
| `packages/core/src/commands.ts` | `0711857ba525852b024c314002b19f4a83fce81a690ffb25e6ba7527815ba802` | `92cfa73c6f680f67030608431bb63e8370ea0904713ce8cbbd788f5f206b4611` |
| `packages/core/src/editor/pages.ts` | `cf7ddfc7af13fcf9df747ce0c8c869fb9b222e2b3ef72f61e2c105d2349d190e` | `786fb4a7acd7152124b3ed141922bd7d4710d2f702a617d4047c282bb12aef31` |
| `packages/ir/src/registry/document.test.ts` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | `ff87b25e35ad71a35d87c2aec1c2a7cabba58973f99044c2ae16a36d6d3828bd` |
| `packages/ir/src/page-flow.test.ts` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | `8c554d450c7119387ce7f1127eeb24389a74b0c2853e99e6c5bb9b90d85fa5e7` |
| `packages/io/src/jsonl/page-flow.test.ts` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | `04d2f465ba8db4f06c7eb7024f80f76516fbec20f4beda6856a34819ad8c7d9c` |
| `packages/collab/src/page-flow.test.ts` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | `a6ec844bdba8fd6532b52dd93178b6917a770956d35eaa783e6ea0d00ff368ec` |
| `packages/core/src/page-flow-commands.test.ts` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | `190cbd35ce1a370efc9f05499dab7c95b2d59a9207f66d5d935945a084fc6554` |

Per-edit fresh content, intent and pre/post hashes are recorded in `tmp/dps-s861/dps-03-model/edit-*.json`.

- Behavioral suite: exit 0, 491 passed, 0 failed; `tmp/dps-s861/dps-03-model/tests-final-2.log`.
- `bun run typecheck`: exit 0; `tmp/dps-s861/dps-03-model/typecheck-final-2.log`.
- Assigned Biome check: exit 0; `tmp/dps-s861/dps-03-model/biome-final-2.log`.
- Earlier typecheck failures in concurrent document-export files resolved before final rerun; prior logs retained.

Registry registration, independent review, final integration verification and Git finalization are owned by downstream steps.

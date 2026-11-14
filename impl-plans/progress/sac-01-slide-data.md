# sac-01-slide-data progress

- Mode: issue-resolution; issue: none (session 826 runtime input).
- Accepted design: design-docs/specs/design-slide-area-copy-shapes.md sections 2.1–2.3, 3.1–3.2; no dependencies.
- Plan intent git hash: `a93c2131cd4945b2269a374b27ab87a9191e4396`.
- Implemented optional slide metadata, validation, canonical JSONL, store persistence, and undoable commands. Exactly one new core command kind: `updateDocument`; private nodetto-cloud sync Worker requires a matching switch case.
- Current-source verification on moving shared tree: IR 2 passed; JSONL 159 passed; core 20 passed; typecheck, owned-file Biome, diff check and command-kind grep all exited 0. Complete logs and exit files are in `tmp/sac-s826/sac-01-slide-data/final/`. Earlier Biome exit 1 (nonfinite value naming) was fixed; log `tmp/sac-s826/sac-01-slide-data/biome-initial.log`.
- Formal review, stable integration verification, and workflow finalization are downstream.

## Per-edit SHA-256 evidence

- 001-types.ts.json: `packages/ir/src/types.ts` before `71470cb004f61801a21ed3d05b0bff2f61d2f8f4cfa562eefa8f69b250801a4d` after `2c735ad852e272cbd25a9328470ea6262a1baf1b8569203537d2792d982e0dc4`
- 002-index.ts.json: `packages/ir/src/index.ts` before `61d3764883ebc69f4b4bb5c361116e914e0662b778280c79b40d8bf1dc616f25` after `6576bb0b5dbc974861d8600a24d886a99e714b5470c6bb8d8c57e00bf1c8f89f`
- 003-validate.ts.json: `packages/ir/src/validate.ts` before `4c2c7d79294be1c0fa44d5993d4f5f600d6437da2cddd331d5334c8e99414c4e` after `ec8dffe63661f6d7c11bdb6d278e48cc35dba1340b232d908efb006f46a59a0a`
- 004-records.ts.json: `packages/io/src/jsonl/records.ts` before `df876434c4ab2300351c46de55b19ac15e24fcc9421fce941ee7e7d704cf8f46` after `ee379622ea8aaf9be4e3c96f19b05366464660223898f38c2f7f038da6c21828`
- 005-parse.ts.json: `packages/io/src/jsonl/parse.ts` before `4c6c679b32bfe08a2cc1b04e57fc23658d99e06ec59e35ca800b29b9a09492b9` after `4433e0ad2465956eb6aa47152933b5686a8e99c611609732ec57bb9b366b5235`
- 006-store.ts.json: `packages/core/src/store.ts` before `fff32e51e065b0e1ee3aab6e34005d8a3deef2348cfcb7910e34892df33a7e61` after `99c25b728ed1020b27d61e0e4f4072fb8f2f9283c8c892c8df2eff763582c5c7`
- 007-dirty-pages.ts.json: `packages/core/src/editor/dirty-pages.ts` before `43fd733f8ac564bce4df19eb1bc7b48bfc933fac04ff689a11874ea6d89883c8` after `8d55c7493512ce7afb6a481d613e010e9cd3b826f0c356a930ad331434f37492`
- 008-commands.ts.json: `packages/core/src/commands.ts` before `69b80b9610792513128febd7c52c5e7c00fb0af78fb362303b043660ced39372` after `6d5bcec7e886aee050a00d3d150ab9752a811ff6bf09ad81dc16cf531dc073c6`
- 009-slide-area.test.ts.json: `packages/ir/src/slide-area.test.ts` before `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` after `2c7816cd050d531ce6dd7e9bd5fe825b488ef64643cbc1fb84860223b8faa7b2`
- 010-slide-area.test.ts.json: `packages/io/src/jsonl/slide-area.test.ts` before `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` after `25055d17adc690f5f41ae29c65310a8731b2b8c2ed4c0d8c7cdb25ef3a975daf`
- 011-slide-area-commands.test.ts.json: `packages/core/src/slide-area-commands.test.ts` before `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` after `af14d6655c65966ed48a414825edfc6fe46c7a3997cbe3dbf3700553b05f640b`
- 023-slide-area.test.ts.json: `packages/ir/src/slide-area.test.ts` before `20eee80449fe7619616335c2bfd768e82345d66771540b9d77a596f272ced724` after `fc6b0f50d001029c66ef174bb65b865d4111d4f16ac5446785a494bbb56e2ca2`
- 024-slide-area-commands.test.ts.json: `packages/core/src/slide-area-commands.test.ts` before `9e945b1bf1f55678fe9f3f1eab477f43bc4b5d2fa26838ccac3da073b31d1793` after `41a334a15cc65a66926972adc55dd62b56d2741c2b3a8c4b7f1dd68b952527bc`
- 100-types.ts.json: `packages/ir/src/types.ts` before `2c735ad852e272cbd25a9328470ea6262a1baf1b8569203537d2792d982e0dc4` after `2c735ad852e272cbd25a9328470ea6262a1baf1b8569203537d2792d982e0dc4`
- 101-validate.ts.json: `packages/ir/src/validate.ts` before `ec8dffe63661f6d7c11bdb6d278e48cc35dba1340b232d908efb006f46a59a0a` after `136ac6dae889b397e0da0651a69fd0a673236a90dd505931a2cb07ad4b87ed0b`
- 102-index.ts.json: `packages/ir/src/index.ts` before `6576bb0b5dbc974861d8600a24d886a99e714b5470c6bb8d8c57e00bf1c8f89f` after `6576bb0b5dbc974861d8600a24d886a99e714b5470c6bb8d8c57e00bf1c8f89f`
- 103-slide-area.test.ts.json: `packages/ir/src/slide-area.test.ts` before `2c7816cd050d531ce6dd7e9bd5fe825b488ef64643cbc1fb84860223b8faa7b2` after `20eee80449fe7619616335c2bfd768e82345d66771540b9d77a596f272ced724`
- 104-records.ts.json: `packages/io/src/jsonl/records.ts` before `ee379622ea8aaf9be4e3c96f19b05366464660223898f38c2f7f038da6c21828` after `4af23fef0558645c1fa1729ebe1b5922fc60b75565fdf7d5ffeb99abe40bb24d`
- 105-parse.ts.json: `packages/io/src/jsonl/parse.ts` before `4433e0ad2465956eb6aa47152933b5686a8e99c611609732ec57bb9b366b5235` after `00faadd581325996e7c798b181fe99858f03c849cf77e51245023a7f84df3599`
- 106-slide-area.test.ts.json: `packages/io/src/jsonl/slide-area.test.ts` before `25055d17adc690f5f41ae29c65310a8731b2b8c2ed4c0d8c7cdb25ef3a975daf` after `5f2cd0ec5443a1e6e296b6493c25f103b383f937a33b5e7d717ac42750fd3f5d`
- 107-store.ts.json: `packages/core/src/store.ts` before `99c25b728ed1020b27d61e0e4f4072fb8f2f9283c8c892c8df2eff763582c5c7` after `7e21b557f26b0434c4eb3f342a2dbd0d5252213102504015a523dfce2e2cc180`
- 108-commands.ts.json: `packages/core/src/commands.ts` before `6d5bcec7e886aee050a00d3d150ab9752a811ff6bf09ad81dc16cf531dc073c6` after `28d5e5de7a13496dbc3e4eb800878589e0368222b63a46ab28cba9e91de2c7ce`
- 109-dirty-pages.ts.json: `packages/core/src/editor/dirty-pages.ts` before `8d55c7493512ce7afb6a481d613e010e9cd3b826f0c356a930ad331434f37492` after `8d55c7493512ce7afb6a481d613e010e9cd3b826f0c356a930ad331434f37492`
- 110-slide-area-commands.test.ts.json: `packages/core/src/slide-area-commands.test.ts` before `af14d6655c65966ed48a414825edfc6fe46c7a3997cbe3dbf3700553b05f640b` after `9e945b1bf1f55678fe9f3f1eab477f43bc4b5d2fa26838ccac3da073b31d1793`
- 120-slide-area.test.ts.json: `packages/ir/src/slide-area.test.ts` before `fc6b0f50d001029c66ef174bb65b865d4111d4f16ac5446785a494bbb56e2ca2` after `0a7b3d8ed7f34b3a91ac858b1f0ecc6f81dc60a4eae6933cff68975180725a85`
- 121-slide-area-commands.test.ts.json: `packages/core/src/slide-area-commands.test.ts` before `41a334a15cc65a66926972adc55dd62b56d2741c2b3a8c4b7f1dd68b952527bc` after `44ad77fef742b9f3c8250fd1400092b0c7436f285a870b88bc415c039b1155f3`

## Subsequent edits

- 027-sac-01-slide-data.md.json: `impl-plans/progress/sac-01-slide-data.md` before `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` after `39cdb447cfb9237e00c656fb775998c8abefbe14098de9ec125bb8827836784d`
- 028-sac-01-slide-data.md.json: `impl-plans/active/sac-01-slide-data.md` before `841a3958d7cc41c141e3735311271a21cb42cc62843c5350fad07ba34c9f5887` after `5550150d349f4c9f01b8e42ab1c6908cab4dd3259997abc9c596e5e03a02aada`
- 029-slide-area-commands.test.ts.json: `packages/core/src/slide-area-commands.test.ts` before `44ad77fef742b9f3c8250fd1400092b0c7436f285a870b88bc415c039b1155f3` after `2ede453e59b0a598a8619f03bd95dd12951a8e3b3bbdd22ebc9c8caf1ac0aca4`
- 100-types.ts.json: `packages/ir/src/types.ts` before `2c735ad852e272cbd25a9328470ea6262a1baf1b8569203537d2792d982e0dc4` after `2c735ad852e272cbd25a9328470ea6262a1baf1b8569203537d2792d982e0dc4`
- 101-validate.ts.json: `packages/ir/src/validate.ts` before `ec8dffe63661f6d7c11bdb6d278e48cc35dba1340b232d908efb006f46a59a0a` after `136ac6dae889b397e0da0651a69fd0a673236a90dd505931a2cb07ad4b87ed0b`
- 102-index.ts.json: `packages/ir/src/index.ts` before `6576bb0b5dbc974861d8600a24d886a99e714b5470c6bb8d8c57e00bf1c8f89f` after `6576bb0b5dbc974861d8600a24d886a99e714b5470c6bb8d8c57e00bf1c8f89f`
- 103-slide-area.test.ts.json: `packages/ir/src/slide-area.test.ts` before `2c7816cd050d531ce6dd7e9bd5fe825b488ef64643cbc1fb84860223b8faa7b2` after `20eee80449fe7619616335c2bfd768e82345d66771540b9d77a596f272ced724`
- 104-records.ts.json: `packages/io/src/jsonl/records.ts` before `ee379622ea8aaf9be4e3c96f19b05366464660223898f38c2f7f038da6c21828` after `4af23fef0558645c1fa1729ebe1b5922fc60b75565fdf7d5ffeb99abe40bb24d`
- 105-parse.ts.json: `packages/io/src/jsonl/parse.ts` before `4433e0ad2465956eb6aa47152933b5686a8e99c611609732ec57bb9b366b5235` after `00faadd581325996e7c798b181fe99858f03c849cf77e51245023a7f84df3599`
- 106-slide-area.test.ts.json: `packages/io/src/jsonl/slide-area.test.ts` before `25055d17adc690f5f41ae29c65310a8731b2b8c2ed4c0d8c7cdb25ef3a975daf` after `5f2cd0ec5443a1e6e296b6493c25f103b383f937a33b5e7d717ac42750fd3f5d`
- 107-store.ts.json: `packages/core/src/store.ts` before `99c25b728ed1020b27d61e0e4f4072fb8f2f9283c8c892c8df2eff763582c5c7` after `7e21b557f26b0434c4eb3f342a2dbd0d5252213102504015a523dfce2e2cc180`
- 108-commands.ts.json: `packages/core/src/commands.ts` before `6d5bcec7e886aee050a00d3d150ab9752a811ff6bf09ad81dc16cf531dc073c6` after `28d5e5de7a13496dbc3e4eb800878589e0368222b63a46ab28cba9e91de2c7ce`
- 109-dirty-pages.ts.json: `packages/core/src/editor/dirty-pages.ts` before `8d55c7493512ce7afb6a481d613e010e9cd3b826f0c356a930ad331434f37492` after `8d55c7493512ce7afb6a481d613e010e9cd3b826f0c356a930ad331434f37492`
- 110-slide-area-commands.test.ts.json: `packages/core/src/slide-area-commands.test.ts` before `af14d6655c65966ed48a414825edfc6fe46c7a3997cbe3dbf3700553b05f640b` after `9e945b1bf1f55678fe9f3f1eab477f43bc4b5d2fa26838ccac3da073b31d1793`
- 120-slide-area.test.ts.json: `packages/ir/src/slide-area.test.ts` before `fc6b0f50d001029c66ef174bb65b865d4111d4f16ac5446785a494bbb56e2ca2` after `0a7b3d8ed7f34b3a91ac858b1f0ecc6f81dc60a4eae6933cff68975180725a85`
- 121-slide-area-commands.test.ts.json: `packages/core/src/slide-area-commands.test.ts` before `41a334a15cc65a66926972adc55dd62b56d2741c2b3a8c4b7f1dd68b952527bc` after `44ad77fef742b9f3c8250fd1400092b0c7436f285a870b88bc415c039b1155f3`

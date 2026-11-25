# car4-f4-swept-extents progress

Status: done (implementation); formal review and integration pending.

Per-loop extrema are cached by points and frame and used by validation and swept bounds. The projection counts are 1000 for one and 1000 extrusions. The old-formula oracle, extent boundary, entity failure precedence and capture determinism tests pass.

Pre-implementation regression: `bun test packages/core/src/cad/check.test.ts` exited 1 because cadBoundsWork was absent; log: `tmp/car4-r4/car4-f4-swept-extents/prefix-test.log`. Earlier focused run had invalid fixture distances and a timing failure under load; log: `tmp/car4-r4/car4-f4-swept-extents/focused-initial.log`. Fixture corrected and timing gate passed on final run.

Final gate: `bunx biome check --diagnostic-level=warn packages/core/src/cad/bounds.ts packages/core/src/cad/history.ts packages/core/src/cad/check.test.ts packages/core/src/cad/history.test.ts && bun test packages/core/src/cad/check.test.ts packages/core/src/cad/history.test.ts packages/core/src/capture/determinism.test.ts` exited 0, 33 tests passed, 0 failed. Log: `tmp/car4-r4/car4-f4-swept-extents/final-gate.log`. Workspace typecheck and integration gates are scheduled at integration.

Per-edit intentions and hashes are preserved under the evidence directory; recorded edits follow.

```
Pre-sha256 99a95c0330375e1a51cc9a27914131136c46d90850e2f19ed87f76659c8a1836
Intent: add deterministic shared-outline projection counter regression and old swept-bounds oracle cases.
Post-sha256 d60b5b3ee63b83867f7cb03f364f9fc41b143f1f6f1ba013e9a859388bc668a2

Pre-sha256 a00c138ce07820b5d6d8cf8c39e5c49ee8dcdaddc67887aea4a19a33d3d58239
Intent: Memoize exact per-loop projections per frame; reuse in swept bounds.
Post-sha256 8f371b3bec00c49978605c99926fb96950cf84bed89c5cb801e62518ca396698

Pre-sha256 6ad06ed3cbb5656e978491ffbdbec15a5b0378cb1c17d3b9f63015f413064223
Intent: Use loop extrema for endpoint extent validation preserving failure point.
Post-sha256 a92ffe6cfad636863432d2b2459675374fb27810fd9a7f450cd2a59cec7d8855

Pre-sha256 d60b5b3ee63b83867f7cb03f364f9fc41b143f1f6f1ba013e9a859388bc668a2
Intent: round generated polygon coordinates to valid CAD precision.
Post-sha256 695489ac65538fa80c448222bddc2eb6ca4bd6c46304aba7520276c91ae55cda

Pre-sha256 b2ddaa2e0aee90f50a1edafbff51ee32d03eea3bbba8c9ab4c7c5f538f8c224e
Intent: assert extent tolerance and entity failure precedence through geometry.
Post-sha256 bcd6151d41e66941f04a369d2dce076c96c357459024062e184973f1c423d25a

Pre-sha256 695489ac65538fa80c448222bddc2eb6ca4bd6c46304aba7520276c91ae55cda
Intent: use distinct valid integer extrusion distances.
Post-sha256 d3d453e1c0988c6f20722259755d07e1ed272610f55c5bdca900a3ca9a680a71

Intent: format only the four assigned TypeScript files with Biome.
Pre-sha256 packages/core/src/cad/bounds.ts 8f371b3bec00c49978605c99926fb96950cf84bed89c5cb801e62518ca396698
Pre-sha256 packages/core/src/cad/history.ts a92ffe6cfad636863432d2b2459675374fb27810fd9a7f450cd2a59cec7d8855
Pre-sha256 packages/core/src/cad/check.test.ts d3d453e1c0988c6f20722259755d07e1ed272610f55c5bdca900a3ca9a680a71
Pre-sha256 packages/core/src/cad/history.test.ts bcd6151d41e66941f04a369d2dce076c96c357459024062e184973f1c423d25a
ccdbe59c9804508cf0289894d28e7710e7c9324fb9e293b921f2822387d420ce  packages/core/src/cad/bounds.ts
62762d6044724ac4ab5e0a97c46da5562480614c331b8e07ca75bb29a5c3333e  packages/core/src/cad/history.ts
05fa64329cb322666928b17eb81384cc20fcb0a4371de1714407385d22d8dffc  packages/core/src/cad/check.test.ts
b5dbbab8d1c64f4f0ce0927b696319d4bba32d5d9e24a83ecab2e8fb1261fef0  packages/core/src/cad/history.test.ts

Intent: use Number namespace for infinity per Biome.
Pre-sha256 packages/core/src/cad/bounds.ts ccdbe59c9804508cf0289894d28e7710e7c9324fb9e293b921f2822387d420ce
Post-sha256 packages/core/src/cad/bounds.ts c4eb57c0da31d16e323928d77ac158d512941cac9bc5765464cfe11674474356
Pre-sha256 packages/core/src/cad/check.test.ts 05fa64329cb322666928b17eb81384cc20fcb0a4371de1714407385d22d8dffc
Post-sha256 packages/core/src/cad/check.test.ts f0727320713d08386ab43dacdd18934c2c3816ef1574f068ed30fc5ef8ea1ac7

Pre-sha256 f0727320713d08386ab43dacdd18934c2c3816ef1574f068ed30fc5ef8ea1ac7
Intent: record measured projection counts in test log.
Post-sha256 15f77c31ac832906a0bf8d2a40f619c7ab644096d03fef33fcf4ce65f7560192

```

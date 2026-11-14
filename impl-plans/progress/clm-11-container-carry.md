
- `apps/cli/src/edit/carry-members.ts`: Implement E1 container validation and held-member selection; pre `e69de29bb2d1d6434b8b29ae775ad8c2e48c5391`, post `52252d9869b8c15a2f17379ad1a59530094cffb3`.

- `apps/cli/src/edit/operations/elements.ts`: Replace frame-only placed handling with heldMembers and keepMembers; pre `3dc97aa5c8dfc3fd959b413e17316e923d1a67c8`, post `7d36a1da871e801a45e340ffa2dc885d6372d337`.

- `apps/cli/src/edit-frame-carry.test.ts`: Update non-container error expectation to E1 message; pre `5b12784299a9755e349759fefcc661c8dadca13d`, post `1517ab37e2d751c2c2b77f4f2597aefb0f81e7af`.

- `apps/cli/src/edit/carry-members.test.ts`: Cover E1 container move, resize, errors, batch placement, and BPMN membership; pre `e69de29bb2d1d6434b8b29ae775ad8c2e48c5391`, post `9636213b4920aaa389028f43bfafe8c176d6e9eb`.

- `apps/cli/src/edit/carry-members.test.ts`: Fix lane message test string quoting; pre `9636213b4920aaa389028f43bfafe8c176d6e9eb`, post `40dc1bf54a83f18aca57309b2a45f60a02b9d934`.

- `apps/cli/src/edit/carry-members.test.ts`: Correct valid fixtures and add boundary attachment and per-match selector tests; pre `40dc1bf54a83f18aca57309b2a45f60a02b9d934`, post `a5e0b33129de1fcfe51aea97964907d0305730ee`.

- Format exact file `apps/cli/src/edit/carry-members.ts`; pre `52252d9869b8c15a2f17379ad1a59530094cffb3`
- Format exact file `apps/cli/src/edit/carry-members.test.ts`; pre `a5e0b33129de1fcfe51aea97964907d0305730ee`
- Format exact file `apps/cli/src/edit/operations/elements.ts`; pre `7d36a1da871e801a45e340ffa2dc885d6372d337`
- Format exact file `apps/cli/src/edit-frame-carry.test.ts`; pre `1517ab37e2d751c2c2b77f4f2597aefb0f81e7af`
- Format post `apps/cli/src/edit/carry-members.ts`: `f1e8b68c10a078d0eb824ccfaea9408cccb62bb0`.

- Format post `apps/cli/src/edit/carry-members.test.ts`: `79a5b71a4dd8959a41e7ccf5655cb94fb7fe6f0b`.

- Format post `apps/cli/src/edit/operations/elements.ts`: `fbf7bc6901e7f3f058c03555b501828699be94f7`.

- Format post `apps/cli/src/edit-frame-carry.test.ts`: `8b82c8ae7312516096127e41b8dd60ef95987a5e`.

- Repair S737-W1-CLM11-INCOMPLETE: add CLI failure and atomicity tests; `apps/cli/src/edit/carry-members.test.ts` pre `79a5b71a4dd8959a41e7ccf5655cb94fb7fe6f0b`; intention `tmp/clm-s737/clm-11-container-carry/repair-intent-01.txt`.
- Repair tests post initial edit `fb97b4e72589b96550b1ce9d5f5d09d639fbb82a`; next add default frame resize coverage and format this exact file; pre `fb97b4e72589b96550b1ce9d5f5d09d639fbb82a`.
- Default frame resize test post `68a42cafc4c84ea614058be48ab12c2af494435c`; exact-file format pre `68a42cafc4c84ea614058be48ab12c2af494435c`, post `fc44699d627490cdf63f6c0a6432e67bcde04c58`.
- Final verification on current shared tree: manifest commands 1-7 all exit 0; CLI 44 pass, core 64 pass, 0 fail; typecheck, Biome, both grep checks and plan diff pass. Complete logs and exact commands: `tmp/clm-s737/clm-11-container-carry/final-repair-results.json`, `final-repair-1.log` through `final-repair-7.log` in that directory.
- Final hashes: `apps/cli/src/edit/carry-members.ts` `f1e8b68c10a078d0eb824ccfaea9408cccb62bb0`; `apps/cli/src/edit/carry-members.test.ts` `fc44699d627490cdf63f6c0a6432e67bcde04c58`; `apps/cli/src/edit/operations/elements.ts` `fbf7bc6901e7f3f058c03555b501828699be94f7`; `apps/cli/src/edit-frame-carry.test.ts` `8b82c8ae7312516096127e41b8dd60ef95987a5e`.
- Implementation criteria complete. Independent test-integrity and adversarial decisions remain for subsequent review steps; clm-09 owns registration and documentation.

- Review repair S737-CLM11-POOL-SHRINK-LANES: add regression coverage; test pre `fc44699d627490cdf63f6c0a6432e67bcde04c58`, source pre `f1e8b68c10a078d0eb824ccfaea9408cccb62bb0`; intentions in `tmp/clm-s737/clm-11-container-carry/pool-shrink-intent-test.txt`.
- Regression test post `dd0cb55334d8ac2bae55902f67fb080a30f4f2f0`; reproduction `pool-shrink-reproduction.log` observed exit 1, expected 2 but got 0. Source guard pre `f1e8b68c10a078d0eb824ccfaea9408cccb62bb0`; intention `pool-shrink-intent-source.txt` in the plan evidence directory.
- Guard post and pre-format `2acf65f15c9933af4506d93e02e9fd7fb9039f5f`; nested regression test pre `dd0cb55334d8ac2bae55902f67fb080a30f4f2f0`. See `pool-shrink-intent-nested.txt`.
- Initial guard post `2acf65f15c9933af4506d93e02e9fd7fb9039f5f`; nested test post `bcbe58b29d17aa049765c0bb7abeacd18dc575c0`; exact-file formatting produced source `da90a02dbbf462f4b56ee2e166bd6d564968d388` and test `f9d2c12fd0c0a8c8e7dc813bc0b7a4a2d8f38f58`. Focused run `pool-shrink-focused.log` exposed that nested children do not restack in the same planner pass; correcting the guard to preserve their occupied height.
- Nested guard adjustment pre source `da90a02dbbf462f4b56ee2e166bd6d564968d388`, post `1edd78ddf63c66302e2bc5cd1c7cc4bdc135212b`; test pre `f9d2c12fd0c0a8c8e7dc813bc0b7a4a2d8f38f58`, post `ccda6de1b6af6af05827b91932ec0c4f6511692e`; final exact-file format left both hashes unchanged. Nested children retain their current occupied heights because the planner does not restack them during their parent's update.
- This introduces clear lane-fit errors in addition to the fixed E1 messages, authorized by the owner's E1 invariant-or-clear-error clause. clm-09 help should describe these errors.
- Final current shared-tree verification: all seven manifest commands and `git diff --quiet HEAD -- packages/core` exit 0; CLI 47 pass, core 64 pass, zero failures. Complete commands and logs: `tmp/clm-s737/clm-11-container-carry/pool-shrink-final-results.json` and `pool-shrink-final-1.log` through `pool-shrink-final-8.log`.
- Final hashes: `carry-members.ts` `1edd78ddf63c66302e2bc5cd1c7cc4bdc135212b`; `carry-members.test.ts` `ccda6de1b6af6af05827b91932ec0c4f6511692e`; `operations/elements.ts` `fbf7bc6901e7f3f058c03555b501828699be94f7`; `edit-frame-carry.test.ts` `8b82c8ae7312516096127e41b8dd60ef95987a5e`. Independent review of this revision is pending.

- Review repair S737-CLM11-NESTED-LANE-WIDTH: source pre `1edd78ddf63c66302e2bc5cd1c7cc4bdc135212b`, tests pre `ccda6de1b6af6af05827b91932ec0c4f6511692e`; intent `tmp/clm-s737/clm-11-container-carry/nested-width-intent-tests.txt`.
- Nested-width test edit post `65d065d68989c7386d423930dca4906d252209a0`; reproduction `nested-width-reproduction.log` exit 1 (expected 2, received 0). Source guard intent `nested-width-intent-source.txt` in the evidence directory.
- Nested-width guard post `fb22652ef2d791a691e9a941bc0d909afba9d179`, test post `65d065d68989c7386d423930dca4906d252209a0`; exact-file formatting post source `104aa8c03f7904a81d1a6192d59006bd0ad20950`, test `ef3bc4596b7c1c44ae58e369f535fd49bc9a52cf`. CLI failure reproduction and focused passing results are in `nested-width-reproduction.log` and `nested-width-focused.log` in the plan evidence directory.
- Final verification on the current shared tree: all seven manifest commands and `git diff --quiet HEAD -- packages/core` exit 0; CLI 50 pass, core 64 pass, zero failures. Exact commands and complete logs: `tmp/clm-s737/clm-11-container-carry/nested-width-final-results.json` and `nested-width-final-1.log` through `nested-width-final-8.log` in that directory.
- Final hashes: `apps/cli/src/edit/carry-members.ts` `104aa8c03f7904a81d1a6192d59006bd0ad20950`; `apps/cli/src/edit/carry-members.test.ts` `ef3bc4596b7c1c44ae58e369f535fd49bc9a52cf`; `apps/cli/src/edit/operations/elements.ts` `fbf7bc6901e7f3f058c03555b501828699be94f7`; `apps/cli/src/edit-frame-carry.test.ts` `8b82c8ae7312516096127e41b8dd60ef95987a5e`. Independent review of this revision is pending.

# fv-25-nmesh-varint progress

Dependency fv-18-nmesh-codec-model is accepted in the dispatch. The plan matches design section 6.3.

- Created `formal/Nodetto/Nmesh/Varint.lean`: absent -> b8fe2bafec5a5fc90cb801fc4a1aab6116dac089 -> c26ba58196f51fc759a386ff9c7a9640c937d174 -> e4748beca17046bc0f2cd0e8a3594b30fa4c1ad6. The general `writeVarint_bytes` proof uses strong induction.
- Appended the Varint import to `formal/Nodetto/Nmesh.lean`: 26a3dc683b5a218ef892420962b73199c5dfc1cc -> f80b14a995319af1f78104789b58364291240440, preserving the existing imports.
- Build passes: `tmp/fv-s942/fv-25-nmesh-varint/build-3.log`. Earlier compiler failures are retained in `build.log` and `build-2.log`.
- The required audit fails: `tmp/fv-s942/fv-25-nmesh-varint/audit.log`. It verifies the byte theorem but reports five missing declarations: `readVarint_writeVarint`, `readVarint_canonical`, `readVarint_truncated`, `unzigzag_zigzag`, and `zigzag_unzigzag`. No counterexample was established. Acceptance remains unchecked.
- Continue by proving the five remaining statements verbatim and rerunning both gates. Verification was performed on the shared working tree.

## Continuation 1

- `Varint.lean` e4748beca17046bc0f2cd0e8a3594b30fa4c1ad6 -> 9ef3b6a32547a768574260f794453e861d08ac90 -> 97daff123f7b3d63dc8d183f5abec31873ffc73f: proved both zigzag inverses with arithmetic case analysis and added the one-byte varint round-trip helper.
- `cd formal && mise exec -- lake build Nodetto.Nmesh` exited 0 (`tmp/fv-s942/fv-25-nmesh-varint/cont-build-2.log`).
- Six-name audit exited 1 (`tmp/fv-s942/fv-25-nmesh-varint/cont-audit.log`): three proofs pass with allowed axioms; `readVarint_writeVarint`, `readVarint_canonical`, and `readVarint_truncated` remain absent. Acceptance is unchecked. No counterexample has been established.
- Progress file before this append: 7f9cc033f94cf361ad81c863af56ce726db294e4. Verification uses the shared working tree.

## Continuation 2

- `Varint.lean` 97daff123f7b3d63dc8d183f5abec31873ffc73f -> de7ee39c4392a51a0f46ff1f4c1135098eb1797b -> 468f44ec19f5f5e50b6cad443db7f75c5b60e0c5 -> 8866a7e488690675cd1d2fe3cef47120fb3460ab -> 53eb15f976d90959230e6bda17858b43691a3136 -> a76719015141c47d78ac8c2390fb000da854ce66. Proved the two-byte round-trip case as a private helper, preserving the prior proofs.
- Build exited 0: `tmp/fv-s942/fv-25-nmesh-varint/cont2-build-final.log`. Failed intermediate proof attempts are in `cont2-build-1.log` through `cont2-build-4.log`.
- The full assigned audit exited 1: `tmp/fv-s942/fv-25-nmesh-varint/cont2-audit.log`. The three general varint theorem declarations remain absent; no counterexample was established. Acceptance remains unchecked.
- Progress before append: 6a955ed9712ba8898d9d057a5de5fd3bc02b8207. Build and audit ran on the shared working tree.

## Redispatch verification

- The assigned plan remains aligned with design section 6.3; fv-18 is accepted by dispatch. No source proof was changed in this invocation.
- Fresh shared-tree build exited 0 (`tmp/fv-s942/fv-25-nmesh-varint/redispatch-build.log`); the six-name audit exited 1 (`tmp/fv-s942/fv-25-nmesh-varint/redispatch-audit.log`), identifying the same three absent declarations. No counterexample was established. Acceptance remains unchecked.
- Progress before this append: 5dce26b25d0ab133d69f3deab99290b09c78c8ad.

## Continuation 3

- Added a kernel-checked three-byte round-trip helper in `Varint.lean`: a76719015141c47d78ac8c2390fb000da854ce66 -> 62ee1c679a336ed71b03f17cf9560cd557f5bcba -> 4226135d083b8fb31e74dc34fab9d363153c5014. The first attempt failed and was corrected; intentions and snapshots are under `tmp/fv-s942/fv-25-nmesh-varint/cont3-*`.
- Build exited 0 (`cont3-build-final.log`); the six-name audit exited 1 (`cont3-audit.log`): the general round-trip, canonicality and truncation declarations remain absent. Acceptance remains unchecked. No counterexample was established. Verification ran on the shared working tree.
- Progress before append: 338a2cae506a51c57c6c346dce1f8067752285d9.

## Continuation 4

- Added checked four- and five-byte helpers and the exact `readVarint_writeVarint` theorem. `Varint.lean` hashes: 4226135d083b8fb31e74dc34fab9d363153c5014 -> de89c94dbd2d38c04c5a9076ea9959cd89a1f051 -> edbc78be5e706543710c8b57192974f5070c782f -> 6fddbe982a0296f53dcfcd08ea341fbc00e8ed84. The intermediate fifth-byte guard failure is in `cont4-build-2.log`.
- `cont4-build-final.log` exited 0. `cont4-audit.log` exited 1: four of six statements pass; `readVarint_canonical` and `readVarint_truncated` remain absent. No counterexample was established. Acceptance remains unchecked; verification ran on the shared working tree.
- Progress before append: b8cb7df23320ceeb5caf472695aae5907d26a24b.

## Current verification

- Dependency fv-18 is accepted in dispatch; this plan matches design section 6.3. No proof source changed in this invocation. `Varint.lean` hash: 6fddbe982a0296f53dcfcd08ea341fbc00e8ed84.
- Shared-tree build exited 0 (`tmp/fv-s942/fv-25-nmesh-varint/current-build.log`). The six-name audit exited 1 (`tmp/fv-s942/fv-25-nmesh-varint/current-audit.log`): `readVarint_canonical` and `readVarint_truncated` remain absent. No counterexample was established; acceptance remains unmet.
- Progress before append: 356fc046d49592f2d012c6f29f5c61433ee08c0b.

## Continuation 5

- Added a generic decoder-prefix lemma and proved `readVarint_truncated` with the exact design signature by applying the existing round-trip theorem. `Varint.lean` hashes: 6fddbe982a0296f53dcfcd08ea341fbc00e8ed84 -> e10cb28961985121bb0ffd3e8fdd3f9a2b15da32 -> 9c4d9c1c8b6159749cbbc2ccef64e8a2185242f3 -> 0686b653c0d565d58c05c085921ab47488307ad3. Per-edit intentions and snapshots are in `tmp/fv-s942/fv-25-nmesh-varint/cont5-*`.
- Shared-tree build exited 0 (`cont5-build-3.log`); prior failed attempts are in `cont5-build-1.log` and `cont5-build-2.log`. The required audit exited 1 (`cont5-audit.log`): five of six theorems pass, and `readVarint_canonical` remains absent. No counterexample was established; acceptance remains unmet.
- Progress before append: 3ab5d637ceb87a84b734cd816ac0f756f5702b41.

## Continuation 6

- Added checked writer reconstruction and one- and two-byte canonicality lemmas. `Varint.lean` hashes: 0686b653c0d565d58c05c085921ab47488307ad3 -> cd32b455c08eeee3b4695517c37be2aa50537efb -> 7ff02d2c4dcd23b40063a7ab65f8773122977e0f -> 4cd7f905df8883bde45625260cab99b3a5308b64 -> 4aac6202e3bd0864cfc2c4ce653b35b3b1935c6b. Per-edit intentions and snapshots are under `tmp/fv-s942/fv-25-nmesh-varint/cont6-*`.
- Shared-tree build exited 0 (`cont6-build-4.log`); intermediate failure is retained in `cont6-build-3.log`. The required audit exited 1 (`cont6-audit.log`): `readVarint_canonical` remains absent and acceptance is unmet. No counterexample was established. The remaining proof must cover successful three- through five-byte decodes and assemble the exact theorem.
- Progress before append: 1ad1ecede4ad3cc0adc382bb419dd13177672f70.

## Redispatch 3

- The accepted dependency and design alignment remain confirmed. `Varint.lean` remains at 4aac6202e3bd0864cfc2c4ce653b35b3b1935c6b; no proof edit was made.
- Shared-tree build exited 0 (`redispatch3-build.log`); six-name audit exited 1 (`redispatch3-audit.log`) because `readVarint_canonical` is absent. Three- through five-byte canonicality and assembly remain required. No counterexample was established; acceptance remains unmet.
- Review findings at `formal/scripts/audit.ts:58` and `:320` remain unresolved and outside this plan's write paths. The audit owner must repair and verify them.
- Progress before this append: e696db4d3d66bb82c584eae5627a9f6600085864.

## Redispatch 4

- The accepted fv-18 dependency and design section 6.3 alignment were confirmed. `Varint.lean` remains at 4aac6202e3bd0864cfc2c4ce653b35b3b1935c6b; no proof change was made.
- Shared-tree build exited 0 (`redispatch4-build.log`); six-name audit exited 1 (`redispatch4-audit.log`), with `readVarint_canonical` still absent. Acceptance remains unmet; no counterexample was established.
- The two audit findings at `formal/scripts/audit.ts:58` and `:320` remain unresolved outside this plan's write scope. The audit owner must repair and verify them. Complete the canonicality proof and rerun both gates.
- Progress before append: 53f0d14a20564e27f4d2e46f163c1e3a080a7edb.

## Canonicality completion

- Added three-, four-, and five-byte reconstruction lemmas and the exact `readVarint_canonical` statement, by splitting the decoder cases and applying the existing writer lemma. Source hashes: 4aac6202e3bd0864cfc2c4ce653b35b3b1935c6b -> 066e1a762438f1babac28f6487afbb662def3b2e; intermediate snapshots, hashes and intentions are in `tmp/fv-s942/fv-25-nmesh-varint/session*`.
- Shared-tree `lake build Nodetto.Nmesh` exited 0 (`session-final-build.log`); the six-name audit exited 0 (`session-final-audit.log`). The intermediate fifth-byte guard failure is retained in `session-build-2.log` and resolved in `session-build-3.log`.
- Acceptance is satisfied for this plan. Formal review and integration remain downstream.
- Plan hash: 553aa44a6673754ca8afadea9346959514c6240b -> 6ed6c492830ff4718ac1d69cb01f5a7cc2a2bf6a. Progress hash before this session: f594a94832610ab86089ca9fdfc96918fcb20d47; after first append: 4b0eca77ab798123fa4394a75159dc41a1356116. The final progress hash is recorded in session-progress2-after.hash.

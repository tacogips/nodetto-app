# fv-36-merge-records progress

- Dependency fv-35-merge-value is accepted by dispatch.
- Read plan and design section 6.7. Records.lean and all five required theorems are absent; Merge.lean hash before and after inspection: d6778590e0906a55bbf201762a9bd3ea7f15d1ae.
- Progress log before creation: absent.
- Build passed: tmp/fv-s942/fv-36-merge-records/build.log.
- Audit failed: tmp/fv-s942/fv-36-merge-records/audit.log; all five theorem names are unknown.
- Remaining: prove the five verbatim statements, import Records, and rerun both gates. No counterexample established.

## Continuation 1

- Records.lean created from absent. Edit hashes: absent -> 11f5309dac5447af2e35d6884784e2d07d5482da -> b3db5572e5fc6346f70348f458ab2c4f2a394324 -> 0b91d9f3ea4e685278cdcff73ea1444aa410f69a -> dcea64e49527a57c36d7265492bad21086f9ab34 -> e172fc382cdea6df2ca7c7f0d8cc9928eb307c9f. Intent files records-intent-1.txt through records-intent-5.txt are in the evidence directory.
- Added verified helper lemmas for last-match lookup and fold decomposition, and a per-record branch decomposition awaiting its connection proof.
- Merge.lean changed d6778590e0906a55bbf201762a9bd3ea7f15d1ae -> 158953fbbfd185ddb4f8c1835c7b4cfc5dd7a0b5 by appending the Records import.
- Initial helper build failure is recorded in records-build-1.log; corrected builds are records-build-2.log through records-build-4.log. Current root build passes in build-continuation-2.log. The five-name audit still fails in audit-continuation-1.log because the required theorems remain absent.
- Acceptance criterion remains unmet. Complete the correspondence and per-id lemmas, prove all five statements verbatim, then rerun both required gates. No counterexample was established.
- Progress file before this edit: c732c691b706a3e39a64543b84072b1db3fbb27a; after-edit hash is recorded in progress-continuation-1.hash in the evidence directory.

## Continuation 2

- Records.lean edit hashes: e172fc382cdea6df2ca7c7f0d8cc9928eb307c9f -> 913d1512158911192671469031edcef8f41c6312 -> 08624ec1d7c77569aa7347bc34a03ded15ab3d46 -> a0ca72be23a68df1502be4f992875064056af22e -> 1b82493cec74280baa8518a476acb5a979d43a33 -> eb1c274f5b7fad160af5deda09250d640a752f1e -> 57bcc886ef277f2782fa29ea5105b9b813886015 -> 9d53f722994fa02bb672a6b5bae82c1eb231a865 -> 70a2be6e70b5e41f77d367f36fc85ee9ddc9d416 -> f79e9c96103b61be21087e9fd8d53f24a6d40370 -> 0c6332d094704bdf9ca6104ae8341709df7d0579. Intent records are records-intent-6.txt through records-intent-15.txt.
- Proved mergeById_parts connecting recordParts to the model, find_filterMap_keys, recordParts_same_change and the verbatim mergeById_same_change theorem. The root build passes in cont2-build-10.log; preceding trial errors are preserved in cont2-build-*.log.
- Five-name audit fails in cont2-audit.log because unchanged_ours, unchanged_theirs, symm and conflict_iff remain absent. Complete those four proofs and rerun both required gates. No counterexample established.

## Redispatch verification

- The accepted predecessor remains fv-35-merge-value. The assigned plan remains aligned with design section 6.7.
- Current Merge root build passed (build-redispatch.log). The five-name audit failed (audit-redispatch.log): unchanged_ours, unchanged_theirs, symm, and conflict_iff are still missing. The acceptance criterion remains unmet; no counterexample was established.
- The prior ZOrder audit finding is already corrected in the shared current tree by checkOpens in formal/scripts/audit.ts (hash 721a3fe0fed5c45e18909f356cafa42199cf4d17). The focused ZOrder audit passed (redispatch-zorder-audit.log); this plan did not edit that file.
- Progress before this append: 07740ba77423ffad0ed73fcf41ac2334cb8b8b3b. The resulting hash is recorded in redispatch-progress.hash.

## Redispatch continuation

- Added recordValue, recordParts_value, the two per-record unchanged lemmas, mergeById_find, and the verbatim mergeById_unchanged_ours and mergeById_unchanged_theirs theorems. Record comparisons retain semantic equality, including reordered object members.
- Records.lean edit hashes: 0c6332d094704bdf9ca6104ae8341709df7d0579 -> 2de88903bc5680e5a68e0fef2693acb3efa104fd -> 02555e1cd6d2e0920a7212c29afb634293baba55 -> 0e80421cecec7a7b893d6a41f86e7e11e417d0ae -> 5a0604f6767bd74783f99fc253390909219dd8ca -> 92ab9d1cb8ea387b3becf4fa90b08e061f5ccee6 -> f5ccc0475bc86d0f03941deaa3273a736ddb20a7 -> ab7f499158e93825dfbac03400695c30ae2df4f0 -> 15db74d4bb5f3ab308ce12fa99e14df58ac825f9 -> f5ccc0475bc86d0f03941deaa3273a736ddb20a7. Per-edit intent is in continuation-intent-1.txt through continuation-intent-9.txt. The unfinished conflict lemma was removed after failed trials; no existing work was removed.
- Root build passed (build-continuation-final.log). The five-name audit failed (audit-continuation-final.log): symm and conflict_iff remain absent. Three audited theorems use only the permitted axioms. No counterexample established. Trial build logs continuation-build-1.log through continuation-build-8.log preserve failed and successful attempts.
- Progress before this append: 238261c1526c4869c26df9f6e405ccc7d23b5018; resulting hash is in continuation-progress.hash. Acceptance remains unmet.

## Redispatch continuation 2

- Proved mergeById_conflict_iff and mergeById_symm with per-record conflict identity, lookup, and symmetry lemmas. All five theorem signatures match the accepted design through the audit statement check.
- Records.lean edit hashes: f5ccc0475bc86d0f03941deaa3273a736ddb20a7 -> 1cd101780268c761a6946f5089655f255611850b -> cf266e5d4ea2363adec0db911402afb896ade0cb -> 2408569f55d4492c6e24e7728066884404a22e99 -> 7a9358bf17306c46806be09c8f380c9e5cd95e5c -> f34edb7e16600f27e49a889f3a75fb6d4090cb82 -> 3e2d91220604688466ff70179f23aa7330bc8f78 -> 1241caf36ae2e5549fc91d814015880249eed7f7 -> 5082da894cb5ff2fb4aaaf7c50985ec845461c88 -> c273588a3379f8dc525580f6c8976cccbf4d1f70 -> d7b3c4398dc77fbc2334fd4971c466b82f63427c -> 11c7cb96b1e9bc16f03287d08d6dfafc6cd5a02c -> 45b5399d95e6149e71260c493c077dc987b5c143 -> 841005736868d974b9c4d6c59ca4f4ce20a213a4 -> 8866740cc6f3bff11f95d1cbb59fe84f892c8437 -> c3e7eee9ffd63b1470601c68723cfd739cfdfebc -> 45ba8d14c4c60dbf15f3c4d25d7b54efebd0b19d. Per-edit intentions are cont3-intent-1.txt through cont3-intent-16.txt.
- Current-source build passed (cont3-build-16.log), and five-name audit passed (cont3-audit-final.log). Earlier trial logs cont3-build-1.log through cont3-build-15.log are retained. The active plan acceptance checkbox changed from hash 1ed629f5b37967b90d2d22239008fbd72687038f to ec3dfbb2196cbb3e06cf54c2fb255ff6d287d0df. Formal independent review remains downstream.
- Progress before append: 52bafeb053b1640e1ebd89267f32f1a6529ed341; resulting hash is in cont3-progress.hash.

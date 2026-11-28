# fv-33-merge-canon progress

Status: incomplete. The model dependency fv-16 is accepted by dispatch. The plan agrees with design section 6.7.

Created `formal/Nodetto/Merge/Canon.lean` (absent before; final blob aaaf6eccf35ccd665c509d7d9df48a24115e640d), establishing `same_eq`, reflexivity, symmetry, transitivity, and the none characterization. Added its import to `formal/Nodetto/Merge.lean` (before d36904e0d68612e807869ade707b0ec4efd7e162; after 33e6f86a5b2a754cb820592cfc41ca0d0dfe2312). Per-edit intent and intermediate hashes are under `tmp/fv-s942/fv-33-merge-canon/intent-{1,2,3}.txt`.

Still required: object shape and first-lookup forward and converse lemmas, sorted-key uniqueness, array elementwise and scalar characterizations. Sorting and deduplicated first-occurrence lookup require nontrivial lemmas about `mergeSort` and `eraseDupsBy`; no claim of a counterexample or model defect is made. Do not mark acceptance complete until these are proved.

On this shared working tree, `lake build Nodetto.Merge` and `formal/scripts/audit --module Merge --vectors` exited 0; complete logs are `tmp/fv-s942/fv-33-merge-canon/build.log` and `audit.log`. Earlier failed proof attempts are preserved as `build-attempt-1.log` and `build-attempt-2.log`. No formal review or integration decision has been made.

## Continuation 1

Added `sameItems`, `same_array`, `sameItems_length`, scalar characterizations, `sorted_keys_unique`, and `same_object_shape`. The canonical lookup forward and converse remain unproved. Core `List.mem_mergeSort` and `List.eraseDupsBy_cons` offer a possible route, but no object lookup theorem is claimed. Status remains incomplete.

Canon blob transitions: aaaf6eccf35ccd665c509d7d9df48a24115e640d → bb81f98261d1d65b8f91e23b6d0a0e843770c1e7 → b724b689cf15adf6378334630afe1a9c32d706d4 → 2df830f993a0beb3c4022983bef1f894225bad20 → e8d45696e59793629d249262eee2656b0772b5ec → 2ae3e4b3536b7a569785c3457138ff8d909c1780 → 2eaf866b8f232006602c604ebabb4018aef68237. Fresh reads and intended edits are recorded in `intent-cont1.txt` through `intent-cont6.txt`.

Final-source build and audit exited 0; logs `build-cont1-final.log` and `audit-cont1-final.log`. Failed intermediate builds are preserved under `build-cont1-attempt*.log`. Vectors blob remains 094264fe78c6a198c9fe4a0d8a4f033c49119cdf. Verification is on the shared working tree.

## Continuation 2

Proved `lookupFirst_map_canon`, `lookupFirst_dedup`, and their combination `lookupFirst_canonical_fields`: first lookup survives duplicate-key removal and commutes with canonicalizing field values. Canon.lean changed from 2eaf866b8f232006602c604ebabb4018aef68237 to 75f8afb8951b336455ef54907b4772eb5135591d; per-edit intentions are in `intent-cont2-1.txt` through `intent-cont2-12.txt`. Previous progress blob was 51689a7212fe3aba18edf7f445e3aac89732bf26.

The proof relating sorted canonical fields to `lookupFirst` and the object forward and converse lemmas remain incomplete. No counterexample has been established. A further proof must establish unique-key membership for the deduplicated list, use mergeSort permutation, and connect list equality to pointwise lookup.

Build and vector audit both exited 0 on the current shared tree; logs are `build-cont2-final.log` and `audit-cont2-final.log`. Intermediate failed attempts are preserved in `build-cont2-attempt*.log`. Vector blob remains 094264fe78c6a198c9fe4a0d8a4f033c49119cdf. Acceptance remains incomplete.

## Redispatch verification

The assigned dependency remains accepted and the plan aligns with design section 6.7. No source edit was made. The object lookup forward and key-order independence converse remain unproved; acceptance is incomplete. A possible route is key uniqueness after `eraseDupsBy`, membership preservation by `List.mergeSort_perm`, and equality of sorted unique lists from pointwise lookup. No counterexample was established.

On the current shared tree, `lake build Nodetto.Merge` and `formal/scripts/audit --module Merge --vectors` exited 0; complete logs are `build-redispatch-final.log` and `audit-redispatch-final.log`. These gates do not check the missing lemmas.

## Continuation 3

Proved `dedup_sublist`, `dedup_keys_nodup`, and `lookupFirst_of_mem` in `formal/Nodetto/Merge/Canon.lean`. Source transitions are recorded in `cont3-before.hash`, `cont3-after.hash`, `cont3-fix-after.hash`, `cont3-fix2-after.hash`, `cont3-lookup-after.hash`, and `cont3-lookup-fix-after.hash`; corresponding fresh reads and intentions are in the evidence directory. The final source was read after editing and builds. The object lookup through sorting and the forward and converse object lemmas remain unproved; acceptance remains incomplete. No counterexample was established.

`cd formal && mise exec -- lake build Nodetto.Merge` exited 0 (`cont3-build-5.log`); `formal/scripts/audit --module Merge --vectors` exited 0 (`cont3-audit-final.log`). These runs used the shared working tree and do not verify absent lemmas. Failed intermediate builds are retained as `cont3-build-attempt.log` and `cont3-build-{2,4}.log`.

## Continuation 4

Proved `mem_of_lookupFirst`, `lookupFirst_perm`, `lookupFirst_sort_dedup`, and `same_object_lookup` in `formal/Nodetto/Merge/Canon.lean`. Thus equal canonical objects have pairwise equal first-occurrence lookups. Fresh source reads, intended hunks, and before/after hashes are recorded under `cont4-*` in the evidence directory. The converse object key-order independence lemma remains unproved; acceptance remains incomplete. No counterexample was established.

The final-source `cd formal && mise exec -- lake build Nodetto.Merge` exited 0 (`cont4-build-4.log`), and `formal/scripts/audit --module Merge --vectors` exited 0 (`cont4-audit-final.log`) on the shared working tree. Intermediate failed builds are retained as `cont4-build-1.log` and `cont4-build-3.log`; these were corrected before the final build. The audit does not establish the missing converse.

## Redispatch 2

The accepted predecessor and design alignment were checked. The converse object key-order independence lemma remains unproved, so this plan is incomplete. Current shared-tree build and vector audit both exited 0; complete logs are `build-redispatch2.log` and `audit-redispatch2.log`. These gates do not prove the absent converse.

The two supplied audit review findings concern `formal/scripts/audit.ts`, outside this plan's authorized write paths; repair requires reassignment or a scope amendment. No source repair was attempted for those findings.

## Redispatch 3

The accepted fv-16 dependency and design section 6.7 alignment were checked. The object key-order independence converse remains unproved; no counterexample was established. The two prior audit findings at `formal/scripts/audit.ts:58` and `:320` remain unresolved outside this plan's write paths and require reassignment to the audit owner. Current shared-tree build and vector audit exited 0 in `build-redispatch3.log` and `audit-redispatch3.log`; these gates do not establish the missing converse, and the audit findings limit reliance on the vector result. Formal review and integration remain downstream.

## Redispatch 4 completion

The accepted fv-16 dependency and design section 6.7 were checked. Proved `same_object_of_lookup`: pairwise `same` first-occurrence lookups imply identical sorted canonical fields, using key uniqueness, permutation and sort order. This is stronger than requiring equal key sets separately. The plan's assigned lemma layer is complete; formal review and integration remain downstream. Canon before/after hashes and each intended edit are in `redispatch4-*.hash` and `redispatch4-*-intent.txt`; fresh before/after source snapshots are also in the evidence directory.

Final shared-tree `cd formal && mise exec -- lake build Nodetto.Merge` and `formal/scripts/audit --module Merge --vectors` each exited 0; complete logs are `redispatch4-build-final.log` and `redispatch4-audit-final.log`. Intermediate failed builds `redispatch4-build1.log` and `redispatch4-build2.log` were corrected. Previous audit findings reported in redispatches 2 and 3 concern `formal/scripts/audit.ts`, outside this plan's ownership; review and disposition belong to its owner.

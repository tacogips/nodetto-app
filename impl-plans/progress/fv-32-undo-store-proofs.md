# fv-32-undo-store-proofs progress

Dependency fv-31 is accepted by dispatch. Design section 6.6 and the plan agree.

- Created `formal/Nodetto/Undo/StoreUndo.lean` (before: absent; after: `c65cb44b4f6dc534df27c5eb8e20a8d574d87f6c`) with general lookup lemmas for the inserted head and a different key. Intent: `tmp/fv-s942/fv-32-undo-store-proofs/intent-1.txt`.
- Appended the StoreUndo import, preserving Model and Stack, to `formal/Nodetto/Undo.lean` (before: `7a86595a5c1a115a86fb161d17818f95f7d51c26`; after: `c5e3fcaac5752b3f41075eaec9e3dc0a7bdc8a42`). Intent: `tmp/fv-s942/fv-32-undo-store-proofs/intent-root.txt`.
- `cd formal && mise exec -- lake build Nodetto.Undo.StoreUndo`: exit 0, `tmp/fv-s942/fv-32-undo-store-proofs/helper.log`.
- `cd formal && mise exec -- lake build Nodetto.Undo`: exit 0, `tmp/fv-s942/fv-32-undo-store-proofs/build.log`.
- `formal/scripts/audit --module Undo --theorem applyCommands_undo`: exit 1, `tmp/fv-s942/fv-32-undo-store-proofs/audit.log`; the required theorem is absent.

Acceptance remains unchecked. Prove observational congruence, the single-command inverses including deletion and sorted reconstruction, and the fold/list composition, then add the exact design theorem and rerun both gates. No counterexample was established.

## Continuation 1

- Added `lookup_filter`, a general characterization for any key predicate, supporting deletion and update. `StoreUndo.lean` changed from `c65cb44b4f6dc534df27c5eb8e20a8d574d87f6c` to `d1f9482c66f6a107202e6d628013daf39ed222af` (intent `cont1-intent.txt`); after correcting the induction simplification, it changed to `2c51d136a088b02356922e3051e56fdd4c7f4beb` (intent `cont1-fix-intent.txt`). Evidence paths are under `tmp/fv-s942/fv-32-undo-store-proofs/`.
- First build failed on the lemma (`build-cont1.log`, exit 1); the corrected `cd formal && mise exec -- lake build Nodetto.Undo` passed (`build-cont1-fix.log`, exit 0).
- `formal/scripts/audit --module Undo --theorem applyCommands_undo` failed (`audit-cont1.log`, exit 1): the theorem is still absent.
- Remaining: prove fold accumulation and observational congruence, deletion reconstruction using distinct keys and `List.mergeSort_perm`, then the exact theorem. No counterexample was found by case analysis. Acceptance remains unchecked.

## Continuation 2

- Added single-key removal lookup and update restoration lemmas. StoreUndo.lean hashes: `2c51d136a088b02356922e3051e56fdd4c7f4beb` → `e1ed821381a58cd9d22c4f8d9b7b8477cf71f90d` → `c3f3151fdfe6cb92f8ad4b0c71a6050c81c718a3` → `294d6332f158ecd87a4b173c2a6849c1278eeb43`. Per-edit intentions are `cont2-intent.txt`, `cont2-fix-intent.txt`, and `cont2-update-intent.txt` under the plan evidence directory.
- The first build failed on predicate instantiation (`build-cont2.log`); the corrected build and update lemma build passed (`build-cont2-fix.log`, `build-cont2-update.log`, exit 0).
- The theorem audit failed (`audit-cont2.log`, exit 1) because `applyCommands_undo` remains absent. The fold accumulator law, observational congruence and sorted delete reconstruction still need proofs. Acceptance remains unchecked.

## Terminal handoff

- Fresh `cd formal && mise exec -- lake build Nodetto.Undo` passed (exit 0; `build-final-attempt.log`). The fresh theorem audit failed (exit 1; `audit-final-attempt.log`): `applyCommands_undo` is absent. No counterexample was established.
- The accepted two productive continuations have not completed the theorem. Observational congruence, sorted deletion reconstruction and command-list composition remain. The acceptance criterion remains unchecked.
- Progress file before this append: `0ff447b24140967364067760ab01163cc5c1bed5`; intent: `intent-handoff.txt` in the plan evidence directory.

## Workflow continuation 1

- Added `create_restores_lookup` and `lookup_delete_keys` to support single-command inversion. `StoreUndo.lean` hashes: `294d6332f158ecd87a4b173c2a6849c1278eeb43` → `fc9fd53b5ce58e66b145ccae25e45eef0480fcdc` → `12bb62cf7e00a1b7fb01664745596f763e2bd139` → `b6409f1fea64a42cd0c87c6b0ef4d3d1d32eb5d9`; per-edit intent files are `cont3-create-intent.txt`, `cont3-delete-intent.txt`, and `cont3-delete-fix-intent.txt` in the evidence directory.
- The initial delete lemma build failed (`build-cont3-final.log`, exit 1); the corrected module build passed (`build-cont3-fixed.log`, exit 0). The theorem audit still fails (`audit-cont3.log`, exit 1), as `applyCommands_undo` remains absent.
- Remaining: observational congruence, sorted deletion reconstruction, fold accumulation, and the exact theorem. `List.mergeSort_perm`, `List.mem_filterMap`, and `List.mem_eraseDups` support reconstruction; a suffix-invariance lemma for the fold accumulator supports command-list composition. Acceptance remains unchecked.
- Progress file before this append: `aa745320e363f7e5fe951cbec1fdf03be3cee936`; intent: `cont3-progress-intent.txt`.

## Workflow continuation 2

- Added `deleted_pair_spec`, characterizing the sorted removed entries exactly by original lookup and id membership, and `deleted_pair_absent`, showing removed keys are absent after deletion. `StoreUndo.lean` hashes: `b6409f1fea64a42cd0c87c6b0ef4d3d1d32eb5d9` → `390f4408ea154f35d12f7ff15bc5834ccfa5fa2c` → `fa61d57e6dc5408e7b4ca2956d52147b9a6d147c`. Intent files: `cont4-pair-intent.txt`, `cont4-absent-intent.txt`.
- Final module build passed (`build-cont4-final.log`, exit 0). The required theorem audit failed (`audit-cont4-final.log`, exit 1); `applyCommands_undo` is still absent. The accepted criterion remains unchecked.
- Remaining: prove uniqueness of sorted removed keys, reconstruction through creates, observational congruence, fold accumulator composition, and the exact theorem. No counterexample was found. Progress before this append: `44427d45c190818e9c51724ee90bd89e6a314c39`; intent: `cont4-progress-intent.txt`.

## Redispatch verification

- Dependency fv-31 is accepted in the dispatch; the plan matches design section 6.6. Current StoreUndo hash `fa61d57e6dc5408e7b4ca2956d52147b9a6d147c`; Undo root `c5e3fcaac5752b3f41075eaec9e3dc0a7bdc8a42`.
- Build passed (exit 0, `build-redispatch3.log`); theorem audit failed (exit 1, `audit-redispatch3.log`): `applyCommands_undo` remains absent. The acceptance criterion remains unchecked and the proof obligations listed above remain.
- Review findings at `formal/scripts/audit.ts:58` and `:320` require the audit owner; this file is outside fv-32 writePaths. No source proof changes were made in this redispatch. Progress before append: `33663cfc236fd0e4e66b67d85b0bdd5f9dd96eb1`; intent: `redispatch3-intent.txt`.

## Redispatch 4

- Dependency fv-31 is accepted by dispatch; design section 6.6 states the same theorem as the plan. The current proof remains incomplete; read-only analysis found no concrete counterexample.
- Current-source `Nodetto.Undo` build passed (exit 0, `build-redispatch4.log`); the required theorem audit failed (exit 1, `audit-redispatch4.log`) because `applyCommands_undo` is absent. Acceptance remains unchecked. Remaining obligations are sorted deletion reconstruction, observational congruence, and fold composition.
- The two unresolved mid findings in `formal/scripts/audit.ts:58` and `:320` require repair by the audit owner; that file is outside this plan's writePaths. Formal review and integration remain downstream. Source and progress pre-edit hashes are in `redispatch4-before.hash`; intent is in `redispatch4-intent.txt`.

## Redispatch 5

- Added `deleted_pair_value_unique`, showing two removed entries with the same key have the same value. `StoreUndo.lean` changed from `fa61d57e6dc5408e7b4ca2956d52147b9a6d147c` to `5bd0b1c2ea2039b9525302740f8bbc3034ed1e76`; intent: `redispatch5-intent.txt`.
- Current-source `cd formal && mise exec -- lake build Nodetto.Undo` passed (exit 0, `build-redispatch5-final.log`). The theorem audit failed (exit 1, `audit-redispatch5-final.log`): `applyCommands_undo` remains absent. Acceptance remains unchecked.
- Remaining: prove distinct removed keys, reconstruction through creates, observational congruence, fold accumulator composition, and the exact theorem. No concrete counterexample was found. Intent for this append: `redispatch5-progress-intent.txt`.

## Continuation 6

- Added lookup congruence for deleted pairs, lookup through a key-absent prefix, and proofs that deduplication and the sorted deleted entries have distinct keys. These support reconstruction and observational congruence, but do not complete the required theorem.
- StoreUndo edit hashes: `5bd0b1c2ea2039b9525302740f8bbc3034ed1e76` → `3c92fa654463ebba1f61ddc1a211212477dca6f1` → `fb5c49cc0b08e7d99deb44f3fe421f11da1e70c3` → `c4a08c2d1ad50460fc3bd5c2b19ebaec3aa1d09a` → `d3828f454d5ee03932457e42777051420bd1729a` → `a95f82c783af2cb306543494445f38ecc78500b8` → `55782739088e440fd7147d1b8e675e9d70d90f6b`. Corresponding `cont6-*-intent.txt` files document each edit.
- Initial builds `build-cont6-2.log` and `build-cont6-5.log` failed on a reserved identifier and permutation direction respectively; both were corrected. Final `cd formal && mise exec -- lake build Nodetto.Undo` passed (exit 0, `build-cont6-final.log`). The theorem audit failed (exit 1, `audit-cont6-final.log`) because `applyCommands_undo` remains absent.
- Remaining: prove create-list reconstruction, observational congruence for command lists, fold accumulator composition, and the exact theorem. Acceptance remains unchecked. Progress append intent: `cont6-progress-intent.txt`.

## Continuation 7

- Added `lookup_append_member`, `fold_creates`, and generic `fold_suffix`, proving lookup reconstruction for distinct keys, successful creation of absent distinct entries, and suffix preservation by a suitable fold. These lemmas still need connection to the concrete model and the required theorem.
- StoreUndo edit hashes: `55782739088e440fd7147d1b8e675e9d70d90f6b` → `851770725db0b27b56cb61cb6aa573acce8197a7` → `68aecc6a279d62eae65a45410971212ba0ee738d` → `883b27107acc37526631b4567ef5f9b6e0d1ff70` → `3974d0e1e485d746d83ced808d284a1d5a8e1196` → `b9e7068435abc074cae0b2bc4dbc3754a7b0ce82` → `45f4cf5a583be006949d73ad0ee4930d00613978`. Per-edit intentions are `cont7-*-intent.txt`.
- Initial builds `build-cont7-2.log`, `build-cont7-3.log`, and `build-cont7-5.log` failed during proof construction; subsequent edits corrected them. Final module build passed (exit 0, `build-cont7-final.log`); theorem audit failed (exit 1, `audit-cont7-final.log`) because `applyCommands_undo` remains absent.
- Remaining: connect the create fold and suffix lemma to `applyCommands`, prove single-command inversion and observational congruence, and prove the exact theorem. Acceptance remains unchecked. Progress append intent: `cont7-progress-intent.txt`.

## Redispatch 9

- Dependency fv-31 is accepted by dispatch; the plan matches design section 6.6. No source edits were made. The StoreUndo source hash is `45f4cf5a583be006949d73ad0ee4930d00613978`.
- `cd formal && mise exec -- lake build Nodetto.Undo` passed (exit 0, `build-redispatch9.log`); `formal/scripts/audit --module Undo --theorem applyCommands_undo` failed (exit 1, `audit-redispatch9.log`), as the theorem is absent. Acceptance remains unchecked.
- Read-only proof analysis found no counterexample. One-command and list congruence, inverse reconstruction, fold composition and the theorem remain to be proved. Progress before this append: `3a034b95392e49ba87d0de9ac00a12de99624d5c`; intent: `redispatch9-progress-intent.txt`.

## Continuation 10

- Proved `deleted_lookup_restored`: the reversed sorted removed entries prepended to the remaining store recover every original lookup. StoreUndo hashes: `45f4cf5a583be006949d73ad0ee4930d00613978` → `115077fd4bf41da34ef1cbe05151a273383433b4` → `f316ea8f703aaae98b82595d27e1ceecb5d5dedc` → `6953afdf09132ea2fe55af8491d362f3c647f9d8` → `1e06112070ebfb81e9c4193b70cad1e44b0c79e1` → `f316ea8f703aaae98b82595d27e1ceecb5d5dedc`. The unfinished apply_creates attempt was removed after build failures; per-edit intents are `cont10-*-intent.txt`.
- Current-source `cd formal && mise exec -- lake build Nodetto.Undo` passed (exit 0, `cont10-build-final.log`); the theorem audit failed (exit 1, `cont10-audit-final.log`) because `applyCommands_undo` is absent. Build attempts 1, 3 and 4 failed during development; build 2 passed. Acceptance remains unchecked.
- Remaining: bridge create folds to applyCommands, prove observational congruence and command-list composition, and prove the exact theorem. Progress before this append: `ed515bd745ee125db73af0d2b03cf224e97557d0`; intent: `cont10-progress-intent.txt`.

## Continuation 11

- Proved `apply_creates`, connecting create-command execution to `fold_creates`, and `delete_inverse`, showing the generated creates successfully restore every lookup after a deletion. StoreUndo hashes: `f316ea8f703aaae98b82595d27e1ceecb5d5dedc` → `3cc237d5acb2f6bf73218f9e868bef00b2bbc0b1` → `d5147aeba96964a904754604d175d11482a69a42` → `a672c2d99f1bedcf7ffcce30f5845fc6e79d6937`. Intent files: `cont11-creates-intent.txt`, `cont11-fix-intent.txt`, `cont11-delete-intent.txt`.
- `cd formal && mise exec -- lake build Nodetto.Undo` passed (exit 0, `cont11-build-final.log`); the required theorem audit failed (exit 1, `cont11-audit-final.log`) because `applyCommands_undo` is absent. Build attempt 1 failed during development; attempts 2 and 3 passed. Acceptance remains unchecked.
- Remaining: prove single-command inversion for create and update, observational congruence and command-list composition, and the exact theorem. Progress before this append: `753b71195afabe645627221e624571fcf1a48e27`; intent: `cont11-progress-intent.txt`.

## Continuation 12

- Proved `create_inverse` and `update_inverse` for the concrete singleton inverse commands. StoreUndo hashes: `a672c2d99f1bedcf7ffcce30f5845fc6e79d6937` → `37f26a95e4ed0fd55c95db7d55c1aa5b50b24f83` → `9bd5b49cbae06ebba1cb00b910ea5c94b15f3d6c` → `d096796f434219b5193257078d3c5ea970ab327f` → `1fe655070f1560187dd8357973c4da9b7ef870ad`. Per-edit intent files are `cont12-intent.txt` and `cont12-fix*-intent.txt`.
- Initial proof builds failed (`cont12-build1.log`, `cont12-build2.log`, `cont12-build-final.log`); the corrected source built successfully (`cont12-build3.log`, `build-cont12-final.log`, exit 0). The required audit failed (`audit-cont12-final.log`, exit 1) because `applyCommands_undo` is absent.
- Remaining: observational congruence, command-list composition, and the exact theorem. Acceptance remains unchecked; no counterexample was found. Progress before append: `1d7ad39224c9022e62292b64c39c0c31498ec148`; intent: `cont12-progress-intent.txt`.

## Continuation 13

- Proved command-list composition, lookup congruence, singleton inversion and the exact design theorem `applyCommands_undo`. The theorem restores every lookup after executing the inverse list. The existing Undo root import remains intact.
- StoreUndo edit hashes, in order: `1fe655070f1560187dd8357973c4da9b7ef870ad`, `3e6e6af6009a4e212a8cc8749a1e4ce24a0cf374`, `142ced79f63b52378602835d4e4e416ce4ff5b05`, `1cf2c1454f4eed797f7016426d5fb2fe47647ab3`, `0f951fd61e0dba5c5e916b5e86b5985f087686d4`, `a7edb609be83c01aeec5b89822fafa9686d2b234`, `c644cde0fd49f4d76a59db835962236abcee179f`, `5f5b3e0c1f28e3bd8d04e6e13274079e1089c764`, `18a4566bc3103e42f3f3b37457643558a7dbc2e1`, `db49f420377ff92d5d31e3774ec309e92980884d`, `c7649e3ad1abe109dbbf8488bb2f046525d9c7d8`, `fb9a0bf4a7d237cfe7ae0a872e65c2d9c9660664`, `5388903ae7d5abf70f0f018aa14282b7973a1388`, `b0761a0593a0ff54bc758bef3997b33bc6e39a0e`, `d81a9b7823acf65de41ef56d4669080fada82022`, `64377cc98f8cc2cafcb53df78e32767c8a8eb4b7`. Per-edit intents are `cont13-*-intent.txt`.
- Current-source build and audit both passed on the shared tree (exit 0, `cont13-build-final.log` and `cont13-audit-final.log`); audit reports token scan, build and Undo statements all OK. Acceptance criterion met for implementation; formal review remains downstream. Development build attempts are retained as `cont13-build1.log` through `cont13-build14.log`.
- Progress before append: `92945ad735e161ed04cdc671955d371b05eebae2`; intent: `cont13-progress-intent.txt`.

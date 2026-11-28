# fv-35-merge-value progress

Status: complete for implementation. The accepted fv-34 dependency is present; the plan matches design section 6.7. Independent review remains pending.

- Created `formal/Nodetto/Merge/Value.lean` (absent -> d689ec02638cdd0e687786a3bada777482585662 -> 75f3d82f3a9e424344bc1d157ee2cc4a5c867168), proving the three early-return laws. The first attempt used `simp [mergeValue]`; the second uses `mergeValue.eq_def`.
- Appended the Value import to `formal/Nodetto/Merge.lean` (3754995123ee14dbd678cfd8acf7deeb78b61097 -> d6778590e0906a55bbf201762a9bd3ea7f15d1ae), preserving prior imports.
- `build-attempt1.log` failed during proof development; `build.log` exits 0 on the current source.
- `audit.log` exits 1: `mergeValue_symm` and `mergeValue_conflict_iff` are absent. The other three signatures and allowed axioms pass.
- Remaining: prove the two general recursive object-case statements, then rerun both plan gates. No counterexample has been established.

## Continuation 1

- Added general `fieldConflict_unchanged_left`, `fieldConflict_same`, and `fieldConflict_objects` lemmas. The latter decomposes a parent object conflict into a conflict at a common child key.
- Value.lean hashes: 75f3d82f3a9e424344bc1d157ee2cc4a5c867168 -> cad1fc85c025e9744869b8e0e17db1c03ba9aba6 -> db1d01378a6b3a4bb86b52c1de0997678231b4e9 -> a6fbfd49c572c51b2292df8feffe0f9c1d92799f -> d62bc3a034b7b87a3df54089a0422f4458587dda. Intent and fresh reads are in cont1-intent*.txt and cont1-before*.txt.
- `cont1-build4.log` passes. Object-result lookup and flag lemmas, the two recursive theorems, and their successful audit remain outstanding. No counterexample found.

## Continuation 2

- Added `fieldConflict_unchanged_right`, `lookupFirst_filterMap_keys`, and `any_key_flags`, supporting the recursive object case. Value.lean hashes: d62bc3a034b7b87a3df54089a0422f4458587dda -> a725787d49c27104f423e92f4d1313a862316d4c -> cfb46fc43e28b28f13e6c0babb584816408512c4 -> 9f51cbdc3f48ffba1b2c374640dc34fa17ba4d3c -> 5405ea78b9c8473b3c9201841628ba614c7074cf. Fresh reads and intents are in cont2-before*.txt and cont2-intent*.txt.
- `mergeValue_symm` and `mergeValue_conflict_iff` remain absent. The five-name audit remains failing. Complete the recursive proofs and rerun both gates before review.

## Continuation 3

- Added and checked `mergeValue_object_flag`, reducing an object merge's conflict flag to a child conflict. Value.lean hashes: 5405ea78b9c8473b3c9201841628ba614c7074cf -> f142c53337ac614ced1ca19131ef813645a30e68 -> d36b81094add73860d37e25b178191813fc4f5c9 -> edf1e92f3539923f0c321b0279a1d6787b1892b3. Fresh reads and intentions are recorded in cont3-before*.txt and cont3-intent*.txt.
- Final-source `build.log` exits 0. `audit.log` exits 1: `mergeValue_symm` and `mergeValue_conflict_iff` remain absent; the three existing statements pass the axiom check. No counterexample established. The plan remains incomplete and requires both recursive proofs and a successful audit.

## Continuation 4

- Proved object-result lookup, root replacement conflict, `mergeValue_conflict_iff`, and `mergeValue_symm`. The five theorem statements match design section 6.7. No counterexample was found.
- Value.lean hashes in edit order: edf1e92f3539923f0c321b0279a1d6787b1892b3 -> 4162369515e5dc319697e68c569b7f4afe30b5f1 -> baf31313e484ba43706dd84d4adb058361799bdd -> cb422d9d3e5597d387aeedc6e18d1d177e6984d5 -> a529163efb0211f8e0b04cd8d69fe9cbd73fc9e4 -> 4c63ff4799a7b5180e3b144b3fac13a9d1568567 -> a12526054d3b255a7d7319a57f7f0a826d277369 -> c87bfe1d791cb7240f02d8a6d2cfded8efd95df9 -> 2fc363bcb62c791bf0c66bb3e150ac34639f35c7 -> f630ba25ce667e259ea1c319a259393bac5511df. Fresh reads and edit intentions are in cont4-before*.txt and cont4-intent*.txt.
- On the shared moving tree, `cont4-final-build.log` and `cont4-final-audit.log` both exit 0; the audit reports all five statements and the token scan pass. Earlier development attempts remain in cont4-build*.log.
- Progress file hash before this update: e795ccc45ee5650e553cafd09d4c91f7558a4a2a; its resulting hash is recorded in the continuation evidence.

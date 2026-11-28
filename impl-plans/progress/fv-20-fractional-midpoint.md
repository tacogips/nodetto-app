# fv-20-fractional-midpoint progress

Dependency fv-10 is accepted in the dispatch. The plan aligns with design sections 6.1 and 8.

- Before: `formal/Nodetto/Fractional/Midpoint.lean` absent; `formal/Nodetto/Fractional.lean` blob `fdf764741f969da44fc0a4003f1c2c27b8b42239`; progress file absent.
- Intent: `tmp/fv-s942/fv-20-fractional-midpoint/intent-1.txt` and `intent-progress.txt`.
- After: `Midpoint.lean` blob `ef169474b78d9c5e035438e070cb23cccce4af11`; root blob `971466fa8d5711533a4894413fad029bcdf19f2a`.
- Proved `randomDigitBetween_bounds` for every draw. Added the midpoint module import.
- Build and vector audit passed; see `tmp/fv-s942/fv-20-fractional-midpoint/build.log` and `audit.log`.
- Incomplete: digit validity and ordering, shared-prefix preservation, and bounded/unbounded midpoint correctness lemmas. Acceptance remains unmet; no counterexample has been established.

## Continuation 1

- Midpoint.lean before prefix: `ef169474b78d9c5e035438e070cb23cccce4af11`; after prefix / before digit proof: `b8d5f0d4cdb436642ed529c7e239ddfb8bec9d75`; after digit proof: `b7f9cae12419d97839e5257025cb3df605f6f28a`. Intent records: `intent-prefix.txt`, `intent-digit.txt`.
- Progress file before this entry: `0d761345d3e8ae7c6cd47b5ec8b05e6e71f3edf1`; intent: `intent-progress-cont1.txt`.
- Added `digit_code_unit` and `prefix_bounds`. Build and audit pass in `build-cont1.log` and `audit-cont1.log` on the shared tree.
- Still incomplete: index inverse, digit ordering and the bounded/unbounded midpoint correctness lemma. Acceptance remains unmet. No counterexample has been established.

## Continuation 2

- `Midpoint.lean` before: `b7f9cae12419d97839e5257025cb3df605f6f28a`; after sorting: `40e9eae4aace0aa38fbbcce0a8903050be01e148`; after index lemmas: `64eb5f11989275fb1ac043eadcb7e9b07f7c1542`; after lexicographic lemma: `e977523c0bbef076eae1b4726de63a64d82b72a2`. Intent records: `intent-sorted-cont2.txt`, `intent-index-cont2.txt`, `intent-lex-cont2.txt`.
- Progress before: `842129b0047f10647884d74f7de2ac88d2058852`; intent: `intent-progress-cont2.txt`.
- Added `digits_sorted`, `digit_index_inverse`, `digit_index_order`, and `digit_heads_order`. Current build and audit pass in `build-cont2-final.log` and `audit-cont2-final.log` on the shared tree.
- The general bounded/unbounded midpoint correctness lemma remains unproved. Acceptance remains unmet; no counterexample has been established.

## Redispatch verification

- Dependency fv-10 is accepted in the runtime dispatch; the plan remains aligned with design 6.1.
- No proof source changed in this redispatch. The general midpoint correctness lemma remains unproved; acceptance is unmet and no counterexample has been established.
- `build-redispatch.log` and `audit-redispatch.log` record passing focused gates on the shared tree; neither establishes the missing lemma. Formal review remains pending.

## Continuation 3

- Added `digit_positive_ne_zero`, `valid_cons`, and `valid_tail`, supporting the recursive validity argument. The successive source identities are recorded in `before-cont3.hash`, `before-prefix-cont3.hash`, `before-tail-cont3.hash`, and `after-tail-cont3.hash`; matching fresh reads and intentions are in the plan evidence directory.
- `build-cont3-final.log` and `audit-cont3-final.log` pass on the shared tree. The general bounded/unbounded midpoint correctness lemma remains unproved; acceptance remains unmet. No counterexample was established.
- A strong induction on the combined bound lengths needs branch-specific ordering invariants, particularly the padded empty lower bound and the adjacent-digit descent.

## Continuation 4

- Added `digit_singleton_valid` and `midpoint_empty_unbounded`, proving the unbounded empty-lower case for arbitrary draws. Source identities and intentions are recorded in the plan evidence directory (`before-cont4.hash`, `before-base-cont4.hash`, `before-base-fix-cont4.hash`, `after-base-cont4.hash`).
- The initial base-case build failed on a definitional equality; `build-base-cont4-final.log` records the successful correction. `audit-cont4-final.log` passes on the shared tree.
- The general bounded and unbounded correctness lemma remains unproved. Acceptance remains unmet; no counterexample has been established.

## Current handoff

- Rechecked the accepted dependency and design alignment. No proof source was changed in this handoff.
- The focused build and vector audit passed on the shared tree; see `build-current.log` and `audit-current.log` in the plan evidence directory.
- The general bounded/unbounded midpoint correctness lemma remains unproved. The assigned implementation is incomplete; no counterexample has been established. Independent review and downstream plans remain pending.

## Continuation 5

- Added `midpoint_unbounded_room` and `midpoint_unbounded`, proving arbitrary-draw correctness for every empty or valid lower key with no upper bound. Source blob before: `b41411d540f216941bf45b2d02d0573f63496232`; after: `879e69947ce7be8364c14d5935d848271ef9c8e8`. Per-edit snapshots and intentions are in the plan evidence directory. Progress blob before: `82d67b466f95ed63757f014572d63dc6c7a9ca06`.
- Initial induction build failed on an `Except` definitional equality; `build-unbounded-fix-cont5.log` records the corrected passing build and `audit-cont5.log` the passing vector audit on the shared tree.
- Bounded midpoint correctness remains unproved. The assigned plan is incomplete; no counterexample has been established.

## Continuation 6

- Added `midpoint_bounded_room`, `midpoint_bounded_truncate`, and `midpoint_shared_head`; these prove room, truncation, and recursive shared-head cases. Source blob before: `879e69947ce7be8364c14d5935d848271ef9c8e8`; after: `9d0adfc25d57ba242c40733e1e82622c8cc53434`. Progress blob before: `0060bb2e1f6ada8a32055fed81fd1c9cd88e4360`. Per-edit snapshots and intentions are in the plan evidence directory.
- `build-final-cont6.log` and `audit-final-cont6.log` pass on the shared tree. Earlier build failures and corrections are retained in `build-shared-cont6.log` and `build-adjacent-cont6.log`.
- General bounded correctness remains unproved: the induction, padded empty-lower cases, and adjacent singleton-upper descent still need integration. The assigned plan remains incomplete; no counterexample has been established.

## Continuation 7

- Added `midpoint_bounded_adjacent` for distinct adjacent digits and a singleton upper bound. Source before: `9d0adfc25d57ba242c40733e1e82622c8cc53434`; after: `69b1aba5accf5991c222a2e589f42c3dcdb79794`. Progress before: `b84ec14dc090ca066bb03432846b38d1d673aa28`. Intent records are in the plan evidence directory.
- `build-cont7.log` and `audit-cont7.log` pass on the shared tree. General bounded correctness, including induction and padded empty-lower cases, remains unproved. No counterexample was established; acceptance remains incomplete.

## Current verification 8

- Reconfirmed dependency admission and alignment with design section 6.1. No proof source changed in this turn.
- The focused build and vector audit exited 0 on the moving shared tree: `build-current-8.log` and `audit-current-8.log` under the plan evidence directory.
- General bounded midpoint correctness, including the induction and padded empty-lower cases, remains unproved. The assigned plan is incomplete; no counterexample has been established. Downstream review remains pending.

## Continuation 9

- Added `midpoint_empty_shared_zero`, `midpoint_empty_eq_zero`, `midpoint_empty_positive`, and `midpoint_empty_bounded`, proving bounded correctness for every valid upper key when the lower bound is empty. Source before: `69b1aba5accf5991c222a2e589f42c3dcdb79794`; after: `af454b2b9309d551b6c75d8389cbcab4ca6cd560`. Progress before: `6fcadc7346a8c01f870c59025844693de3e14aec`. Per-edit snapshots and intentions are in the plan evidence directory.
- The final focused build and vector audit passed on the moving shared tree (`build-cont9-attempt9.log`, `audit-cont9-final.log`). Earlier unsuccessful proof iterations are retained as `build-cont9-attempt2.log` through `build-cont9-attempt8.log`.
- General bounded correctness for nonempty lower keys remains unproved. Acceptance remains unmet; no counterexample was established.

## Continuation 10

- Added `midpoint_bounded`, proving bounded correctness for empty or valid lower tails and every valid upper key by induction. Together with `midpoint_unbounded`, this supplies the plan's general midpoint correctness for both upper-bound forms. Source before: `af454b2b9309d551b6c75d8389cbcab4ca6cd560`; after: `89293c6e68ffad65bc9dd39e6efa2b79e7449012`. Progress before: `d409e830863fe066b3332c1f2cf1763218900c9f`. Per-edit snapshots and intentions are in the evidence directory.
- Focused build and vector audit passed on the moving shared tree (`build-cont10-attempt2.log`, `audit-cont10.log`); the superseded failed proof iteration is `build-cont10-attempt1.log`. Assigned implementation criteria are met; independent review remains pending.

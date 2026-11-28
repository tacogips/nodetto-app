# fv-37-overlap-sweep progress

Status: incomplete. Dependency fv-17-overlap-model is accepted by dispatch. The plan and design section 6.8 agree on the two required signatures. The model root currently imports only `Nodetto.Overlap.Model`; `Sweep.lean` does not exist. No proof or counterexample has been established.

Before editing this progress file, fresh state and hashes were recorded in `tmp/fv-s942/fv-37-overlap-sweep/before.hash`; the intended edit is in `progress-intent.txt` in that directory. The file was absent before this edit. No source or plan checkbox was changed.

Verification on the current shared tree: `cd formal && mise exec -- lake build Nodetto.Overlap` exited 0 (`tmp/fv-s942/fv-37-overlap-sweep/build.log`). The required theorem audit exited 1 (`tmp/fv-s942/fv-37-overlap-sweep/audit.log`) because both theorem names are absent. Remaining work: prove the sorted scan and permutation lemmas and both exact design statements, add the root import, then rerun both gates. This is incomplete proof work, not a demonstrated counterexample.

## Continuation 1

Created `formal/Nodetto/Overlap/Sweep.lean`, initially absent, and proved the intermediate `overlappingPairs_sweep_of_sweep`: branch selection preserves correctness assuming both sweep axes are correct. Its final blob is `8b8ecaf53e9a46d2b0a828c6c8f2357a45a6b131`; intermediate hashes were `c9e60a46e8e1aebb1e25ce414f25f6643684f107`, `0f3a485c814ed8a324c781c0b753b3bec00edec1`, `a64d54c3f75874cd2f756351efcd34f73a7f22df`, and `eba010504ef7b6ec7531d40fda869dfc40239362`. Per-edit intentions are in `tmp/fv-s942/fv-37-overlap-sweep/intent-cont1*.txt`. The helper build exited 0 (`helper-cont1-fix4.log`); earlier attempts and errors remain in that directory. Root import remains unchanged because the required proof is incomplete.

The required root build exited 0 (`build-cont1.log`); the theorem audit exited 1 (`audit-cont1.log`), with both required theorem names absent. These checks ran on the shared tree. Still required: prove the sorted scan permutation theorem, instantiate the helper as the exact branch theorem, add the root import, and pass the audit. No counterexample has been demonstrated.

## Continuation 2

Added `sorted_perm` (sorting preserves indexed inputs) and `overlaps_symm` (closed-box overlap is symmetric, including inverted bounds) in `Sweep.lean`. Before hash: `8b8ecaf53e9a46d2b0a828c6c8f2357a45a6b131`; first edit: `95bed3df7a33072208d338d9217b2939fffb8213`; correction: `bde571446b21a3ca301973aadf07453bba7dceb9`. The intended edits are in `intent-cont2.txt` and `intent-cont2-fix.txt` under the evidence directory. The initial helper build failed (`helper-cont2.log`); after correction, `lake build Nodetto.Overlap.Sweep` exited 0 (`helper-cont2-fix.log`).

On the shared tree the required root build exited 0 (`build-cont2.log`) and the required audit exited 1 (`audit-cont2.log`), because the required theorems are still absent. The root does not import the helper file. The sorted scan, pair uniqueness and permutation proof remain to be completed, followed by the required declarations, root import and audit. No counterexample was established. The acceptance checkbox remains unchecked.

## Current recheck

The accepted fv-17 dependency is present in dispatch and design section 6.8 matches the plan. The root build exited 0 (`tmp/fv-s942/fv-37-overlap-sweep/build-cont3.log`); the two-name audit exited 1 (`tmp/fv-s942/fv-37-overlap-sweep/audit-cont3.log`) because both declarations are absent. No counterexample was established. The sorted-scan and pair permutation proof, exact declarations, root import, and passing audit remain outstanding. The plan remains incomplete.

## Continuation 4

Added `overlap_lower_le_upper`, proving the sweep-axis necessary bound for every overlapping pair, including inverted boxes. `Sweep.lean` hashes before, intermediate and after: `bde571446b21a3ca301973aadf07453bba7dceb9`, `01eb187775f6b6e0eadc7652136612c85b4ae148`, `b98346fbb00a0c50cd382ab2f28092b7e5ff8a84`. Intent and fresh snapshots are in `tmp/fv-s942/fv-37-overlap-sweep/intent-cont4*.txt` and `cont4*.txt`. The first helper build failed due to axis reduction (`helper-cont4.log`); the corrected helper build passed (`helper-cont4-fix.log`).

The root build passed (`build-cont4.log`), but the required two-name audit failed (`audit-cont4.log`): both declarations remain absent. The sorted-scan and pair-permutation proof, exact declarations and root import remain outstanding. No counterexample was established. Acceptance remains unchecked.

## Continuation 5

Proved `sorted_lower_pairwise`: the merge-sorted inputs have nondecreasing lower bounds on either axis. `Sweep.lean` changed from blob `b98346fbb00a0c50cd382ab2f28092b7e5ff8a84` to `c044793bf6a86af31d55ce806fd7b91b2670f4f5`; intent and fresh snapshots are under `tmp/fv-s942/fv-37-overlap-sweep/cont5*` and `intent-cont5.txt`. The helper build passed (`helper-cont5.log`).

The root build passed (`build-cont5.log`), but the required audit failed (`audit-cont5.log`) because both required declarations remain absent. The scan and pair-permutation proof, both declarations and root import remain outstanding. No counterexample was established. Acceptance remains unchecked.

## Redispatch recheck

The accepted dependency and design signatures were rechecked. No source proof was added in this invocation. The current root build passed (`build-redispatch-final.log`, exit 0); the two-name audit failed (`audit-redispatch-final.log`, exit 1) because both declarations remain absent. The root still does not import `Sweep.lean`. The sorted scan and pair permutation proofs remain required; no counterexample was established. Acceptance remains unchecked. Pre-edit content, intent, and hashes are in the plan evidence directory under `redispatch-*`.

## Continuation 6

Added `norm_swap`, proving normalization is invariant under exchanging indices. `Sweep.lean` changed from `c044793bf6a86af31d55ce806fd7b91b2670f4f5` to `a9305f1774b3745689d71dc9bc460cce0a3069bc`; fresh snapshots and intent are in `tmp/fv-s942/fv-37-overlap-sweep/cont6-*` and `intent-cont6.txt`. The helper build exited 0 (`helper-cont6.log`). The root build exited 0 (`build-cont6.log`); the two-name audit exited 1 (`audit-cont6.log`) because both declarations remain absent. The root import and general proof remain outstanding. A proof route is to expose the model's private scan equations using the existing `Lean.mkIdent` pattern in `Tsv/Theorems.lean`, prove scan equals filtering the sorted tail, then prove permutation using unique indexed inputs. No counterexample was established. Acceptance remains unchecked.

## Continuation 7

Proved `expired_tail`: once the sorted scan reaches a lower bound greater than the current upper bound, no remaining box overlaps. `Sweep.lean` hashes before, intermediate and after: `a9305f1774b3745689d71dc9bc460cce0a3069bc`, `40d7b953221b85f182d64c64ebff6a6f3f5a5efa`, `c9c572f5530d155459eafb30bc965ffd8246c437`. Intent and snapshots are under `tmp/fv-s942/fv-37-overlap-sweep/cont7-*` and `intent-cont7*`. The initial helper build failed on an unqualified identifier (`helper-cont7.log`); the corrected helper build passed (`helper-cont7-fix.log`). The root build passed (`build-cont7.log`), but the two-theorem audit failed (`audit-cont7.log`) because both declarations are absent. The full scan equivalence, pair permutation, declarations and root import remain outstanding. Acceptance remains unchecked; no counterexample was established.

## Current scan proof

Proved `scan_eq_filter`: for a sorted tail, the scan equals the list of overlapping boxes mapped to visited pairs. Sweep.lean hashes before, intermediate, and after are `c9c572f5530d155459eafb30bc965ffd8246c437`, `0f62f046bb54091f2bf8b8d37006080776643bc3`, `a821ec933d01ae384ed8e5de209b6ff847402ab1`, and `86bfc5f353c080328fea8623318b45452cf04a64`. Snapshots and intentions are in `tmp/fv-s942/fv-37-overlap-sweep/current-scan-*`. The helper build passed (`current-helper-fix2.log`); earlier failed attempts are in `current-helper.log` and `current-helper-fix.log`.

The root build passed (`build-current.log`); the required audit failed (`audit-current.log`) because both specified declarations remain absent. The general pair permutation proof, exact declarations, root import, and passing audit remain outstanding. No counterexample has been established. Acceptance remains unchecked. These checks ran on the shared tree.

## Continuation 8

Added `orderedPairs`, `sweepItems_eq_orderedPairs`, `sweep_eq_orderedPairs`, `orderedPairs_perm`, `sweep_perm_input_pairs`, and `mem_bruteForce`. These establish sweep equivalence to the ordered enumeration, invariance under input permutation, and a brute-force membership characterization. Source hashes before successive edits and after are recorded in `tmp/fv-s942/fv-37-overlap-sweep/cont8*-before.hash` and `cont8-after.hash`; snapshots and per-edit intentions are alongside them. The final helper build passed (`cont8h-helper.log`); intermediate attempts are retained in the same directory.

The required root build passed (`build-cont8.log`); the two-name audit failed (`audit-cont8.log`) because both exact declarations are absent. The remaining work is to prove the indexed enumeration agrees as a permutation with `bruteForce`, derive the two exact theorems, add the root import, and pass the audit. No counterexample was established. Acceptance remains unmet. Verification ran on the shared tree.

## Continuation 9: implementation complete

Proved normalization is redundant for strictly increasing indexed inputs, represented the ordered enumeration as a full-list filtered flatMap, and proved its equality with `bruteForce`. Derived the exact design declarations `sweep_visits_overlaps` and `overlappingPairs_sweep` and added the root import. The initial source hashes and per-edit intentions/snapshots are recorded under `tmp/fv-s942/fv-37-overlap-sweep/cont9*`; final Sweep.lean hash is `82a7c89e71469fee620d69ba5aea0bae1cbd3805` and Overlap.lean hash is `27c48ce342f5843081a9d63c519569e451bf69e2`.

The focused root build exited 0 (`build-cont9.log`), and the two-name audit exited 0 (`audit-cont9.log`), satisfying the plan acceptance criterion. These checks ran on the shared tree; formal review and integration remain downstream.

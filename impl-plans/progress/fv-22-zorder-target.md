# fv-22-zorder-target progress

Dependency fv-11-zorder-model is admitted by the dispatch acceptedPlanIds. Plan intent matches design section 6.2.

Added the front and back idempotence theorems with the exact design statements and supporting filter lemmas in `formal/Nodetto/ZOrder/TargetOrder.lean`; imported it in `formal/Nodetto/ZOrder.lean`. Per-edit fresh reads, intended hunks and before/after blob hashes are in `tmp/fv-s942/fv-22-zorder-target/` (before-1 through after-3 and root-before/root-after). Initial target and progress files were absent; root before and after hashes are recorded there.

`cd formal && mise exec -- lake build Nodetto.ZOrder` passed (build.log). The six-name audit failed (audit.log): `targetOrder_perm`, `targetOrder_selected_order`, `targetOrder_unselected_order`, and `targetOrder_all_selected` are absent. The two idempotence theorems type-check and use only allowed axioms. Build attempts 1 and 2 failed on filter simplification and were superseded by successful attempt 3. No counterexample was established. The acceptance criterion remains unchecked; prove the swap-pass invariants and remaining four statements, then rerun both required gates.

## Continuation 1

Proved the four remaining design statements. Adjacent swap and fold lemmas establish permutation and preservation of both filters; all-selected follows from fixed guarded steps. The two previous idempotence proofs remain intact. The acceptance criterion is met on the shared working tree; formal review and integration remain downstream.

| Edit | Before blob | After blob |
| --- | --- | --- |
| TargetOrder 1 | ba8ed566ea901d6619f7262e83e996f77583df6e | b2b177192548f34f28f696e9b6965fed9a00be8d |
| TargetOrder 2 | b2b177192548f34f28f696e9b6965fed9a00be8d | 13c88941062eed671e707af387257a9a9ac90ee3 |
| TargetOrder 3 | 13c88941062eed671e707af387257a9a9ac90ee3 | c279b2873d07b642f12d680d755d2a3a0d82242a |
| TargetOrder 4 | c279b2873d07b642f12d680d755d2a3a0d82242a | 8f8b38a5639ea7199ca3b2ee179dc6e75f6d4e3f |
| TargetOrder 5 | 8f8b38a5639ea7199ca3b2ee179dc6e75f6d4e3f | 336fd097876af0ebc4b38879d82cf20b42857584 |
| TargetOrder 6 | 336fd097876af0ebc4b38879d82cf20b42857584 | 6527c57b04d5be3ae76a4614a0d38e8f81249805 |
| TargetOrder 7 | 6527c57b04d5be3ae76a4614a0d38e8f81249805 | 083d1f315cdf454ce92b620b403e5ed8811b1816 |
| TargetOrder 8 | 083d1f315cdf454ce92b620b403e5ed8811b1816 | 1a188838183adae937c8babf7af5c419947083e3 |
| TargetOrder 9 | 1a188838183adae937c8babf7af5c419947083e3 | bd0bc2752c05e9c537f2e1d4cd40d6331d7ec4f4 |
| TargetOrder 10 | bd0bc2752c05e9c537f2e1d4cd40d6331d7ec4f4 | b92cd4b3d63c114a762c599a5efa32ecf56804af |
| TargetOrder 11 | b92cd4b3d63c114a762c599a5efa32ecf56804af | bb6c379768b53b4900e766d02e36d9a7c9c2c29c |

Root remains 10498f2567e93dea27f95a4529d85c8da8ac8db1. Final build: cont1-build-final.log, exit 0. Six-name audit: cont1-audit-final.log, exit 0. Earlier attempt logs are retained in the evidence directory. No tests or model files changed.

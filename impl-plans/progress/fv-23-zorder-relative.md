# fv-23-zorder-relative progress

The accepted fv-22 dependency is present in the runtime acceptedPlanIds. The plan agrees with design section 6.2.

- Created `RelativeOrder.lean`; successive before/after blob identities and intentions are in `tmp/fv-s942/fv-23-zorder-relative/{before,after}-*.hash` and `intent-*.txt`. Initial file was absent. Final blob: `cc96f2898d4f374e63e7d8dcaf96a530b815ab03`.
- Appended the root import, preserving the Model and TargetOrder imports. Before and after identities are in `root-before-edit.hash` and `root-after-edit.hash`; final blob `907de5fc8feceb061f984c4bf21ac493aecbdca5`.
- Proved `relativeOrder_perm`. Build succeeded: `build.log`. Audit failed: `audit.log` reports 1/6; `relativeOrder_moved_order`, `relativeOrder_unmoved_order`, `relativeOrder_no_anchor`, `relativeOrder_before`, and `relativeOrder_after` remain absent. Earlier proof attempts are in `build-attempt-*.log`.
- Acceptance remains unchecked. Prove the five remaining statements and rerun both plan gates. First/last anchor proofs need index and filtered-zip lemmas; no counterexample established.

## Continuation 1

- Added general filtered-take/drop lemmas and proved `relativeOrder_moved_order`, `relativeOrder_unmoved_order`, and `relativeOrder_no_anchor` without changing their design signatures. Source edits before/after: `cc96f2898d4f374e63e7d8dcaf96a530b815ab03` to `b8351cc5e72908ee64ef80995904767866b715cd`; `b8351cc5e72908ee64ef80995904767866b715cd` to `2eddd6ab26c431c19a0e33b9ff13f748e30841f7`; `2eddd6ab26c431c19a0e33b9ff13f748e30841f7` to `3acf6518d60eae9a486b51a37982d01862f9da6f`. Exact identities and intentions are in the plan evidence directory.
- `cont1-build-3.log` passed. `cont1-audit.log` failed with 4/6: `relativeOrder_before` and `relativeOrder_after` are absent. All four present theorem statements and allowed-axiom checks passed.
- Acceptance remains open; prove the first- and last-anchor placement rules and rerun both gates. No counterexample was established.

## Continuation 2

- Added first_position and proved relativeOrder_before. Source edits: 3acf6518d60eae9a486b51a37982d01862f9da6f -> 6c677b7af5e6519c4939c60c50e86dc0b9236b1c; 6c677b7af5e6519c4939c60c50e86dc0b9236b1c -> cdf9c1cfa5ee5e321959bebcabf0e6b7075c1249; cdf9c1cfa5ee5e321959bebcabf0e6b7075c1249 -> e93a7e90115223f8722d634e6f04e695568a9dad. Intentions and attempts are in the plan evidence directory.
- cont2-build-3.log passed; cont2-audit.log failed with 5/6 because relativeOrder_after is absent. The five present theorem statements and allowed-axiom checks passed.
- Acceptance remains open. Prove last-anchor placement and rerun both gates. No counterexample established.

## Current handoff

- Fresh build passed (`final-build.log`, exit 0); fresh audit failed (`final-audit.log`, exit 1), reporting 5/6 because `relativeOrder_after` remains absent. No counterexample established. Acceptance remains open.
- The prior audit.ts review findings are outside this plan's writePaths and require their owning plan's resolution.

## Continuation 3

- Proved `relativeOrder_after` with the exact design statement, using last-anchor decomposition and its filtered index. Source edits: e93a7e90115223f8722d634e6f04e695568a9dad -> e555a2a4d4152be17e7a042ac4055313394cd5fc; e555a2a4d4152be17e7a042ac4055313394cd5fc -> 5516fbf67979e920a4e2a1524f48c5e9a7c79f2c; 5516fbf67979e920a4e2a1524f48c5e9a7c79f2c -> 1ed1f84b433cdf493cfcb4facf768b96a8611a59; 1ed1f84b433cdf493cfcb4facf768b96a8611a59 -> 72b1e9f35f708db1a7a1378d029082f286932d9f; 72b1e9f35f708db1a7a1378d029082f286932d9f -> 583386e2d53be65e2d3608f262d05d465512ddaf; 583386e2d53be65e2d3608f262d05d465512ddaf -> 6cddbed6cf4868c25ba1c99a96fedcbceb7106b6; 6cddbed6cf4868c25ba1c99a96fedcbceb7106b6 -> ebf925708c97d729bd486c7098dcca25556fd019. Per-edit intentions are in `cont3-intent*.txt`.
- Final build passed (`cont3-final-build.log`, exit 0); six-theorem audit passed (`cont3-final-audit.log`, exit 0). Acceptance criterion is satisfied on the shared working tree; independent review remains downstream.

# fv-31-undo-stack-proofs progress

Status: incomplete. The accepted fv-15 dependency was present. Design section 6.6 and the plan were read before implementation.

- Created `formal/Nodetto/Undo/Stack.lean` (before: absent; initial blob `255ae018542e39f03563923aaf9f9f5dafc4ce84`; second `7061c60e0d9e7767f8e506013cb18e9c5ffe675f`; current `c0d5e5bbc0df84af9c5c576d3142d9f06480a978`). Six exact statements are proved: undo_then_redo, redo_then_undo, push_clears_redo, push_empty, abortBatch_keeps_stacks, batch_inverts. Per-edit intentions and prior content are in `tmp/fv-s942/fv-31-undo-stack-proofs/intent-{1,2,3}.txt` and `stack-before-{2,3}.txt`.
- Appended Stack import to `formal/Nodetto/Undo.lean` (before `b9147162357532c24f9f1f1787648552213f308c`; after `7a86595a5c1a115a86fb161d17818f95f7d51c26`); intention in `intent-root.txt`.
- Final build `build.log` exits 0. Full nine-name `audit.log` exits 1 because batch_one_step, batch_noop and abortBatch_reverts are absent. No counterexample has been established. Prove the pending-entry fold invariant and these exact statements before acceptance; do not mark the plan complete.
- Earlier failed build attempt 2 and its correction are retained in `build-attempt-2.log` and `build-attempt-3.log`. Evidence is from the shared working tree, not a final integration review.

## Continuation 1: implementation complete

The earlier incomplete status and failed audit above are superseded. `fold_batch` and snoc induction prove the pending entry invariant; the exact `batch_one_step`, `batch_noop`, and `abortBatch_reverts` statements now compile. `continuation-build-7.log` and `continuation-audit.log` each exited 0 on the shared tree; audit reports statements Undo and audit ok for all nine names. Formal reviews remain downstream.

`Stack.lean` before/after hashes for edits 1–7: c0d5e5bbc0df84af9c5c576d3142d9f06480a978 → d411cebe8875fca803109b03f0c4e956f487cea8 → 17071c4766daa4b0fb40ea6269f6d47335d46c85 → 81c936bcf9e86fb697401977c7194f3839398af3 → 85f293dccd068eac0f58355be585b493f30b7512 → b9e9f8ec344eccc0053842088711c82f1d04a776 → 10ec2879e099a1be27a74628bd933911139d0636 → 7eea6ae3d2dce6f320a324e6f3054679bae61ed6. Each read snapshot and intended hunk is retained under `tmp/fv-s942/fv-31-undo-stack-proofs/continuation-before-{1..7}.txt` and `continuation-intent-{1..7}.txt`. Failed intermediate build logs are retained there.

The active plan acceptance criterion was marked complete; its before and after hashes are recorded in the continuation plan evidence. Progress before this append: 3a06964925cb143b50731bad8e94ddc17bba90ba; its after hash is recorded in `continuation-progress-after.hash`.

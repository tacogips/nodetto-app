# fv-24b progress

Dependency fv-24a is accepted by dispatch. The G2 statements match design 6.2.1; no argument adaptation was needed. The argument order is elements, target, moved, rest, done, cmds, state, confirmed by the kernel-checked equations.

The temporary signature probe printed:

    reorderCommands.loop : List (ElemId × Key) →
      List ElemId →
        List ElemId → List ElemId → List (ElemId × Key) → List Reorder → Rng → Except String (List Reorder × Rng)

Source edits (git hash-object before -> after):
- Signature probe: 91f84f11c485f52eefb0bc732153b38f69de8b49 -> a80d401a1c5e9434d70ee76c8c64cda10ab9efef.
- Replace probe with G2 declarations: a80d401a1c5e9434d70ee76c8c64cda10ab9efef -> 4e64723386a47eb0b84f57b2a7208e9db1ddeb87.
- Fix proof simplification and split bounds: 4e64723386a47eb0b84f57b2a7208e9db1ddeb87 -> e9712400c36113a0f6f7c6616c8380b274c14212.

Evidence: tmp/fv-s959/fv-24b-reorder-loop-eqs/. Signature build exited 0; build-attempt-1 exited 1 due to proof simplification, corrected in edit 3; build-attempt-2 exited 0. Final build and audit logs record the final source. No build-lock failure occurred.

Plan edit hash: cc1ef6995dab3a51da2fdc054d74f95b0b51cc7e -> 609d77958b710e77f95d90e1e8da624e28321d6a. Progress was initially absent; initial content hash 9f9142c37c66da263c78d22312f7788f6c6d67c5. Final source build, audit, declaration count, probe removal and signature checks all exited 0. Final review is pending.

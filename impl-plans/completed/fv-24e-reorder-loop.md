# fv-24e-reorder-loop

- planId: fv-24e-reorder-loop
- planPath: impl-plans/active/fv-24e-reorder-loop.md
- progressPath: impl-plans/progress/fv-24e-reorder-loop.md
- taskId: fv-s959
- wave: 5
- dependsOn: fv-24d-reorder-steps (same file)
- Design: section 6.2.1, group G5.
- writePaths: `formal/Nodetto/ZOrder/Reorder.lean`, `impl-plans/progress/fv-24e-reorder-loop.md`,
  `tmp/fv-s959/fv-24e-reorder-loop`, `target`, `tmp/cad3d`, `formal/.lake`
- sharedPaths: none
- artifactRoots: `target`, `tmp/cad3d`, `formal/.lake`

Follow `impl-plans/active/fv-00-overview.md`.

## Intent and context

Prove that the loop always returns `.ok` with a command list satisfying any
property `P` that holds for every renumber result and for every finished
`done` list (`loop_ok`). Also show that, for a finished `done`, the applied
keys along `target` are sorted (`loop_final`, via `done_applied_keys`).

## Changes (file-level)

`formal/Nodetto/ZOrder/Reorder.lean`: append. Copy from design 6.2.1 G5, using
the loop signature recorded in `impl-plans/progress/fv-24b-reorder-loop-eqs.md`
for `loop_ok`:

- `private theorem done_applied_keys`: `List.map_map`, `List.map_congr_left`.
  For `p` with `moved.contains p.1 = true`, show `⟨p.1, p.2⟩ ∈ cmdsOf moved done`.
  The ids of `cmdsOf` are `(done.filter _).map Prod.fst`, a sublist of
  `done.map Prod.fst`, so they are `Nodup` by `List.Nodup.sublist`. Then apply
  `keyOf_apply_member`. For a kept `p`, no command has id `p.1` (that command
  would come from a pair with `moved.contains p.1 = true`), so apply
  `keyOf_apply_other` and then `hkept`.
- `private theorem loop_final`: `subst hd`, rewrite with `done_applied_keys`.
- `private theorem loop_ok`: induction on `rest` generalizing `done cmds state`.
  - nil: `loop_nil_eq`; rewrite `cmds` with `hinv.hcmds`; apply `hfin`
    (`hinv.hpre` simplifies to `done.map Prod.fst = target`).
  - cons, kept: `loop_kept_eq`, then the IH with `inv_kept`.
  - cons, moved: case on `done.getLast?.map Prod.snd` and on
    `(tail.find? _).map (keyOf elements)`. For `some b`, `some a` with
    `¬ b < a`: `loop_fallback_eq` and `hren state`. Otherwise build `hord`.
    `between_bounds` with the validity clauses of `inv_bounds` gives
    `key, state'` and both bounds. Then `loop_moved_eq`, and the IH with
    `inv_moved`, where `hlo` comes from the third clause of `inv_bounds`.

## Pitfalls

- Keep `P` abstract in `loop_ok`. Do not specialise it to the applied-key
  statement here; fv-24f does that.
- `between_bounds` returns `∃ k r, ... ∧ isFractionalKey k = true ∧ (lower) ∧ (upper)`
  in that order (see `formal/Nodetto/ZOrder/Reorder.lean:between_bounds`).
- Do not try to prove that the fallback never fires. The proof handles it
  through `hren`.
- Same forbidden-word and no-maxHeartbeats rules.

## Non-goals

The final composition and the section 6.2 theorem (fv-24f).

## Acceptance criteria

- `done_applied_keys`, `loop_final` and `loop_ok` exist; the file builds; the
  audit of the two finished theorems exits 0.

## Verification (each must exit 0)

1. `mkdir -p tmp/fv-s959/fv-24e-reorder-loop`
2. `cd formal && mise exec -- lake build Nodetto.ZOrder > ../tmp/fv-s959/fv-24e-reorder-loop/build.log 2>&1`
3. `formal/scripts/audit --module ZOrder --theorem reorderCommands_refuses --theorem reorderCommands_unchanged > tmp/fv-s959/fv-24e-reorder-loop/audit.log 2>&1`
4. `test "$(grep -cE '^private theorem (done_applied_keys|loop_final|loop_ok) ' formal/Nodetto/ZOrder/Reorder.lean)" -eq 3`

## Progress log

Hashes before and after each edit, build attempts with exit codes and log
paths, and any helper statement change.

Implementation complete: G5 lemmas build and the plan-local audit and declaration checks pass. Formal review is pending; details are in `impl-plans/progress/fv-24e-reorder-loop.md`.

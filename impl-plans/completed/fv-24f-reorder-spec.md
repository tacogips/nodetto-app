# fv-24f-reorder-spec

- planId: fv-24f-reorder-spec
- planPath: impl-plans/active/fv-24f-reorder-spec.md
- progressPath: impl-plans/progress/fv-24f-reorder-spec.md
- taskId: fv-s959
- wave: 6
- dependsOn: fv-24e-reorder-loop (same file)
- Design: section 6.2 (`reorderCommands_spec`, binding) and 6.2.1, group G6.
- writePaths: `formal/Nodetto/ZOrder/Reorder.lean`, `impl-plans/progress/fv-24f-reorder-spec.md`,
  `tmp/fv-s959/fv-24f-reorder-spec`, `target`, `tmp/cad3d`, `formal/.lake`
- sharedPaths: none
- artifactRoots: `target`, `tmp/cad3d`, `formal/.lake`

Follow `impl-plans/active/fv-00-overview.md`.

## Intent and context

Compose the earlier groups into `reorderCommands_spec`, exactly as stated in
design section 6.2. This completes job 1. After this plan the audit passes
for all three `reorderCommands_*` statements.

## Changes (file-level)

`formal/Nodetto/ZOrder/Reorder.lean`: append, with `reorderCommands_spec` as
the last declaration before `end Nodetto.ZOrder`.

- `private theorem keys_valid_of_check`: case on `keys.all isFractionalKey`, then `simp_all`.
- `private theorem reorderCommands_valid_eq` (design G6, with the loop
  argument list recorded by fv-24b): first
  `simp only [reorderCommands, target_guard_false elements order hnd hperm hmove, hkeys, Bool.false_eq_true, if_false]`,
  then `rfl`. If `rfl` is blocked by the elaborated pair match, `split`, take
  `congrArg Prod.snd` of the split equation, rewrite, and close the remaining
  fold equality (model lambda against `scanStep elements`) by `rfl`.
- `private theorem reorderCommands_valid_spec`: rewrite with
  `reorderCommands_valid_eq`, then apply `loop_ok` with
  `P := fun cs => ((targetIds elements order).map (keyOf (applyReorders elements cs))).Pairwise (· < ·)`.
  `hren` comes from `renumber_applied_sorted` (nodup from
  `hperm.nodup_iff.mpr hnd`, subset from `targetIds_subset`); `hfin` from
  `loop_final`; `hinv` from `loop_init` with `keys_valid_of_check`. The last
  conjunct comes from `untouched_element elements cs hnd`.
- `theorem reorderCommands_spec`: the statement copied character for character
  from design 6.2 (lines starting `theorem reorderCommands_spec`). Proof:
  `cases hk :` on the key-check Boolean
  `(!(elements.map Prod.snd).all isFractionalKey || (elements.map Prod.snd).eraseDups.length != (elements.map Prod.snd).length)`;
  `false` gives `reorderCommands_valid_spec`, `true` gives the existing
  `reorderCommands_renumber_spec`.

## Pitfalls

- The audit elaborates `example : ∀ B, C := @reorderCommands_spec` against the
  design text. Any added hypothesis, reordered binder or changed conclusion
  fails. It must be public (not `private`) and in `namespace Nodetto.ZOrder`.
- Do not touch `reorderCommands_refuses` or `reorderCommands_unchanged`.
- If the statement is false (not expected; see design FD2), stop. Record a
  Lean `example`/`#eval` counterexample and the matching TypeScript
  `reorderCommands` input in the progress file, and report
  `needs_design_revision`. Never weaken the statement.
- Same forbidden-word and no-maxHeartbeats rules.

## Non-goals

docs/formal.md, the umbrella module and the prove task (fv-50-docs).

## Acceptance criteria

- The audit passes for `reorderCommands_refuses`, `reorderCommands_unchanged`
  and `reorderCommands_spec`, with only propext, Classical.choice and Quot.sound.

## Verification (each must exit 0)

1. `mkdir -p tmp/fv-s959/fv-24f-reorder-spec`
2. `cd formal && mise exec -- lake build Nodetto.ZOrder > ../tmp/fv-s959/fv-24f-reorder-spec/build.log 2>&1`
3. `formal/scripts/audit --module ZOrder --theorem reorderCommands_refuses --theorem reorderCommands_unchanged --theorem reorderCommands_spec > tmp/fv-s959/fv-24f-reorder-spec/audit.log 2>&1`
4. `formal/scripts/audit --module ZOrder --vectors > tmp/fv-s959/fv-24f-reorder-spec/vectors.log 2>&1`
   (z-order vectors still fresh, which also checks the model is untouched)

## Progress log

Hashes before and after each edit, build and audit attempts with exit codes
and log paths. Also append one line to this file saying that plans
fv-24a to fv-24f together complete fv-24-zorder-reorder.

Plans fv-24a through fv-24f together complete fv-24-zorder-reorder; formal review remains pending.

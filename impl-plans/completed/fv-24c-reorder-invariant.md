# fv-24c-reorder-invariant

- planId: fv-24c-reorder-invariant
- planPath: impl-plans/active/fv-24c-reorder-invariant.md
- progressPath: impl-plans/progress/fv-24c-reorder-invariant.md
- taskId: fv-s959
- wave: 3
- dependsOn: fv-24b-reorder-loop-eqs (same file; uses `cmdsOf` and the G1 scan lemma)
- Design: section 6.2.1, group G3.
- writePaths: `formal/Nodetto/ZOrder/Reorder.lean`, `impl-plans/progress/fv-24c-reorder-invariant.md`,
  `tmp/fv-s959/fv-24c-reorder-invariant`, `target`, `tmp/cad3d`, `formal/.lake`
- sharedPaths: none
- artifactRoots: `target`, `tmp/cad3d`, `formal/.lake`

Follow `impl-plans/active/fv-00-overview.md`.

## Intent and context

Define the loop invariant `LoopInv`, prove that it holds at the start of the
loop, and prove the bound facts a moved step needs: `below` and `above` are
valid keys, and a key above `below` is above every key in `done`.

## Changes (file-level)

`formal/Nodetto/ZOrder/Reorder.lean`: append. Copy the statements from design 6.2.1 G3:

- `private theorem last_bound`: get `ks = init ++ [b]` from
  `List.getLast?_eq_some_iff` (or prove it by induction if that name is
  missing), then use `List.pairwise_append`.
- `private theorem find_first_kept`: induction on `tail` with `List.find?_cons`
  and `List.filter_cons`; `List.pairwise_cons` on the kept filter gives the
  strict step.
- `private structure LoopInv ... : Prop` with fields `hpre hsorted hvalid hrestValid
  hrestSorted hbelow hcmds hkept` exactly as in the design.
- `private theorem loop_init`: `hrestSorted` is
  `(scan_kept_sorted elements target none [] hn (by simp)).1`, `hrestValid` uses
  `keyOf_valid_of_member` with `hsub`, and the remaining fields are `simp [cmdsOf]`
  or vacuous.
- `private theorem inv_bounds`: use `List.getLast?_map` to move between
  `done.getLast?.map Prod.snd` and `(done.map Prod.snd).getLast?`; when
  `getLast?` is `none`, `done = []` and the third clause is vacuous;
  `List.mem_of_find?_eq_some` plus `hrestValid` gives the second clause.

Imitate `formal/Nodetto/ZOrder/Reorder.lean:keyOf_valid_of_member` and `sorted_keys_append`.

## Pitfalls

- The field names start with `h` on purpose: a field named `cmds` would shadow
  the parameter `cmds`. Keep the names.
- `private structure` in `Prop` is allowed. Do not turn it into a `def` with
  `∧`, because later plans use field projections (`h.hsorted` and so on).
- `LoopInv` does not mention `reorderCommands.loop`, so the loop signature
  recorded by fv-24b does not affect this plan.
- Same forbidden-word and no-maxHeartbeats rules. Never change existing
  declarations.

## Non-goals

Invariant preservation (fv-24d), the loop theorem (fv-24e).

## Acceptance criteria

- `last_bound`, `find_first_kept`, `LoopInv`, `loop_init` and `inv_bounds`
  exist; the file builds; the audit of the two finished theorems exits 0.

## Verification (each must exit 0)

1. `mkdir -p tmp/fv-s959/fv-24c-reorder-invariant`
2. `cd formal && mise exec -- lake build Nodetto.ZOrder > ../tmp/fv-s959/fv-24c-reorder-invariant/build.log 2>&1`
3. `formal/scripts/audit --module ZOrder --theorem reorderCommands_refuses --theorem reorderCommands_unchanged > tmp/fv-s959/fv-24c-reorder-invariant/audit.log 2>&1`
4. `test "$(grep -cE '^private (theorem|structure) (last_bound|find_first_kept|LoopInv|loop_init|inv_bounds) ' formal/Nodetto/ZOrder/Reorder.lean)" -eq 5`

## Progress log

Hashes before and after each edit, build attempts with exit codes and log
paths, and any helper statement change with its reason.

Implementation complete: all five G3 declarations build and the two-theorem audit passes. See `impl-plans/progress/fv-24c-reorder-invariant.md`; formal reviews remain pending.

# fv-24d-reorder-steps

- planId: fv-24d-reorder-steps
- planPath: impl-plans/active/fv-24d-reorder-steps.md
- progressPath: impl-plans/progress/fv-24d-reorder-steps.md
- taskId: fv-s959
- wave: 4
- dependsOn: fv-24c-reorder-invariant (same file; uses `LoopInv`, `find_first_kept`)
- Design: section 6.2.1, group G4.
- writePaths: `formal/Nodetto/ZOrder/Reorder.lean`, `impl-plans/progress/fv-24d-reorder-steps.md`,
  `tmp/fv-s959/fv-24d-reorder-steps`, `target`, `tmp/cad3d`, `formal/.lake`
- sharedPaths: none
- artifactRoots: `target`, `tmp/cad3d`, `formal/.lake`

Follow `impl-plans/active/fv-00-overview.md`.

## Intent and context

Prove that one loop step preserves `LoopInv`, for a kept id (`inv_kept`) and
for a moved id that receives a key strictly between the bounds (`inv_moved`).

## Changes (file-level)

`formal/Nodetto/ZOrder/Reorder.lean`: append. Copy `private theorem inv_kept`
and `private theorem inv_moved` from design 6.2.1 G4. Prove each field of the
new `LoopInv` separately (`refine ⟨?_, ?_, ...⟩` or `constructor`):

- `hpre`: `simp` with `List.map_append` and `List.append_assoc`.
- `hsorted`: kept, `sorted_keys_append` with `h.hbelow id`; moved,
  `sorted_keys_append` with `hlo`.
- `hvalid`: kept, `h.hrestValid id`; moved, `hv`.
- `hrestValid`: `tail` is a subset of `id :: tail`.
- `hrestSorted`: kept, the kept filter of `id :: tail` is `id :: (tail filter)`,
  so take the tail of `List.pairwise_cons`; moved, the two filters are equal
  because `moved.contains id = true`.
- `hbelow`: for `id'` kept in `tail` and `k` in the new `done` keys. Either `k`
  is an old key (old `hbelow`, with `id' ∈ id :: tail`) or the new key. For a
  kept step, the new key `keyOf elements id` is below `keyOf elements id'` by
  `List.pairwise_cons` on `hrestSorted`. For a moved step, `find_first_kept`
  gives `f` with `find? = some f`, then `hhi (keyOf elements f)` (via
  `Option.map`) and the transfer clause give `key < keyOf elements id'`.
- `hcmds`: unfold `cmdsOf`; `List.filter_append` adds nothing for a kept pair
  and exactly `⟨id, key⟩` for a moved pair.
- `hkept`: the new pair is kept with its original key, or it is moved and the
  clause is vacuous.

## Pitfalls

- `(done ++ [(id, key)]).map Prod.snd` must be normalised with
  `List.map_append` before applying `sorted_keys_append`.
- Membership in `(id :: tail).filter p` with `p id = true` versus `false`: use
  `List.filter_cons` with the Bool hypothesis, not `decide`.
- Same forbidden-word and no-maxHeartbeats rules. Never change earlier
  declarations, except a recorded strengthening of a private helper.

## Non-goals

The loop induction (fv-24e).

## Acceptance criteria

- `inv_kept` and `inv_moved` exist; the file builds; the audit of the two
  finished theorems exits 0.

## Verification (each must exit 0)

1. `mkdir -p tmp/fv-s959/fv-24d-reorder-steps`
2. `cd formal && mise exec -- lake build Nodetto.ZOrder > ../tmp/fv-s959/fv-24d-reorder-steps/build.log 2>&1`
3. `formal/scripts/audit --module ZOrder --theorem reorderCommands_refuses --theorem reorderCommands_unchanged > tmp/fv-s959/fv-24d-reorder-steps/audit.log 2>&1`
4. `test "$(grep -cE '^private theorem (inv_kept|inv_moved) ' formal/Nodetto/ZOrder/Reorder.lean)" -eq 2`

## Progress log

Hashes before and after each edit, build attempts with exit codes and log
paths, and any helper statement change.

Implementation: G4 lemmas implemented and plan gates passed; formal review pending.

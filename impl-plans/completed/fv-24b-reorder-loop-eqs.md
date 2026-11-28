# fv-24b-reorder-loop-eqs

- planId: fv-24b-reorder-loop-eqs
- planPath: impl-plans/active/fv-24b-reorder-loop-eqs.md
- progressPath: impl-plans/progress/fv-24b-reorder-loop-eqs.md
- taskId: fv-s959
- wave: 2
- dependsOn: fv-24a-reorder-scan (same file)
- Design: section 6.2.1, group G2 and the "Loop signature" paragraph.
- writePaths: `formal/Nodetto/ZOrder/Reorder.lean`, `impl-plans/progress/fv-24b-reorder-loop-eqs.md`,
  `tmp/fv-s959/fv-24b-reorder-loop-eqs`, `target`, `tmp/cad3d`, `formal/.lake`
- sharedPaths: none
- artifactRoots: `target`, `tmp/cad3d`, `formal/.lake`

Follow `impl-plans/active/fv-00-overview.md`.

## Intent and context

Isolate all do-notation unfolding of the model's inner `let rec loop` (in
`formal/Nodetto/ZOrder/Model.lean:reorderCommands`, lines 80-94) in four
equation lemmas, one per path: end of list, kept id, in-loop renumber
fallback, and moved id with a `keyBetween` key. Later plans reason only
through these lemmas.

## Changes (file-level)

`formal/Nodetto/ZOrder/Reorder.lean`: append after the G1 lemmas. Copy the
statements from design 6.2.1 G2:

- `private def cmdsOf`
- `private theorem loop_nil_eq`, `loop_kept_eq`, `loop_fallback_eq`, `loop_moved_eq`

First step: add a temporary `#check @reorderCommands.loop` line, build, and
record the printed signature in the progress file. Then delete the line. If
the captured leading arguments are not `elements target moved` (for example
`elements order moved` with `targetIds elements order` inlined, or a
different order), write the G2 statements with the actual argument list
(instantiate `target` as Lean requires). Record the final form verbatim in
the progress file; fv-24e and fv-24f use it.

Proof approach: `simp only [reorderCommands.loop]` (or `rw [reorderCommands.loop]`
/ `unfold`), then the case hypothesis. For the moved cases, `split` on the
`match (below, above)` and close with `simp_all`. Reduce `Except` binds with
the simp set used in `formal/Nodetto/ZOrder/Reorder.lean:reorderCommands_renumber_spec`
(`Bind.bind, Except.bind, Pure.pure, Except.pure`). For `loop_fallback_eq`,
`cases` on `renumber target state` if `x >>= pure` remains.

## Pitfalls

- `moved.contains id` is a `Bool`, and the model tests `!moved.contains id`.
  Rewrite with the hypothesis before splitting.
- `return ← renumber target state` is an early return. The fallback result is
  exactly `renumber target state`, possibly wrapped in a bind with `pure`.
- In `loop_moved_eq`, the `if let` guard is skipped when either bound is `none`
  or `b < a`. `hord` covers all three cases, so case on both options inside the
  proof.
- Do not change `Model.lean` (the model is accepted and vectors depend on it).
- Same forbidden-word and no-maxHeartbeats rules as fv-24a. Remove the
  temporary `#check` before the final build.
- You may only adapt the argument list of these private helpers. Never change
  the design 6.2 theorems.

## Non-goals

Invariant lemmas, `reorderCommands_spec`.

## Acceptance criteria

- `cmdsOf` and the four equation lemmas exist, the actual loop signature is
  recorded in the progress file, the file builds without the `#check`, and the
  audit of the two finished theorems exits 0.

## Verification (each must exit 0)

1. `mkdir -p tmp/fv-s959/fv-24b-reorder-loop-eqs`
2. `cd formal && mise exec -- lake build Nodetto.ZOrder > ../tmp/fv-s959/fv-24b-reorder-loop-eqs/build.log 2>&1`
3. `formal/scripts/audit --module ZOrder --theorem reorderCommands_refuses --theorem reorderCommands_unchanged > tmp/fv-s959/fv-24b-reorder-loop-eqs/audit.log 2>&1`
4. `test "$(grep -cE '^private (def|theorem) (cmdsOf|loop_nil_eq|loop_kept_eq|loop_fallback_eq|loop_moved_eq) ' formal/Nodetto/ZOrder/Reorder.lean)" -eq 5`
5. `! grep -n '#check' formal/Nodetto/ZOrder/Reorder.lean`
6. `grep -n 'reorderCommands.loop' impl-plans/progress/fv-24b-reorder-loop-eqs.md` (signature recorded)

## Progress log

Hashes before and after each edit, the `#check` output, build attempts with
exit codes and log paths, and the final helper statements if they differ
from design 6.2.1.

Implementation complete: G2 declarations and loop signature are recorded in
the progress file. Final verification evidence is under
tmp/fv-s959/fv-24b-reorder-loop-eqs/; formal review remains pending.

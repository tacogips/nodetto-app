# fv-24a-reorder-scan

- planId: fv-24a-reorder-scan
- planPath: impl-plans/active/fv-24a-reorder-scan.md
- progressPath: impl-plans/progress/fv-24a-reorder-scan.md
- taskId: fv-s959 (finishing run; evidence root `tmp/fv-s959`)
- wave: 1
- dependsOn: none (fv-21-fractional-keys and fv-23-zorder-relative are already accepted)
- Design: `design-docs/specs/design-formal-verification.md` section 6.2.1, group G1.
- writePaths: `formal/Nodetto/ZOrder/Reorder.lean`, `impl-plans/progress/fv-24a-reorder-scan.md`,
  `tmp/fv-s959/fv-24a-reorder-scan`, `target`, `tmp/cad3d`, `formal/.lake`
- sharedPaths: none
- artifactRoots: `target`, `tmp/cad3d`, `formal/.lake`

Follow `impl-plans/active/fv-00-overview.md` (proof integrity rules).

## Intent and context

This is the first of six chained plans (fv-24a to fv-24f) that finish
`reorderCommands_spec` (design 6.2). `reorderCommands_refuses` and
`reorderCommands_unchanged` are already proved in
`formal/Nodetto/ZOrder/Reorder.lean` and must keep passing. This plan adds
the scan lemmas: along the target order, the original keys of the kept ids
(those the `highestKept` fold does not mark as moved) strictly increase.

## Changes (file-level)

`formal/Nodetto/ZOrder/Reorder.lean`: append after `reorderCommands_unchanged`,
before `end Nodetto.ZOrder`. Copy each statement verbatim from design 6.2.1 G1:

- `private def scanStep` (text copied from the fold lambda in
  `formal/Nodetto/ZOrder/Model.lean:reorderCommands`, lines 74-78, so that it is
  definitionally equal to the model's step).
- `private theorem scanStep_mem`: proof is `exact scan_moved_mem ...`. If defeq
  `exact` fails, redo the induction of the existing `scan_moved_mem` with
  `simp only [List.foldl_cons, scanStep]`.
- `private theorem scanStep_preserved`: the same, from `scan_moved_preserved`.
- `private theorem scan_kept_sorted`: induction on `xs` generalizing
  `highest moved`. At `x :: xs`, rewrite with `List.foldl_cons`; the final
  moved list of `x :: xs` is the final moved list of `xs` from the stepped
  state. Case on `highest` and on `h < keyOf elements x`.

Imitate: `formal/Nodetto/ZOrder/Reorder.lean:scan_moved_mem` (case structure),
`fold_sorted` (`List.lt_trans` chaining), `kept_filter_step` (`List.contains_iff_mem`).

## Pitfalls

- In the kept branches, show that `x` is NOT in the final moved list: by
  `scanStep_mem` it would be in `moved` (excluded by `hfresh`) or in `xs`
  (excluded by `xs.Nodup`). In the marked branch, `x` IS in the final list
  (`scanStep_preserved` with `moved ++ [x]`), so the filter drops it.
- In the marked branch, the IH needs `hfresh` for `moved ++ [x]`, which uses
  `x ∉ xs`.
- `!l.contains x` is a `Bool`. Turn it into `x ∉ l` with
  `List.contains_iff_mem` or `List.elem_iff`, not with `decide`.
- Do not edit or delete existing lemmas, the two finished theorems, `Model.lean`,
  `formal/Nodetto/ZOrder.lean` or `formal/scripts/audit.ts`.
- Forbidden words anywhere in `.lean` files, comments included: sorry, admit,
  axiom, native_decide, unsafe, partial, opaque, implemented_by, extern,
  skipKernelTC, #exit. No `maxHeartbeats` option.
- If a G1 statement turns out false, you may strengthen it (for example add a
  needed side condition to this private helper). Record the exact change and the
  reason in the progress file; later plans use the recorded form.

## Non-goals

Loop lemmas (fv-24b onwards), `reorderCommands_spec`, any file other than the
writePaths.

## Acceptance criteria

- The four G1 declarations exist with the design statements (or recorded
  strengthened forms), the file builds, and the audit of the two finished
  theorems still exits 0.

## Verification (each must exit 0; logs under `tmp/fv-s959/fv-24a-reorder-scan/`)

1. `mkdir -p tmp/fv-s959/fv-24a-reorder-scan`
2. `cd formal && mise exec -- lake build Nodetto.ZOrder > ../tmp/fv-s959/fv-24a-reorder-scan/build.log 2>&1`
   (retry up to three times on a build-lock failure; never `lake clean`)
3. `formal/scripts/audit --module ZOrder --theorem reorderCommands_refuses --theorem reorderCommands_unchanged > tmp/fv-s959/fv-24a-reorder-scan/audit.log 2>&1`
   (log shows only propext / Classical.choice / Quot.sound)
4. `test "$(grep -cE '^private (def|theorem) (scanStep|scanStep_mem|scanStep_preserved|scan_kept_sorted) ' formal/Nodetto/ZOrder/Reorder.lean)" -eq 4`

## Progress log

`impl-plans/progress/fv-24a-reorder-scan.md`: `git hash-object` of
Reorder.lean before and after each edit, every build attempt with its exit code
and log path, and any helper statement change.

Implementation progress: G1 declarations and focused verification completed; see
`impl-plans/progress/fv-24a-reorder-scan.md`. Review remains downstream.

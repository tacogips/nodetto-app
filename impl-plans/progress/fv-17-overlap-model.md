# fv-17-overlap-model progress

Design alignment: section 6.8 and assumptions B6/B7; dependencies fv-01, fv-02 and fv-05 are accepted by dispatch. The model follows the two sorted sweeps, signed expiry counts, branch selection, and the X sweep with a max-Y segment tree. Proofs and TypeScript conformance belong to fv-37, fv-38 and fv-47.

Edit history (git blob hashes; absent means the file did not exist):
- Model.lean absent -> d358aef8f3cd5a55846625417e1ddf9b7c98d9a7 -> c2effd22cd2e4d1600dbeec8538f0b2c842f4c16; the second edit implements binary search. Intent and before snapshot: tmp/fv-s942/fv-17-overlap-model/model-intent-{1,2}.txt and model-before-2.txt.
- Overlap.lean absent -> 23176635f989858e333b40be7a1cfbb1ff1a6104.
- Vectors.lean a8aef606d3dbc6b2f7a7aa9c257bf98338eb3912 -> 637c59cbd17682717dde3c2902ceccc2a0d0aa3f -> 5141d1cc884bae35e802d805115463fd6f80a358; per-edit intent and snapshots in tmp/fv-s942/fv-17-overlap-model/vectors-agent/.
- overlap.json absent -> afe0da5e1f59c179c17e91eaca36fb0a29a7b18f; generator evidence in vectors-agent/.
- Progress log first version d20bf3af3149f929d14d49cb7180d4254910470b; second edit corrected the recorded command quotation.
- Active plan a4669b5c7f22dca0dc4d68486a531f8089199316 -> ef9d770707c631e66c9edca9740e354127930be3; completion criterion marked.
- This progress record was absent; its after hash is recorded in tmp/fv-s942/fv-17-overlap-model/progress-hash.txt.

Verification on the shared moving tree:
- `cd formal && mise exec -- lake build Nodetto.Overlap > ../tmp/fv-s942/fv-17-overlap-model/build.log 2>&1`: exit 0.
- `formal/scripts/audit --module Overlap --vectors > tmp/fv-s942/fv-17-overlap-model/audit.log 2>&1`: exit 0, token scan, build and fresh vectors passed.
- `{ test "$(grep -c '"tree":true' formal/vectors/overlap.json)" -ge 20; } > tmp/fv-s942/fv-17-overlap-model/tree-count.log 2>&1`: exit 0; 24 cases.
- 213 total cases; the generator checks 21 each X wins, Y wins and ties with differing visit order. Prior build attempt and vector-generation logs are retained in the evidence directory.

Formal review, integration and stable combined-tree checks are downstream.

Current-run author self-check: accepted dispatch dependencies confirmed; model and vectors match design sections 6.8 and 7. The following gates passed on the shared moving tree: `cd formal && mise exec -- lake build Nodetto.Overlap` (build-rerun.log, exit 0), `formal/scripts/audit --module Overlap --vectors` (audit-rerun.log, exit 0), and tree count (tree-count-rerun.log, exit 0, 24 cases). Generator checks 21 discriminating cases in each of the X, Y and tie categories; 213 cases total. Proof and conformance work remain assigned to downstream plans. Formal review and integration remain pending.

Current verification: build-current.log, audit-current.log and tree-count-current.log each exited 0 on the shared moving tree. The audit regenerated and compared vectors; the tree count is recorded in its log. The model, vector generator and acceptance criteria were reviewed against the accepted plan and design; downstream proof and conformance plans retain their assigned scope.

Step 6 current-source verification: build-step6-final.log, audit-step6-final.log, tree-step6-final.log and cases-step6-final.log all exit 0. There are 213 cases, including 24 tree cases; the generator checks 21 discriminating cases in each axis category. The source hashes match the earlier model and vector edit history. Verification ran on the shared working tree; downstream review and integration remain pending.

Review repair FV17-TREE-VECTORS-TRIVIAL: before hashes Vectors.lean 5141d1cc884bae35e802d805115463fd6f80a358, overlap.json afe0da5e1f59c179c17e91eaca36fb0a29a7b18f, progress fdf0837c83636417edf213c0e8b826397717ade2. Intent: add mixed crowded cases and generator checks, preserve existing cases and model.

FV17-TREE-VECTORS-TRIVIAL repair: Vectors.lean 5141d1cc884bae35e802d805115463fd6f80a358 -> d358e897ed18118cc9b49cd8052e8d4b300440b0; overlap.json afe0da5e1f59c179c17e91eaca36fb0a29a7b18f -> 0f3e8a4aa0b13a677a0fa89ef88a03d525eac3ed. Model.lean remains c2effd22cd2e4d1600dbeec8538f0b2c842f4c16. Six mixed tree fixtures cover expiry, touching, Y separation, partial overlap and inverted X bounds. Generator checks branch, disjoint axes, non-clique visits and normalized brute-force equality for mixed cases, plus equality for existing crowded cases. Existing guards and cases remain. Generator exit 0; build-repair.log, audit-repair.log, tree-repair.log and mixed-repair.log exit 0; mixed check reports 219 total, 30 tree, 6 mixed. Forbidden-token grep returns 1 with no matches (tokens-repair.log). Shared-tree verification; independent re-review and integration remain pending.

Step 6 current verification (shared tree): build-step6-current2.log, audit-step6-current2.log and tree-step6-current2.log exited 0; 30 tree cases. Source blob identities: Model c2effd22cd2e4d1600dbeec8538f0b2c842f4c16, Vectors d358e897ed18118cc9b49cd8052e8d4b300440b0, root 23176635f989858e333b40be7a1cfbb1ff1a6104, JSON 0f3e8a4aa0b13a677a0fa89ef88a03d525eac3ed. Progress before edit 944ee0a6b0ee72fb30d76fa3dd37b7e250f0aa79; after identity recorded in hashes-after-current2.txt. Formal review and integration remain downstream.

# fv-12-nmesh-primitives-model progress

The accepted dependencies fv-01, fv-02 and fv-04 are present in the dispatch acceptance list. The plan matches design section 6.3 and the cited TypeScript. Added the total primitive model and module import; vectors and proofs belong to downstream plans.

Git blob hashes before/after:
- `formal/Nodetto/Nmesh/Model.lean`: absent -> `8823035b661d495d19de46e69a3a4706590df5fa` (intermediate `07dc70bd33ab0d1f73b5e894adab5ce683c2`, `ac946da5077a407eda969c6f802ad7769c68ee69`).
- `formal/Nodetto/Nmesh.lean`: absent -> `2442dbed9f4781fb89bd70f0b045999bf700d15e`.
- `impl-plans/active/fv-12-nmesh-primitives-model.md`: `137277e72476140ff31c9e0720e00e62bb26e179` -> `238ae84bd25208e0ab3f3a9a357c1a3901eca6b4`.
- This progress file: absent before creation; after hash recorded in `tmp/fv-s942/fv-12-nmesh-primitives-model/progress-hash.txt`.

The final build exited 0, including the CRC-32 literal example; see `tmp/fv-s942/fv-12-nmesh-primitives-model/build.log`. The forbidden-token check exited 0; see `forbidden.log`. Initial builds failed on a reserved identifier; attempts 1 and 2 are preserved in the evidence directory. Builds use the shared moving tree. Formal review and downstream codec, proofs, and vectors remain assigned to later workflow steps.

Rerun self-check: current model hash `8823035b661d495d19de46e69a3a4706590df5fa`; root hash `2442dbed9f4781fb89bd70f0b045999bf700d15e`. The focused module build and forbidden-token gate both exited 0; logs are `build-rerun.log` and `forbidden-rerun.log` in the plan evidence directory. Progress pre-edit hash: `018d9f0aa0f4429facbe5eb467c4206d00b988da`; post-edit hash is recorded in `progress-rerun-hash.txt`.

Current Step 6 self-check: model `8823035b661d495d19de46e69a3a4706590df5fa` and root `2442dbed9f4781fb89bd70f0b045999bf700d15e` are unchanged. Focused build and forbidden-token checks exited 0 on the shared moving tree; evidence: `build-step6-current.log` and `forbidden-step6-current.log`. Progress pre-edit hash: `cbcceb0adde278e622827b3da50dd314b71074f7`; post-edit hash is recorded in `progress-hash-step6-current.txt`. The acceptance criterion remains complete; dependent proofs and vectors and formal review remain downstream.

Current node: model and root hashes remain 8823035b661d495d19de46e69a3a4706590df5fa and 2442dbed9f4781fb89bd70f0b045999bf700d15e. The focused build and forbidden-token check exited 0; see build-current-node.log and forbidden-current-node.log. Progress pre-edit hash: 49592d4f265c5844f3873d40603cfb78e350c241; post-edit hash is recorded in progress-current-node.hash. Verification used the shared moving tree.

Latest Step 6 verification: the model and root remain at blobs `8823035b661d495d19de46e69a3a4706590df5fa` and `2442dbed9f4781fb89bd70f0b045999bf700d15e`. The focused build and forbidden-token checks both exited 0; complete logs are `build-step6-new.log` and `forbidden-step6-new.log`. The progress before and after identities are recorded in `progress-before-step6-new.hash` and `progress-after-step6-new.hash`. This verification used the shared moving tree; formal review and downstream plans remain pending.

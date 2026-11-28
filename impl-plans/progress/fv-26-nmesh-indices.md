# fv-26-nmesh-indices progress

Dependency fv-25-nmesh-varint is accepted in the dispatch. The plan matches design section 6.3. The required `decodeIndices_encodeIndices` and `encodeIndices_decodeIndices` proofs have not been implemented. Generalized induction over the running used count and the vertex-count guard remains necessary. No Lean source was changed.

The module build succeeds; the theorem audit fails because both declarations are absent. See `tmp/fv-s942/fv-26-nmesh-indices/build-final.log` and `audit-current.log`. This plan remains incomplete.

Progress file before: absent. Intent: `tmp/fv-s942/fv-26-nmesh-indices/progress-intent.txt`.

## Continuation 1

Implemented both exact design 6.3 statements by induction over the running used count. The forward proof establishes monotonicity of first use and checks the vertex-count guard; the converse handles zero and positive codes and the terminal count. Added the Indices import while retaining the existing imports. Both declared gates pass on the moving shared tree; formal review remains pending.

Edit hashes (git blob IDs): Indices absent → 2d37da81fe4116b7ba50f84b8da28c90e7bf7935 → 1d6ea3251bed1bdb0ea143928539e44e8bdb6688 → fef0fff372d42784f1fc65c4bd6d219769d819ae → bae78bb59066f38e7af6fc1b6c4bc574676c94c2 → 7ae08a99a93d5d1bcd6533232b53824e2c92369a → ad7549ed15d8ae1f272446405d48af7fe6aed395 → 267e0d66ce8520ddd6b33aee9f6898e82c29f915. Root f80b14a995319af1f78104789b58364291240440 → 02d282a8f5dc6b65492ca5da778efa318df1a426. Per-edit intent files are `tmp/fv-s942/fv-26-nmesh-indices/cont1-intent*.txt`. Progress before this edit: f1bac94f2bba278c1228ab94509a917294c6fd6b.

Build: `cont1-build7.log`, exit 0. Audit: `cont1-audit.log`, exit 0. Earlier attempts remain in the evidence directory.

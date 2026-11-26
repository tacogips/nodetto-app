# fv-16-merge-model progress

Status: implementation complete; independent review pending. Accepted design sections 3, 5, 6.7 and 7 match this plan; dependencies fv-01-scaffold, fv-02-audit and fv-05-stubs-b are accepted in the dispatch.

## Initial attempt (superseded)

Before/after git blob hashes: Model.lean absent -> 35267dc11f4079a96d88c7c2e684f24c2404f1e0; Merge.lean absent -> d36904e0d68612e807869ade707b0ec4efd7e162; Vectors.lean a8aef606d3dbc6b2f7a7aa9c257bf98338eb3912 -> 0ec1dd42a80c4eb38e3be17706d3f0e153ab7c70; vectors/merge.json absent -> 094264fe78c6a198c9fe4a0d8a4f033c49119cdf. The active plan remains unchanged (7edbdeff05e06f6f019793051b0f78079e2371a2); its acceptance criterion has not been marked complete.

The model implements the design's definitions and the vector executable emits 223 cases (123 mergeValue and 100 mergeById), including the three surrogate cases. The required equality correctness lemma for the derived nested J BEq is not proved. Lean does not derive LawfulBEq for this nested type, and its generated equality method is opaque to the attempted proof. A total comparator with a correctness proof, or another proven equality implementation, is needed before this plan is complete. Attempts are recorded in tmp/fv-s942/fv-16-merge-model/model-build-*.log. The generated vectors and passing checks do not establish the missing lemma.

Final-source checks on the shared working tree: build.log exit 0; audit.log exit 0 (token scan, build and fresh vectors); surrogates.log exit 0 for at least three matching lines. These are not stable integration verification. Per-edit intentions are in root-intent.txt, model-intent.txt and vectors-intent.txt in the plan-local evidence directory. Subsequent proof and conformance plans and independent reviews remain downstream.

## Continuation 1

Replaced generated nested equality with total mutual `jEq`, `itemsEq`, and `fieldsEq`. The mutually recursive theorems `jEq_correct`, `itemsEq_correct`, and `fieldsEq_correct` establish that each comparison returns true exactly for equal values. Model.lean hash before continuation: 35267dc11f4079a96d88c7c2e684f24c2404f1e0; after: 866f065393bbd97db36871533f28e3c22c170299. Earlier notes about the missing lemma describe the superseded implementation.

The final-source module build, vector audit and surrogate gate all exited 0 in continuation-build.log, continuation-audit.log and continuation-surrogates.log under tmp/fv-s942/fv-16-merge-model/. The audit regenerated the same 223 vectors. Build attempts 1 and 2 are retained there; attempt 3 and the final module build passed. Shared working tree verification is subject to integration rechecks.

Active plan before hash: 7edbdeff05e06f6f019793051b0f78079e2371a2; after: 29d3c023ffa4ca12e1927d540c1ad508721d60a6. Progress before hash: d0f3540fc78cae9646623d413dc5179479299933. Intended edits and source snapshots are retained in the plan-local evidence directory.

Progress intermediate hash before historical-label edit: 5d05298f265b086964406b5b57a349e5d2368b3e.

## Current verification

Rechecked the assigned plan on the shared working tree: current-build.log, current-audit.log and current-surrogates.log each exit 0. current-counts.log records 223 vectors: 123 mergeValue and 100 mergeById. Independent review, proof and conformance plans remain downstream. Progress hash before this append: 368d62b7d3e68b8e81884ad7916badbc431d07eb.

## Dispatch rerun verification

Accepted dependency decisions were confirmed from dispatch. The assigned model and vectors already existed; no source rewrite was needed. Current shared-tree build, vector audit, surrogate and case-count checks exited 0 in rerun-build.log, rerun-audit.log, rerun-surrogates.log and rerun-counts.log. The vectors contain 223 cases (123 mergeValue, 100 mergeById). Independent review and downstream proof and conformance remain pending. The progress file before this edit is captured with its hash in rerun-progress-before.md and rerun-progress-before-hash.txt; its after hash is in rerun-progress-after-hash.txt.

## Step 6 final verification

The accepted design and dispatch dependencies were rechecked. Existing model and vectors were preserved. On the shared tree, the module build, vector freshness audit, surrogate check and case-count check each exited 0 in `tmp/fv-s942/fv-16-merge-model/step6-final-{build,audit,surrogates,counts}.log`. The vectors contain 223 cases: 123 mergeValue and 100 mergeById, with three lines containing `ud800`. Independent review and downstream proof and conformance plans remain pending. The progress file's before hash and edit intention are recorded in `step6-progress-before.hash` and `step6-progress-intent.txt` under the evidence directory.

## Current dispatch verification

Accepted dependencies and design sections 3, 5, 6.7 and 7 were rechecked. The existing implementation was retained. The shared-tree build, vector audit, surrogate check and case-count check each exited 0 in `tmp/fv-s942/fv-16-merge-model/dispatch-{build,audit,surrogates,counts}-2.log`. There are 223 cases (123 mergeValue, 100 mergeById), with three surrogate-containing lines. Model, vector generator, module root and generated vectors have respective git blob hashes `866f065393bbd97db36871533f28e3c22c170299`, `0ec1dd42a80c4eb38e3be17706d3f0e153ab7c70`, `d36904e0d68612e807869ade707b0ec4efd7e162` and `094264fe78c6a198c9fe4a0d8a4f033c49119cdf`. Before-edit progress content, hash and intent are recorded under the same evidence directory. Independent review and downstream proof and conformance plans remain pending.

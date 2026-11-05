# clm-09b-cli-tests progress

Workflow mode: issue-resolution. Issue reference: clm-09-wiring, continuation 5 (no GitHub issue). The assigned design and plan were read; no dependencies are declared. Review feedback contained no findings.

## Edits

- `apps/cli/src/cli-wiring.test.ts`: absent (`e69de29bb2d1d6434b8b29ae775ad8c2e48c5391` as empty-content sentinel) → `a33fff3f6a8c096f755d307b539c87615ec3fc0d` (initial runCli coverage) → `d294eba2309a9776895099340724cea760d658ef` (nested BPMN, refusal, ERD and warnings) → `8f303a8d7e1c42dbade867bb48309e7ea6ed805c` (scoped formatting). Subsequent edit and format hashes are recorded in `tmp/clm-s740/clm-09b-cli-tests/edit-cli-3.txt` and `edit-format-2.txt`.
- `apps/cli/src/merge-git.test.ts`: absent (same empty-content sentinel) → `376d2e9f2e155b0a4e9015aea543e82bec775e78` (isolated real Git driver tests) → `17248fd71b723f16b63ae1f561d1d43a4476a828` (scoped formatting).
- This progress file was created; its before and after hashes are recorded in `tmp/clm-s740/clm-09b-cli-tests/edit-progress.txt`. Each edit has a fresh snapshot and intent under the evidence directory.

## Completion criteria

- CLI tests cover merge, arrange modes and option validation, BPMN nested refusal with unchanged bytes, lint metrics and fixes, warning collapse and quiet, selector reports, and carryMembers behavior. No production feature logic was changed.
- Git tests use an isolated temporary repository, `.gitattributes merge=nodetto`, and assert clean and conflicting merges, canonical output, conflict output, and no conflict markers. Git is required and is never skipped.
- All six manifest verification commands passed on the moving shared tree: new tests 13 passed, focused suites 69 passed, typecheck and Biome passed, and both Git-driver checks passed. Complete logs are under `tmp/clm-s740/clm-09b-cli-tests/` with `final` in the filename.
- No feature-owner findings discovered. Formal reviews, stable-tree gates, native parity and final integration belong to downstream workflow steps.

- Self-check strengthened the supported-kind error assertion; the before/after hashes and intent are in `edit-cli-4.txt` and `edit-format-3.txt`. All six gates were rerun successfully on the final source. A prior Biome formatting failure is retained in `biome-final-2.log` and resolved by the scoped formatting edit.

## Test-integrity revision

- Review decision: needs revision for `clm-09b-TI-01` (mid). The prior pool resize did not distinguish the opt-out from default carry. The runCli test now moves and resizes the pool, verifies the held task at (60,40), the lane at (10,-20) with width 670 and containment, and the default-carry task at (40,20). It retains the original exit and lane-width assertions. No production file was edited.
- The same test-file edit addresses `clm-09b-TI-02`, `clm-09b-TI-03`, and `clm-09b-TI-04`: assert lint fix changes bytes, positional `--quiet` appears in the read error, and clean ERD lint output is empty.
- `apps/cli/src/cli-wiring.test.ts` hashes: `99c2fd3adbff9edbafdf60cc1761a085bc8d0007` before the assertion edit, `83a6a23303afab4f2ccaa6117b18d248a0aeb178` after it, and `b9e0c15017fe2a73feacaf56dd724d565a8c66ba` after scoped formatting. Intent and snapshots are in `tmp/clm-s740/clm-09b-cli-tests/ti-revision-edit.txt` and `ti-format-edit.txt`. This progress edit's before/after hashes are in `ti-progress-edit.txt`.
- Six current-source gates exited 0 on the moving shared tree: `bun test apps/cli/src/cli-wiring.test.ts apps/cli/src/merge-git.test.ts` (13 passed), the manifest focused `bun test` suite (69 passed), `bun run typecheck`, `bunx biome check apps/cli/src/cli-wiring.test.ts apps/cli/src/merge-git.test.ts`, `grep -n 'merge=nodetto' apps/cli/src/merge-git.test.ts`, and `sh -c '! grep -nE "test\.skip|nativeTest" apps/cli/src/merge-git.test.ts'`. Full output and exit statuses are in `ti-new-final.log`, `ti-focused-final.log`, `ti-typecheck-final.log`, `ti-biome-final.log`, `ti-driver-final.log`, and `ti-skip-final.log` under the plan evidence directory. Independent review and stable-tree gates remain downstream.

# fv-10-fractional-model progress

Accepted design sections 3, 6.1 and 7 and plan signatures were checked. Dependencies fv-01, fv-02 and fv-04 are accepted by dispatch. Implemented total fractional model and deterministic vectors. Theorem proofs and conformance test belong to downstream plans.

Before: Model, root, vector JSON and progress absent; Vectors stub a8aef606d3dbc6b2f7a7aa9c257bf98338eb3912; plan eaba2383f791a049e3f5601114b6f5b53e653b63. Per-edit intent and intermediate hashes: tmp/fv-s942/fv-10-fractional-model/{intent.txt,before.txt}.

After: Model fc99814af88ee3846c4828efa26e0be5d9e50110; Vectors d051aa126be2120a24fe85ab973eb9d3d822cc89; root fdf764741f969da44fc0a4003f1c2c27b8b42239; JSON 4370447f7e504f07585459e575ba790b3a51122d. Plan hash recorded in evidence after.txt.

Build and vector audit exited 0 (build.log, audit.log). Generated 2,892 vectors: 120 isFractionalKey, 2,646 keyBetween, 126 keyAfter. A focused TypeScript comparison reported zero mismatches (compare.log). Earlier build attempts 1-5 failed during termination proof development; attempt 6 passed. Vector attempt 1 failed to compile; attempt 2 passed. Logs are preserved in the evidence directory. Checks ran on the moving shared tree; integration verification remains downstream.

Rerun: module build and vector freshness audit passed on the current shared tree (build-rerun.log, audit-rerun.log). Progress hash before this update: 2d0d742689669fea23e6433cc6deb023bb06a2a5; after hash recorded in evidence progress-rerun-hash.txt.

Current-source author check: the Fractional module build and vector freshness audit both exited 0 (build-current.log, audit-current.log). Model, vector generator, root and JSON hashes remain fc99814af88ee3846c4828efa26e0be5d9e50110, d051aa126be2120a24fe85ab973eb9d3d822cc89, fdf764741f969da44fc0a4003f1c2c27b8b42239 and 4370447f7e504f07585459e575ba790b3a51122d respectively. Verification ran on the shared tree; downstream review and integration remain pending. Progress before hash: ab6869db6798ead5255622caa3e1c0be09d8f3c8; after hash is in progress-current-hash.txt.

Step 6 final author check: the module build and vector audit passed on the current shared tree (build-step6-final.log and audit-step6-final.log). Count check passed with 2,892 cases: 120 isFractionalKey, 2,646 keyBetween, 126 keyAfter (count-step6-final.log). Source hashes remained Model fc99814af88ee3846c4828efa26e0be5d9e50110, Vectors d051aa126be2120a24fe85ab973eb9d3d822cc89, root fdf764741f969da44fc0a4003f1c2c27b8b42239, JSON 4370447f7e504f07585459e575ba790b3a51122d. Progress before hash 0ade934ed7ed2cc27b8e114febf7cf7ba50baf0e; after hash recorded in progress-step6-final.hash. Formal review and integration remain downstream.

Current Step 6: build-step6-new.log, audit-step6-new.log and count-step6-new.log all exit 0 on the shared tree; 2,892 vectors comprise 120 isFractionalKey, 2,646 keyBetween and 126 keyAfter. Source hashes remain fc99814af88ee3846c4828efa26e0be5d9e50110, d051aa126be2120a24fe85ab973eb9d3d822cc89, fdf764741f969da44fc0a4003f1c2c27b8b42239 and 4370447f7e504f07585459e575ba790b3a51122d. Before and after progress hashes are recorded in plan-local evidence.

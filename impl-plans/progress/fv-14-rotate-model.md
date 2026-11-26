# fv-14-rotate-model progress

Accepted dependencies: fv-01-scaffold, fv-02-audit, fv-05-stubs-b. The model follows design 6.5 and B3.

Before hashes (missing denotes absent file; ordered Model, Vectors, root, JSON, progress, plan):
```
missing formal/Nodetto/Rotate/Model.lean
a8aef606d3dbc6b2f7a7aa9c257bf98338eb3912
missing formal/Nodetto/Rotate.lean
missing formal/vectors/rotate.json
missing impl-plans/progress/fv-14-rotate-model.md
0aca07f1772405dac0b6b4a85e1d3d75977a6e57
7d141014d589f96741dfe8beb6f983d463d3460a
```
After hashes (ordered Model, Vectors, root, JSON, plan):
```
3f33d38c14e4e64657e7b4c72dc1af912d31e318
a5f92433eec19b7df19c17ac1cb0a4e401113ec1
87d2e831c1b6e8f2a069016089d4390eee417524
427145a9fc859ae88f3a39dc75240b78f6b06140
9399836ac626a5156e7dd4972065b04d9eb41243
```

Final build and vector audit both exit 0; logs: `tmp/fv-s942/fv-14-rotate-model/build.log`, `audit.log`. Coverage: cases 297 fixtures 9 rotations 288 combinations {(0, 1): 36, (1, 1): 36, (2, 1): 36, (3, 1): 36, (0, -1): 36, (1, -1): 36, (2, -1): 36, (3, -1): 36} anchors {'on': 72, 'off': 216}

Initial generator compilation failed due to indexed fixture lookup; corrected by iterating fixtures. See `initial-build.log`. The initial generator had no on-lattice cases; corrected and regenerated before the final gates. Proofs and conformance belong to downstream plans. Verification used the moving shared tree; integration must check the combined tree.

Self-check: corrected generator metadata to the source path required by design section 7; regenerated JSON differs only in that field.

- Vectors.lean hashes: a5f92433eec19b7df19c17ac1cb0a4e401113ec1 -> 034fa8ac52b962f54367290ada9674b67081fe0f
- rotate.json hashes: 427145a9fc859ae88f3a39dc75240b78f6b06140 -> 2a68499ef5f614eca425f0c01aea839bf806844b
- Progress before hash: d736ba38caa9a1dc780b5f78bc6bb72f4dd88a5e
- Final current-source build and vector audit exit 0: `build-final.log`, `audit-final.log` under `tmp/fv-s942/fv-14-rotate-model/`. Generated vectors: 297 cases, including 288 rotations. Verification ran on the moving shared tree.

Rerun self-check: progress before hash `eaf002c42b354c5a359f8678091f64922076be1e`; current model, vectors, root and JSON hashes match the preceding records. Build and audit both exited 0; complete logs `tmp/fv-s942/fv-14-rotate-model/build-rerun.log` and `tmp/fv-s942/fv-14-rotate-model/audit-rerun.log`. Vector inventory: 9 fixtures, 288 rotation cases. Checks ran on the moving shared tree.

Step 6 current-source self-check: accepted dependencies fv-01-scaffold, fv-02-audit and fv-05-stubs-b; design B3 and section 6.5 match the existing model. Build and vector audit exited 0; complete logs `tmp/fv-s942/fv-14-rotate-model/build-step6-current.log` and `tmp/fv-s942/fv-14-rotate-model/audit-step6-current.log`. Inventory: 9 fixtures and 288 rotations. These gates ran on the shared tree. Progress before hash: `4c2e6bfb2517507f198b546f5ab58daadcb16d1c`. Proofs and conformance are downstream.

Step 6 recheck: accepted dependencies and design B3/6.5 confirmed. Current shared-tree build and vector audit passed; logs `tmp/fv-s942/fv-14-rotate-model/build-step6-recheck.log` and `tmp/fv-s942/fv-14-rotate-model/audit-step6-recheck.log`. Inventory: 297 cases (9 fixtures, 288 rotations); `inventory-recheck.log`. Before identities: `hashes-before-recheck.txt`. Proofs and TypeScript conformance remain assigned downstream.

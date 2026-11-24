# car3-cad-drag progress

Status: done (implementation phase; formal review and integration pending).

The regression was added first. `bun test packages/ui-solid/src/cad/viewport.test.tsx` exited 1 on pre-fix source: Add retained the two stored targets, as recorded in `tmp/car3-r3/car3-cad-drag/baseline-drag-2.log` (1 pass, 1 fail). An initial test setup attempt failed due to an incorrect import; see `baseline-drag.log`.

Shared helper rules now drive inspector and committed drag, with one update command and one Undo. The DOM case checks reversed stored order, positive Add, status, undo count and restoration in both themes.

## Per-edit evidence

- tmp/car3-r3/car3-cad-drag/edit-01-intent.txt: Pre-sha256 691359b0758ec795137a0145347902127841d1f32facc3817a8ed7f7931180cb; Add committed multi-target Cut-to-Add drag regression using existing new bodies; assert target, valid status and single undo.; post: d8dbe729d975fcccc4b142de5a25f243f47debbd3a7143812d4f724c9ffcd104
- tmp/car3-r3/car3-cad-drag/edit-02-intent.txt: Pre-sha256 d8dbe729d975fcccc4b142de5a25f243f47debbd3a7143812d4f724c9ffcd104; Import scanCadPage from its module because core barrel does not export it.; post: 7ed5bd201c4e1ef3f579be4ab397dc671e2ff5414c5aa70c2898fd366f616a32
- tmp/car3-r3/car3-cad-drag/edit-03-intent.txt: path packages/ui-solid/src/cad/extrude-targets.ts; pre-sha256 absent; Create shared history-order and operation target normalization rules.; post: e4aac6180b7a0a4d036eeffb94368831553541950bee5bf596f068e3f9477a30
- tmp/car3-r3/car3-cad-drag/edit-04-intent.txt: path packages/ui-solid/src/inspector/CadSection.tsx; pre-sha256 fd301d994fba8669ae67dcecbb4532c24a089fc39256e4c78ff5dcdceffad7af; Use shared earlier bodies and displayed target ordering, preserving reactive memo.; post: 9e31834d79cfc17b9494d0b11094ed25f28bf8d07bcb9c34987308b3e8c6f0b3
- tmp/car3-r3/car3-cad-drag/edit-05-intent.txt: path packages/ui-solid/src/inspector/cad-edits.ts; pre-sha256 c3a7f33225766b5f2d47437f270c1220e34db0fcdc615fc3bfe84a117f410a7c; Reuse target operation rule without changing inspector semantics.; post: b7919f8df56d8c8597c02a0e9a0a0532354a73b686b518e2e69ea27509cbb903
- tmp/car3-r3/car3-cad-drag/edit-06-intent.txt: path packages/ui-solid/src/cad/extrude-authoring.ts; pre-sha256 4e4c1a928d113411885e6c603f3494771cdd6fdd1c73692923f6eb275f710f82; Normalize Add targets in displayed order within the existing atomic drag command; preserve other operations.; post: bf3aeec9dc7b573b2cd4643de9e845ef8fed2fa976e129101e31236c9d13ef32
- tmp/car3-r3/car3-cad-drag/edit-07-intent.txt: path packages/ui-solid/src/cad/extrude-targets.test.ts; pre-sha256 absent; Cover history filtering, ordering, detached IDs, duplicate handling and all operations.; post: 0185e3a3d21ba421105ac796522541a048e2e942073669b2232d635a7a24ee74
- tmp/car3-r3/car3-cad-drag/edit-08-intent.txt: Format only plan-owned changed files with Biome.; packages/ui-solid/src/cad/extrude-targets.ts e4aac6180b7a0a4d036eeffb94368831553541950bee5bf596f068e3f9477a30; packages/ui-solid/src/cad/extrude-targets.test.ts 0185e3a3d21ba421105ac796522541a048e2e942073669b2232d635a7a24ee74; packages/ui-solid/src/cad/extrude-authoring.ts bf3aeec9dc7b573b2cd4643de9e845ef8fed2fa976e129101e31236c9d13ef32; packages/ui-solid/src/inspector/CadSection.tsx 9e31834d79cfc17b9494d0b11094ed25f28bf8d07bcb9c34987308b3e8c6f0b3; packages/ui-solid/src/inspector/cad-edits.ts b7919f8df56d8c8597c02a0e9a0a0532354a73b686b518e2e69ea27509cbb903; packages/ui-solid/src/test-dom/cad-sketch.dom.tsx 7ed5bd201c4e1ef3f579be4ab397dc671e2ff5414c5aa70c2898fd366f616a32; post: recorded after write
- tmp/car3-r3/car3-cad-drag/edit-09-intent.txt: Pre-sha256 5d9e1240bf0b872a020645cb3846e21610e0aa266fa61a937abc65aca743f843; Preserve previous empty-list guard when ordering targets for New or non-extrudes.; post: 24e2875d7699ab4865191882a7711a54ae215c6eb7079662f14690ccf4d7aa4e
- tmp/car3-r3/car3-cad-drag/edit-10-intent.txt: Pre-sha256 dec4e0680cb5c63f44261c8501afade9636bdf1a691ea8657eba858ae2477d67; Record implemented completion criteria; formal review and integration remain downstream.; post: aa2ebc3253aa64888d47f2345bb79d02687225d432a0efa08159db04f0be26c3
- tmp/car3-r3/car3-cad-drag/edit-11-intent.txt: Pre-sha256 absent; Record implementation status, per-edit pre/post hashes and verification evidence.; post: recorded after write

Biome formatting post hashes and final source hashes are recorded in `final-hashes.txt`. Evidence paths under `tmp/car3-r3/car3-cad-drag/` are plan-local.

## Verification

- Focused biome and tests: exit 0, 11 tests passed, 0 failed; `tmp/car3-r3/car3-cad-drag/final-focused.log`.
- `bun test packages/ui-solid/src/cad/strict-index.test.ts`: exit 0, 1 test passed, 0 failed; `tmp/car3-r3/car3-cad-drag/final-strict.log`.
- Workspace checks and formal reviews are integration responsibilities.

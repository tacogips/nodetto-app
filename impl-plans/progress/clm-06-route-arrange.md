# clm-06 route arrange progress

Status: incomplete; implementation and review remain pending.

Implemented BPMN flow-label position precedence and baseline-relative label box, with a focused notation test. No routing, metrics, or CLI modules have been implemented yet.

Per-edit git hash-object evidence:
- notation.ts: caec501d43f40c140529433d1c78c7e90aa45ec6 -> 37c8da7099bc3e18874e2789ccc715b8404f599e
- notation.test.ts: 5db2bdaf9a35e505c5855c0eab1c80bce57f3cca -> 86c8d0737179e14335430a593b70dc6a68e9dfb3
- Before formatting: 37c8da7099bc3e18874e2789ccc715b8404f599e, 86c8d0737179e14335430a593b70dc6a68e9dfb3
- After formatting: 6317a61dff153d2be50bfb6efcd6483f466b535e, a4220c10f49e6cd37a34b685726084712e83d8f4
- This new progress record: pre-edit absent; post-edit hash recorded in `tmp/clm-s731/clm-06-route-arrange/progress-post-hash.txt`.

Verification on moving shared tree: `bun test packages/core/src/bpmn/notation.test.ts packages/core/src/bpmn/svg-export-bpmn.test.ts` passed 11 tests; `bunx biome check packages/core/src/bpmn/notation.ts packages/core/src/bpmn/notation.test.ts` passed. `bun run typecheck` failed in sibling-owned `apps/cli/src/edit/report.ts` (missing selectors.ts) and `packages/core/src/arrange-layered-bpmn.ts` (possibly undefined element). Logs are in `tmp/clm-s731/clm-06-route-arrange/`.

Outstanding: implement all route planning, metrics and CLI contracts and their tests; add SVG regression including pre-change byte comparison; execute all amended plan verification commands and record A7 fixture timing. Formal review and wiring belong to later workflow steps.

Typecheck retry on the newer shared tree still failed: `apps/cli/src/edit/selectors.ts:99` references missing `Batch.matches`, and `packages/core/src/arrange-layered-bpmn.ts:122` assigns a possibly undefined element. See `typecheck-retry.log`; both paths belong to sibling plans. Resume after those plans stabilize and rerun the full required gate.

## Continuation 1

Implemented route planning, shared metrics and collision helpers, and both CLI modules. Added route, metrics, CLI and SVG movement tests. The earlier sibling typecheck errors are resolved on the current shared tree.

On the moving shared tree, the amended core test command passed 27 tests, the CLI command passed 7 tests, `bun run typecheck` passed, the scoped Biome command passed, and both export checks passed. Logs: `core-cont-final.log`, `cli-cont-final.log`, `typecheck-cont-final.log`, `biome-cont-final.log`, `grep-bpmn.log`, and `grep-obstacle.log` in the evidence directory. A7 layered fixture: 16.9 ms (`cli-cont-final.log`).

Remaining: exact pre-change SVG byte comparison and full acceptance-specific edge-case coverage, including all supported page kinds and collision allocation cases, require further verification. Formal review and final wiring remain downstream.

Per-edit hashes (pre-edit absence is recorded as absent in the corresponding evidence):
- `cli-format-post-2.txt`: 72ec0fd7b6d0af75fa9694cbc524fe0a52f2aa0b
- `cli-format-pre-2.txt`: 4fa5aa3e90f8c506e5d5239ee28f561e3b0461ce
- `cli-post-1.txt`: e1d39c8eedc4f643d6559db2346fddef7312f723
- `cli-pre-1.txt`: absent
- `cli-test-post-1.txt`: 29226ef6cfeae1c2c8f51adb236e0637641610de
- `cli-test-post-2.txt`: 7e9df6916a36fd00b99413ba63604900ac87d917
- `cli-test-post-3.txt`: 971c1ac6831bec7e92bb50f9ad71e18f03b14c97
- `cli-test-post-4.txt`: 4fa5aa3e90f8c506e5d5239ee28f561e3b0461ce
- `cli-test-post-5.txt`: 983158e45b9f4ebee0a83fe78e2b048d2af0c267
- `cli-test-pre-1.txt`: absent
- `cli-test-pre-2.txt`: 8f216ac4a0cbc2ba61032f3ca80bfec530a8722b
- `cli-test-pre-3.txt`: 7e9df6916a36fd00b99413ba63604900ac87d917
- `cli-test-pre-4.txt`: 971c1ac6831bec7e92bb50f9ad71e18f03b14c97
- `cli-test-pre-5.txt`: 72ec0fd7b6d0af75fa9694cbc524fe0a52f2aa0b
- `format-cont-post-hash.txt`: e529647d85311a3e3b11d75b55816faea6f38809, 85c174d0972f4ad4fe429117a5f2cdfa24e5f125, 005ae5746605a916674c2f620fb221139edd775e
- `format-cont-pre-hash.txt`: 72addebcce470810d46e51d5b99602bb57a94d2c, b367a06065434bd11536f18ffbf259cc8121488c, 9489bb16edef190d1a535e7646b1a9bb4f89822f
- `lint-cli-hashes-1.txt`: lint-metrics.ts pre: absent, lint-metrics.test.ts pre: absent, 11fd927f2d5b6e7eccdf79cb3f3eccc6afc374a3
- `lint-cli-post-2.txt`: 245eb7c5afcf38e5fa6a04f2331ea97f99d3dc1b
- `lint-cli-pre-2.txt`: 11fd927f2d5b6e7eccdf79cb3f3eccc6afc374a3
- `lint-cli-test-post-1.txt`: 1db1a20db56041be6fb54945a83244a2f6bfad4d
- `metrics-format-post-hash-2.txt`: 39e3e9702d946eb68418d7864a7ca1295cb96f98
- `metrics-format-post-hash.txt`: c655b6f3cfb21c7643fcdb635a4a5bc280b958c4, db7ac23f800540696e935bf169616a409fe48664
- `metrics-format-pre-hash-2.txt`: 9348feccdecf0b95da5cac05c929d3096a5a8090
- `metrics-format-pre-hash.txt`: 8af094d279c16c199fa6a470989b5ff24a8446cc, 6d54480ff16be587dd420a21e22272c4544dd2eb
- `metrics-impl-post-hash.txt`: 8af094d279c16c199fa6a470989b5ff24a8446cc
- `metrics-test-post-hash-2.txt`: 9348feccdecf0b95da5cac05c929d3096a5a8090
- `metrics-test-post-hash.txt`: 6d54480ff16be587dd420a21e22272c4544dd2eb
- `metrics-test-pre-hash-2.txt`: db7ac23f800540696e935bf169616a409fe48664
- `route-format-post-hash.txt`: 937f570c4357e26b24a80c61f8568e290b497fc9, 87884f6f4ca9bc4bcb06e8d5295efd96df869c12
- `route-format-pre-hash.txt`: 315765f6fac753ef3f9b8fc26718d38ce1265cb4, f07c948c462a084dcefdc2803135806c50221789
- `route-post-hash-1.txt`: 58a292f82d3a8d18763cba404bb91ffddf02458c
- `route-post-hash-2.txt`: 315765f6fac753ef3f9b8fc26718d38ce1265cb4
- `route-post-hash-3.txt`: 5e74333d3e815574226b7e8fd98ab110272aa8c7
- `route-post-hash-4.txt`: 72addebcce470810d46e51d5b99602bb57a94d2c
- `route-pre-hash-1.txt`: pre: absent
- `route-pre-hash-2.txt`: 58a292f82d3a8d18763cba404bb91ffddf02458c
- `route-pre-hash-3.txt`: 937f570c4357e26b24a80c61f8568e290b497fc9
- `route-pre-hash-4.txt`: 5e74333d3e815574226b7e8fd98ab110272aa8c7
- `route-test-post-hash-1.txt`: 7961d03d4b01fc285de6d85ca704b18c95dbcba0
- `route-test-post-hash-2.txt`: 5c50095b82b54b7def01dd5e577cd1ef43d0551a
- `route-test-post-hash-3.txt`: f07c948c462a084dcefdc2803135806c50221789
- `route-test-post-hash-4.txt`: b367a06065434bd11536f18ffbf259cc8121488c
- `route-test-pre-hash-1.txt`: pre: absent
- `route-test-pre-hash-2.txt`: 7961d03d4b01fc285de6d85ca704b18c95dbcba0
- `route-test-pre-hash-3.txt`: 5c50095b82b54b7def01dd5e577cd1ef43d0551a
- `route-test-pre-hash-4.txt`: 87884f6f4ca9bc4bcb06e8d5295efd96df869c12
- `svg-post-hash-1.txt`: 9489bb16edef190d1a535e7646b1a9bb4f89822f
- `svg-pre-hash-1.txt`: e978bd6b45cdeda161a80a15b110bb03156033b9

## Continuation 2

Added a checkpoint-rendered full SVG comparison and routing tests across eligible page kinds, including BPMN containment, ERD port spreading, and fixed and inferred endpoints. Corrected self-loop side occupancy for unpinned non-target connectors and excluded tangential bend contacts from crossing counts.

The amended plan gates passed on the current moving shared tree: 33 core tests, 7 CLI tests, typecheck, scoped Biome, and both export checks. Logs are `core-cont2-final.log`, `cli-cont2-final.log`, `typecheck-cont2-final.log`, `biome-cont2-final.log`, `grep-bpmn-cont2.log`, and `grep-obstacle-cont2.log` under the evidence directory. The A7 layered fixture took 19.5 ms.

An additional repository-wide `bun run typecheck --noUncheckedIndexedAccess` exited 2 with 99 diagnostics, including existing tests and `packages/core/src/diagram-lint/node-overlap.ts`; no diagnostics named the changed production modules. See `unchecked-attempt.log`. This command is not one of the amended plan gates; the repository-wide strict baseline requires separate disposition.

Per-edit hash evidence:
- `cont2-format-post.txt`: 8e1b3ba858f52bcccfe9b6aff51aeb8533a3dfc0, c244848af11783b076f2d22bb6f183c38410ae2f, 7eab02b1c00e1a37fbc5eb18b469d9b5123e3138
- `cont2-format-pre.txt`: 8d0b1cd94bf2792b9f66e9b1428856c34ae0d361, 75ec378c8cc85148904bfeab067f1dfb01b9a897, 5033f1174317fcd0217598494ac6920538dd6171
- `metrics-cont2-post-1.txt`: 75ec378c8cc85148904bfeab067f1dfb01b9a897
- `metrics-cont2-pre-1.txt`: c655b6f3cfb21c7643fcdb635a4a5bc280b958c4
- `metrics-test-cont2-post-1.txt`: 5033f1174317fcd0217598494ac6920538dd6171
- `metrics-test-cont2-pre-1.txt`: 39e3e9702d946eb68418d7864a7ca1295cb96f98
- `route-cont2-post-1.txt`: 8d0b1cd94bf2792b9f66e9b1428856c34ae0d361
- `route-cont2-pre-1.txt`: e529647d85311a3e3b11d75b55816faea6f38809
- `route-coverage-post-1.txt`: 7c0e31eecb188b15f9ce9e9b41edd1f755fba01e
- `route-coverage-post-2.txt`: cfdea5c8bd3010794da343e09b514c6a526ad7dc
- `route-coverage-post-format.txt`: e39027d868ad8feb9a356c8ca2617c0c1745fde0
- `route-coverage-pre-1.txt`: 85c174d0972f4ad4fe429117a5f2cdfa24e5f125
- `route-coverage-pre-2.txt`: 7c0e31eecb188b15f9ce9e9b41edd1f755fba01e
- `route-coverage-pre-format.txt`: cfdea5c8bd3010794da343e09b514c6a526ad7dc
- `svg-baseline-format-post-hash.txt`: fc756f5d084ec6e450a23ab952a77e059e651e83
- `svg-baseline-format-pre-hash.txt`: c1475f8baeea524cf090505d4d5bd83b82ee979a
- `svg-baseline-test-post-hash.txt`: c1475f8baeea524cf090505d4d5bd83b82ee979a
- `svg-baseline-test-pre-hash.txt`: 005ae5746605a916674c2f620fb221139edd775e

Formal review and final wiring remain downstream.

## Continuation 3 verification

On the current shared tree, the assigned core suite passed 33 tests and the CLI suite passed 7 tests; standard typecheck, scoped Biome, and both export checks passed. Complete logs are `core-resume.log` and `resume-gate-1.log` through `resume-gate-5.log`. The additional `bun run typecheck --noUncheckedIndexedAccess` still exits 2 with 99 diagnostics, none in this plan's production modules; `resume-gate-6.log` contains the complete output. A source-matched baseline disposition remains unavailable. Formal review and wiring remain downstream.

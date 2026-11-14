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

## Continuation 4: implementation complete, review pending

Added G1-G11 regression coverage: manual route clearance and unchanged geometry; generic and ERD label placement, including a control for a previously placed label; fallback self-loop selection; BPMN manual label bounds as an obstacle; metrics decrease, ERD crossing and containment; excluded page kinds; ERD layered containment; ordering flags; and BPMN/ERD metrics in page order. Preserved BPMN `labelPosition` on reset when `labelBounds` is present, as E2.2 requires route mode never to write that manually placed label field. The pre-existing SVG byte comparison remains in the core suite. Boa audit found no document regex split or per-point destructuring in routing and metrics segment loops. The noUncheckedIndexedAccess baseline disposition in the authoritative plan remains applicable.

On the moving shared tree, core tests passed 41, CLI tests passed 10, standard typecheck and scoped Biome passed, and both required export checks passed. Logs are in `tmp/clm-s732/clm-06-route-arrange/`: `core-final3.log`, `cli-final3.log`, `typecheck-final3.log`, `biome-final3.log`, `bpmn-export-final.log`, and `obstacle-export-final.log`. The A7 layered fixture took 18.0 ms. Initial fixture and lint failures are retained in `focused-attempt2.log` and `biome-final.log`; final-source reruns passed. Formal review and final wiring remain downstream.

Per-edit git hash-object evidence (pre -> post; formatting and corrections included):
- `arrange-route.ts`: 8e1b3ba858f52bcccfe9b6aff51aeb8533a3dfc0 -> f02be11058f977a439ebb17813148ad444bfba9a -> f3f7d2a5d7047e85147deaf647f8d49fd253f85f.
- `arrange-route.test.ts`: e39027d868ad8feb9a356c8ca2617c0c1745fde0 -> f71bbd505d10a37d2cab68e166c2ab9ba3fc948c -> ec8ad70e2ee4ef00fbc5ea761071255146b66a08 -> b6ba49232719c59e1f8943fa708f6abe04b16a81 -> ac9ce7a9585cf7b10a738b80ac8496cd5c6f19a9 -> 70691a9b697f69a9ca67ec9b4081684093fd2b59 -> bc14248d281abb9b26f2a14ff695925c2595969a -> 088bc74dc3de52ebb2ee90a4c55b62317f1526c9 -> 104131ef89f0d713759b0b13a208e7d0bc042288 -> dc9272fb08b9d83f767c1f1204ce858822a6716b -> 2116fff1a211779363f5ea8ff74cd614481e54d8 -> e14a8f21a98abfeabee3d69c20861ca0ccb54d2c.
- `metrics.test.ts`: 7eab02b1c00e1a37fbc5eb18b469d9b5123e3138 -> e6ab2e35bc8d2862afe450a39d644402e5ab9db6 -> 11ae0776247cae6e05126bd955fbdf580f6a0698 -> e9bd311eeeab3bcbaaf8dcd387502b5250127e31 -> a115d25b51a28314c46f4ea8feedb78f8b0aa587.
- `arrange-modes.test.ts`: 983158e45b9f4ebee0a83fe78e2b048d2af0c267 -> 2ba89d1a284f0462ddfde8b6b8c86c7af5bdafa9 -> f9a302b8cc29d0e9c6194c4b1233b3641530f4ab -> 20b0b470455d6f48c850751b32e14cdaf096868a -> f3468985ea6229ee842d9fb22b8391df8ee89771.
- `lint-metrics.test.ts`: f6c4422ca12388e8461453419d5466c64e96fc09 -> 072f09cc3cfb6d45e3acf67aafdaaeced5832ef7 -> 333004b4f7974e241e09e1635b3ad944757adfe7.
- This progress record: pre 7723a2bd069c3712055dbacafafa41d5b251512f; post recorded in `progress-post-hash.txt`.

## Adversarial review revisions

- CLM06-AR-1-RESET-RERUN-DRIFT: `planRoute` now compares sorted top-level semantic keys and JSON values at both command emission points. Serialized CLI regressions for route and layered cover spread ports, a manual label position, real first-run changes, zero-update second writes, and identical rerun bytes. The existing manual-waypoint reset test remains passing. Pre-fix and post-fix first-write SHA-256 hashes match for the original reproduction: route `fb14a21a7c574f69127cdd37147435b5569510d82468f9a685e261d426c2c87b`, layered `031e63d9f25dd1ae04b7ed32afd134bf199645712db98a116f03814de89bf87c`; see `review2-reproduction-cli.log` and `review2-focused.log`.
- CLM06-AR-2-LOCALE-ORDER: all three route planner locale comparisons use UTF-16 code-unit comparison. The mixed-case regression asserts `Zed` 0.3333 and `alpha` 0.6667. This follows the design's determinism rule: stable element order is ascending ID compared by UTF-16 code unit. No existing expectations were changed.
- Both failures reproduced before the fix in `review2-reproduction.log` and `review2-reproduction-cli.log`. Subsequent exploratory fixture failures and corrections remain in `review2-label-probe*.log`. On the moving shared tree, final core tests passed 42, CLI tests passed 12, typecheck and scoped Biome passed; the A7 layered fixture took 46.1 ms. Logs: `review2-core.log`, `review2-cli.log`, `review2-typecheck.log`, `review2-biome.log`, `review2-bpmn.log`, `review2-obstacle.log`. The requested `grep -n localeCompare packages/core/src/arrange-route.ts` exited 1 with no matches (`review2-locale.log`), as expected. Independent review and stable integration remain downstream.
- G9 fixture correction rationale from prior continuation: the design's E2 verification requires “ERD layered with frames”; table containment uses the shape's derived `erdTableBounds`, since ERD table height comes from the semantic columns rather than stored visual height.

Review revision per-edit hashes (pre -> post):
- `arrange-route.ts`: f3f7d2a5d7047e85147deaf647f8d49fd253f85f -> d94ad19aa0a1e1afc353d6034533856160d4f14b -> 587d9fff3666ac76129e5aa31a9a054ab2f0280f.
- `arrange-route.test.ts`: e14a8f21a98abfeabee3d69c20861ca0ccb54d2c -> fedc3fa93c83f767a052f0f23db798f75a93ed78 -> 1fa3be60a030d63440127c280a286f19a1138925.
- `arrange-modes.test.ts`: f3468985ea6229ee842d9fb22b8391df8ee89771 -> 6518d787d6d2e64c97fd72104cde7cea496017d6 -> 394f6bad79c7e7a603b141786a9aef0b70b9cacf -> fff1b094ebab93961bd74b1afe526e4c65fb36d7 -> 2db678a853c6c80dfe1e1888ce26ba614de5315a -> 6cb2a681918ae2c927e6a373b0990d168065b755 -> 58f0548bfffc29f8a7a242efa6749e01f5f1a0e6 -> 8401b1e1deda9ee76e575e41e805f6a4ea197aa7 -> b9367d375d836d453b9d2bd77b1e6b54c3611b71 -> 9f4d9663644711155fa7668d68c43efaa8c9525f.
- Progress pre: b2ee246e5bad5bf14d6be1e7155cf54c206f6603; post in `review2-progress-post-hash.txt`.

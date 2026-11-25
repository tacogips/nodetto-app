# car7-f1b-incomplete-exit progress

Status: done. The selected plan matches design section 25.1; dependencies: none.

## Edits and checksums

- capture-cad.test.ts.format.intent: Format only newly added regression hunk; preserve prior content.; pre sha256 74cfc9722ef260fdae776d266b5612d586568b37523dba7f6c979014fd16364e; post sha256 d84cbb654cae0f145aacf16701cfc791f83815934d114c80b232aa2a3ac77dd0
- capture-cad.test.ts.intent: Add injected incomplete reports in text and JSON with flagged, unflagged, and refinement-only cases.; pre sha256 0063a93981fe2dead1065b63926b29a1fb950c3f7cc43ad0eb395ac418add434; post sha256 74cfc9722ef260fdae776d266b5612d586568b37523dba7f6c979014fd16364e
- capture-help.ts.intent: Describe incomplete coarse checks in exit contract.; pre sha256 b5b7bc6240f5188661a501eec38af1e8fe1b2cd0f5595e90091478d5b6003699; post sha256 c96895a47a080229eef935a8eba983c27ccc3f6891d3b2bef637114f4c9d05cb
- capture-interference-options.test.ts.format.intent: Format only newly added regression hunk; preserve prior content.; pre sha256 cdca3f1dfaaa69c21e987f4e9d943aabfce66ad7e700f5708eef1a4c7ec4680d; post sha256 a7283c35c927216bca5cdab73a4bb6533541a71b344c16f42cf6c6ae83bea659
- capture-interference-options.test.ts.intent: Add incomplete and legacy/refinement control exit assertions.; pre sha256 3a53150806fbde9a0f9698c8fdaac33f01cbeb0747373109268581a002796bfd; post sha256 cdca3f1dfaaa69c21e987f4e9d943aabfce66ad7e700f5708eef1a4c7ec4680d
- capture-interference-options.ts.intent: Fail on incomplete coarse checks only when requested.; pre sha256 c10dbc1740a72271b2e48a9ff5571bd78db9126d551ba9e829d686853c6fbc39; post sha256 7f2e730e34fe724cfc83a3e9ab7493a10610e933aa9b41d5e7e73074d19ebee0
- capture.md.intent: Document incomplete output, JSON identifiers, and exit semantics.; pre sha256 989a783b335c6836bdaa0cb2664aec30a43f95081a860bc14ed37e6db7c7f38d; post sha256 bc3827482a2e9fbe1d432da63b45ec6acf2b69430281138091a06dcdc8d5eaaf
- interference.ts.intent: Describe incomplete pairs in flag help.; pre sha256 8c2c506d0ed79bd4c36b90003aac1cd8d1f648007b42e89d58f2d679c9fdebb1; post sha256 2b2265c3cda2dc3df40cf5c3845e49ee3a254616938a83a2217789eebb4b30dd
- report.test.ts.intent: Type expected pairs as readonly tuples.; pre sha256 cccc10365d6647185e54e6b7921b5596fe911c5ee2dc2470b0c41fbf60fc71ee; post sha256 445f6fb4ce039e74935c96b725d4499cc015c9071a18b712cbce42cd49a39a9b

## Verification

- Before predicate change: `bun test apps/cli/src/capture-interference-options.test.ts apps/cli/src/capture-cad.test.ts` failed (37 passed, 2 failed); `tmp/car7-r7/car7-f1b-incomplete-exit/pre-fix.log`. Both failures show exit 0 instead of 1.
- `bunx biome check --diagnostic-level=warn apps/cli/src/capture-interference-options.ts apps/cli/src/capture-interference-options.test.ts apps/cli/src/capture-cad.test.ts apps/cli/src/capture-help.ts apps/cli/src/capture-help/interference.ts packages/core/src/capture/report.test.ts`: exit 0; `tmp/car7-r7/car7-f1b-incomplete-exit/biome-final.log`.
- `bun test apps/cli/src/capture-interference-options.test.ts apps/cli/src/capture-cad.test.ts apps/cli/src/capture-docs.test.ts packages/core/src/capture/report.test.ts`: exit 0, 63 passed, 0 failed; `tmp/car7-r7/car7-f1b-incomplete-exit/tests-final.log`.
- Tests ran on the shared working tree. Workspace typecheck, formal reviews and integration gates belong to later workflow steps.

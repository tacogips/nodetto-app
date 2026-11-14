# clm-13 edit selectors progress

Status: implementation complete; review pending. Implemented scoped element names, where and expect for update/delete, select refs, operation field validation, and match report formatting. Existing edit assertions were preserved. The downstream clm-09 plan owns BatchResult passthrough, help and parity wiring.

Coverage includes exact ids, prefixes, ambiguous and scoped names, similar candidates, page-scoped connect, registry semantic references and literal text, BPMN sequence-flow selection, geometric frame, BPMN and group parents, count validation, select binding, and mismatch without writing after a preceding operation.

Required gates on the current moving shared tree: focused tests 30 passed, regression tests 25 passed, typecheck exit 0, Biome exit 0, and three exported symbols found. Complete logs are `tmp/clm-s731/clm-13-edit-selectors/final2-test.log`, `final2-regression.log`, `final2-typecheck.log`, `final2-biome.log`, and `final2-symbols.log`. Previous failed attempts and their corrections remain in the same evidence directory. The previously absent sibling metrics module is now present. Formal review and final stable-tree integration remain downstream.

## Per-edit intentions and hashes

```text
apps/cli/src/edit/types.ts
intent: Add optional match reporting contract.
pre: 5a4d2dc2dfac51aebe22dac663404a3d16cb375d
post: 324f8596b379cebcf036e9327eba0b5629d203b1
apps/cli/src/edit/operation-fields.ts
intent: Register selector fields and expose validation for where keys.
pre: 2112839876c234d60dff97a8f10930517c42190b
post: 1abbc705ea39c573f001aabd153dba5d8145498f
apps/cli/src/edit/report.ts
intent: Render match records without changing legacy reports.
pre: a10a00464625e540022d98a7f4943047bec5ccb7
post: 9286b739a6b8dd7849548984dfc2fe0865937fd2
apps/cli/src/edit/selectors.ts
intent: Implement scoped reference resolution, where matching and count reporting.
pre: new
post: 20794bfd51ec59ad8f7a22056705ade229a8fc7a
apps/cli/src/edit/batch.ts
intent: Delegate element lookup and resolve registry-declared name references; dispatch select.
pre: 823c8b294d1148122380f8b4c9e3b10157bc9aef
post: dd4a245f1065aa5720396f5c800ee4b3d579d895
apps/cli/src/edit/operations/elements.ts
intent: Apply where matches once for update and delete, preserving update logic.
pre: 72f9df32bd29224d2bbbe59b9841d5ca1a5c3211
post: 032693255c8423d4c321fc86a25530db5566232f
apps/cli/src/edit/operations/add.ts
intent: Scope semantic reference resolution to the target page.
pre: 05277f3ed1fe16d054237ba4c3825f92cbca4762
post: 5d3f5227c9766eb656faa49ed0e890220878dc19
apps/cli/src/edit/operations/connect.ts
intent: Resolve endpoints and semantic references in page scope.
pre: 5a4d4a4a63833251119cf43d6eeeadfa4641d1ba
post: e7da1611541b5e64e1e42750f0129a0f064f75b2
apps/cli/src/edit/operations/select.ts
intent: Bind a single existing element to an operation ref.
pre: new
post: 7ff7c0fafdd11d92d03b295a04171bbfba5e3058
apps/cli/src/edit/operation-fields.test.ts
intent: Cover new selector operation field readers.
pre: bba5fda23269cc13c29c0e5383e846db28cecf36
post: 3a524a5eb5ad7bf2af287dbdedb5fe1258fc2ce9
apps/cli/src/edit/report.test.ts
intent: Check match reports in text and JSON.
pre: 5301869f89a2f094361260732b1b8fc3e6eb5749
post: 9eac2a43862db6ea4a2dc457ed0d7d52405f9d6d
apps/cli/src/edit/selectors.test.ts
intent: Exercise references, count checks, selection and no-write behavior.
pre: new
post: 9a16b9d24eed45fdc685534c5bc1458c33949850
apps/cli/src/edit/selectors.test.ts
intent: Use valid neutral generic node fixtures.
pre: 9a16b9d24eed45fdc685534c5bc1458c33949850
post: 607ca3022f04b9173b1d80763551bb861322a566
apps/cli/src/edit/selectors.ts
intent: Format only this plan-owned file with Biome.
pre: 20794bfd51ec59ad8f7a22056705ade229a8fc7a
post: 8572aa5755480256a12e9983f1402904b1689ba2
apps/cli/src/edit/selectors.test.ts
intent: Format only this plan-owned file with Biome.
pre: 607ca3022f04b9173b1d80763551bb861322a566
post: 56158ecafa025472b53c26f3c7165202a9b029a2
apps/cli/src/edit/operations/select.ts
intent: Format only this plan-owned file with Biome.
pre: 7ff7c0fafdd11d92d03b295a04171bbfba5e3058
post: dea7550c2d2b2a775748567c2ff37e5562f1b019
apps/cli/src/edit/batch.ts
intent: Format only this plan-owned file with Biome.
pre: dd4a245f1065aa5720396f5c800ee4b3d579d895
post: c818bb0bfa447da3617bab5637103544f1d10b66
apps/cli/src/edit/operations/elements.ts
intent: Format only this plan-owned file with Biome.
pre: 032693255c8423d4c321fc86a25530db5566232f
post: 3dc97aa5c8dfc3fd959b413e17316e923d1a67c8
apps/cli/src/edit/operations/connect.ts
intent: Format only this plan-owned file with Biome.
pre: e7da1611541b5e64e1e42750f0129a0f064f75b2
post: b0a29aa3f03fa39cd9b9b3badc37ba904ddf3654
apps/cli/src/edit/operations/add.ts
intent: Format only this plan-owned file with Biome.
pre: 5d3f5227c9766eb656faa49ed0e890220878dc19
post: a62669ff0c84e66ee7c3e4ccb1e3a1de3a2043c4
apps/cli/src/edit/operation-fields.ts
intent: Format only this plan-owned file with Biome.
pre: 1abbc705ea39c573f001aabd153dba5d8145498f
post: e138c60f51d59532cba166add6a29542233352dc
apps/cli/src/edit/operation-fields.test.ts
intent: Format only this plan-owned file with Biome.
pre: 3a524a5eb5ad7bf2af287dbdedb5fe1258fc2ce9
post: 3a524a5eb5ad7bf2af287dbdedb5fe1258fc2ce9
apps/cli/src/edit/report.ts
intent: Format only this plan-owned file with Biome.
pre: 9286b739a6b8dd7849548984dfc2fe0865937fd2
post: 9286b739a6b8dd7849548984dfc2fe0865937fd2
apps/cli/src/edit/report.test.ts
intent: Format only this plan-owned file with Biome.
pre: 9eac2a43862db6ea4a2dc457ed0d7d52405f9d6d
post: 161496c7f2209cef165ce9f2ec2af5a68a79df20
apps/cli/src/edit/types.ts
intent: Format only this plan-owned file with Biome.
pre: 324f8596b379cebcf036e9327eba0b5629d203b1
post: 324f8596b379cebcf036e9327eba0b5629d203b1
impl-plans/progress/clm-13-edit-selectors.md
intent: Record implementation progress, hash audit, current gates, and outstanding work.
pre: new
post: 6a414fcbb191e686c64452312c56e03f7f946772
apps/cli/src/edit/selectors.ts
intent: Reject null expect, ignore missing labels, and preserve page query hints.
pre: 8572aa5755480256a12e9983f1402904b1689ba2
post: 6b6786892fd2dbf17f1ef0139fb71166e574e4ef
apps/cli/src/edit/operations/select.ts
intent: Reject whitespace-only ref names.
pre: dea7550c2d2b2a775748567c2ff37e5562f1b019
post: 63c68d437cbc8e9437f1347df3b1dcc0bba4d206
apps/cli/src/edit/operation-fields.test.ts
intent: Scan shared selector operation field reads for update, delete and select.
pre: 3a524a5eb5ad7bf2af287dbdedb5fe1258fc2ce9
post: 6db7dafe04fa17c7f6100174eb091aa3407fa1cc
apps/cli/src/edit/selectors.test.ts
intent: Add scoped name, endpoint, reference, parent, validation, and atomicity regression tests.
pre: 56158ecafa025472b53c26f3c7165202a9b029a2
post: 401f11cb7069354eda48977b6a06af2c504c2fcd
apps/cli/src/edit/selectors.test.ts
intent: Fix unique prefix and frame z-order fixture; check select conflict precedence.
pre: 401f11cb7069354eda48977b6a06af2c504c2fcd
post: 5ffaa13632365b4a828d17c7f3401efe8c1c60df
apps/cli/src/edit/operations/select.ts
intent: Reject conflicting id and where before expect validation.
pre: 63c68d437cbc8e9437f1347df3b1dcc0bba4d206
post: bb5b3e0610782ec2447098c96f60bb56cb9611eb
apps/cli/src/edit/selectors.test.ts
intent: Place BPMN task inside its subprocess for containment invariants.
pre: 5ffaa13632365b4a828d17c7f3401efe8c1c60df
post: 133341fa53bac9bfedb739296c95592256fcbd14
apps/cli/src/edit/selectors.ts
intent: Use deterministic code-unit ordering for candidate ids.
pre: 6b6786892fd2dbf17f1ef0139fb71166e574e4ef
post: 5da33c56cb8afd179267b7d922eb6eecc53258be
apps/cli/src/edit/selectors.test.ts
intent: Cover page ref hints, semantic update and missing string labels.
pre: 133341fa53bac9bfedb739296c95592256fcbd14
post: fdd8b9d5f99d56753c04e49372705363938a8d9c
apps/cli/src/edit/selectors.test.ts
intent: Assert existing page-ref behavior when a ref points to a page.
pre: fdd8b9d5f99d56753c04e49372705363938a8d9c
post: 9fb7eeeffb6376bafc55188c304429d4477641da
apps/cli/src/edit/selectors.ts
intent: Format only this plan-owned file with Biome.
pre: 5da33c56cb8afd179267b7d922eb6eecc53258be
post: 328fcc290778397f6a61b24db4606effb12e9299
apps/cli/src/edit/selectors.test.ts
intent: Format only this plan-owned file with Biome.
pre: 9fb7eeeffb6376bafc55188c304429d4477641da
post: 1d86b906b0d6d3e9d5487df2827635b7db187cd8
apps/cli/src/edit/operations/select.ts
intent: Format only this plan-owned file with Biome.
pre: bb5b3e0610782ec2447098c96f60bb56cb9611eb
post: 466ef52f26ebfe580b8a48e456737f8450f0da8c
apps/cli/src/edit/batch.ts
intent: Format only this plan-owned file with Biome.
pre: c818bb0bfa447da3617bab5637103544f1d10b66
post: c818bb0bfa447da3617bab5637103544f1d10b66
apps/cli/src/edit/operations/elements.ts
intent: Format only this plan-owned file with Biome.
pre: 3dc97aa5c8dfc3fd959b413e17316e923d1a67c8
post: 3dc97aa5c8dfc3fd959b413e17316e923d1a67c8
apps/cli/src/edit/operations/connect.ts
intent: Format only this plan-owned file with Biome.
pre: b0a29aa3f03fa39cd9b9b3badc37ba904ddf3654
post: b0a29aa3f03fa39cd9b9b3badc37ba904ddf3654
apps/cli/src/edit/operations/add.ts
intent: Format only this plan-owned file with Biome.
pre: a62669ff0c84e66ee7c3e4ccb1e3a1de3a2043c4
post: a62669ff0c84e66ee7c3e4ccb1e3a1de3a2043c4
apps/cli/src/edit/operation-fields.ts
intent: Format only this plan-owned file with Biome.
pre: e138c60f51d59532cba166add6a29542233352dc
post: e138c60f51d59532cba166add6a29542233352dc
apps/cli/src/edit/operation-fields.test.ts
intent: Format only this plan-owned file with Biome.
pre: 6db7dafe04fa17c7f6100174eb091aa3407fa1cc
post: 52ba79b62e443d457134e5013a75bec44efd27ef
apps/cli/src/edit/report.ts
intent: Format only this plan-owned file with Biome.
pre: 9286b739a6b8dd7849548984dfc2fe0865937fd2
post: 9286b739a6b8dd7849548984dfc2fe0865937fd2
apps/cli/src/edit/report.test.ts
intent: Format only this plan-owned file with Biome.
pre: 161496c7f2209cef165ce9f2ec2af5a68a79df20
post: 161496c7f2209cef165ce9f2ec2af5a68a79df20
apps/cli/src/edit/types.ts
intent: Format only this plan-owned file with Biome.
pre: 324f8596b379cebcf036e9327eba0b5629d203b1
post: 324f8596b379cebcf036e9327eba0b5629d203b1
apps/cli/src/edit/selectors.test.ts
intent: Exercise BPMN sequence flow endpoint selection and matched candidates.
pre: 1d86b906b0d6d3e9d5487df2827635b7db187cd8
post: 3ea16f6d240b863e22c7ea630692b4e85165bb2c
apps/cli/src/edit/selectors.ts
intent: Format only this plan-owned file with Biome.
pre: 328fcc290778397f6a61b24db4606effb12e9299
post: 328fcc290778397f6a61b24db4606effb12e9299
apps/cli/src/edit/selectors.test.ts
intent: Format only this plan-owned file with Biome.
pre: 3ea16f6d240b863e22c7ea630692b4e85165bb2c
post: c0aa8c1cad72055c4abbdbbbfd4906b96e295b1c
apps/cli/src/edit/operations/select.ts
intent: Format only this plan-owned file with Biome.
pre: 466ef52f26ebfe580b8a48e456737f8450f0da8c
post: 466ef52f26ebfe580b8a48e456737f8450f0da8c
apps/cli/src/edit/batch.ts
intent: Format only this plan-owned file with Biome.
pre: c818bb0bfa447da3617bab5637103544f1d10b66
post: c818bb0bfa447da3617bab5637103544f1d10b66
apps/cli/src/edit/operations/elements.ts
intent: Format only this plan-owned file with Biome.
pre: 3dc97aa5c8dfc3fd959b413e17316e923d1a67c8
post: 3dc97aa5c8dfc3fd959b413e17316e923d1a67c8
apps/cli/src/edit/operations/connect.ts
intent: Format only this plan-owned file with Biome.
pre: b0a29aa3f03fa39cd9b9b3badc37ba904ddf3654
post: b0a29aa3f03fa39cd9b9b3badc37ba904ddf3654
apps/cli/src/edit/operations/add.ts
intent: Format only this plan-owned file with Biome.
pre: a62669ff0c84e66ee7c3e4ccb1e3a1de3a2043c4
post: a62669ff0c84e66ee7c3e4ccb1e3a1de3a2043c4
apps/cli/src/edit/operation-fields.ts
intent: Format only this plan-owned file with Biome.
pre: e138c60f51d59532cba166add6a29542233352dc
post: e138c60f51d59532cba166add6a29542233352dc
apps/cli/src/edit/operation-fields.test.ts
intent: Format only this plan-owned file with Biome.
pre: 52ba79b62e443d457134e5013a75bec44efd27ef
post: 52ba79b62e443d457134e5013a75bec44efd27ef
apps/cli/src/edit/report.ts
intent: Format only this plan-owned file with Biome.
pre: 9286b739a6b8dd7849548984dfc2fe0865937fd2
post: 9286b739a6b8dd7849548984dfc2fe0865937fd2
apps/cli/src/edit/report.test.ts
intent: Format only this plan-owned file with Biome.
pre: 161496c7f2209cef165ce9f2ec2af5a68a79df20
post: 161496c7f2209cef165ce9f2ec2af5a68a79df20
apps/cli/src/edit/types.ts
intent: Format only this plan-owned file with Biome.
pre: 324f8596b379cebcf036e9327eba0b5629d203b1
post: 324f8596b379cebcf036e9327eba0b5629d203b1
impl-plans/progress/clm-13-edit-selectors.md
intent: Replace stale incomplete status with current implementation coverage and verification; retain per-edit hash audit.
pre: 6a414fcbb191e686c64452312c56e03f7f946772
```

# zorder-06 CLI order operation

Dependency zorder-02 is accepted in the runtime dispatch; section 3 of the design agrees with this plan. Finding ZORDER-06-NOT-IMPLEMENTED requires the missing handler and registration. Existing test blob: 3c2d2c07a834693c00312e15dd2a10ab1e1c3617; preserved unchanged. Edits and hash-object evidence follow.
fb8c9d168b52be2d00fc54372a5542947620a85d
c818bb0bfa447da3617bab5637103544f1d10b66
95f5a90619bafb7c8e3bf8a8c7934860d3573243
e138c60f51d59532cba166add6a29542233352dc
20411529fb04c282266b838d7038d19603a3d159
52ba79b62e443d457134e5013a75bec44efd27ef
39d2208b94e1c5f14337552750df4d62403bc217
fb8c9d168b52be2d00fc54372a5542947620a85d
8a9a1ae48efce90d12f1840c3029c8dcc4a828a3
8a9a1ae48efce90d12f1840c3029c8dcc4a828a3
7784eeaa4c3dd9cd330a8414d1669bca207185d3

## Completion

- Added `operations/order.ts`: placement validation, selectors, page/group and anchor checks, container expansion, core placement call, and three alias hints. Zero matches with expect 0 return successfully. Exact IDs are checked for page after resolution.
- Registered `order` in Batch and field/handler tables. Existing `operation-fields.test.ts` has only the prescribed row; `edit-order.test.ts` retains blob 3c2d2c07a834693c00312e15dd2a10ab1e1c3617. Help and docs describe the same before/after semantics.
- Final source gates: focused 27 pass, regression 25 pass, typecheck and Biome exit 0; complete logs in `tmp/zorder-s734/zorder-06-cli-order-op/*-final.log`. Earlier Biome failed two non-null assertions; replaced with checked first target and reran all four gates.
- Supplemental root bun test: exit 1, 3097 pass, 26 skip, 6 fail, 6 errors, all six errors are Solid jsxDEV module-load failures; no order-op failures appear. This is outside this plan's owned paths and requires serial integration investigation. Log: `root-final.log`.
- Final hashes: order.ts 7784eeaa4c3dd9cd330a8414d1669bca207185d3; batch.ts 95f5a90619bafb7c8e3bf8a8c7934860d3573243; operation-fields.ts 20411529fb04c282266b838d7038d19603a3d159; operation-fields.test.ts 39d2208b94e1c5f14337552750df4d62403bc217.
- Changes reviewed against plan, on the shared moving tree. Formal reviews and serial combined-tree gates remain downstream. No Git state changes.

## ZORDER-06-VERIFY-REPORT redispatch

- Fresh plan gates on the shared tree: focused 27 pass, 0 fail; regression 25 pass, 0 fail; typecheck and Biome exit 0. Complete logs: `tmp/zorder-s734/zorder-06-cli-order-op/verify-report-{1,2,3,4}.log`.
- The supplemental default-runtime root failure is a pre-existing JSX module-load baseline, not a passing gate: `tmp/zorder-s734/reconcile-wave-003/root-default.log` records 3097 pass and 6 failures; `tmp/zorder-s734/reconcile-wave-003/root-classic.log` records 3114 pass and 0 failures using the classic runtime. Finding: ZORDER-06-VERIFY-REPORT. Serial integration must assess the final gates.
- Fresh source hashes before and after verification: order.ts 7784eeaa4c3dd9cd330a8414d1669bca207185d3; batch.ts 95f5a90619bafb7c8e3bf8a8c7934860d3573243; operation-fields.ts 20411529fb04c282266b838d7038d19603a3d159; operation-fields.test.ts 39d2208b94e1c5f14337552750df4d62403bc217; edit-order.test.ts 3c2d2c07a834693c00312e15dd2a10ab1e1c3617. Independent test-integrity and adversarial reviews remain pending.

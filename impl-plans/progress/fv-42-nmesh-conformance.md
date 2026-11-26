# fv-42-nmesh-conformance progress

The accepted fv-18 dependency supplies the NMESH codec model and vectors. The plan matches design sections 6.3 and 7.

- Added `packages/nmesh/src/codec.formal.test.ts`: absent before; after creation `5d869ddcbb728607dcda963fcd4536b3e19b284a` identity is recorded in `tmp/fv-s942/fv-42-nmesh-conformance/test-created.hash`; final formatted identity is in `post-format.hash`. It checks every vector in four operation groups with exact values or NMESH error codes and rejects malformed data.
- Marked the acceptance criterion complete in the active plan. Before and after identities are in `plan-before.hash` and `plan-after.hash` under the plan evidence directory.
- Build: `build.log`, exit 0. Focused conformance and isolation tests: `test.log`, exit 0, 5 passed, 0 failed, 327 assertions. Biome: `biome.log`, exit 0.
- Workspace typecheck and combined-tree verification belong to integration, as prescribed by the dispatch constraints. Formal review remains downstream.

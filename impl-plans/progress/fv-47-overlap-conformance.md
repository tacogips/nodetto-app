# fv-47 overlap conformance progress

Dependency fv-17 is accepted by dispatch. The plan matches design sections 6.8 and 7.

- `packages/core/src/cad/loops.ts`: export only; before `9cf0a3b877295d503d25b31c7f930efc47217faa`, after `410db281acda526e9f9a2799109251201b8fac66`.
- `packages/core/src/cad/loops.formal.test.ts`: absent before creation; after creation `316c6f36a20c54e28f04173f5bca26a6f58b0903`; after formatting `e25f0a45eb343247a0205fc10b5d579b8d14e6a5`. Validates vectors, records the tree callback and ordered visits, and checks all 219 cases.
- Plan before and after hashes are recorded in `tmp/fv-s942/fv-47-overlap-conformance/plan-before.hash` and `plan-after.hash`. This progress file was absent before creation; its after hash is in `progress-after.hash` in the same evidence directory.
- `cd formal && mise exec -- lake build Nodetto.Overlap.Model`: exit 0, `build.log`.
- `bun test packages/core/src/cad/loops.formal.test.ts packages/core/src/cad/loops.test.ts`: exit 0, 20 tests, 0 failures, `test-final.log`.
- `bunx biome check packages/core/src/cad/loops.ts packages/core/src/cad/loops.formal.test.ts`: exit 0, `biome.log`. Earlier formatting failure retained in `biome-attempt.log`.

Evidence is under `tmp/fv-s942/fv-47-overlap-conformance/`. Tests ran on the shared tree; integration and formal reviews remain downstream. `loops.test.ts` was unchanged by this plan.

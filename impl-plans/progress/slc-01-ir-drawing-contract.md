# slc-01 progress

Intent: add actor and open-contour IR contracts, validation, rectangular interaction fallback, and focused regression tests without changing existing fixtures.

- packages/ir/src/semantics/drawing.ts: before 70deb6da373bfe62333f75530264b16a247a7538a3ae17331213fde788be1c1f, after daed2dcc8bad054977b87871c6eb5b5de4c744ca981c661086a861526695b81e. Append actor and add optional closed contour flag.
- packages/ir/src/registry/drawing.ts: before a92741cfbff26e063da02904e568bc3902d2ee5505c5c08cf892d58abd44ac7f, after 448f017a368a8a77359417405b68a1dcc247735e37cea493750526f03ef05d8a. Validate optional closed flag and respective point minima; append canonical key.
- packages/core/src/shapes/outline.ts: before a9d4ba6800dfabba5c0eececa7bc34c3446147bcdc4cccf8a01cd0761e281612, after 64015e5310db0baa19a2de0f6fe0e2045af0ebba0bc103f2e3d281e3c9f1518c. Use box for actor and bounds for a single open path.
- packages/ir/src/registry/drawing.test.ts: before 68405ed78b7892c781ae6be42e1e8c674e07bae102c30e73a4c0ebd70cf4265b, after c47467b7b1eb90a393f623ddf877e07752bd01482c5287cb3838bea840d004b3. Cover actor, open and closed minimums and flag type validation.
- packages/io/src/jsonl/open-path.test.ts: before absent, after 91aa0d9e3fc7e6393ddf1e4b63b5cbb9c6e989cc91a2c30543daa271847b6062. Assert open and closed contour canonical byte-identical JSONL round trips.
- packages/core/src/shapes/outline-rules.test.ts: before absent, after 18deb4ab59e47d6b94b20065fc61346862857397e956585a1e2e8fe279fc2c1f. Assert actor box and open contour bounds with unchanged person and closed path outlines.

Final source hashes after scoped Biome formatting:
- packages/ir/src/semantics/drawing.ts: daed2dcc8bad054977b87871c6eb5b5de4c744ca981c661086a861526695b81e
- packages/ir/src/registry/drawing.ts: afef60783fdb00cf28f035118f5fdee15ec8f315153af8a90c340b7019b80e4d
- packages/ir/src/registry/drawing.test.ts: 467020c1bafb3bf4f0b5bb4eab3958049169dc340410161b96bbfc8ccb43aacc
- packages/io/src/jsonl/open-path.test.ts: 91aa0d9e3fc7e6393ddf1e4b63b5cbb9c6e989cc91a2c30543daa271847b6062
- packages/core/src/shapes/outline.ts: 015bf89d46f46129b0aff76542261cddf4ebeaf52c3ba76e31a188cfd27e32a3
- packages/core/src/shapes/outline-rules.test.ts: 2cb8d2acb060b6f78ed77e752cc821b68bcab7e9c4689a285ced3afd6c731c87

Verification (logs under tmp/shape-lateral-s544/slc-01-ir-drawing-contract/):
- BUN_OPTIONS=--jsx-runtime=classic bun test packages/ir: exit 0, 142 passed, 0 failed, ir.log. Moving shared tree; serial join rerun pending slc-02.
- BUN_OPTIONS=--jsx-runtime=classic bun test packages/io/src/jsonl: exit 0, 138 passed, 0 failed, io-jsonl.log. Shared-input pending-join, slc-02.
- BUN_OPTIONS=--jsx-runtime=classic bun test packages/core/src/shapes/outline-rules.test.ts packages/core/src/shapes/connection-points.test.ts: exit 0, 7 passed, 0 failed, outline.log.
- bunx tsc -p tsconfig.json --noEmit: exit 0, tsc.log. Shared-input pending-join, slc-02.
- bunx biome check on six changed TypeScript files: exit 0, biome.log.
- grep -c actor and open contour error: both exit 0 and output 1, grep-actor.log and grep-open.log.
- git diff --check on tracked source files: exit 0, diff-check.log.

Other git changes observed belong to concurrent slc-02 and were preserved. Formal reviews, serial shared-input checks, staging and commit are downstream.

Rerun on the moving shared tree: focused drawing tests passed (8/8, drawing-rerun.log), JSONL passed (138/138, io-jsonl-rerun.log), outline passed (7/7, outline-rerun.log), scoped Biome and both grep checks passed (biome-rerun.log, grep-actor-rerun.log, grep-open-rerun.log). The aggregate IR test failed (144 passed, 1 failed, ir-rerun.log) in sibling slc-02's validate.test.ts because uml.component kind is not reported; slc-02 reports the registry ownership blocker. Typecheck failed (exit 2, tsc-rerun.log) on readonly ValidationIssue[] in sibling slc-02's validate.test.ts:645. Serial join must rerun these gates after slc-02 resolves both failures. Current owned source hashes match the final source hashes above.

Final current-source rerun on the shared tree: IR 145 passed, JSONL 138 passed, outline 7 passed, all zero failures (ir-final2.log, io-final2.log, outline-final2.log); TypeScript and scoped Biome exit 0 (tsc-final2.log, biome-final2.log); both grep checks exit 0 and print 1 (grep-actor-final2.log, grep-open-final2.log); scoped git diff --check exit 0 (diff-final2.log). Previously failing sibling checks are resolved. Shared-input results remain subject to serial join verification. Owned source hashes match those recorded above. Formal review and workflow finalization remain downstream.

STATUS: done

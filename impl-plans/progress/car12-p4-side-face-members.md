# car12-p4-side-face-members progress

Status: done (implementation phase; formal review and integration follow).

- Source SHA-256: `f5c9facbfcafba93fdd7dfb53119e4ea39d9af2b606a004f2c94f5f1c36d132a` before; `fbe5a472fbf820e62373b3989fb66b28a18faf8e873267b84a1cd1e0b6c252e4` after.
- Test SHA-256: `8ae4523b2cd439449fd17e15027e4b9efb2e732a73593c3c688a00b9ce40099d` before; `73e03724c9ff9e2d0ad37790217818fb273a92e7cdf182ff83b1f95dbd1b42db` after.
- Per-edit intentions and intermediate hashes are recorded under `tmp/car12-r12/car12-p4-side-face-members/`.
- Regression before implementation: `bun test packages/core/src/cad/history.test.ts --test-name-pattern 'side membership work stays linear'` exited 1, one test failed; `fail-before.log`.
- Final `bunx biome check packages/core/src/cad/history.ts packages/core/src/cad/history.test.ts`: exit 0, `biome-final.log`.
- Final `bun test packages/core/src/cad/history.test.ts`: exit 0, 20 passed, 0 failed, `test-final.log`.
- Work at 256/512/1024: repeated 1532/3068/6140; distinct 1502/3040/6143; omitted 272/528/1040. Ordinary fixture: zero visits and zero builds; maximum scanned/memberTotal is zero because there are no side queries. Exact 4x threshold is checked.
- Deviation: workspace typecheck and integration checks are deferred to the serial integration step as directed by the dispatch and overview. Shared tree verification is provisional until integration.

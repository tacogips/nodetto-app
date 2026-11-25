# car13-p2-profile-side-index progress

Status: done (implementation phase; formal review and serial integration pending).

- Design alignment: R13-2, with typed history lookup as specified by the plan.
- Dependencies: none.
- File SHA-256 before/after:
  - history.ts: fbe5a472fbf820e62373b3989fb66b28a18faf8e873267b84a1cd1e0b6c252e4 / dd57a94e39ea49383328669dace67f8409d57fc2d00fd36d60efbb7e5052dbec
  - history.test.ts: 73e03724c9ff9e2d0ad37790217818fb273a92e7cdf182ff83b1f95dbd1b42db / see test-post-3.sha256 in evidence.
  - Active plan hashes and intermediate per-edit hashes are recorded in evidence.
  - Progress file did not exist before this implementation.
- Negative control: `bun test packages/core/src/cad/history.test.ts -t 'shared profile side queries use the sketch index'` exited 1, 1 test failed (65536 versus 256 visits); `fail-before.log`.
- Final `bunx biome check packages/core/src/cad/history.ts packages/core/src/cad/history.test.ts`: exit 0, `biome-final.log`.
- Final `bun test packages/core/src/cad/history.test.ts`: exit 0, 22 passed, 0 failed, `test-final.log`.
- Whole-profile visits: 256, 512, 1024; selection entries and builds: 0.
- Explicit-selection visits: 704, 1408, 2816; entries: 64, 128, 256; builds: 0.
- Ordinary 500-feature fixture: 0 side visits, builds, entries; 500 profile builds, 5500 loop probes.
- Evidence paths above are relative to `tmp/car13-r13/car13-p2-profile-side-index/`.
- Full workspace typecheck, lint and verification run once in serial integration as dispatched.

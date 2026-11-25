# car14-p3-profile-extents progress

Status: done (implementation; formal review and integration are downstream).

- Design alignment: section 31.1 R14-3, identity cache and direct single-loop path. No dependencies.
- File pre/post SHA-256: `bounds.ts` 3999b1b619956e3f19db406c6f5a84290261b05d9c9b8dbedb7934000162b5c7 / 73d9508e9ccbb5043d6473f4e65d5cae27c0932f139ceedb11de6ee8b6788776; `history.ts` dd57a94e39ea49383328669dace67f8409d57fc2d00fd36d60efbb7e5052dbec / 45af157ec6912bcb967b10b8e756a933b35fba458aad2d9055a132572bf13fa9; `check.test.ts` 6e1b940f75cc4df43d2c674dc6695fd09d401d45a03bf99cd754fa989c212e0e / a9c8873f813ee3f1df507e1499d884145971d41ab0cc65a39f7a1e88baf93581. Per-edit intentions and intermediate hashes are in evidence.
- Fail-before: `bun test packages/core/src/cad/check.test.ts --test-name-pattern 'shared multi-loop extrema|ordinary document extrema'`, exit 1, `tmp/car14-r14/car14-p3-profile-extents/fail-before-all.log`: 49152, 196608, 786432, 3145728 reads; ordinary 16500 reads and 164000 projections.
- Pass-after: `bun test packages/core/src/cad/check.test.ts packages/core/src/cad/history.test.ts`, exit 0, 41 tests, `tmp/car14-r14/car14-p3-profile-extents/pass-after.log`: 128, 256, 512, 1024 reads; ordinary 5500 reads and 164000 projections. A first oracle fixture used invalid coordinates; corrected to a translated side frame, with attempts retained in evidence.
- `bunx biome check packages/core/src/cad/bounds.ts packages/core/src/cad/history.ts packages/core/src/cad/check.test.ts`, exit 0, `tmp/car14-r14/car14-p3-profile-extents/biome.log`.
- Workspace typecheck, lint, verify and formal reviews are serial integration work per overview.

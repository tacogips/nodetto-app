# fv-03-merge-fix progress

Implementation complete on the shared working tree; integration and independent review remain downstream.

- Design alignment: section 5 D2 and plan changes match; no dependencies.
- Initial hashes: document-merge.ts `94c63e8c1248f26640f4f5d128acd4b8bd0de453`; document-merge.test.ts `7132f07b62d434ba246a126ce561f7ab083524dd`.
- Export/test edit hashes: `2ba8d132e5a009e36e4d8473a41ccb7449240b32`, `2fef34c548f6976063b5398144893af85757e066`.
- Canonical/own-member edit hash: `8a7d69a623a796bcc1b64dff590489162382d23a`.
- Sparse-array/format edit hashes: `2a3883aae302494708ede511d27a783a74792cf3`, `e4a36fd73872677891f689165f58656618a1b1f0`.
- Fixture type correction test hash: `20ba07314984584216885fb571a08df1daf1aa20`.
- Before fix: `tmp/fv-s942/fv-03-merge-fix/before.log` records 11 pass and 3 fail, covering key ordering, prototype member retention, and diff ordering. The shell wrapper subsequently hit zsh's read-only `status` variable; the Bun log records all three failures.
- Final source: `bun test packages/core/src/document-merge.test.ts packages/core/src/document-merge-versions.test.ts` passed 14 tests, 0 failed (`test-final.log`); focused Biome check passed (`biome-final.log`); strict focused TypeScript check with noUncheckedIndexedAccess passed (`typecheck-final.log`); canonicalValue absence and nonempty baseline checks passed (`canonical-check.log`, `baseline-check.log`). Logs are under `tmp/fv-s942/fv-03-merge-fix/`.
- Focused first typecheck detected invalid test fixture extensions; corrected and reran all affected gates. Initial formatting check was resolved by formatting only the two owned TypeScript files.
- All tests ran on a moving shared tree; final integration verification is owned downstream. No workspace-wide typecheck or verify was run in fanout.
- Plan hash before/after status update: `1a3a7aafe0291fb66cc4e1ec5a985f2fb2510de5` / `8396688bc515e979867e9110e9da94969fe25dfe`. Progress was absent before creation; initial progress hash `743374371af2efba54b4794bdcc99688ead222bc`; final hash is recorded in `progress-hash.txt` under the evidence directory.
- Amendment: the key-order diff now asserts both non-null and `isEmptyCommit`; the own `__proto__` edit still asserts null. Test before/after hashes: `20ba07314984584216885fb571a08df1daf1aa20` / `94e6368498fa18a00636db27bfdf444f51df538b`. Plan before/after hashes: `36a69a7de655f69f56e64b475ddec22aa11f7608` / `5a1e0284657c7d574bf2179b692068d0cb121872`. Progress before hash: `fc3ee25b67fac07f8bced70b60586df133c9ce67`; after hash is in `amend-progress-after-hash.txt`.
- Amendment final-source gates: focused Bun tests 14 passed, 0 failed (`test-amend.log`); Biome, focused strict TypeScript, canonicalValue absence, nonempty baseline, and isEmptyCommit count all exited 0 (`biome-amend.log`, `typecheck-amend.log`, `canonical-amend.log`, `baseline-amend.log`, `empty-amend.log`). The tests ran on the shared moving tree; formal review and integration remain downstream.

- Redispatch self-check: D2 remains aligned with the plan and design; no feedback findings or dependencies. Current source hashes: document-merge.ts `2a3883aae302494708ede511d27a783a74792cf3`, document-merge.test.ts `94e6368498fa18a00636db27bfdf444f51df538b`. Fresh focused Bun run: 14 passed, 0 failed (`test-rerun.log`); Biome, focused strict TypeScript, canonicalValue absence, baseline evidence and empty-commit count checks all exit 0 (`biome-rerun.log`, `typecheck-rerun.log`, `canonical-rerun.log`, `baseline-rerun.log`, `empty-rerun.log`). Shared-tree integration and independent review remain downstream. Progress hash before this edit: `7d5a286f5bba1247cf13b131c7b603d990e82958`; after hash recorded in `progress-after-rerun-hash.txt`.

# car5-f6-diagnostic-ids progress

Status: done (implementation); formal review and integration remain downstream.

- `apps/cli/src/capture-cad.test.ts`: initial SHA256 `984a3ab74d899bbb1d7921101124f32e8bd2b6c3acc6e386f8f4771cbfddc89d`; final `c4dece24aa46cbf8967cb7ac2e74221d1c001ba8e68078cf65affcc994f48f01`. Per-edit intentions and intermediate hashes recorded under `tmp/car5-r5/car5-f6-diagnostic-ids/` and terminal output.
- `apps/cli/src/capture-cad.ts`: pre `294f6a9401dd1e64da7ecb5ed6e42d5a7105ad39fdd831dc7d5d8b7b89f679b2`; post `1a98fcc499a02876635cf557f1b09c83d76e3fd3b7341864a7cd76ab5fb1a04b`.
- `apps/cli/src/capture-command.ts`: pre `5c51952bcbec83957f5e77686def7d11907632c5916a0e2bd8277027d05688b0`; post `b8707bb0be810c1e84919394b85f9944fbe6ef0dd74274b54ffc1239e959740e`.
- `impl-plans/active/car5-f6-diagnostic-ids.md`: pre `829a4d25fdc702726f0e62f54d7815e7082a5749e1b1aec4573ec4f0da43fbfa`; post hash in evidence `plan-hashes.txt`.
- Progress file was absent before creation. Per-edit intentions: `tmp/car5-r5/car5-f6-diagnostic-ids/intent-*.txt`.

Pre-fix regression: `bun test apps/cli/src/capture-cad.test.ts --test-name-pattern 'diagnostic IDs resolve across pages'` exited 1, both cases failed on the incorrect short IDs; complete log `tmp/car5-r5/car5-f6-diagnostic-ids/negative-05.log`. Earlier fixture setup attempts remain in the same evidence directory.

Final focused gate: `bunx biome check --diagnostic-level=warn apps/cli/src/capture-cad.ts apps/cli/src/capture-command.ts apps/cli/src/capture-cad.test.ts && bun test apps/cli/src/capture-cad.test.ts apps/cli/src/capture-command.test.ts` exited 0, 83 tests passed, 0 failed; complete log `tmp/car5-r5/car5-f6-diagnostic-ids/verification.log`. This ran on the shared moving tree. Integration owns workspace typecheck and verification.

Both text paths use one document-wide ID map, JSON retains full IDs, and the two collision tests demonstrate edit removes the intended feature while preserving the other-page element.

# car6-f1-diagnostic-tokens implementation

Status: done (implementation; formal review and integration pending).

- `apps/cli/src/ids.ts`: pre `d603d9a5295ad9cebd2e56f48efa8eb13de2df9ae8d30cbdabee324999458089`, post `73e4a7f0938fbdb9d9a150e953077cefce3ba6f5a7358d7270cf4623af903e2f`; Emit full IDs beginning name: or @ while preserving neighbor comparisons.
- `apps/cli/src/ids.test.ts`: pre `absent`, post `4f0515e65206a723526cbaf071034b88c437be68ae5779bf9354168b29b8f516`; Test reserved IDs and unchanged ordinary prefixes.
- `apps/cli/src/capture-cad.test.ts`: pre `c4dece24aa46cbf8967cb7ac2e74221d1c001ba8e68078cf65affcc994f48f01`, post `0063a93981fe2dead1065b63926b29a1fb950c3f7cc43ad0eb395ac418add434`; Add four stdout token round-trip cases with competing label and batch reference.
- `apps/cli/src/cad-command.test.ts`: pre `7a84ae44e400f3b7ccde5aad83ec29682ad35849aaf003666872963f4d849133`, post `89bbea5d7512f212996d929c8456c1cbcb8008de3c169482a03a2b4bc952d5f8`; Add cad check reserved diagnostic ID regression.
- `impl-plans/active/car6-f1-diagnostic-tokens.md`: pre `da3ba42eed6da86ff8daf43bd60ab4b4ef77b5496fe97c2256762f671b2e1c9f`, post `66839fd6bf21c525663c5830d718b3afc0cf723920a77b2bf02146aaa9d53b2b`; record status.

Pre-fix: `bun test apps/cli/src/ids.test.ts apps/cli/src/capture-cad.test.ts apps/cli/src/cad-command.test.ts` exited 1, 42 passed and 6 failed, including four capture tokens `name:l` / `@spind`; log `tmp/car6-r6/car6-f1-diagnostic-tokens/pre-fix-corrected.log`.

Final focused gate: `bunx biome check --diagnostic-level=warn apps/cli/src/ids.ts apps/cli/src/ids.test.ts apps/cli/src/capture-cad.test.ts apps/cli/src/cad-command.test.ts && bun test apps/cli/src/ids.test.ts apps/cli/src/capture-cad.test.ts apps/cli/src/cad-command.test.ts` exited 0, 48 passed, 0 failed; log `tmp/car6-r6/car6-f1-diagnostic-tokens/final-gate.log`. Workspace typecheck, lint and integration verification are assigned to integration.

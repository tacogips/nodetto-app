# schematic-01-ir-semantics progress

## Start (UTC)
2026-11-25T19:23:15Z

## Files
- `packages/ir/src/types.ts`: pre `5fa5ab58bbec9ce4f5bb751e0a87b652d422998766a670a8813d6dd33421339c`, final `ede113a45dd6fed758a0210ba25e4bb6e8d4222aa839fd03a39728f52a8d6e25`
- `packages/ir/src/semantics/schematic.ts`: pre `absent`, final `f936fcef1be21c4779fe78a444255dcfa9d9cdb79fe878598a7ccd27f5998f82`
- `packages/ir/src/semantics.ts`: pre `726f6c900211d8bff5f9e5c95582654e2bf91a3ec66864bf2b5c9608a4a583b6`, final `56dbb04f95510a9a62c92ed78355fa2d180a38a4702e428969646906fcf06df4`
- `packages/ir/src/index.ts`: pre `02cdd2df4a200893e294e802afbea44288b4a4e6c184377b4c0de3acedeebc2f`, final `08298fc1f86dd115712f09395ab9231369128d055a8173936b8b3573636ed70c`
- `packages/ir/src/semantics/schematic.test.ts`: pre `absent`, final `92b14a8e14a633ef5bad1b69597c903865d47520fb768822aefaac9f0d346353`
- `apps/cli/src/types-command.ts`: pre `cabe1aeb0609181435556d6ceb75460424794cd27ae267f5fe70a08819000d43`, final `996faea123f805f92d23ffbc2cd41aa08e34d6f4db53641ad6b4fd66057cc7f8`
- Progress log: pre `absent`; final hash recorded in evidence `progress-final.sha256`.

## Commands
- `bun test packages/ir/src/semantics/schematic.test.ts`: exit 0, 4 passed, 0 failed; `tmp/schematic-s933/schematic-01-ir-semantics/schematic-test.log`.
- `bun test packages/ir/src/page-content.test.ts packages/ir/src/breadboard.test.ts packages/ui-solid/src/canvas/canvas-background.test.ts apps/cli/src/capture-command.test.ts`: exit 0, 63 passed, 0 failed; `tmp/schematic-s933/schematic-01-ir-semantics/existing-tests.log`.
- `bunx biome check packages/ir/src/types.ts packages/ir/src/semantics/schematic.ts packages/ir/src/semantics.ts packages/ir/src/index.ts packages/ir/src/semantics/schematic.test.ts apps/cli/src/types-command.ts`: exit 0; `tmp/schematic-s933/schematic-01-ir-semantics/biome-check.log`.
- Scoped Biome write reported 6 checked, 3 formatted in `biome-write.log`; shell wrapper returned 1 afterward due to zsh's readonly `status` variable. The final scoped Biome check passed.

## Drift
Final source hashes match intended post-format contents; no sibling drift detected. Intent snapshots preserve pre-edit contents and post-edit hashes are recorded here and in `hashes.txt`.

## Sibling diagnostics
None.

## Open issues
None for this plan. Registry, workspace wiring and integration gates belong to later plans.

## Done checklist
- [x] Schematic page kind and dedicated mode added without reordering existing entries.
- [x] Eighteen semantic types, thirteen part types, prefixes, enums, limits and payload exports implemented.
- [x] CLI typical list contains the eighteen schematic types.
- [x] Four schematic tests and 63 existing tests passed; scoped Biome passed.
- [x] Pre-edit intent snapshots, hashes and full command logs recorded.
- [ ] Formal review and workflow finalization are downstream.

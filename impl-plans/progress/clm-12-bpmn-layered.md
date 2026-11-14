# clm-12 BPMN layered progress

Implementation is incomplete. The planner and direct tests are present, but the free-only page cannot satisfy both the specified origin/column formulas and the no-op rerun criterion: a single task at (0, 0) moves to (70, 40), then (140, 80). See `tmp/clm-s731/clm-12-bpmn-layered/free-row-reproduction.log`. The geometry contract needs a decision for pages without pools. Nested lane geometry and collapsed pools, message flows, free rows alongside pools, subprocesses, boundary events, and document validation need direct regression coverage and any resulting fixes before completion.

Fresh reads and edit intentions are in `tmp/clm-s731/clm-12-bpmn-layered/edit-{1,2,3,4,5}-intent.txt`. Initial source and test files and this log were absent. Planner hashes: initial `8dab16b46d9e5643f381b9945cf5ac02bdfd1f58`, after formatting `0eca7e8ed3bf072222d3aebf28f9d57f785261ed`, current `43703d01af3f38954be352c59a0623b20ee37f73`. Test hashes: initial `7fa56029265526241fbaffb1559afd3fbcc5c87f`, current `b860b94bd43857c699c2d8a01428dbad82211781`.

Current shared-tree checks: planner 10 passed, containment/editor 15 passed, typecheck passed, scoped Biome passed, export grep passed; logs are in the evidence directory. Bun timing for 3 pools, 6 lanes, 60 units: 5.57 ms (`timing.ts`, `timing.log`). These checks do not establish all acceptance criteria. Formal review and wiring belong to downstream workflow steps.

## Continuation 2 implementation

Implemented free-row geometry, first-leaf routing, collapsed-pool carry and explicit nested lane ancestor heights. Added 11 regressions with document validation. A direct child of a pool may be reparented to its first leaf lane by membership reconciliation, as allowed by the plan. A direct child of a non-leaf lane is also reparented to a leaf by `planBpmnMembership`, violating the plan's restriction that only the pool case may change parent. The new assertion preserves this failing behavior for review. Repair requires an authorized change to `packages/core/src/bpmn/containment.ts` or an accepted contract change; this plan explicitly excludes that file. Implementation remains blocked pending an ownership amendment or design decision.

Bun timing for 3 pools, 6 lanes, 60 units: 7.31 ms (`tmp/clm-s732/clm-12-bpmn-layered/timing.log`). Pre/post source hashes and fresh snapshots, per-edit intentions, and verification logs are in that directory. Checks run on a moving shared tree; final stable verification and formal reviews are downstream. The targeted test currently fails the non-leaf parent assertion; see `gate-final-1.log`.

Source pre/post: `43703d01af3f38954be352c59a0623b20ee37f73` / `85a99a58973e43b563664fe54c42756b3da999a5`. Test pre/post: `b860b94bd43857c699c2d8a01428dbad82211781` / `39e3ef23c4c694c607e62927bc5259e266d4bcb5`. Progress pre-edit: `c89b91273ea51448987ccb73467906c54844dd3d`.

## Parent contract amendment revision

The committed amendment permits existing membership reconciliation to reparent a moved unit directly under a non-leaf lane or a pool with lanes to the first leaf. The non-leaf test now expects `one`, retaining its position and no-op assertions; leaf-lane parent assertions remain unchanged. The prior blocker above is superseded. No containment or transaction changes were made by this plan. Timing source moved unchanged to `target/clm-s732-clm-12/timing.ts`; the recorded 7.31 ms remains in `tmp/clm-s732/clm-12-bpmn-layered/timing.log`.

Test hashes before expectation change, after change, and after scoped formatting: 39e3ef23c4c694c607e62927bc5259e266d4bcb5, 384fca65985d5d7b04bf792da068188ff57435b0, 86baf82eedd9b98edae63adc6258835ff9285f32. Timing source hash before and after move: df2eac7c538b1791cdbdf17cafc593695efbafe4, df2eac7c538b1791cdbdf17cafc593695efbafe4. Fresh reads and intentions are in the evidence directory. The reproduction recorded 20 passes and one failure; final gates are recorded as `revision-final-gate-*.log`. Formal test-integrity and adversarial reviews remain downstream. Checks run on the shared tree.

## Test-integrity revision

Added a pool-direct first-leaf parent assertion, a message-flow-dependent cross-pool depth test, and a subprocess endpoint column-gap assertion. Existing assertions remain. Test pre/post hashes: 86baf82eedd9b98edae63adc6258835ff9285f32 / f477c0dc9faf651d572eb925618d014f5a9cdda7. In-memory mutation controls each failed their targeted test as intended: `integrity-subprocess-mutation.log` and `integrity-message-mutation.log`. All eight final gates exit 0: 22 layered tests and 15 containment/editor tests pass; logs are `tmp/clm-s732/clm-12-bpmn-layered/integrity-final-1.log` through `integrity-final-8.log`. These checks ran on the shared tree; independent reviews and stable integration verification remain downstream.

## Adversarial review amendment request

Implementation is blocked on author amendments for IR-S732-CLM12-LANE-RESTACK and IR-S732-CLM12-DEEP-INSET. Rule 7 prohibits writing lane x/y/width, while the reviewed repair requires full lane boxes; rule 6 fixes the column inset and width, while the deep-lane repair requires an explicit depth-dependent rule. The active plan requires the worker to leave it unchanged. Request an author checkpoint amendment to the plan and design E2.1 specifying both contracts, including depth-one and depth-two geometry. Preserve containment and transaction ownership. IR-S732-CLM12-LEAF-ORDER also remains open: its regression depends on the restack repair, so implement and verify together after the amendment. The earlier passing gates do not cover these adversarial cases; no new acceptance is claimed.

## Leaf-order review revision

The preceding claim that the leaf-order regression depends on restacking is superseded. IR-S732-CLM12-LEAF-ORDER is repaired by depth-first traversal of direct lane children in model order, retaining both first-leaf lookups. The interleaved regression checks each leaf parent, full vertical containment, and an empty rerun. Before repair it failed with expected A1, received A2 (22 pass, 1 fail; `tmp/clm-s732/clm-12-bpmn-layered/leaf-order-before.log`); after repair the final planner suite passes 23 tests. Planner pre/post hashes: 85a99a58973e43b563664fe54c42756b3da999a5 / d5ec3dfd5215b28c0ef88e4c5c4e6b1b242ebce9. Test pre/post hashes: f477c0dc9faf651d572eb925618d014f5a9cdda7 / 27209cebbe6eecc20392527d9c3c363c2a971961. Per-edit intentions and intermediate hashes are in the evidence directory. Moved `tmp/clm-s732/clm-12-bpmn-layered/integrity-mutation-preload.js` to `target/clm-s732-clm-12/integrity-mutation-preload.js`.

Final-source checks: planner 23 pass, containment/editor 15 pass, typecheck, scoped Biome, symbol, test count, no TypeScript under evidence, and unchanged active plan all exit 0; see `tmp/clm-s732/clm-12-bpmn-layered/review-final-*.log`. The first typecheck failed on readonly fixture assignment and was repaired before these checks (`final-typecheck.log`). Shared-tree verification is point-in-time. Independent review is downstream.

IR-S732-CLM12-LANE-RESTACK remains blocked until an author commits the rule 7 and E2.1 amendment allowing full top-down lane boxes; then assert containment at depths 1 through 3 and no-op rerun. IR-S732-CLM12-DEEP-INSET remains blocked until an author commits the rule 6 and E2.1 amendment specifying depth-dependent inset and pool width, retaining depth-one results and specifying depth-two results; then test depths 1 through 3. The checkpoint amendment budget is exhausted. No lane x, y, width or semantic parent commands were added.

## Continuation 3 implementation

The authoritative D1/D2 amendment supersedes the previous restack and inset blockers. The planner uses the page-wide depth inset and top-down full lane boxes at D >= 2, settles planned pool and lane boxes on the draft, and leaves depth-one commands unchanged. The two allowed first-leaf membership changes remain geometry-driven; the planner writes no semantic parent. Nested lane x and width now use 30 per depth, with unit x 100 at D=2 and 130 at D=3 for pool x=0. Depth-one examples retain x=70. Existing nested tests retain order and parent assertions.

Baseline snapshots captured before planner edits from the d5b9bac archive with export-local resolutions and containment checks; provenance is `tmp/clm-s736/clm-12-bpmn-layered/capture-provenance.txt`. Hashes (git hash-object):

- `packages/core/src/arrange-layered-bpmn.depth-one.collapsed-pool.expected.json`: `ada68bcc0e1916fa24b02706d75829c371fe0200`
- `packages/core/src/arrange-layered-bpmn.depth-one.pool-no-lanes-free-row.expected.json`: `19dd4035b811c881ee717330cad018cc0cde4a8d`
- `packages/core/src/arrange-layered-bpmn.depth-one.subprocess-boundary.expected.json`: `6a3ba5a6a8478d5c8f98e897191112c864793e3d`
- `packages/core/src/arrange-layered-bpmn.depth-one.two-pools-message-flow.expected.json`: `d623a48616b80d9c00f8bb1a755b83b20c68b249`

Fresh reads, intentions, and per-edit pre/post hashes are in `tmp/clm-s736/clm-12-bpmn-layered/`. Bun planner timing for 3 pools, 6 lanes and 60 units: 13.296 ms, `target/clm-s736-clm-12/timing.ts` and `tmp/clm-s736/clm-12-bpmn-layered/timing.log`. Verification runs on the shared tree; formal review and clm-09 wiring are downstream.

Per-edit source hashes:

- Edit 02: pre `2173202e9b429675e3ff7f0c10024601b3d9f636`; post `472afb86f08065c6fd021a9e5992f2e7a2b7e1de`.
- Edit 03: pre `d5ec3dfd5215b28c0ef88e4c5c4e6b1b242ebce9`; post `f7a739f79d92e46f93088812f96e8263cf0b25db`.
- Edit 04: pre `27209cebbe6eecc20392527d9c3c363c2a971961`; post `ab3ac8c3bdb1d56f303d007cf6be2bdca62f2f60`.
- Edit 05: pre `f7a739f79d92e46f93088812f96e8263cf0b25db; ab3ac8c3bdb1d56f303d007cf6be2bdca62f2f60`; post `cecdd0e8eb27135691c0a80bf184c1dba5ea50a1; 3e07a8efa36bafc36a9baead1cc7123c66e81b36`.
- Edit 06: pre `3e07a8efa36bafc36a9baead1cc7123c66e81b36`; post `b444f2cb8eb713411e453d24aa6fa407651d5d0f`.
- Edit 07: pre `b444f2cb8eb713411e453d24aa6fa407651d5d0f`; post `49904c55aa7ceb940c5c1098dd1165779f467d54`.
- Edit 08: pre `d55cdb8578f21484489b7ef6d8c8f0a6a96f2f9a`; post `2a780a8d581a89f2697b412ec4691ffafbdd0790`.
- Edit 09: pre `49904c55aa7ceb940c5c1098dd1165779f467d54; cecdd0e8eb27135691c0a80bf184c1dba5ea50a1`; post `c1c9000ca7dd95e828283e52e8c05a1339f73471; c54a8f49af9b8780fdf0475ec3f33d0a2470a61c`.

## Test-integrity depth-three revision

TI-S736-CLM12-D3-MULTIROW: added sibling and non-summing depth-three lane cases, asserting planned boxes, settlement, task containment, parents and empty reruns. The depth-two coincident case now also asserts full boxes. The targeted suite ran 38 tests successfully. Test hash before: `c1c9000ca7dd95e828283e52e8c05a1339f73471`; after: `2444aa6ede5d92b4e8b868dfa963dbe3e9365a04`. Planner and capture fixtures remain unchanged. Fresh reads and intentions are in `tmp/clm-s736/clm-12-bpmn-layered/revision-*.txt`. Independent review remains downstream.

## Adversarial subprocess revision

ADV-S736-CLM12-SUBPROCESS-TEAR: for D >= 2, the planner checks the final draft for changed subprocess-descendant parents or non-boundary offsets and refuses with a specific error before returning commands. The valid tear reproduction and clear control pass; the suite has 40 tests. Planner pre-edit hash `c54a8f49af9b8780fdf0475ec3f33d0a2470a61c`; test pre-edit hash `2444aa6ede5d92b4e8b868dfa963dbe3e9365a04`; post-format hashes `73ccb2405aa9505cc3e1f0ab802fb6536e2d08c2; 79867293041d56411eb1c2d97e03f270ae78d2b7`. Edit intentions and snapshots are under `tmp/clm-s736/clm-12-bpmn-layered/adv-*`.

Design note for the design author or serial integration reviewer: E2.1 should record this D >= 2 refusal when subprocess contents cannot be preserved; the design file is outside this plan's ownership. Strict D2 also preserves the analogous depth-one limitation, which remains open alongside Q11. Independent review is downstream.

## Adversarial collapsed-pool revision

ADV-S736-CLM12-COLLAPSED-TEAR: the D >= 2 draft guard also refuses changed collapsed-pool descendant parents or non-lane, non-boundary offsets. The valid reproduction and clear control pass; 42 layered tests pass. Planner pre-edit hash `73ccb2405aa9505cc3e1f0ab802fb6536e2d08c2`; test pre-edit hash `79867293041d56411eb1c2d97e03f270ae78d2b7`; post-format hashes `bac883cee840bbb671f2aa36b0142f2886d71d04; 05f14a0877a2fa6ce8927ae0a19ed743508dbdb8`. Fresh reads and intentions are in `tmp/clm-s736/clm-12-bpmn-layered/collapse-*`.

Design note for the design author or serial integration reviewer: E2.1 should record or reject both the subprocess and collapsed-pool refusals; the design file is outside this plan's ownership. Strict depth-one identity also preserves the analogous collapsed-pool limitation. Independent review is downstream.

## Collapsed-pool refusal wording revision

ADV-S736-CLM12-COLLAPSED-REFUSAL-TEXT: the refusal now reports the planned width and both remedies. A member can fall outside the narrower common pool width or land transiently on a live subprocess; the design author or serial integration reviewer should consider both causes when recording the refusal in E2.1. The width-only reproduction and follow-the-advice control pass; the layered suite has 44 tests. Planner pre/post hashes `bac883cee840bbb671f2aa36b0142f2886d71d04` / `6d79f24919d72503156fb1129f29aa8c567784ce`; test pre/post hashes `05f14a0877a2fa6ce8927ae0a19ed743508dbdb8` / `f7fb1e924537129d809cf1a7adc1abd14f62a811`. Per-edit intent and snapshots are in `tmp/clm-s736/clm-12-bpmn-layered/refusal-*`. Independent review remains downstream.

Q11 open: depth-one containment not accepted for conflict inputs

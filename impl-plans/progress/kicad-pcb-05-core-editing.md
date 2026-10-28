# kicad-pcb-05-core-editing progress

## Intent snapshot (before source edits)

Implement the assigned plan only: semantic PCB move commands and insertion helpers in `edit.ts`; a grid-indexed derived track-follow planner in `follow.ts`; Editor integration for movable anchors, footprint rotation, track/via creation, and follow after the breadboard planner; focused tests. Preserve generic rotation policy and ensure one Editor.apply keeps footprint and derived track updates in a single undo step. No connectivity, UI, shape, CLI, barrel/index, or downstream integration work.

The dispatch lists no DAG dependencies and `acceptedPlanIds` is empty; `fanoutItem.dependsOn` is also empty, so this plan is admitted for implementation. The accepted design sections 5.1-5.4 place PCB geometry in semantic millimetres, require anchors in page units, specify pad-attached track following for all semantic edit sources, and define footprint rotation/add-track/add-via editor operations.

Initial source hashes before edits:

- `packages/core/src/editor.ts`: `65c7dc11abf55f5c0dc482cd734125e3b7811bf680424e463364e6cc4ef06482`
- `packages/core/src/commands.ts`: `4657cde0a47e3aaab93063dd1019541ac7a5b463cb00b1e196bd14ca80765e0a`
- `packages/core/src/pcb-board/geometry.ts`: `cd92958f2df105290f0da8be7dac3b4f75e53377cef43d7e176cdcabc9aa0898`
- `packages/core/src/pcb-board/page.ts`: `faa1ab1c4f8473903bcd431f00c4b2295d973203cc21c04d7c9b0c0abaf88038`
- `packages/ir/src/pcb.ts`: `9593868a147dbcdd31f21a594cd4b2ef5aae327d6fbbcaa2f726cabc2aea1464`

## Implementation

Implemented the assigned plan:

- Added `edit.ts` with semantic PCB movement, footprint rotation normalization,
  typed track/via inputs, default constants, nm rounding, and category-aware
  fractional insertion.
- Added `follow.ts` with changed-footprint detection, a grid of unchanged
  tracks, old-pad/shared-layer endpoint matching, preserved pad offsets,
  deterministic arc sagitta adjustment, and one update command per track.
- Integrated PCB anchors and semantic movement in `Editor`, ran follow after
  breadboard translations, and added footprint rotation plus track/via creation
  with empty visual payloads. `ROTATABLE_LEAF_TYPES` was not changed.
- Added edit and follow tests covering absolute drag targets, all movable PCB
  semantics, lock handling, insertion order, nm rounding, pad/layer matching,
  multiple attached endpoints, batch track movement, arc follow, inspector
  updates, and one-step undo.

Final source hashes:

- `packages/core/src/editor.ts`: `66af2c642c3a56dd02ebd05a509ca46f7b9f18552d40c4730c950cedd7fad25c`
- `packages/core/src/pcb-board/edit.ts`: `f6d69980e479a780037bd62ca0abd8f58273ce8c30efc9822f50951fd81ffc26`
- `packages/core/src/pcb-board/follow.ts`: `3d5c7ced231fef07aa8b9a38fd0ba211b17c70126751517c88b38df68878fe80`
- `packages/core/src/pcb-board/edit.test.ts`: `72cd7572a2ad99e9e37c023d8ef35361a2de18efd78a107abeb89f217a82f4ef`
- `packages/core/src/pcb-board/follow.test.ts`: `f322514942b7f7df2c5122a08c96c1167d7889e82aa513b877f328576f19c6e7`

The shared checkout also contains in-progress paths owned by neighboring plans;
no files outside this plan's `writePaths` were edited.

## Verification

Final source gates (complete logs under
`tmp/kicad-pcb-s534/kicad-pcb-05-core-editing/`):

| Command | Exit | Result | Log |
| --- | ---: | --- | --- |
| `bun test packages/core/src/pcb-board/edit.test.ts packages/core/src/pcb-board/follow.test.ts` | 0 | 11 passed, 0 failed, 35 assertions | `targeted-tests.r1.log` |
| `bun test packages/core/src/editor.test.ts packages/core/src/breadboard packages/core/src/editor-ux.test.ts` | 0 | 137 passed, 0 failed | `regression-tests.r1.log` |
| `bun run typecheck` | 0 | TypeScript check passed | `typecheck.r1.log` |
| `bunx biome check packages/core/src/editor.ts packages/core/src/pcb-board/follow.ts packages/core/src/pcb-board/follow.test.ts packages/core/src/pcb-board/edit.ts packages/core/src/pcb-board/edit.test.ts --diagnostic-level=warn` | 0 | 5 files checked, no diagnostics | `biome.r1.log` |
| `bunx biome format --write packages/core/src/pcb-board/follow.ts packages/core/src/pcb-board/follow.test.ts` | 0 | 2 owned files formatted | `format.r1.log` |
| `{ test "$(grep -c 'planPcbTrackFollow' packages/core/src/editor.ts)" -ge 1 && printf '%s\n' 'planPcbTrackFollow: present'; grep -q 'rotatePcbFootprints' packages/core/src/editor.ts && printf '%s\n' 'rotatePcbFootprints: present'; grep -q 'addPcbTrack' packages/core/src/editor.ts && printf '%s\n' 'addPcbTrack: present'; grep -q 'addPcbVia' packages/core/src/editor.ts && printf '%s\n' 'addPcbVia: present'; test -s impl-plans/progress/kicad-pcb-05-core-editing.md && printf '%s\n' 'progress log: non-empty'; } > tmp/kicad-pcb-s534/kicad-pcb-05-core-editing/acceptance-greps.r1b.log 2>&1; rc=$?; cat tmp/kicad-pcb-s534/kicad-pcb-05-core-editing/acceptance-greps.r1b.log; printf 'exit=%s\n' "$rc"; exit "$rc"` | 0 | All four Editor symbols present; progress log non-empty; captured output is non-empty | `acceptance-greps.r1b.log` |

## Test-integrity revision (comm-009907)

- F05-TI-01: corrected `rotateSagitta` to apply the forward old-to-new
  chord rotation while retaining the zero-length guards. The arc test now
  derives its expected midpoint with arithmetic, asserts `[1.5, 0]`, checks
  equal distances to both endpoints, and verifies the sagitta is perpendicular
  to the new chord.
- F05-TI-02: refreshed the `editor.ts` hash above and captured passing
  acceptance-grep output in `acceptance-greps.r1b.log`.
- Revision evidence: `targeted-tests.r1.log` (11 passed, 0 failed),
  `regression-tests.r1.log` (137 passed, 0 failed), `typecheck.r1.log`, and
  `biome.r1.log`; each has exit 0 and a complete log.
- The review's additional low-priority coverage notes are retained as residual
  test-coverage observations; the authorized repair paths for this revision
  cover the two assigned findings and do not include `edit.test.ts`.

Superseded attempts are retained separately: `targeted-tests.initial-retry.log`
failed module loading because `pcbAnchor` was imported from the wrong module;
`targeted-tests.second.log` recorded two incorrect test assertions; the first
`typecheck.log` found an unused variable in the in-progress plan-04 reader, and
`biome.log` identified formatting changes subsequently applied to owned files.
The arc test-integrity finding is corrected by the r1 evidence above, and all
specified final-source gates pass.

Formal integrity/adversarial review, shared integration updates, staging,
commit, and push remain downstream workflow steps.

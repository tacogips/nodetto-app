# kicad-pcb-06-core-connectivity progress

## Intent snapshot

Implement only plan 06's connectivity, ratsnest, highlight, membership, net-name APIs and tests. Use the plan 01 geometry helpers and builder. Keep page and pad ordering deterministic; ignore hidden elements and empty nets; use per-layer PcbGrid candidate lookup and same-net union-find; preserve the pinned Prim tie breaks. No downstream barrel or UI integration is owned here.

Per-worker protocol: captured the absent-file pre-node snapshot at `tmp/riela-fanout/836E79A4-EEB8-4BAC-8B74-8C6CC171471C/4DF04F15-FDB5-4B16-96C0-773986B9B1F8.json`; the fresh-read context hashes and exact intent are in `tmp/kicad-pcb-s534/kicad-pcb-06-core-connectivity/intent-001.md`.

## Verification

Final current-source gates:

| Command | Exit | Result | Complete log |
| --- | ---: | --- | --- |
| `bun test packages/core/src/pcb-board/connectivity.test.ts packages/core/src/pcb-board/ratsnest.test.ts` | 0 | 10 tests, 23 assertions, 0 failures; includes the 5,000-track / 500-pad sample, arc chords, different-net contact and same-net positive control | `tmp/kicad-pcb-s534/kicad-pcb-06-core-connectivity/bun-test-final-004.log` |
| `bun run typecheck` | 0 | TypeScript workspace check passed on the revised test source | `tmp/kicad-pcb-s534/kicad-pcb-06-core-connectivity/typecheck-final-004.log` |
| `bunx biome check packages/core/src/pcb-board/connectivity.test.ts --diagnostic-level=warn` | 0 | Revised test file checked; no diagnostics | `tmp/kicad-pcb-s534/kicad-pcb-06-core-connectivity/biome-test-final-001.log` |
| `bunx biome check packages/core/src/pcb-board/connectivity.ts packages/core/src/pcb-board/connectivity.test.ts packages/core/src/pcb-board/ratsnest.ts packages/core/src/pcb-board/ratsnest.test.ts --diagnostic-level=warn` | 0 | Four owned files checked; no diagnostics | `tmp/kicad-pcb-s534/kicad-pcb-06-core-connectivity/biome-final-003.log` |
| `! grep -n 'Math.hypot' packages/core/src/pcb-board/connectivity.ts packages/core/src/pcb-board/ratsnest.ts` | 0 | No matches | `tmp/kicad-pcb-s534/kicad-pcb-06-core-connectivity/no-hypot-final-003.log` |

The recorded shell invocations redirected each exact command's full output to the listed log, captured `$?`, printed the exit status, and returned that status.

Superseded attempts (kept as evidence, not final gates):

- `bun test packages/core/src/pcb-board/connectivity.test.ts packages/core/src/pcb-board/ratsnest.test.ts` exited 1 (7 passed, 2 failed) because two test zone fixtures had empty outlines rejected by the IR validator. Both fixtures now use valid three-point outlines; the final run above passes.
- The scoped Biome check initially exited 1 because the four new files needed formatting. `bunx biome format --write packages/core/src/pcb-board/connectivity.ts packages/core/src/pcb-board/connectivity.test.ts packages/core/src/pcb-board/ratsnest.ts packages/core/src/pcb-board/ratsnest.test.ts` exited 0; the final scoped check above passes.
- An earlier `bun run typecheck` exited 2 on an in-progress plan 05 error in `packages/core/src/editor.ts` and `packages/core/src/pcb-board/edit.test.ts`; a later run passed. Another run exited 2 on an in-progress plan 04 unused parameter in `packages/io/src/kicad/pcb.ts`; the latest run passed after that sibling edit was corrected. No typecheck diagnostic referenced plan 06 files. Logs: `typecheck-001.log`, `typecheck-final-001.log`, `typecheck-final-002.log`, and `typecheck-final-003.log` under this plan's evidence directory.

## Review repair

- `P06-TI-1` (mid): made the net-B track endpoint touch the middle of net-A `track-1`; retained the A-pad-to-A-pad join and track-2/track-1 separation assertions; added track-2 separation from the A pad and a same-geometry net-A positive control. `connectivity.ts` and `ratsnest.ts` were not changed.
- In-memory mutation removed both `candidate.net !== net` and the union net guard. The new net-B assertion then failed as expected because track-2 joined net-A track-1. This negative control exited 1 and is recorded at `tmp/kicad-pcb-s534/kicad-pcb-06-core-connectivity/mutation-filter-negative-001.log`; the unchanged production file hash is `d8def7dcace54e042bab072ad59f631107b6cdec0ce06a951827cf2b4e3a90a1`.

Final SHA-256:

- `packages/core/src/pcb-board/connectivity.ts`: `d8def7dcace54e042bab072ad59f631107b6cdec0ce06a951827cf2b4e3a90a1`
- `packages/core/src/pcb-board/connectivity.test.ts`: `b2c2eeba155e2ac553f04221c3b52e6aaa0479ba36feba18b10f46967b651b52`
- `packages/core/src/pcb-board/ratsnest.ts`: `d2dffde28491d9deaecc72c543f5e94f6a7eaa73e0ce8ea121a397dec5d70356`
- `packages/core/src/pcb-board/ratsnest.test.ts`: `c16c012cb27e93c90934c1d559f4139ec622daafb763d7eb63b0aa65bf9a924b`

## Completion

- Implemented `computePcbConnectivity`, `computePcbRatsnest`, `pcbNetHighlight`, `pcbNetMembers`, `pcbNetNames` and the pinned exported types.
- Per-layer 2.54 mm `PcbGrid` indexes pad outlines/primitives, track segments and arc chords, vias, and individual zone fill polygons. Same-net contact filtering feeds path-compressed union-find. Hidden elements and empty-net copper are excluded.
- Prim ratsnest emits `g - 1` links per disconnected net in code-unit-sorted net order, using squared distances and the pinned element-order/pad tie-breaks.
- Same-net-only contact filtering has a discriminating regression: endpoint-touching net-B copper stays separate from net-A copper, while the same geometry on net A joins; the in-memory mutation confirms the separation assertion fails without both net guards.
- All five plan done criteria and four listed verification steps pass on current source.
- Formal review and downstream plan 09 barrel/integration remain workflow-owned follow-up, not plan 06 implementation work.

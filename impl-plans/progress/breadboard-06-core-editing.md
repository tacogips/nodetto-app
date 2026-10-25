# breadboard-06-core-editing progress

## Implemented

- Added 10-unit point and selection-delta snapping plus the breadboard snap-target guard.
- Added part-only quarter-turn rotation that preserves pin 1, reference allocation and duplicate repair helpers, and board-carry translation for parts and wires fully hosted by a moved board.
- Added fixed-size shape utilities for every breadboard element type, with useful default dimensions, wire bounds and segment hit testing, plus pin and wire-end picking.
- Added guarded Editor intents for creating breadboard elements, rotating parts, editing part parameters while preserving pin 1, fixing references, and maintaining transient cross-probe state. Creating an empty netlist card assigns source `manual` so the IR validator accepts the card.
- Added paste/duplicate annotation only on breadboard pages; registered the shape utilities and appended the pinned snap, rotate, and annotate barrel exports. `board-carry.ts` stays internal.
- Added focused tests for snapping, annotations, Editor intents, board carry, transient probes, registry coverage, wire hit testing, and pin picking.

## Verification

All commands ran in the foreground from the repository root. Current final-source results:

| Command | Exit | Result | Complete log |
|---|---:|---|---|
| `bun test packages/core/src/breadboard/snap.test.ts packages/core/src/breadboard/annotate.test.ts packages/core/src/breadboard/editor-breadboard.test.ts packages/core/src/shapes/breadboard.test.ts` | 0 | 16 pass, 0 fail, 89 assertions | `tmp/breadboard-mode-s485/breadboard-06-core-editing/focused-final4.log` |
| `bun test packages/core` | 0 | 1199 pass, 4 skip, 0 fail | `tmp/breadboard-mode-s485/breadboard-06-core-editing/core-final4.log` |
| `bun run typecheck` | 0 | TypeScript check passed; no diagnostics | `tmp/breadboard-mode-s485/breadboard-06-core-editing/typecheck-final4.log` |
| `bunx biome check` on the 11 plan-owned files | 0 | Style check passed | `tmp/breadboard-mode-s485/breadboard-06-core-editing/biome-final4.log` |
| `git diff --quiet -- packages/core/src/rotation.ts packages/core/src/snap.ts` | 0 | Generic rotation and snap modules are unchanged | `tmp/breadboard-mode-s485/breadboard-06-core-editing/generic-rotation-snap-final4.log` |
| G1 own-regex diagnostic scan on `typecheck-final4.log` | 0 | No owned diagnostics | `tmp/breadboard-mode-s485/breadboard-06-core-editing/g1-ownregex-final4.log` |
| TypeScript error scan on `typecheck-final4.log` | 0 | No `error TS` lines | `tmp/breadboard-mode-s485/breadboard-06-core-editing/typescript-errors-final4.log` |
| Added-line ASCII scan for `packages/core/src/editor.ts`, `packages/core/src/shapes/index.ts`, and `packages/core/src/breadboard/index.ts` | 0 | No non-ASCII added lines | `tmp/breadboard-mode-s485/breadboard-06-core-editing/ascii-added-final4.log` |
| ASCII scan for all new plan source, tests, and this progress log | 0 | No non-ASCII bytes | `tmp/breadboard-mode-s485/breadboard-06-core-editing/ascii-files-final4.log` |
| Pinned barrel count and no-board-carry export checks | 0 | snap, rotate and annotate each occur once; board-carry is not exported | `tmp/breadboard-mode-s485/breadboard-06-core-editing/barrel-final4.log` |
| `git diff --check` on plan-owned and shared edited paths | 0 | No whitespace errors | `tmp/breadboard-mode-s485/breadboard-06-core-editing/diff-check-final4.log` |

No cargo commands were run. Formal test-integrity/adversarial review and combined-tree integration remain downstream workflow steps.

## Resolved verification attempt

An earlier full-core run exposed that the empty default source on a newly created netlist card is rejected by IR validation. The Editor creation intent now fills the empty source as `manual`. The final-source focused suite and full core suite above pass. The superseded run is retained at `tmp/breadboard-mode-s485/breadboard-06-core-editing/core-final2.log` (exit 1, 1 failing test).

## Review repair F06-AR-1

`updateBreadboardSemantic` now accepts every registered breadboard element type. The existing part path remains pin-1-preserving. Wire, board and netlist semantic patches use one `apply` batch; board size changes also update width and height from `boardLayout` while preserving position. Added tests cover wire points with undo, wire color, half-to-full board sizing with undo (660 x 220), netlist source with undo, and rejection of a `shape.geo` element. Existing part-parameter tests remain unchanged.

Current final-source verification after the repair:

| Command | Exit | Result | Complete log |
|---|---:|---|---|
| `bun test packages/core/src/breadboard/snap.test.ts packages/core/src/breadboard/annotate.test.ts packages/core/src/breadboard/editor-breadboard.test.ts packages/core/src/shapes/breadboard.test.ts` | 0 | 19 pass, 0 fail, 105 assertions | `tmp/breadboard-mode-s485/breadboard-06-core-editing/focused-F06-AR-1-final.log` |
| `bun test packages/core` | 0 | 1202 pass, 4 skip, 0 fail | `tmp/breadboard-mode-s485/breadboard-06-core-editing/core-F06-AR-1-final.log` |
| `bun run typecheck` | 0 | TypeScript check passed | `tmp/breadboard-mode-s485/breadboard-06-core-editing/typecheck-F06-AR-1-final.log` |
| G1 owned-path diagnostic scan on the final typecheck log | 0 | No plan-06 diagnostics | `tmp/breadboard-mode-s485/breadboard-06-core-editing/g1-F06-AR-1-final.log` |
| TypeScript error scan on the final typecheck log | 0 | No `error TS` lines | `tmp/breadboard-mode-s485/breadboard-06-core-editing/ts-errors-F06-AR-1-final.log` |
| `bunx biome check` on the 11 plan-owned files | 0 | Style check passed | `tmp/breadboard-mode-s485/breadboard-06-core-editing/biome-F06-AR-1-final.log` |
| `git diff --quiet -- packages/core/src/rotation.ts packages/core/src/snap.ts` | 0 | Generic rotation and snap files unchanged | `tmp/breadboard-mode-s485/breadboard-06-core-editing/generic-F06-AR-1-final.log` |
| ASCII gates for plan source, progress and added shared-path lines | 0 | ASCII checks passed | `tmp/breadboard-mode-s485/breadboard-06-core-editing/ascii-F06-AR-1-final.log` |
| Pinned barrel count and internal board-carry export check | 0 | Three pinned exports exactly once; board-carry not exported | `tmp/breadboard-mode-s485/breadboard-06-core-editing/barrel-F06-AR-1-final.log` |
| `git diff --check` on assigned source and shared paths | 0 | No whitespace errors | `tmp/breadboard-mode-s485/breadboard-06-core-editing/diff-F06-AR-1-final.log` |

Superseded repair attempts are retained separately: `focused-F06-AR-1-attempt1.log` passed before type narrowing and formatting corrections; `typecheck-F06-AR-1-final.log` and `biome-F06-AR-1-final.log` were rerun successfully on the corrected final source. The failed initial logs from those checks are not used as final evidence. Formal independent review remains downstream.

# clm-07-layered-core progress

HEAD at start: ee2cb43938ca5e66289ed87d925f6354c223b14b. Owned edits: packages/core/src/arrange-layered.ts, packages/core/src/arrange-layered.test.ts, this log. Intent and hashes are recorded under tmp/clm-s725/clm-07-layered-core/.

Implemented contract exports, frame and unit selection, deterministic BFS placement, direction, explicit frame ordering, nested-container translations, and no-frame/invalid-frame errors. Initial focused tests cover ordering, shuffling, parent preservation, rerun, and errors. More tests are required for edge traversal, cycles, disconnected components, nested frames, exact geometry and transposition.

Incomplete: the title band is temporarily copied as 24 from the hit-test region in packages/core/src/shapes/frame.ts; the accepted plan prohibits hard-coding and requires a value read from the frame shape util or layout code. Neither that value nor arrange.ts's related private padding constants are exported. A shared-code seam or a scoped plan amendment is needed before completion. Workspace typecheck also failed in sibling-owned packages/core/src/document-merge.ts; see typecheck log. No sibling files were edited.

Formal reviews, shared wiring and final integration are downstream work.

Redispatch: current shared-tree focused tests pass (11 tests), typecheck passes, Biome passes, and the planLayered symbol check passes; see redispatch-*.log. The earlier typecheck failure is superseded. The title-band ownership blocker and missing behavioral coverage remain unresolved; no source edits were made in this redispatch.

Continuation: added tests with actual state transitions, exact LR dimensions and a rerun, plus nested-frame descendant translation, placed membership and rejection of nested frame order. The final focused suite passes 13 tests; typecheck, Biome and symbol check pass (continuation-*-final.log). An initial test expectation incorrectly added the frame height and was corrected; see continuation-tests-attempt.log. The title-band seam remains outside writePaths, and tests for source/cycle/disconnected ranking and exact TB transposition remain outstanding. Formal review and wiring remain downstream.

Amendment round 1: exported `FRAME_TITLE_BAND` from `packages/core/src/shapes/frame.ts` and used it in frame hit testing and layered layout. Added source, cycle, disconnected traversal, shuffled graph creation and exact LR/TB transposition tests. The assigned implementation and tests are complete; shared CLI wiring and formal reviews remain downstream. Current shared-tree verification: targeted tests, typecheck, Biome, both symbol checks and no-copied-literal check all exit 0; see `tmp/clm-s725/clm-07-layered-core/round1-*.log`. Frame diff contains only the authorized export and literal replacement.

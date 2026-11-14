# breadboard-05-collab progress

## Implemented

- Added `BREADBOARD_PAGE` and `breadboardDocument()` with unique `bb-` element
  ids and all 13 registered breadboard element types.
- Added the breadboard document as the sixth and last entry from
  `allFixtures()`.
- Added Yjs round-trip coverage for every type, including ordered wire points
  and nested netlist nodes, plus peer convergence tests for concurrent edits
  and edit/delete operations.
- Left `ydoc.ts`, `binding.ts` and `ydoc.test.ts` unchanged.

## Verification

All commands ran in the shared worktree on `feat/breadboard-mode`.

| Command | Exit | Result / log |
| --- | ---: | --- |
| `bun test packages/collab/src/breadboard.test.ts packages/collab/src/ydoc.test.ts` | 0 | 16 pass, 0 fail; `tmp/breadboard-mode-s485/breadboard-05-collab/focused-final4.log` |
| `bun test packages/collab` | 0 | 135 pass, 0 fail; `tmp/breadboard-mode-s485/breadboard-05-collab/collab-final3.log` |
| `bun run typecheck` | 2 | No diagnostics in plan-owned collab files. Current diagnostics are in concurrent `packages/core/src/breadboard/board.ts` and `packages/io/src/kicad/sexpr.test.ts`; full output: `tmp/breadboard-mode-s485/breadboard-05-collab/typecheck-final3.log` |
| `! grep -E '^packages/collab/src/(test-fixtures|breadboard\.test)\.ts' tmp/breadboard-mode-s485/breadboard-05-collab/typecheck-final3.log` | 0 | G1 owner-scoped diagnostics: none |
| `bunx biome check packages/collab/src/test-fixtures.ts packages/collab/src/breadboard.test.ts` | 0 | 2 files checked; `tmp/breadboard-mode-s485/breadboard-05-collab/biome-final3.log` |
| `bun -e 'import { isValidDocument } from "@nodetto/ir"; import { breadboardDocument } from "./packages/collab/src/test-fixtures.ts"; if (!isValidDocument(breadboardDocument())) process.exit(1); console.log("breadboard fixture valid");'` | 0 | Fixture validates; `tmp/breadboard-mode-s485/breadboard-05-collab/fixture-validation.log` |
| `git diff --quiet -- packages/collab/src/ydoc.ts packages/collab/src/binding.ts packages/collab/src/ydoc.test.ts` | 0 | Runtime and shared test files unchanged |
| `perl -ne 'if (/[^\x00-\x7F]/) { print "$ARGV:$.\n"; $bad = 1 } close ARGV if eof; END { exit($bad ? 1 : 0) }' packages/collab/src/breadboard.test.ts impl-plans/progress/breadboard-05-collab.md` | 0 | New test and progress files are ASCII |
| `git diff -U0 -- packages/collab/src/test-fixtures.ts \| perl -ne 'if (/^\+(?!\+\+)/ && /[^\x00-\x7F]/) { print; $bad = 1 } END { exit($bad ? 1 : 0) }'` | 0 | Added fixture lines are ASCII |

## Open notes

The workspace-wide typecheck remains red due to sibling-plan diagnostics in
`packages/core/src/breadboard/board.ts` and
`packages/io/src/kicad/sexpr.test.ts`. Those files are outside this plan's
write paths.

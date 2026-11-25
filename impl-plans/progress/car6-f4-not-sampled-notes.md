# car6-f4-not-sampled-notes progress

Status: implementation source complete; required workspace typecheck blocked.

- Added ordered, sanitized `notSampled` names and desktop notice; preserved existing description and sibling incomplete-pair behavior.
- Added ten-body shared, desktop, and CLI tests and desktop picture-only incomplete test. Before implementation, the two new shared/desktop tests failed; `tmp/car6-r6/car6-f4-not-sampled-notes/02-pre-fix.log` records 20 pass, 2 fail.
- Focused plan gate passed: 23 tests, 0 failures; `tmp/car6-r6/car6-f4-not-sampled-notes/07-final-gate.log`.
- `bun run typecheck` failed in sibling `packages/core/src/capture/report.test.ts:55` (tuple inference); complete log `tmp/car6-r6/car6-f4-not-sampled-notes/06-typecheck.log`. That file is outside this plan's write scope. Re-run after its owner repairs it.
- Formal reviews and integration remain downstream.

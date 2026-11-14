# ipd-28 finish progress

Plan blob: `18b68a244aec5db883a3b6fb4ed4d5eea9917d5b`. Dependency `ipd-27-reproduction` is accepted by dispatch. The design verification and accepted output changes were reviewed.

`CARGO_TERM_QUIET=true mise run verify` exited 1; complete log: `tmp/ipd-s772/ipd-28-finish/final/verify.log`. Biome reports one formatting error in `packages/core/src/index.ts:897` on the app-design-lint export. The `ipd-00` baseline verify exited 0 with no exclusions, so this is a new failure. The affected file is outside this plan's write paths. Finding: `pending_downstream`; request the owning plan or integration reconciliation to format that export while preserving its behavior, then rerun the finish gates.

The verify task stopped before its test phase; no test count is available. The remaining finish gates, README completion entry, and design status change are pending. Do not mark the design implemented until gates pass. Formal reviews and plan archival remain downstream.

## Round 29 verification

Formatted `packages/core/src/index.ts` with `bunx biome format --write`; only the app-design-lint export was reformatted, including Biome's trailing comma. Pre/post hashes and the original content are in `tmp/ipd-s772/ipd-28-finish/final/`. The previous verify log is preserved under `attempt-round29/previous-final/`.

- `CARGO_TERM_QUIET=true mise run verify`: exit 1, 3663 pass, 73 skip, 2 fail, 2 errors; `final/verify.log`. Bun discovers copied scratch tests in `tmp/ipd-s772/ipd-21-html-prototype/edits/pre-format/`, whose relative imports fail. Baseline verify passed without exclusions. Finding `pending_downstream`: preserve the other plan's evidence and arrange for its copied tests to be excluded from discovery or safely relocated, then rerun the exact gate.
- `CARGO_TERM_QUIET=true mise run test-cli`: exit 0, 496 Bun pass, 0 fail, native tests passed; `final/test-cli.log`. Native parity was not skipped.
- `CARGO_TERM_QUIET=true mise run build-cli`: exit 0; `final/build-cli.log`.
- `bun run typecheck --pretty false`: exit 0; `final/typecheck.log`.
- Tracked and untracked tmp checks, privacy scan, license checks, and lockfile check: exit 0; separate logs in `final/`.
- Emoji positive control exit 0; 260 files scanned, no whitespace paths, scan exit 1 with empty output and stderr (gate exit 0); logs in `final/`.

The README completion entry and design status remain pending until all gates pass. Formal review, archival, and commit are downstream.

## Round 30 final gates

The previously applied formatting-only change is `packages/core/src/index.ts`.
`CARGO_TERM_QUIET=true mise run verify`: exit 0; Bun 3661 pass, 73 skip,
0 fail; Rust test groups also passed. `CARGO_TERM_QUIET=true mise run test-cli`:
exit 0; Bun 496 pass, 0 fail; native parity ran and passed.
`CARGO_TERM_QUIET=true mise run build-cli` and `bun run typecheck --pretty false`:
exit 0. Complete logs are in `tmp/ipd-s772/ipd-28-finish/final/`.
Tracked and untracked tmp checks, private-term scan, license checks and lockfile
check all exited 0. Emoji positive control exited 0; 260 paths were scanned,
with no whitespace paths and no findings (scanner exit 1, gate exit 0).

The accepted reproduction has zero hard findings; counts per screen, all within
4 points of reference: 01: 3; 02: 6; 03: 24; 04: 9; 05: 88; 06: 3;
07: 11; 08: 16; 09: 8; 10: 4. The visual checklist and intentional overlay
decisions are recorded in `impl-plans/progress/ipd-27-reproduction.md`.

Steps 1-8 passed; the README entry and design status are updated. Formal review,
archival and commit remain downstream.

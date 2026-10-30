# tll-13 native parity progress

Dependency tll-12 is accepted by dispatch. The plan matches the native CLI and test plan sections of design-text-layout-lint.md. Added the wide fixture import and one appended native parity block; existing blocks remain byte-unchanged. Ten comparisons cover lint, JSON lint and SVG export of all three fixtures and page-selected flowchart lint, including the required finding assertions.

Test file SHA-256 before: 57f297614ae69add54f36cf65cba87f85a706178036aaae65e9e3d1758b21a49; after: 65d7ebfa766dac3c8a59b71eb87f08605cd66a9b188e2697864b79f65925fc0b. Binary SHA-256: c9ad095e66686314483a605c9fa345062308ca561d1552e9a8cda0af6dcde09d. Toolchain: cargo 1.98.1 (797e8a9bc 2026-08-05), rustc 1.98.1 (48a229cea 2026-09-01), Bun 1.4.4, mise 2026.10.21.

Evidence directory: tmp/text-layout-lint-s556/tll-13-native-parity. Gate 1 mkdir, gates 2-3 parity-skip.log and skip-check.log, gates 4-5 test-cli.log and gate-5.log, gates 6-12 parity-native-retry.log, no-skip-retry.log, pass-retry.log, parity-new-retry.log, one-pass-retry.log, parity-new-junit-retry.log and junit-check-retry.log, and gates 13-16 artifact-sha256.txt, biome.log, lint-ts.log and native-boundary.log all exited 0. Additional bun run typecheck exited 0 (typecheck.log). test-cli: 172 pass, 0 fail; full parity: 17 pass, 0 fail, no skips; filtered parity: 1 pass, 0 fail. JUnit identifies the exact new test. Native boundary diff is empty.

Initial standalone parity runs timed out with killed child processes (parity-native.log: 13 pass, 4 fail; parity-new.log and parity-new-junit.log: 0 pass, 1 fail each). Source-unchanged retries passed; earlier complete logs and statuses.log are retained. Formal review and final archival remain downstream.

STATUS: done

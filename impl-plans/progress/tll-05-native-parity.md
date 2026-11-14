# tll-05-native-parity progress

Intent: add one binary-gated text-layout parity test for lint, SVG export,
and the dense native deadline, without changing existing tests or native code.
The accepted tll-03 and tll-04 dependencies were supplied in the dispatch.
The plan aligns with the native CLI and test-plan sections of the design.

- Source before: `c02f46c9685d0621f890196b31ce40b0ca97f569d28f6ef6b2b4572369e45f87`.
- Source after: `57f297614ae69add54f36cf65cba87f85a706178036aaae65e9e3d1758b21a49`.
- Intent and source snapshots: `tmp/text-layout-lint-s551/tll-05-native-parity/intent-source.txt`, `intent-fix.txt`, `intent-final-format.txt` and corresponding source snapshots.
- The plan described fixture objects with `.source`; the integrated builders return strings. The initial typecheck failure in `typecheck.log` was corrected and superseded by `typecheck-final2.log` (exit 0).
- Skip gate: `parity-skip-final2.log`, exit 0, 16 skipped, 0 failed.
- Native gate: `test-cli-final.log`, exit 0, 167 CLI tests passed, 0 failed. The separate `parity-native.log` verifies the named new test ran: 1 passed, 0 failed, 30 assertions, exit 0.
- `bunx biome check apps/cli/src/native-parity.test.ts`: exit 0, `biome-final2.log`.
- `bun run typecheck`: exit 0, `typecheck-final2.log`.
- Protected paths against a9728e6: exit 0, `protected.log`; native diff: exit 0, `native-diff.log`.
- Artifact digest manifest: `tmp/text-layout-lint-s551/tll-05-native-parity/artifact-sha256.txt`: `target/release/nodetto-cli` SHA256 `f5cfbb90002d8df506ae2b56a23cc23d4f895e3416edfcaea1699db1b4261790`.
- Toolchain (`toolchain.log`): cargo 1.98.1 (797e8a9bc 2026-08-05), rustc 1.98.1 (48a229cea 2026-09-01).
- Formal reviews and serial integration verification are downstream workflow steps.

STATUS: done
